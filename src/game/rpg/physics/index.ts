export { FIXED_DT, MAX_CATCHUP_STEPS, createSimClock, type SimClock } from "./clock.ts";
export {
  GRAVITY,
  MAX_CLIMB_GRADE,
  STEP_UP_M,
  SURFACE_FRICTION,
  classifySurface,
  sampleContact,
  type ContactSample,
  type SurfaceKind,
} from "./contact.ts";
export { SWEEP, sweepCircle, type SweepQuery, type SweepResult } from "./sweep.ts";
export { createWalker, stepWalker, type Walker } from "./motor.ts";
export { POSITION_TOLERANCE_M, knockback, type KnockResult } from "./knockback.ts";
export { cameraClearance, type CameraPoint } from "./camera.ts";
export {
  createHitLedger,
  resolveHitSignals,
  type HitIntent,
  type HitLedger,
  type HitSignal,
} from "./hits.ts";
export {
  applyImpulse,
  createProp,
  stepDynamics,
  type DynBody,
  type Mobility,
  type PropDrop,
  type PropKind,
} from "./bodies.ts";
export { integrateInterior, stepInterior, type InteriorStep } from "./interior.ts";
