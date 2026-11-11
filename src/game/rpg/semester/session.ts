import type { QualityTier } from "../../quality.ts";
import { TIME_PRESETS, type TimeOfDay } from "../../world-data/lighting.ts";
import { APPEARANCE, resolveAppearance, type AppearanceId } from "./appearance.ts";
import { createAnomaly, stepAnomaly, type AnomalySim } from "./anomaly.ts";
import { createEncounter, stepEncounter, type EncounterSim } from "./encounter.ts";
import { CHAPTERS, createStory, storyPins, type StoryState } from "./story.ts";

export type Session = {
  story: StoryState;
  encounter: EncounterSim;
  anomaly: AnomalySim;
  paused: boolean;
  timeOfDay: TimeOfDay;
  interiorId: string | null;
  appearanceId: AppearanceId;
  quality: QualityTier;
  clockSkew: boolean;
};

export function createSession(encounter?: EncounterSim): Session {
  const fight = encounter ?? createEncounter();
  return {
    story: createStory(),
    encounter: fight,
    anomaly: createAnomaly(),
    paused: false,
    timeOfDay: "day",
    interiorId: fight.player.interiorId,
    appearanceId: APPEARANCE[0].id,
    quality: "high",
    clockSkew: false,
  };
}

export function setSessionPaused(session: Session, paused: boolean) {
  session.paused = paused;
  session.encounter.paused = paused;
  session.anomaly.paused = paused;
}

/** Same frame dt for the anomaly clock and the encounter clock. */
export function stepSession(session: Session, frameDt: number): number {
  const anomalySteps = stepAnomaly(session.anomaly, frameDt);
  session.encounter.anomaly =
    session.anomaly.stage === "active" ? session.anomaly.script : "quiet";
  const encounterSteps = stepEncounter(session.encounter, frameDt);
  if (anomalySteps !== encounterSteps) session.clockSkew = true;
  return encounterSteps;
}

export function setSessionTime(session: Session, timeOfDay: TimeOfDay) {
  session.timeOfDay = timeOfDay;
}

export function setSessionInterior(session: Session, id: string | null) {
  session.interiorId = id;
  session.encounter.player.interiorId = id;
}

export function setSessionAppearance(session: Session, id: string, quality: QualityTier) {
  session.quality = quality;
  session.appearanceId = resolveAppearance(id, quality);
}

export function sessionLight(session: Session) {
  const preset = TIME_PRESETS[session.timeOfDay];
  const blackout = session.anomaly.stage === "active" && session.anomaly.script === "blackout";
  return {
    label: preset.label,
    sun: preset.sun,
    lampsOn: blackout ? false : preset.lampsOn,
  };
}

export type SessionView = {
  steps: number;
  anomalySteps: number;
  attackReadyStep: number;
  chapterId: string;
  pins: string[];
  timeOfDay: TimeOfDay;
  light: string;
  lampsOn: boolean;
  interiorId: string | null;
  appearanceId: string;
  quality: QualityTier;
  paused: boolean;
  hp: number;
  clockSkew: boolean;
};

export function viewSession(session: Session): SessionView {
  const light = sessionLight(session);
  const chapter = CHAPTERS[session.story.chapterIndex] ?? CHAPTERS[0];
  return {
    steps: session.encounter.steps,
    anomalySteps: session.anomaly.simSteps,
    attackReadyStep: session.encounter.player.attackReadyStep,
    chapterId: chapter.id,
    pins: storyPins(session.story),
    timeOfDay: session.timeOfDay,
    light: light.label,
    lampsOn: light.lampsOn,
    interiorId: session.interiorId,
    appearanceId: session.appearanceId,
    quality: session.quality,
    paused: session.paused,
    hp: session.encounter.player.hp,
    clockSkew: session.clockSkew,
  };
}

/** Resize / reflow reads the same clock, light, attack, chapter and pins. */
export function reflowSession(session: Session): SessionView {
  return viewSession(session);
}
