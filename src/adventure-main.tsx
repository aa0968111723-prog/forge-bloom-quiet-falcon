import { Component, Suspense, lazy, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./game/rpg/adventure.css";
const Game = lazy(() => import("./game/rpg/AdventureApp"));
class GameBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="ad-loading">
        <h1>世界暫時無法載入</h1>
        <p>請確認網路與瀏覽器的硬體加速，再重新載入。已保存的進度會保留。</p>
        <button onClick={() => location.reload()}>重新載入</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("app")!).render(
  <GameBoundary>
    <Suspense
      fallback={
        <div className="ad-loading">
          <span>TKU / NEW SEMESTER</span>
          <h1>準備前往五虎崗</h1>
          <p>正在載入校園與遊戲系統…</p>
        </div>
      }
    >
      <Game />
    </Suspense>
  </GameBoundary>,
);
