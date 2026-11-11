import { Component, type ReactNode } from "react";
import { artFailures } from "./assets";

type Props = {
  id: string;
  /** What to draw instead; must not depend on the asset that failed. */
  fallback: ReactNode;
  /** Shown to the player once, e.g. through the game's notice line. */
  onFail?: (message: string) => void;
  children: ReactNode;
};

/**
 * Catches a failed art load (missing file, bad GLB, network error) and keeps
 * the game running on a stated fallback instead of a blank canvas.
 */
export class ArtBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[art] ${this.props.id} failed to load: ${detail}`);
    artFailures.push({ id: this.props.id, message: detail });
    this.props.onFail?.(`美術資產「${this.props.id}」載入失敗，已改用備用外形。`);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
