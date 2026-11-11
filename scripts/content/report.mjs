import {
  inventoryStats,
  loadCatalog,
  runTour,
  validateCatalog,
} from "../../src/features/narrative/index.ts";

const catalog = loadCatalog();
const report = validateCatalog(catalog);
const stats = inventoryStats(catalog.places);
const tour = runTour(catalog, "gate-100");
const summary = {
  ok: report.ok,
  errors: report.errors,
  warnings: report.warnings,
  places: stats,
  events: catalog.events.length,
  arcQuests: catalog.quests.filter((quest) => quest.arc).length,
  tour: {
    seed: "gate-100",
    xp: tour.growth.xp,
    notes: tour.growth.materials.notes,
    credit: tour.growth.materials.credit,
    fired: tour.session.fired,
  },
  note: "固定 seed 只記錄這次實際走到的事件，不用次數保證沒有其他問題。",
};
console.log(JSON.stringify(summary, null, 2));
if (!report.ok) process.exit(1);
