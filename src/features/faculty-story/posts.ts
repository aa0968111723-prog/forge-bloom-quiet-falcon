import { CAMPUS_SITES, siteEntrance, SUPPLY_NODES } from "../../game/rpg/campus.ts";
import { zoneOfPermanentId } from "../../game/world-data/registry/index.ts";
import type { ContentZone } from "../narrative/types.ts";
import { FACULTY_CAST, type FacultyPerson } from "./cast.ts";

/** Talk range. Building doors use 5 m, so a post this close would steal the door. */
export const FACULTY_REACH = 3.6;

export type FacultyPost = FacultyPerson & {
  placeId: string;
  x: number;
  z: number;
  doorX: number;
  doorZ: number;
  zone: ContentZone;
};

export function facultyPosts(): FacultyPost[] {
  return FACULTY_CAST.map((person) => {
    const site = CAMPUS_SITES.find((entry) => entry.id === person.siteId);
    if (!site) throw new Error(`faculty site missing: ${person.siteId}`);
    const door = siteEntrance(site);
    const zone = zoneOfPermanentId(site.id);
    if (!zone) throw new Error(`faculty site has no zone: ${person.siteId}`);
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

export function nearestFacultyPost(
  x: number,
  z: number,
  posts: readonly FacultyPost[] = facultyPosts(),
): FacultyPost | null {
  let best: FacultyPost | null = null;
  let bestDistance = FACULTY_REACH;
  for (const post of posts) {
    const distance = Math.hypot(post.x - x, post.z - z);
    if (distance < bestDistance) {
      best = post;
      bestDistance = distance;
    }
  }
  return best;
}

export function supplyDistance(post: FacultyPost): number {
  let best = Infinity;
  for (const node of SUPPLY_NODES) {
    best = Math.min(best, Math.hypot(node.x - post.x, node.z - post.z));
  }
  return best;
}
