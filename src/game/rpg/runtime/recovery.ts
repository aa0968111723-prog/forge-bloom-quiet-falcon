export const RECOVERY_STATES = ["idle", "failed", "retrying", "restored", "stuck"] as const;

export type RecoveryState = (typeof RECOVERY_STATES)[number];

export const FAILURE_KINDS = ["slow-network", "missing-asset", "webgl-lost", "storage-denied"] as const;

export type FailureKind = (typeof FAILURE_KINDS)[number];

export type ResourceCounts = {
  listeners: number;
  audio: number;
  canvas: number;
};

export type RecoveryInit = {
  progressCode: string;
  listeners: number;
  audio: number;
  canvas: number;
};

export type Recovery = {
  readonly state: RecoveryState;
  readonly progressCode: string;
  readonly kind: FailureKind | null;
  readonly message: string;
  readonly nextStep: string;
  readonly saveAccepted: boolean;
  readonly backupAvailable: boolean;
  readonly counts: ResourceCounts;
  readonly baseline: ResourceCounts;
  readonly history: readonly RecoveryState[];
  fail(kind: FailureKind): void;
  retry(outcome?: { ok?: boolean }): void;
  reportSaveSuccess(): boolean;
};

/**
 * Loading can stall without taking control away.
 * The message is the player-facing error; operable stays true.
 */
export const LOAD_STALL = {
  stalled: true,
  operable: true,
  message: "載入停滯，已進入的區域仍可操作。",
} as const;

/**
 * Documents the existing save contract. This module does not write the save file.
 * storage-denied must not replace the progress code, and no login is required.
 */
export const PROGRESS_SPEC = {
  saveVersion: 2,
  loginRequired: false,
  storageDeniedOverwritesProgress: false,
} as const;

const FAILURE_COPY: Record<FailureKind, { message: string; nextStep: string }> = {
  "slow-network": {
    message: "網路過慢，場景資源還沒到齊。",
    nextStep: "請先留在已可操作的區域，稍後再重試載入。",
  },
  "missing-asset": {
    message: "必要資源遺失，這一段場景無法完整顯示。",
    nextStep: "請重試載入。若仍然失敗，請從備份入口回到原進度。",
  },
  "webgl-lost": {
    message: "WebGL 上下文已遺失，畫面先暫停。",
    nextStep: "請重試，以清掉失效的畫布、監聽與音效後重建。碰撞與戰鬥判定不會被關閉。",
  },
  "storage-denied": {
    message: "儲存被拒絕，原進度沒有被覆蓋。",
    nextStep: "進度代號維持不變。請使用備份入口，這次不能回報保存成功。",
  },
};

/**
 * Tracks failure and cleanup only.
 * Handle counts are bookkeeping for listeners, audio, and canvas, not frame timings.
 * A failed retry enters stuck and cannot report a successful save.
 */
export function createRecovery(init: RecoveryInit): Recovery {
  const progressCode = requireProgressCode(init.progressCode);
  let live = {
    listeners: requireCount("listeners", init.listeners),
    audio: requireCount("audio", init.audio),
    canvas: requireCount("canvas", init.canvas),
  };
  let baseline = cloneCounts(live);
  let state: RecoveryState = "idle";
  let kind: FailureKind | null = null;
  let message = "";
  let nextStep = "";
  let saveAccepted = false;
  const history: RecoveryState[] = ["idle"];

  function enter(next: RecoveryState) {
    state = next;
    history.push(next);
  }

  function refuseSave() {
    saveAccepted = false;
    return false;
  }

  return {
    get state() {
      return state;
    },
    get progressCode() {
      return progressCode;
    },
    get kind() {
      return kind;
    },
    get message() {
      return message;
    },
    get nextStep() {
      return nextStep;
    },
    get saveAccepted() {
      return saveAccepted;
    },
    get backupAvailable() {
      return true;
    },
    get counts() {
      return cloneCounts(live);
    },
    get baseline() {
      return cloneCounts(baseline);
    },
    get history() {
      return [...history];
    },
    fail(nextKind: FailureKind) {
      if (!isFailureKind(nextKind)) throw new Error(`unknown failure: ${String(nextKind)}`);
      if (state === "stuck") {
        refuseSave();
        return;
      }
      if (state === "failed") {
        kind = nextKind;
        message = `${FAILURE_COPY[nextKind].message}連續失敗仍未恢復。`;
        nextStep = "已停止自動復原。原進度未改寫，不可回報保存成功，請改走備份入口。";
        enter("stuck");
        refuseSave();
        return;
      }
      kind = nextKind;
      baseline = cloneCounts(live);
      live = {
        listeners: baseline.listeners + 1,
        audio: baseline.audio + 1,
        canvas: baseline.canvas + 1,
      };
      message = FAILURE_COPY[nextKind].message;
      nextStep = FAILURE_COPY[nextKind].nextStep;
      enter("failed");
      refuseSave();
    },
    retry(outcome?: { ok?: boolean }) {
      if (state === "stuck") {
        refuseSave();
        return;
      }
      if (state !== "failed") throw new Error("retry requires a failure");
      enter("retrying");
      const ok = outcome?.ok !== false;
      if (!ok) {
        const reason = kind ? FAILURE_COPY[kind].message : "";
        message = `${reason}連續重試仍然失敗。`;
        nextStep = "已停止自動復原。原進度未改寫，不可回報保存成功，請改走備份入口。";
        enter("stuck");
        refuseSave();
        return;
      }
      live = cloneCounts(baseline);
      if (kind === "storage-denied") {
        message = "已恢復可操作狀態，畫布、監聽與音效已回到失敗前。儲存仍被拒絕，原進度未覆蓋。";
        nextStep = "進度代號與失敗前相同。請使用備份入口，系統不會回報保存成功。";
      } else {
        message = "已恢復。畫布、監聽與音效計數已回到進入失敗前的基線。";
        nextStep = "原進度與備份入口都還在。這次復原不是存檔成功。";
      }
      enter("restored");
      refuseSave();
    },
    reportSaveSuccess() {
      if (state === "stuck" || kind === "storage-denied") return refuseSave();
      return refuseSave();
    },
  };
}

function requireProgressCode(value: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error("progressCode is required");
  return value;
}

function requireCount(name: string, value: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer handle count`);
  }
  return value;
}

function cloneCounts(counts: ResourceCounts): ResourceCounts {
  return { listeners: counts.listeners, audio: counts.audio, canvas: counts.canvas };
}

function isFailureKind(value: unknown): value is FailureKind {
  return typeof value === "string" && (FAILURE_KINDS as readonly string[]).includes(value);
}
