import assert from "node:assert/strict";
import test from "node:test";

import {
  SECONDARY_STRUCTURES,
  contextDetailLimit,
  contextShowsDetail,
  activityProfile,
  glazingBand,
  linkedHallProfile,
  studioProfile,
  watchPostProfile,
} from "../src/game/world-data/zones/secondary.ts";

test("context detail drops off with distance and the low tier is shorter", () => {
  assert.equal(contextDetailLimit("high"), 90);
  assert.ok(contextDetailLimit("low") < contextDetailLimit("high"));
  assert.equal(contextShowsDetail(0, 0, 0, 40, "high"), true);
  assert.equal(contextShowsDetail(0, 0, 0, 120, "high"), false);
  assert.equal(contextShowsDetail(0, 0, 0, 70, "low"), false);
  assert.equal(contextShowsDetail(85, -536, 85, -550, "low"), true);
});

test("white-hall and chuehhsuan are not the generic slab", () => {
  const white = SECONDARY_STRUCTURES.find((item) => item.id === "white-hall");
  const hall = SECONDARY_STRUCTURES.find((item) => item.id === "chuehhsuan");
  const humanities = SECONDARY_STRUCTURES.find((item) => item.id === "humanities");
  assert.equal(white?.kind, "white-block");
  assert.equal(hall?.kind, "hip-roof-block");
  assert.equal(humanities?.kind, "hip-roof-block");
  assert.equal(white?.accuracy, "estimated");
  assert.equal(hall?.accuracy, "estimated");
});

test("dorm, lab, and sport masses stay distinct and estimated", () => {
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "sungtao")?.kind, "dorm-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "reitaku")?.kind, "intl-dorm");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "reitaku")?.accuracy, "estimated");
  assert.notEqual(SECONDARY_STRUCTURES.find((item) => item.id === "reitaku")?.kind, "dorm-block");
  const post = SECONDARY_STRUCTURES.find((item) => item.id === "security");
  assert.equal(post?.kind, "watch-post");
  assert.equal(post?.accuracy, "estimated");
  assert.notEqual(post?.kind, "lab-block");
  const watch = watchPostProfile(post.size);
  assert.ok(watch.glassZ > post.size[2] / 2, "watch window sits on the south face");
  assert.ok(watch.glassH < post.size[1], "watch window stays on the wall");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "chemistry")?.kind, "lab-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "main-gate")?.kind, "gate");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "wind-lab")?.kind, "shed");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "wind-lab")?.accuracy, "estimated");
  assert.notEqual(SECONDARY_STRUCTURES.find((item) => item.id === "wind-lab")?.kind, "lab-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "swimming")?.kind, "sport-hall");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "reviewing")?.kind, "stand");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "reviewing")?.accuracy, "estimated");
  assert.notEqual(SECONDARY_STRUCTURES.find((item) => item.id === "reviewing")?.kind, "lab-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "hweiwen")?.kind, "study-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "education")?.kind, "study-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "business-building")?.kind, "study-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "business-building")?.accuracy, "estimated");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "integrated")?.kind, "linked-hall");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "business-o")?.kind, "media-hall");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "business-q")?.kind, "media-hall");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "business-o")?.accuracy, "estimated");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "humanities")?.kind, "hip-roof-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "integrated")?.accuracy, "estimated");
  const hall = SECONDARY_STRUCTURES.find((item) => item.id === "integrated");
  const profile = linkedHallProfile(hall.size);
  const floors = hall.floors;
  for (let floor = 0; floor < floors; floor++) {
    const y = ((floor + 0.55) * hall.size[1]) / floors;
    const south = glazingBand("linked-hall", hall.size, floors, floor, 1);
    if (y < profile.baseH) continue;
    const face = profile.upperZ + profile.upperDepth / 2;
    assert.ok(Math.abs(south.lz - (face + 0.05)) < 1e-6, `upper band floats at ${south.lz}`);
    assert.ok(south.width <= profile.upperWidth - 1, "upper band is wider than the recessed wall");
  }
  const activity = SECONDARY_STRUCTURES.find((item) => item.id === "commons");
  assert.equal(activity?.kind, "activity-hall");
  assert.equal(activity?.accuracy, "estimated");
  const lobby = activityProfile(activity.size);
  assert.ok(lobby.glassZ > activity.size[2] / 2, "activity glass sits on the south face");
  assert.ok(lobby.lobbyH < activity.size[1] * 0.4, "the lobby stays the ground storey");
  assert.ok(lobby.upperW < activity.size[0], "upper floors step back");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "chuehhsuan")?.kind, "hip-roof-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "conference")?.kind, "forum-hall");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "conference")?.accuracy, "estimated");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "audiovisual")?.kind, "auditorium");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "audiovisual")?.accuracy, "estimated");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "humanities")?.kind, "hip-roof-block");
  const studio = SECONDARY_STRUCTURES.find((item) => item.id === "architecture");
  assert.equal(studio?.kind, "studio-block");
  assert.equal(studio?.accuracy, "estimated");
  const studioFace = studioProfile(studio.size);
  assert.ok(studioFace.glassZ > studio.size[2] / 2, "studio glass sits on the south face");
  assert.ok(studioFace.glassH < studio.size[1], "studio glass stays on the wall");
  assert.ok(studioFace.monitorZ > 0, "roof monitor faces the south approach");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "chemistry")?.kind, "lab-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "administration")?.kind, "study-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "main-gate")?.kind, "gate");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "education")?.accuracy, "estimated");
  for (const id of ["sungtao", "chemistry", "swimming"]) {
    assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === id)?.accuracy, "estimated");
  }
});
