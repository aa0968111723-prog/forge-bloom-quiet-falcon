import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  createCloudSaveController,
  memoryStorage,
  type CloudRevision,
  type SyncPlan,
} from "./client";

/**
 * Optional cloud-save controls for the Node app.
 * The static adventure entry does not import this, so offline play stays login-free.
 */
export function CloudSaveDock() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("訪客");
  const [plan, setPlan] = useState<SyncPlan | null>(null);
  const [revisions, setRevisions] = useState<CloudRevision[] | null>(null);
  const [headRevision, setHeadRevision] = useState<number | null>(null);
  const [note, setNote] = useState("尚未同步。本機進度不會自動上傳。");
  const controller = useMemo(
    () =>
      createCloudSaveController({
        fetch: (url, init) => fetch(url, { ...init, credentials: "include" }),
        storage: typeof window === "undefined" ? memoryStorage() : window.localStorage,
      }),
    [],
  );

  useEffect(() => {
    if (!controller.activeUser()) return;
    let cancel = false;
    void controller.flush().then(() => {
      if (cancel) return;
      void controller.plan().then((next) => {
        if (cancel) return;
        setPlan(next);
        if (next.status === "error" && next.code === "account_mismatch") setNote(next.message);
      });
    });
    return () => {
      cancel = true;
    };
  }, [controller]);

  async function refresh() {
    setPlan(await controller.plan());
  }

  async function signUp() {
    const response = await fetch("/api/auth/sign-up/email", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNote(body?.message || "註冊失敗。可先繼續本機遊玩。");
      return;
    }
    controller.bindAccount(body.user.id);
    const flushed = await controller.flush();
    setNote(
      flushed.sent > 0
        ? "已註冊，並送出這個帳號先前排好的上傳。"
        : "已登入。請選擇是否第一次上傳。",
    );
    await refresh();
  }

  async function signIn() {
    const response = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNote(body?.message || "登入失敗。本機進度仍在。");
      return;
    }
    controller.bindAccount(body.user.id);
    const flushed = await controller.flush();
    setNote(flushed.sent > 0 ? "已登入，並送出這個帳號先前排好的上傳。" : "已登入。");
    await refresh();
  }

  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
    controller.logout();
    setPlan(null);
    setRevisions(null);
    setHeadRevision(null);
    setNote("已登出。本機仍可遊玩。");
  }

  return (
    <aside style={panel}>
      <button type="button" style={toggle} onClick={() => setOpen((value) => !value)}>
        雲端同步（選配）
      </button>
      {open ? (
        <div>
          <p style={copy}>{note}</p>
          <label style={copy}>
            名稱
            <input style={field} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label style={copy}>
            信箱
            <input style={field} value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label style={copy}>
            密碼
            <input
              style={field}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <div style={row}>
            <button type="button" style={button} onClick={() => void signUp()}>
              註冊
            </button>
            <button type="button" style={button} onClick={() => void signIn()}>
              登入
            </button>
            <button type="button" style={button} onClick={() => void signOut()}>
              登出
            </button>
          </div>
          <div style={row}>
            <button type="button" style={button} onClick={() => void refresh()}>
              檢查雲端
            </button>
            <button
              type="button"
              style={button}
              onClick={() =>
                void controller.uploadLocal().then((result) => {
                  if (result.status === "uploaded") {
                    setNote(`已上傳。版本 ${result.revision}。`);
                    return;
                  }
                  if (result.status === "queued") {
                    setNote("目前離線。上傳已排入這個帳號，登入後會再送。");
                    return;
                  }
                  setPlan(result);
                  if (result.status === "in_sync") setNote("本機與雲端相同。");
                  else if (result.status === "conflict")
                    setNote("兩邊都有修改。請選擇要保留哪一份。");
                  else if (result.status === "need_download")
                    setNote("雲端有進度。請先選擇下載或保留本機。");
                  else if (result.status === "error") setNote(result.message);
                  else setNote(JSON.stringify(result));
                })
              }
            >
              上傳本機
            </button>
            <button
              type="button"
              style={button}
              onClick={() =>
                void controller.keepLocalOnly().then(() => setNote("保留本機，不上傳。"))
              }
            >
              先留在本機
            </button>
          </div>
          <div style={row}>
            <button
              type="button"
              style={button}
              onClick={() =>
                void controller.keepRemoteVersion().then((result) => {
                  if (result.status === "downloaded") {
                    setNote(`已下載雲端版本 ${result.revision}。`);
                    return;
                  }
                  setNote(
                    result.status === "error" ? result.message : "沒有下載雲端存檔。本機進度仍在。",
                  );
                })
              }
            >
              保留雲端版本
            </button>
            <button
              type="button"
              style={button}
              onClick={() =>
                void controller.keepLocalVersion().then((result) => setNote(JSON.stringify(result)))
              }
            >
              保留本機版本
            </button>
            <button
              type="button"
              style={button}
              onClick={() =>
                void controller.restorePrevious().then((result) => {
                  if (result.status === "restored") {
                    setNote(`已恢復上一份雲端版本。現在是版本 ${result.revision}。`);
                    return;
                  }
                  setPlan(result);
                  setNote(
                    result.status === "error" ? result.message : "沒有恢復雲端版本。本機進度仍在。",
                  );
                })
              }
            >
              恢復上一份雲端版本
            </button>
            <button
              type="button"
              style={button}
              onClick={() =>
                void controller.listRevisions().then((result) => {
                  if (result.status !== "ready") {
                    setRevisions(null);
                    setNote(
                      result.status === "error"
                        ? result.message
                        : "目前讀不到雲端版本。本機進度仍在。",
                    );
                    return;
                  }
                  setHeadRevision(result.headRevision);
                  setRevisions(result.revisions);
                  setNote(
                    result.revisions.some((item) => item.revision !== result.headRevision)
                      ? "可以選擇一份較早的雲端版本。"
                      : "沒有更早的雲端版本。",
                  );
                })
              }
            >
              查看雲端版本
            </button>
          </div>
          {revisions ? (
            <div style={row}>
              {revisions
                .filter((item) => item.revision !== headRevision)
                .map((item) => (
                  <button
                    key={item.revision}
                    type="button"
                    style={button}
                    onClick={() =>
                      void controller.restoreRevision(item.revision).then((result) => {
                        if (result.status === "restored") {
                          setNote(`已恢復版本 ${item.revision}。現在是版本 ${result.revision}。`);
                          setHeadRevision(result.revision);
                          return;
                        }
                        if (result.status !== "local_only") setPlan(result);
                        setNote(
                          result.status === "error"
                            ? result.message
                            : "沒有恢復雲端版本。本機進度仍在。",
                        );
                      })
                    }
                  >
                    恢復版本 {item.revision}
                  </button>
                ))}
            </div>
          ) : null}
          {plan ? <p style={copy}>狀態：{plan.status}</p> : null}
        </div>
      ) : null}
    </aside>
  );
}

const panel: CSSProperties = {
  position: "fixed",
  left: 12,
  bottom: 12,
  zIndex: 30,
  width: 280,
  maxHeight: "46vh",
  overflow: "auto",
  padding: 10,
  borderRadius: 12,
  background: "rgba(16, 47, 55, 0.92)",
  color: "#f4efe4",
};
const toggle: CSSProperties = {
  width: "100%",
  background: "transparent",
  color: "inherit",
  border: "1px solid rgba(244,239,228,0.4)",
  borderRadius: 8,
  padding: "6px 8px",
};
const copy: CSSProperties = { fontSize: 12, lineHeight: 1.4, margin: "8px 0" };
const field: CSSProperties = { width: "100%", marginTop: 4 };
const row: CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" };
const button: CSSProperties = {
  border: 0,
  borderRadius: 8,
  padding: "6px 8px",
  background: "#d7efe8",
  color: "#102f37",
};
