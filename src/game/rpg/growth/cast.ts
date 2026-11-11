import { COLLEGE_IDS, type CollegeId } from "../../departments.ts";
import { COLLEGE_ABILITIES } from "./abilities.ts";
import type { CastPhase, CastTemplate } from "./types.ts";

/** Shared particle cap for every cast template. Not the backpack size. */
export const CAST_PARTICLE_BUDGET = 24;

export const CAST_PHASES = [
  "ready",
  "release",
  "range",
  "hit",
  "miss",
  "blocked",
  "recover",
] as const satisfies readonly CastPhase[];

const PHASE_PARTICLES: Record<CastPhase, number> = {
  ready: 3,
  release: 10,
  range: 8,
  hit: 16,
  miss: 5,
  blocked: 7,
  recover: 2,
};

const PHASE_LABEL: Record<CastPhase, string> = {
  ready: "預備",
  release: "出手",
  range: "有效範圍",
  hit: "命中",
  miss: "落空",
  blocked: "遮擋",
  recover: "收尾",
};

/** Enemy telegraph stays above skill particles. Particles cannot turn it off. */
export const ENEMY_CAST_WARNING = {
  flag: true as const,
  text: "即將攻擊 · 離開紅色範圍",
  layer: "above-effects" as const,
  suppressedByParticles: false as const,
  readable: true as const,
};

export type CastOptions = {
  reducedMotion?: boolean;
  muted?: boolean;
  quality?: "low" | "high";
};

export type CastBeat = {
  abilityId: string;
  phase: CastPhase;
  template: CastTemplate | null;
  colorName: string;
  particles: number;
  particleBudget: number;
  soundId: string | null;
  caption: string;
  staticMark: "靜態" | null;
  flash: false;
  quality: "low" | "high";
  enemyWarning: typeof ENEMY_CAST_WARNING;
};

function isCollege(id: string): id is CollegeId {
  return (COLLEGE_IDS as readonly string[]).includes(id);
}

function isPhase(phase: string): phase is CastPhase {
  return (CAST_PHASES as readonly string[]).includes(phase);
}

function particleCount(phase: CastPhase, quality: "low" | "high", reducedMotion: boolean) {
  if (reducedMotion) return 0;
  const base = PHASE_PARTICLES[phase];
  const scaled = quality === "low" ? Math.max(1, Math.floor(base / 2)) : base;
  return Math.min(CAST_PARTICLE_BUDGET, scaled);
}

export function castBeat(abilityId: string, phase: CastPhase, options: CastOptions = {}): CastBeat {
  const reducedMotion = options.reducedMotion === true;
  const muted = options.muted === true;
  const quality = options.quality === "low" ? "low" : "high";
  const knownPhase = isPhase(phase) ? phase : "recover";
  const ability = isCollege(abilityId) ? COLLEGE_ABILITIES[abilityId] : null;
  const particles = ability ? particleCount(knownPhase, quality, reducedMotion) : 0;
  const soundId =
    muted || !ability || knownPhase === "recover" ? null : `cast-${ability.type}-${knownPhase}`;
  const title = ability ? ability.skill : "未知能力";
  const bits = [title, PHASE_LABEL[knownPhase]];
  if (reducedMotion) bits.push("靜態");
  if (muted) bits.push("靜音");
  return {
    abilityId,
    phase: knownPhase,
    template: ability ? ability.type : null,
    colorName: ability ? ability.colorName : "灰",
    particles,
    particleBudget: CAST_PARTICLE_BUDGET,
    soundId,
    caption: bits.join(" · "),
    staticMark: reducedMotion ? "靜態" : null,
    flash: false,
    quality,
    enemyWarning: ENEMY_CAST_WARNING,
  };
}

export function overlapCasts(beats: readonly CastBeat[]) {
  const sum = beats.reduce((total, beat) => total + beat.particles, 0);
  return {
    particles: Math.min(CAST_PARTICLE_BUDGET, sum),
    particleBudget: CAST_PARTICLE_BUDGET,
    clamped: sum > CAST_PARTICLE_BUDGET,
    enemyWarning: ENEMY_CAST_WARNING,
    phases: beats.map((beat) => beat.phase),
  };
}

/** Leaving the scene drops the burst. The enemy warning layer stays. */
export function sceneCut(beat: CastBeat): CastBeat {
  return {
    ...beat,
    phase: "recover",
    particles: 0,
    soundId: null,
    caption: `${beat.caption} · 切場收尾`,
    flash: false,
    enemyWarning: ENEMY_CAST_WARNING,
  };
}
