import assert from "node:assert/strict";
import test from "node:test";

import {
  SECONDARY_STRUCTURES,
  contextDetailLimit,
  activityProfile,
  arenaProfile,
  contextShowsDetail,
  engTowerProfile,
  glazingBand,
  poolHallProfile,
  linkedHallProfile,
  memorialProfile,
  scienceHallProfile,
  studioProfile,
  watchPostProfile,
  workshopProfile,
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
  const memorial = SECONDARY_STRUCTURES.find((item) => item.id === "chingsheng-building");
  assert.equal(memorial?.kind, "memorial-tower");
  assert.equal(memorial?.accuracy, "estimated");
  assert.notEqual(memorial?.kind, "hip-roof-block");
  const shaft = memorialProfile(memorial.size);
  assert.ok(shaft.glassZ > memorial.size[2] / 2, "memorial glass sits on the south face");
  assert.ok(shaft.baseH < memorial.size[1] * 0.25, "the base stays the ground storey");
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
  const tower = SECONDARY_STRUCTURES.find((item) => item.id === "engineering");
  assert.equal(tower?.kind, "eng-tower");
  assert.equal(tower?.accuracy, "estimated");
  assert.notEqual(tower?.kind, "lab-block");
  const eng = engTowerProfile(tower.size);
  const towerSouth = eng.towerZ + eng.towerD / 2;
  assert.ok(Math.abs(eng.glassZ - (towerSouth + 0.08)) < 1e-6, "tower glass sits on the set-back face");
  assert.ok(eng.towerW < tower.size[0], "the tower is narrower than the podium");
  assert.ok(eng.podiumH < tower.size[1] * 0.35, "the podium stays the base");
  const workshop = SECONDARY_STRUCTURES.find((item) => item.id === "old-engineering");
  assert.equal(workshop?.kind, "workshop");
  assert.equal(workshop?.accuracy, "estimated");
  assert.notEqual(workshop?.kind, "lab-block");
  const shop = workshopProfile(workshop.size);
  assert.ok(shop.glassZ > workshop.size[2] / 2, "workshop glass sits on the south face");
  assert.ok(shop.baseH < workshop.size[1] * 0.45, "the brick base stays the lower storey");
  const science = SECONDARY_STRUCTURES.find((item) => item.id === "science");
  assert.equal(science?.kind, "science-hall");
  assert.equal(science?.accuracy, "estimated");
  assert.notEqual(science?.kind, "lab-block");
  const bay = scienceHallProfile(science.size);
  assert.ok(bay.glassZ > science.size[2] / 2, "science bay sits on the south face");
  assert.ok(bay.bayX > 0, "the glass bay stays on the east end");
  assert.equal(SECONDARY_STRUCTURES.some((item) => item.id === "science-hall"), false);
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "chemistry")?.kind, "lab-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "main-gate")?.kind, "gate");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "wind-lab")?.kind, "shed");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "wind-lab")?.accuracy, "estimated");
  assert.notEqual(SECONDARY_STRUCTURES.find((item) => item.id === "wind-lab")?.kind, "lab-block");
  const arena = SECONDARY_STRUCTURES.find((item) => item.id === "gymnasium");
  assert.equal(arena?.kind, "arena");
  assert.equal(arena?.accuracy, "estimated");
  assert.notEqual(arena?.kind, "hall");
  const court = arenaProfile(arena.size);
  assert.ok(court.glassZ > arena.size[2] / 2, "gym clerestory sits on the south face");
  assert.ok(court.clerestoryY > court.baseH, "the glass band stays above the plinth");
  const pool = SECONDARY_STRUCTURES.find((item) => item.id === "swimming");
  assert.equal(pool?.kind, "pool-hall");
  assert.equal(pool?.accuracy, "estimated");
  assert.notEqual(pool?.kind, "sport-hall");
  const lane = poolHallProfile(pool.size);
  assert.ok(lane.glassZ > pool.size[2] / 2, "pool clerestory sits on the south face");
  assert.ok(lane.glassY + lane.glassH / 2 < pool.size[1], "pool clerestory stays on the wall");
  assert.ok(lane.spineZ + lane.spineD / 2 < pool.size[2] / 2, "roof spine stays on the roof");
  assert.ok(lane.spineW < pool.size[0], "roof spine is narrower than the hall");
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
