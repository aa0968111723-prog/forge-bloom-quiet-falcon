import { choicesFor, eventLine } from "./narrative-bridge.ts";
import { useRpg } from "./store";

/** Campus dialogue. Rewards are applied by the store, not by this panel. */
export function NarrativePanel() {
  const narrative = useRpg((s) => s.narrative);
  const ui = useRpg((s) => s.narrativeUi);
  if (!ui || ui.phase === "exploring") {
    return <p className="ad-empty">這裡目前沒有人要說的話。你可以繼續走。</p>;
  }
  const play = { session: narrative, growth: null as never, ui };
  const line = eventLine(ui.eventId, narrative);
  const choices = ui.phase === "talking" ? choicesFor(play) : [];
  return (
    <div className="space-y-3">
      {line ? <p className="ad-lead">{line}</p> : null}
      {ui.notice ? <p className="ad-lead">{ui.notice}</p> : null}
      {ui.outcome ? <p className="ad-lead">{ui.outcome}</p> : null}
      {ui.phase === "available" ? (
        <>
          <button className="ad-primary ad-raise" type="button" onClick={() => useRpg.getState().narrativeTalk()}>
            交談
          </button>
          <button className="ad-primary ad-raise" type="button" onClick={() => useRpg.getState().narrativeEnter()}>
            先進入，晚點再談
          </button>
          <button className="ad-primary ad-raise" type="button" onClick={() => useRpg.getState().narrativeDismiss()}>
            先不談
          </button>
        </>
      ) : null}
      {ui.phase === "talking"
        ? choices.map((choice) => (
            <button
              key={choice.id}
              className="ad-primary ad-raise"
              type="button"
              onClick={() => useRpg.getState().narrativeChoose(choice.id)}
            >
              {choice.text["zh-Hant"]}
            </button>
          ))
        : null}
      {ui.phase === "talking" ? (
        <button className="ad-primary ad-raise" type="button" onClick={() => useRpg.getState().narrativeDismiss()}>
          離開，不結算
        </button>
      ) : null}
      {ui.phase === "outcome" ? (
        <button className="ad-primary ad-raise" type="button" onClick={() => useRpg.getState().narrativeDismiss()}>
          繼續自由探索
        </button>
      ) : null}
    </div>
  );
}
