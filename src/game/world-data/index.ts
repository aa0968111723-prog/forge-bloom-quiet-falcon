/**
 * Tamkang reality data layer.
 *
 * Everything here is pure data and pure functions — no Three.js, no React — so
 * it can be unit-tested headlessly and reasoned about without a renderer.
 * Rendering code lives in `src/game/world/` and `src/game/landmarks/`.
 */
export * from "./origin.ts";
export * from "./math.ts";
export * from "./references.ts";
export * from "./kenan.ts";
export * from "./axis.ts";
export * from "./elevation.ts";
export * from "./landmarks.ts";
export * from "./colliders.ts";
export * from "./paths.ts";
export * from "./vegetation.ts";
export * from "./props.ts";
export * from "./benchmarks.ts";
export * from "./lighting.ts";
export * from "./zones/index.ts";
export * from "./zones/secondary.ts";
