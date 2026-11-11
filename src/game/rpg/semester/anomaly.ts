import { createSimClock, type SimClock } from "../physics/index.ts";

const PERIOD_STEPS = 300 * 60;
const ACTIVE_STEPS = 60 * 60;
const OMEN_STEPS = 10 * 60;

export const ANOMALY_SCRIPT = {
  deadline: {
    id: "deadline",
    omen: "截止日前兆：交卷鐘聲變近。",
    activeLabel: "截止日異象",
    restore: "截止日結束：節奏恢復。",
    seconds: 60,
  },
  blackout: {
    id: "blackout",
    omen: "停電前兆：宮燈逐盞轉暗。",
    activeLabel: "停電異象",
    restore: "停電結束：宮燈重新點亮。",
    seconds: 60,
  },
} as const;

export type AnomalyId = keyof typeof ANOMALY_SCRIPT;
export type AnomalyStage = "quiet" | "omen" | "active";

export type AnomalyView = {
  stage: AnomalyStage;
  script: AnomalyId;
  occurrence: number;
  remainingSteps: number;
};

export type AnomalyNotice = { id: string; text: string };

export type AnomalySim = {
  clock: SimClock;
  paused: boolean;
  held: boolean;
  simSteps: number;
  stage: AnomalyStage;
  script: AnomalyId;
  remainingSteps: number;
  banner: string;
  notices: AnomalyNotice[];
  sent: Set<string>;
};

/** Pure phase from a fixed-step count. The stepper and the tests share this. */
export function anomalyAt(simSteps: number): AnomalyView {
  const steps = Math.max(0, simSteps);
  const occurrence = Math.floor(steps / PERIOD_STEPS);
  const cycle = steps % PERIOD_STEPS;
  const script: AnomalyId = occurrence % 2 === 0 ? "deadline" : "blackout";
  const activeStart = PERIOD_STEPS - ACTIVE_STEPS;
  const omenStart = activeStart - OMEN_STEPS;
  if (cycle >= omenStart && cycle < activeStart) {
    return { stage: "omen", script, occurrence, remainingSteps: activeStart - cycle };
  }
  if (cycle >= activeStart) {
    return { stage: "active", script, occurrence, remainingSteps: PERIOD_STEPS - cycle };
  }
  return { stage: "quiet", script, occurrence, remainingSteps: 0 };
}

export function anomalyBanner(view: AnomalyView): string {
  const script = ANOMALY_SCRIPT[view.script];
  if (view.stage === "omen") return script.omen;
  if (view.stage === "active") {
    const seconds = Math.ceil(view.remainingSteps / 60);
    return `${script.activeLabel}：剩餘 ${seconds} 秒`;
  }
  return "";
}

function once(state: AnomalySim, id: string, text: string) {
  if (state.sent.has(id)) return;
  state.sent.add(id);
  state.notices.push({ id, text });
}

export function createAnomaly(): AnomalySim {
  const view = anomalyAt(0);
  return {
    clock: createSimClock(),
    paused: false,
    held: false,
    simSteps: 0,
    stage: view.stage,
    script: view.script,
    remainingSteps: 0,
    banner: "",
    notices: [],
    sent: new Set(),
  };
}

function advance(state: AnomalySim) {
  const prev = anomalyAt(state.simSteps);
  state.simSteps += 1;
  const next = anomalyAt(state.simSteps);
  state.stage = next.stage;
  state.script = next.script;
  state.remainingSteps = next.remainingSteps;
  if (prev.stage !== "omen" && next.stage === "omen") {
    once(state, `${next.script}:${next.occurrence}:omen`, ANOMALY_SCRIPT[next.script].omen);
  }
  if (prev.stage !== "active" && next.stage === "active") {
    once(state, `${next.script}:${next.occurrence}`, ANOMALY_SCRIPT[next.script].activeLabel);
  }
  if (prev.stage === "active" && next.stage !== "active") {
    once(state, `${prev.script}:${prev.occurrence}:restore`, ANOMALY_SCRIPT[prev.script].restore);
    state.banner = ANOMALY_SCRIPT[prev.script].restore;
    return;
  }
  state.banner = anomalyBanner(next);
}

/** Pause returns 0 and does not move the countdown. */
export function stepAnomaly(state: AnomalySim, frameDt: number): number {
  if (state.paused) {
    if (!state.held) {
      state.clock.pause();
      state.held = true;
    }
    return 0;
  }
  if (state.held) {
    state.clock.resume();
    state.held = false;
  }
  const steps = state.clock.step(frameDt);
  for (let i = 0; i < steps; i += 1) advance(state);
  return steps;
}
