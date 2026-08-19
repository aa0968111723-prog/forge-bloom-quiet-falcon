import type { Accuracy } from "./origin.ts";

/**
 * Provenance for every reality figure used by the scene.
 *
 * The point of this file is auditability: when a dimension is later measured on
 * site, you can find every landmark that leaned on the old reference, fix the
 * number once, and know what changed. Reality Compare Mode (F8) shows the
 * reference ids for whatever you are looking at.
 *
 * `kind` is deliberately blunt:
 *  - `documented`  a figure published about the campus (step counts, floor
 *                  counts, the "about 200 m" avenue length, dedication years).
 *  - `photographic` a shape/material/arrangement read off photographs of the
 *                  real place — good for silhouette and colour, useless for
 *                  absolute dimensions.
 *  - `typical`     a standard construction dimension (stair riser/tread, storey
 *                  height, lane width) applied because nothing better exists.
 *  - `assumption`  an explicit guess made to keep the scene buildable. Anything
 *                  resting only on this is `estimated` and stays that way until
 *                  someone visits with a tape measure.
 */
export type ReferenceKind = "documented" | "photographic" | "typical" | "assumption";

export type Reference = {
  id: string;
  kind: ReferenceKind;
  /** What this reference actually establishes. */
  claim: string;
  /** Best accuracy any datum resting solely on this reference may claim. */
  maxAccuracy: Accuracy;
  /** How to improve it. */
  improveBy?: string;
};

export const REFERENCES: Reference[] = [
  {
    id: "REF_KENAN_STEP_COUNT",
    kind: "documented",
    claim:
      "克難坡 has 132 steps — the slope is commonly referred to as 一百三十二階 in Tamkang's own campus material and in the university's founding narrative.",
    maxAccuracy: "mapped",
  },
  {
    id: "REF_KENAN_TWO_FLIGHTS",
    kind: "photographic",
    claim:
      "The stair is broken by at least one intermediate landing rather than running as a single unbroken flight.",
    maxAccuracy: "estimated",
    improveBy: "Count the steps in each flight on site; the 66/66 split used here is a placeholder.",
  },
  {
    id: "REF_STAIR_TYPICAL_RISE",
    kind: "typical",
    claim:
      "Taiwanese outdoor public stone stairs typically use a 150–170 mm riser with a 300–350 mm tread.",
    maxAccuracy: "estimated",
    improveBy: "Measure one tread and one riser; the whole slope profile is derived from those two numbers.",
  },
  {
    id: "REF_LANTERN_AVENUE_LENGTH",
    kind: "documented",
    claim: "宮燈大道 is described as a stone-paved walk of about 200 m.",
    maxAccuracy: "mapped",
    improveBy: "Measure kerb-to-kerb from the plaza edge to the dolphin roundabout.",
  },
  {
    id: "REF_PALACE_CLASSROOMS_1954",
    kind: "documented",
    claim:
      "宮燈教室 (1954) are the first permanent buildings of the Tamsui campus: red walls, green glazed hip-roof tiles, arcaded colonnades facing the avenue.",
    maxAccuracy: "mapped",
  },
  {
    id: "REF_PALACE_ARRANGEMENT",
    kind: "photographic",
    claim: "Halls stand in facing rows on both sides of the avenue, set back behind a colonnade.",
    maxAccuracy: "estimated",
    improveBy: "Count the halls per side and measure the pitch between them.",
  },
  {
    id: "REF_LIBRARY_NINE_FLOORS",
    kind: "documented",
    claim: "覺生紀念圖書館 is a nine-storey open-stack library built along the hill slope.",
    maxAccuracy: "mapped",
    improveBy: "Confirm floor-to-floor height and the below-grade levels.",
  },
  {
    id: "REF_SCROLL_PLAZA_1986",
    kind: "documented",
    claim:
      "書卷廣場 (1986, 林貴榮) carries four bamboo-scroll blades standing for the four characters of the school motto; students call it 蛋捲廣場.",
    maxAccuracy: "mapped",
  },
  {
    id: "REF_DOLPHIN_MILESTONE",
    kind: "documented",
    claim:
      "海豚里程碑 (王秀杞) stands on the roundabout at the north end of 宮燈大道; the dolphin is the student-voted mascot and the plinth carries 立足淡江，放眼世界，掌握資訊，開創未來.",
    maxAccuracy: "mapped",
  },
  {
    id: "REF_CHINGSHENG_STATUE",
    kind: "documented",
    claim:
      "驚聲銅像 at the head of the slope commemorates 張驚聲; the plaza behind it is stepped like a Roman theatre and the plinth is inscribed 功在作人.",
    maxAccuracy: "mapped",
  },
  {
    id: "REF_CAMPUS_ON_WUHU_HILL",
    kind: "documented",
    claim:
      "The Tamsui campus sits on 五虎崗 above the Tamsui River, with 觀音山 across the water to the west — hence the west-facing sunset view from the avenue.",
    maxAccuracy: "mapped",
  },
  {
    id: "REF_PLATEAU_ASSUMPTION",
    kind: "assumption",
    claim:
      "The campus core north of 驚聲銅像廣場 is modelled as an almost level plateau with a 1.5% fall along the avenue and a slight rise towards the library.",
    maxAccuracy: "estimated",
    improveBy:
      "A levelling run along the avenue centreline would replace the whole spine profile in elevation.ts.",
  },
  {
    id: "REF_AXIS_STRAIGHT_ASSUMPTION",
    kind: "assumption",
    claim:
      "The gate → slope → plaza → avenue → dolphin → scroll plaza → library axis is modelled as one straight north–south line at x = 0.",
    maxAccuracy: "estimated",
    improveBy: "Trace the real centreline from a survey plan and give paths.ts real bends.",
  },
  {
    id: "REF_SECONDARY_ZONE_PLACEHOLDER",
    kind: "assumption",
    claim:
      "Landmarks outside the v1 corridor (海事博物館, 五虎碑, 紹謨紀念體育館, 商管大樓, 牧羊草坪, 覺軒) are placed only plausibly relative to the corridor; they were out of scope for Reality Pass v1.",
    maxAccuracy: "estimated",
    improveBy: "Run the same calibration pass over the north and east campus.",
  },
  {
    id: "REF_TAMSUI_WEATHER",
    kind: "documented",
    claim:
      "Tamsui is notably wet and overcast in winter, which is why a cloudy and an after-rain lighting preset exist alongside sunny/sunset/night.",
    maxAccuracy: "mapped",
  },
];

export const REFERENCE_BY_ID: Record<string, Reference> = Object.fromEntries(
  REFERENCES.map((r) => [r.id, r]),
);

const RANK: Record<Accuracy, number> = { surveyed: 3, mapped: 2, estimated: 1 };

/**
 * Highest accuracy a datum may claim given its references. Used by the
 * world-data tests so nothing can silently over-claim precision.
 */
export function accuracyCeiling(referenceIds: readonly string[]): Accuracy {
  let best: Accuracy = "estimated";
  for (const id of referenceIds) {
    const ref = REFERENCE_BY_ID[id];
    if (!ref) continue;
    if (RANK[ref.maxAccuracy] > RANK[best]) best = ref.maxAccuracy;
  }
  return best;
}

export function accuracyRank(a: Accuracy): number {
  return RANK[a];
}
