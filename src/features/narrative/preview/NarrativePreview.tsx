import { useEffect, useMemo, useState } from "react";
import {
  COLLEGES,
  DEPARTMENTS,
  departmentById,
  type CollegeId,
} from "../../../game/departments.ts";
import { loadCatalog } from "../load.ts";
import { validateCatalog } from "../validate.ts";
import {
  acknowledge,
  advanceMinutes,
  arrive,
  choose,
  configure,
  createPlay,
  leave,
  loadEnvelope,
  openingLine,
  suggest,
  talk,
  toEnvelope,
  visibleChoices,
} from "../play.ts";
import type { Play, TimeSlot, WeatherId } from "../types.ts";

const STORAGE_KEY = "tk-narrative-preview-fixture-v1";
const ZONES = [
  ["axis-54", "校門與宮燈"],
  ["library-55", "圖書館"],
  ["stem-56", "理工"],
  ["teaching-57", "文、外、商、教"],
  ["culture-58", "博物館與活動"],
  ["sports-59", "運動"],
  ["life-60", "宿舍與餐飲"],
] as const;

export function NarrativePreview() {
  const catalog = useMemo(() => loadCatalog(), []);
  const report = useMemo(() => validateCatalog(catalog), [catalog]);
  const [booting, setBooting] = useState(true);
  const [play, setPlay] = useState<Play>(() => createPlay("lantern-7"));
  const [seedDraft, setSeedDraft] = useState("lantern-7");
  const [problem, setProblem] = useState<string | null>(null);
  const [exportText, setExportText] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const loaded = loadEnvelope(JSON.parse(raw));
        if (loaded.ok) {
          setPlay(loaded.play);
          setSeedDraft(loaded.play.session.seed);
        } else {
          setProblem("這份測試進度版本不相容，已停止套用，沒有發放獎勵。");
        }
      }
    } catch {
      setProblem("測試進度讀不出來。可以重試，或捨棄後重開。");
    } finally {
      setBooting(false);
    }
  }, []);

  const suggestion = suggest(catalog, play);
  const chainDone = play.session.questNodes["quest-group-report"] === "done";
  const event = catalog.events.find((entry) => entry.id === play.ui.eventId);
  const choices = visibleChoices(catalog, play);
  const line = openingLine(catalog, play);

  function persist(next: Play) {
    setPlay(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toEnvelope(next)));
  }

  function go(placeId: string) {
    persist(arrive(catalog, play, placeId));
  }

  if (!report.ok) {
    return (
      <main className="min-h-dvh bg-navy-deep px-4 py-6 text-paper">
        <h1 className="font-display text-2xl">敘事預覽無法開始</h1>
        <p className="mt-2 text-base">內容驗證沒有通過。下面是錯誤，不會套用效果。</p>
        <ul className="mt-4 space-y-2 text-base">
          {report.errors.map((error) => (
            <li key={`${error.code}-${error.message}`}>
              {error.code}：{error.message}
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-navy-deep text-paper">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[16rem_minmax(0,1fr)_18rem]">
        <section className="tk-panel max-h-[70vh] overflow-auto rounded-2xl p-3 text-ink lg:max-h-[calc(100dvh-2rem)]">
          <h1 className="font-display text-xl">可走的地點</h1>
          <p className="mt-1 text-sm leading-6 text-muted">選一個地方。沒有事件也能離開。</p>
          {ZONES.map(([zone, label]) => (
            <div key={zone} className="mt-3">
              <h2 className="text-sm font-semibold">{label}</h2>
              <div className="mt-1 grid gap-1">
                {catalog.places
                  .filter(
                    (place) =>
                      place.zone === zone &&
                      (place.recordClass === "building" || place.recordClass === "landmark"),
                  )
                  .map((place) => (
                    <button
                      key={place.id}
                      type="button"
                      className="tk-btn tk-btn-ghost w-full justify-start text-left text-base"
                      onClick={() => go(place.id)}
                    >
                      {place.name}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <header className="rounded-2xl border border-white/15 p-4">
            <p className="text-sm tracking-widest">敘事預覽 · 非正式玩家介面</p>
            <p className="mt-2 text-base leading-7">
              訪客測試。這頁不讀登入，也不寫雲端存檔。正式校園畫面沒有這個測試面板。
            </p>
            <div className="mt-3 flex gap-3">
              <img src="/narrative/icons/lantern.svg" alt="" width="40" height="40" />
              <img src="/narrative/icons/notes.svg" alt="" width="40" height="40" />
              <img src="/narrative/icons/compass.svg" alt="繼續探索" width="40" height="40" />
            </div>
            <p className="mt-3 text-sm leading-6">
              概念插畫尚未生成，這裡不放假圖，也不把它說成實景照片或可走的 3D 場景。
            </p>
          </header>

          {booting ? <p className="text-base">正在讀取測試進度…</p> : null}
          {problem ? (
            <p className="rounded-xl bg-vermilion/20 p-3 text-base" role="alert">
              {problem}
            </p>
          ) : null}

          <article className="tk-panel rounded-2xl p-4 text-ink">
            <p className="text-sm text-muted">
              {play.session.placeId
                ? `現在：${catalog.places.find((place) => place.id === play.session.placeId)?.name}`
                : "還沒有選定地點"}
            </p>
            {chainDone ? (
              <p className="mt-3 text-base leading-7">
                這條三節點的樣板已經走完。你可以繼續換區，不會被對話鎖住。
              </p>
            ) : null}
            {suggestion ? (
              <button
                type="button"
                className="tk-btn tk-btn-primary mt-3 w-full text-base"
                onClick={() => {
                  const next = suggestion.timeOfDay
                    ? configure(play, { timeOfDay: suggestion.timeOfDay })
                    : play;
                  persist(arrive(catalog, next, suggestion.placeId));
                }}
              >
                {chainDone ? "另一區的事" : "樣板建議"}：{suggestion.reason}
              </button>
            ) : null}
            {play.ui.notice ? <p className="mt-3 text-base leading-7">{play.ui.notice}</p> : null}
            {play.ui.phase === "available" ? (
              <div className="mt-4 space-y-2">
                <p className="text-base leading-7">這裡有人。你可以交談，也可以先不談。</p>
                <button
                  type="button"
                  className="tk-btn tk-btn-primary w-full"
                  onClick={() => persist(talk(catalog, play))}
                >
                  交談
                </button>
                <button
                  type="button"
                  className="tk-btn tk-btn-ghost w-full"
                  onClick={() => persist(leave(catalog, play))}
                >
                  先不談，繼續走
                </button>
              </div>
            ) : null}
            {play.ui.phase === "talking" && event ? (
              <div className="mt-4 space-y-3">
                <p className="text-base leading-8">{line}</p>
                {choices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    className="tk-btn tk-btn-primary w-full text-left text-base"
                    onClick={() => persist(choose(catalog, play, choice.id).play)}
                  >
                    {choice.text["zh-Hant"]}
                  </button>
                ))}
                <button
                  type="button"
                  className="tk-btn tk-btn-ghost w-full"
                  onClick={() => persist(leave(catalog, play))}
                >
                  離開，不結算
                </button>
              </div>
            ) : null}
            {play.ui.phase === "outcome" ? (
              <div className="mt-4 space-y-3">
                <p className="text-base leading-8">{play.ui.outcome}</p>
                <button
                  type="button"
                  className="tk-btn tk-btn-primary w-full"
                  onClick={() => persist(acknowledge(play))}
                >
                  繼續自由探索
                </button>
              </div>
            ) : null}
          </article>

          <section className="rounded-2xl border border-white/15 p-3">
            <h2 className="text-base">時間、天氣、身份</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["morning", "afternoon", "evening", "night"] as TimeSlot[]).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className="tk-btn tk-btn-on-dark"
                  onClick={() => persist(configure(play, { timeOfDay: slot }))}
                >
                  {slot === "morning"
                    ? "早上"
                    : slot === "afternoon"
                      ? "下午"
                      : slot === "evening"
                        ? "傍晚"
                        : "晚上"}
                </button>
              ))}
              {(["clear", "rain", "dusk"] as WeatherId[]).map((weather) => (
                <button
                  key={weather}
                  type="button"
                  className="tk-btn tk-btn-on-dark"
                  onClick={() => persist(configure(play, { weather }))}
                >
                  {weather === "clear" ? "晴" : weather === "rain" ? "雨" : "暮"}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-sm">
                學院
                <select
                  className="mt-1 w-full min-h-11 rounded-lg bg-paper px-2 text-base text-ink"
                  value={play.session.collegeId ?? ""}
                  onChange={(event) => {
                    const collegeId = (event.target.value || null) as CollegeId | null;
                    const current = departmentById(play.session.departmentId);
                    persist(
                      configure(play, {
                        collegeId,
                        departmentId:
                          current && current.collegeId === collegeId ? current.id : null,
                      }),
                    );
                  }}
                >
                  <option value="">尚未選擇</option>
                  {COLLEGES.map((college) => (
                    <option key={college.id} value={college.id}>
                      {college.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                科系
                <select
                  className="mt-1 w-full min-h-11 rounded-lg bg-paper px-2 text-base text-ink"
                  value={play.session.departmentId ?? ""}
                  onChange={(event) =>
                    persist(configure(play, { departmentId: event.target.value || null }))
                  }
                >
                  <option value="">尚未選擇</option>
                  {DEPARTMENTS.filter(
                    (department) => department.collegeId === play.session.collegeId,
                  ).map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="tk-btn tk-btn-on-dark"
                onClick={() => persist(advanceMinutes(play, 30))}
              >
                測試時間加 30 分鐘
              </button>
              <label className="text-sm">
                seed
                <input
                  className="ml-2 min-h-11 rounded-lg bg-paper px-2 text-base text-ink"
                  value={seedDraft}
                  onChange={(event) => setSeedDraft(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="tk-btn tk-btn-on-dark"
                onClick={() => {
                  setPlay(createPlay(seedDraft || "lantern-7"));
                  setProblem(null);
                }}
              >
                用這個 seed 重開
              </button>
            </div>
          </section>
        </section>

        <aside className="tk-panel max-h-[70vh] overflow-auto rounded-2xl p-3 text-ink lg:max-h-[calc(100dvh-2rem)]">
          <h2 className="font-display text-xl">測試狀態面板</h2>
          <p className="mt-1 text-sm leading-6">
            只存在這個預覽頁。同步狀態：未同步，local-fixture-only。
          </p>
          <dl className="mt-3 space-y-1 text-sm leading-6">
            <div>seed：{play.session.seed}</div>
            <div>分鐘：{play.session.minute}</div>
            <div>天氣：{play.session.weather}</div>
            <div>時段：{play.session.timeOfDay}</div>
            <div>經驗：{play.growth.xp}</div>
            <div>筆記：{play.growth.materials.notes}</div>
            <div>學分：{play.growth.materials.credit}</div>
            <div>已結算：{play.growth.claimedQuests.join("、") || "無"}</div>
            <div>旗標：{Object.keys(play.session.flags).join("、") || "無"}</div>
            <div>
              任務節點：
              {Object.entries(play.session.questNodes)
                .map(([id, node]) => `${id}:${node}`)
                .join("、") || "無"}
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="tk-btn tk-btn-ghost" onClick={() => persist(play)}>
              保存測試進度
            </button>
            <button
              type="button"
              className="tk-btn tk-btn-ghost"
              onClick={() => {
                try {
                  const raw = localStorage.getItem(STORAGE_KEY);
                  if (!raw) {
                    setProblem("沒有已保存的測試進度。");
                    return;
                  }
                  const loaded = loadEnvelope(JSON.parse(raw));
                  if (!loaded.ok) {
                    setProblem("這份測試進度版本不相容，已停止套用，沒有發放獎勵。");
                    return;
                  }
                  setPlay(loaded.play);
                  setProblem(null);
                } catch {
                  setProblem("測試進度讀不出來。可以重試，或捨棄後重開。");
                }
              }}
            >
              恢復
            </button>
            <button
              type="button"
              className="tk-btn tk-btn-ghost"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                const next = createPlay(seedDraft || "lantern-7");
                setPlay(next);
                setProblem(null);
              }}
            >
              捨棄不相容進度
            </button>
          </div>
          <label className="mt-3 block text-sm">
            匯出或貼上進度以重現問題
            <textarea
              className="mt-1 h-28 w-full rounded-lg border border-line p-2 text-xs"
              value={exportText}
              onChange={(event) => setExportText(event.target.value)}
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="tk-btn tk-btn-ghost"
              onClick={() => setExportText(JSON.stringify(toEnvelope(play)))}
            >
              寫入目前進度
            </button>
            <button
              type="button"
              className="tk-btn tk-btn-ghost"
              onClick={() => {
                try {
                  const loaded = loadEnvelope(JSON.parse(exportText));
                  if (!loaded.ok) {
                    setProblem("貼上的進度版本不相容，已停止套用，沒有發放獎勵。");
                    return;
                  }
                  persist(loaded.play);
                  setProblem(null);
                } catch {
                  setProblem("貼上的內容不是這份測試進度。");
                }
              }}
            >
              載入貼上的進度
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
