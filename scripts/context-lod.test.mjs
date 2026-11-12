import assert from "node:assert/strict";
import test from "node:test";

import {
  SECONDARY_STRUCTURES,
  contextDetailLimit,
  activityProfile,
  arenaProfile,
  contextShowsDetail,
  engTowerProfile,
  gardenHouseProfile,
  glazingBand,
  poolHallProfile,
  linkedHallProfile,
  facultyHouseProfile,
  memorialProfile,
  officeProfile,
  languageHallProfile,
  scienceHallProfile,
  studioProfile,
  watchPostProfile,
  chemHallProfile,
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
  const house = SECONDARY_STRUCTURES.find((item) => item.id === "faculty");
  assert.equal(house?.kind, "faculty-house");
  assert.equal(house?.accuracy, "estimated");
  assert.notEqual(house?.kind, "dorm-block");
  const porch = facultyHouseProfile(house.size);
  assert.ok(porch.glassZ > house.size[2] / 2, "faculty door sits on the south face");
  assert.ok(porch.porchW < house.size[0] * 0.4, "the porch stays narrower than the house");
  assert.ok(porch.porchZ - porch.porchD / 2 >= house.size[2] / 2 - 0.02, "the porch meets the south wall");
  for (const id of ["sungtao", "sungtao-3", "sungtao-4", "sungtao-5"]) {
    assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === id)?.kind, "dorm-block");
  }
  const front = SECONDARY_STRUCTURES.find((item) => item.id === "sungtao-2");
  assert.equal(front?.kind, "dorm-front");
  assert.equal(front?.accuracy, "estimated");
  assert.notEqual(front?.kind, "dorm-block");
  assert.notEqual(front?.kind, "intl-dorm");
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
  const chem = SECONDARY_STRUCTURES.find((item) => item.id === "chemistry");
  assert.equal(chem?.kind, "chem-hall");
  assert.equal(chem?.accuracy, "estimated");
  assert.notEqual(chem?.kind, "lab-block");
  const stack = chemHallProfile(chem.size);
  assert.ok(stack.glassZ > chem.size[2] / 2, "chemistry glass sits on the south face");
  assert.ok(stack.glassY + stack.glassH / 2 < chem.size[1], "chemistry glass stays on the wall");
  assert.ok(stack.stackX + stack.stackW / 2 < chem.size[0] / 2, "the fume stack stays on the roof");
  assert.ok(Math.abs(stack.stackZ) + stack.stackD / 2 < chem.size[2] / 2, "the fume stack stays inside the roof");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "science")?.kind, "science-hall");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "old-engineering")?.kind, "workshop");
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
  const language = SECONDARY_STRUCTURES.find((item) => item.id === "foreign");
  assert.equal(language?.kind, "language-hall");
  assert.equal(language?.accuracy, "estimated");
  assert.notEqual(language?.kind, "study-block");
  const gallery = languageHallProfile(language.size);
  assert.ok(gallery.galleryZ > language.size[2] / 2, "language gallery sits on the south face");
  assert.ok(gallery.upperSouth + 0.08 < language.size[2] / 2, "upper bands sit on the set-back wall");
  assert.ok(gallery.galleryH < language.size[1] * 0.3, "the gallery stays the ground storey");
  assert.equal(SECONDARY_STRUCTURES.some((item) => item.id === "foreign-lang-hall"), false);
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
  const garden = SECONDARY_STRUCTURES.find((item) => item.id === "yingyuan");
  assert.equal(garden?.kind, "garden-house");
  assert.equal(garden?.accuracy, "estimated");
  assert.notEqual(garden?.kind, "hip-roof-block");
  const veranda = gardenHouseProfile(garden.size);
  assert.ok(veranda.glassZ > garden.size[2] / 2, "garden door sits on the south face");
  assert.ok(veranda.porchZ - veranda.porchD / 2 >= garden.size[2] / 2 - 0.02, "the veranda meets the south wall");
  assert.ok(Math.abs(veranda.wallY + veranda.bodyH / 2 - garden.size[1]) < 1e-6, "the wall reaches the roof");
  assert.ok(veranda.wallY - veranda.bodyH / 2 >= veranda.baseH - 1e-6, "the wall sits on the plinth");
  assert.ok(veranda.roofH < garden.size[1], "the hip roof stays a cap");
  assert.ok(veranda.roofR < Math.hypot(garden.size[0], garden.size[2]) * 0.5, "the roof does not use the academic cone");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "humanities")?.kind, "hip-roof-block");
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
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "chemistry")?.kind, "chem-hall");
  const office = SECONDARY_STRUCTURES.find((item) => item.id === "administration");
  assert.equal(office?.kind, "office-block");
  assert.equal(office?.accuracy, "estimated");
  assert.notEqual(office?.kind, "study-block");
  const door = officeProfile(office.size);
  assert.ok(door.bayZ > office.size[2] / 2, "office entrance sits on the south face");
  assert.ok(door.bayW < office.size[0] * 0.35, "the entrance bay stays narrow");
  assert.ok(door.bayH < office.size[1] * 0.3, "the entrance bay stays on the ground");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "education")?.kind, "study-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "foreign")?.kind, "language-hall");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "hweiwen")?.kind, "study-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "main-gate")?.kind, "gate");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "education")?.accuracy, "estimated");
  for (const id of ["sungtao", "chemistry", "swimming"]) {
    assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === id)?.accuracy, "estimated");
  }
});
