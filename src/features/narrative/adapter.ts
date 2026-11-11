import type { GrowthState } from "../../game/rpg/growth/types.ts";
import { applyEffects } from "./effects.ts";
import type { Catalog, Effect, NarrativeSession } from "./types.ts";

/** False until AdventureApp, the scene, and the campus save actually call this module. */
export const MAIN_INTEGRATION = false;

export type IntegrationStatus = {
  integrated: false;
  surface: "preview-only";
  sync: "local-fixture-only";
};

export function integrationStatus(): IntegrationStatus {
  return { integrated: false, surface: "preview-only", sync: "local-fixture-only" };
}

/**
 * Whitelist entry for a later scene hook.
 * It does not write HP, the inventory store, or the cloud save.
 * Calling it does not mark the main game integrated.
 */
export function applyNarrativeReward(
  catalog: Catalog,
  growth: GrowthState,
  session: NarrativeSession,
  effects: readonly Effect[],
) {
  return applyEffects(catalog, growth, session, effects);
}
