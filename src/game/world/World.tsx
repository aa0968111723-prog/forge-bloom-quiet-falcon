import { Suspense, useEffect } from "react";
import { TamkangMaterialsProvider } from "../materials/provider";
import { useGame } from "../store";
import { BENCHMARK_BY_ID } from "../world-data/benchmarks.ts";
import { TIME_PRESETS, type TimeOfDay } from "../world-data/lighting.ts";
import { ChingshengPlaza } from "../landmarks/ChingshengPlaza";
import { DolphinMilestone } from "../landmarks/DolphinMilestone";
import { KenanSlope } from "../landmarks/KenanSlope";
import { LanternAvenue } from "../landmarks/LanternAvenue";
import { Library } from "../landmarks/Library";
import { MuseumExhibits } from "../landmarks/MuseumExhibits";
import { PalaceClassrooms } from "../landmarks/PalaceClassrooms";
import { ScrollPlaza } from "../landmarks/ScrollPlaza";
import { ShepherdMeadow } from "../landmarks/ShepherdMeadow";
import { TigerStele } from "../landmarks/TigerStele";
import { ContextStructures } from "./ContextStructures";
import { Lighting } from "./Lighting";
import { LocalLights } from "./LocalLights";
import { PlacedBuildings } from "./PlacedBuildings";
import { Grass } from "./Grass";
import { Rain } from "./Rain";
import { Sky, Clouds } from "./Sky";
import { StylizePass } from "./StylizePass";
import { Water } from "./Water";
import { WindTicker } from "./WindTicker";
import { Paths } from "./Paths";
import { PostFx } from "./PostFx";
import { Props } from "./Props";
import { RealityCameraRig } from "./RealityCompare";
import { Signage } from "./Signage";
import { StampRings } from "./StampRings";
import { Terrain } from "./Terrain";
import { Vegetation } from "./Vegetation";
import { CampusCraft } from "./CampusCraft";

/**
 * The assembled campus.
 *
 * Composition only — every piece owns its own data and geometry:
 *   Terrain / Paths / Vegetation / Props / Signage  (world fabric)
 *   KenanSlope … Library                            (the v1 reality corridor)
 *   ContextStructures                               (out-of-scope surroundings)
 *
 * An active Reality Compare benchmark forces its own time-of-day preset, so a
 * LANTERN_SUNSET capture is always lit the same way regardless of what the
 * player had selected.
 */
function Ready({ onReady }: { onReady?: () => void }) { useEffect(() => { onReady?.(); }, [onReady]); return null; }
export function World({ timeOfDay, onReady }: { timeOfDay: TimeOfDay; onReady?: () => void }) {
  const benchmarkId = useGame((s) => s.benchmarkId);
  const effectiveTime = benchmarkId ? (BENCHMARK_BY_ID[benchmarkId]?.time ?? timeOfDay) : timeOfDay;
  const preset = TIME_PRESETS[effectiveTime];

  return (
    <>
      <Lighting timeOfDay={effectiveTime} />
      <LocalLights lampsOn={preset.lampsOn} />
      <WindTicker timeOfDay={effectiveTime} />
      <StylizePass timeOfDay={effectiveTime} />
      <PostFx timeOfDay={effectiveTime} />
      <Sky timeOfDay={effectiveTime} />
      <Clouds timeOfDay={effectiveTime} />
      <Rain timeOfDay={effectiveTime} />
      <Water timeOfDay={effectiveTime} />
      <RealityCameraRig />
      <Suspense fallback={null}>
        <TamkangMaterialsProvider>
          <Ready onReady={onReady}/>
          <Terrain wetness={preset.wetness} />
          <Paths wetness={preset.wetness} />
          <Grass timeOfDay={effectiveTime} />

          <KenanSlope wetness={preset.wetness} />
          <ChingshengPlaza wetness={preset.wetness} />
          <PalaceClassrooms wetness={preset.wetness} lampsOn={preset.lampsOn} />
          <LanternAvenue wetness={preset.wetness} lampsOn={preset.lampsOn} />
          <CampusCraft />
          <DolphinMilestone wetness={preset.wetness} />
          <ScrollPlaza wetness={preset.wetness} />
          <Library wetness={preset.wetness} lampsOn={preset.lampsOn} />
          <ShepherdMeadow wetness={preset.wetness} />

          <ContextStructures wetness={preset.wetness} lampsOn={preset.lampsOn} />
          <TigerStele wetness={preset.wetness} />
          <MuseumExhibits wetness={preset.wetness} />
          <Signage wetness={preset.wetness} />
          <Vegetation />
          <Props lampsOn={preset.lampsOn} />
          <PlacedBuildings />
          <StampRings />
        </TamkangMaterialsProvider>
      </Suspense>
    </>
  );
}
