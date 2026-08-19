import { AXIS } from "../axis.ts";
import { sampleGroundElevation } from "../elevation.ts";
import type { Accuracy } from "../origin.ts";

/**
 * Structures outside the Reality Pass v1 corridor.
 *
 * These were kept from the pre-v1 scene and only *re-seated* onto the new
 * real-scale ground, because leaving them at their old coordinates would have
 * dropped them inside 宮燈大道. Their positions are plausible relative to the
 * corridor and nothing more: every record here is `estimated` and carries
 * REF_SECONDARY_ZONE_PLACEHOLDER. Calibrating the north and east campus is
 * explicitly future work, not v1.
 */
export type SecondaryStructure = {
  id: string;
  name: string;
  /** Centre in world XZ. */
  position: [number, number];
  /** width (X) × height (Y) × depth (Z), metres. */
  size: [number, number, number];
  rotationY: number;
  floors?: number;
  kind: "hip-roof-block" | "slab-block" | "hall" | "pavilion" | "court" | "ship";
  accuracy: Accuracy;
  referenceIds: string[];
};

const REF = ["REF_SECONDARY_ZONE_PLACEHOLDER"];

export const SECONDARY_STRUCTURES: SecondaryStructure[] = [
  {
    id: "chingsheng-building",
    name: "驚聲大樓",
    position: [-52, AXIS.scrollPlazaZ - 4],
    size: [30, 30, 24],
    rotationY: 0,
    floors: 8,
    kind: "hip-roof-block",
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "business-building",
    name: "商管大樓",
    position: [118, -182],
    size: [34, 30, 22],
    rotationY: 0.1,
    floors: 8,
    kind: "slab-block",
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "gymnasium",
    name: "紹謨紀念體育館",
    position: [166, -122],
    size: [44, 16, 30],
    rotationY: 0,
    kind: "hall",
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "maritime-museum",
    name: "海事博物館",
    position: [150, -252],
    size: [46, 16, 20],
    rotationY: 0.16,
    kind: "ship",
    accuracy: "estimated",
    referenceIds: REF,
  },
  {
    id: "juexuan-garden",
    name: "覺軒花園",
    position: [-46, -108],
    size: [22, 6, 16],
    rotationY: 0,
    kind: "pavilion",
    accuracy: "estimated",
    referenceIds: ["REF_PALACE_CLASSROOMS_1954", ...REF],
  },
  {
    id: "volleyball-court",
    name: "排球場",
    position: [72, -150],
    size: [18, 0, 32],
    rotationY: 0,
    kind: "court",
    accuracy: "estimated",
    referenceIds: REF,
  },
];

export function structureGroundY(s: SecondaryStructure): number {
  return sampleGroundElevation(s.position[0], s.position[1]);
}
