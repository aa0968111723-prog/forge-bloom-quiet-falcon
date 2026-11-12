import eventsJson from "../../../content/narrative/events.json" with { type: "json" };
import npcsJson from "../../../content/narrative/npcs.json" with { type: "json" };
import questsJson from "../../../content/narrative/quests.json" with { type: "json" };
import assetsJson from "../../../content/narrative/assets.json" with { type: "json" };
import unitsJson from "../../../content/narrative/official-units.json" with { type: "json" };
import briefsJson from "../../../content/narrative/briefs.json" with { type: "json" };
import ossJson from "../../../content/narrative/oss.json" with { type: "json" };
import manifestJson from "../../../content/narrative/manifest.json" with { type: "json" };
import { facultySlice } from "../faculty-story/build.ts";
import { buildPlaces } from "./places.ts";
import { CONTENT_REVISION } from "./types.ts";
import type {
  AssetRecord,
  BriefRecord,
  Catalog,
  EventRecord,
  NpcRecord,
  OfficialUnits,
  OssCandidate,
  QuestRecord,
} from "./types.ts";

export function loadCatalog(): Catalog {
  if (manifestJson.revision !== CONTENT_REVISION) {
    throw new Error(`content revision ${manifestJson.revision} does not match ${CONTENT_REVISION}`);
  }
  const faculty = facultySlice();
  return {
    revision: CONTENT_REVISION,
    places: [...buildPlaces(), ...faculty.places],
    npcs: [...(npcsJson as NpcRecord[]), ...faculty.npcs],
    quests: [...(questsJson as QuestRecord[]), ...faculty.quests],
    events: [...(eventsJson as EventRecord[]), ...faculty.events],
    assets: assetsJson as AssetRecord[],
    units: unitsJson as OfficialUnits,
    briefs: briefsJson as BriefRecord[],
    oss: ossJson as OssCandidate[],
  };
}
