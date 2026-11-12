import { CAMPUS_SITES, siteEntrance } from "../../game/rpg/campus.ts";
import { zoneOfPermanentId } from "../../game/world-data/registry/index.ts";
import type { ContentZone } from "../narrative/types.ts";
import { PSYCH_CAST, type PsychPerson } from "./cast.ts";

/** Same reach as a faculty post, so a door at 5 m is not stolen. */
export const PSYCH_REACH = 3.6;

export type PsychPost = PsychPerson & {
  placeId: string;
  x: number;
  z: number;
  doorX: number;
  doorZ: number;
  zone: ContentZone;
};

export function psychPosts(): PsychPost[] {
  return PSYCH_CAST.map((person) => {
    const site = CAMPUS_SITES.find((entry) => entry.id === person.siteId);
    if (!site) throw new Error(`psych site missing: ${person.siteId}`);
    const door = siteEntrance(site);
    const zone = zoneOfPermanentId(site.id);
    if (!zone) throw new Error(`psych site has no zone: ${person.siteId}`);
    return {
      ...person,
      placeId: `post-${person.id.slice("npc-".length)}`,
      x: door.x + person.dx,
      z: door.z + person.dz,
      doorX: door.x,
      doorZ: door.z,
      zone: zone as ContentZone,
    };
  });
}

export function nearestPsychPost(
  x: number,
  z: number,
  posts: readonly PsychPost[] = psychPosts(),
): PsychPost | null {
  let best: PsychPost | null = null;
  let bestDistance = PSYCH_REACH;
  for (const post of posts) {
    const distance = Math.hypot(post.x - x, post.z - z);
    if (distance < bestDistance) {
      best = post;
      bestDistance = distance;
    }
  }
  return best;
}
