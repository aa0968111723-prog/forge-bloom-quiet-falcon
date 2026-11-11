import { QUALITY_TIERS, type QualityTierId } from "./quality-spec.ts";

export const PENDING_DEVICE = "pending-device" as const;

export type PendingDevice = typeof PENDING_DEVICE;

export const ROUTE_SEGMENTS = ["title", "outdoor", "combat", "indoor", "outdoor-return"] as const;

export type RouteSegment = (typeof ROUTE_SEGMENTS)[number];

export type Metric = number | PendingDevice;

export type SampleInput = {
  frameMs?: number;
  drawCalls?: number;
  triangles?: number;
  bytes?: number;
  fps?: number;
  timeToOperableMs?: number;
  device?: string;
  viewport?: string;
  quality?: string;
};

export type SampleRecord = {
  segment: RouteSegment;
  route: RouteSegment;
  frameMs: Metric;
  drawCalls: Metric;
  triangles: Metric;
  bytes: Metric;
  fps: Metric;
  timeToOperableMs: Metric;
  device: string | PendingDevice;
  viewport: string | PendingDevice;
  quality: QualityTierId | PendingDevice;
};

export type SampleLog = SampleRecord[];

export type RuntimeCondition = {
  device: string;
  viewport: string;
  quality: string;
  route: string;
};

/**
 * Five-route budget. Render tuning stays blocked until the same device, viewport,
 * quality, and route have a before/after pair. Unmeasured fields stay pending-device.
 */
export const MEASUREMENT_SPEC = {
  sameConditionKeys: ["device", "viewport", "quality", "route"] as const,
  metrics: ["timeToOperableMs", "frameMsMedian", "frameMsP95", "drawCalls", "triangles", "bytes"] as const,
  routes: ROUTE_SEGMENTS,
  lightingReviewWithF: ["day", "dusk", "night"] as const,
  deferRenderTuning: true,
} as const;

/**
 * Records one route sample.
 * Omitted or non-finite metrics become "pending-device". fps is never derived from frameMs.
 */
export function recordSample(log: SampleLog, segment: RouteSegment, sample: SampleInput = {}): SampleRecord {
  if (!Array.isArray(log)) throw new Error("recordSample requires a log array");
  if (!isRouteSegment(segment)) throw new Error(`unknown route segment: ${String(segment)}`);
  const record: SampleRecord = {
    segment,
    route: segment,
    frameMs: metric(sample.frameMs),
    drawCalls: metric(sample.drawCalls),
    triangles: metric(sample.triangles),
    bytes: metric(sample.bytes),
    fps: metric(sample.fps),
    timeToOperableMs: metric(sample.timeToOperableMs),
    device: label(sample.device),
    viewport: label(sample.viewport),
    quality: qualityOf(sample.quality),
  };
  log.push(record);
  return record;
}

/**
 * True only when device, viewport, quality, and route are all known and equal.
 * "pending-device" is not an identity, so two unknown devices are not comparable.
 */
export function sameCondition(a: RuntimeCondition, b: RuntimeCondition): boolean {
  if (!a || !b) return false;
  if (!knownText(a.device) || !knownText(b.device)) return false;
  if (!knownText(a.viewport) || !knownText(b.viewport)) return false;
  if (!isQualityTier(a.quality) || !isQualityTier(b.quality)) return false;
  if (!isRouteSegment(a.route) || !isRouteSegment(b.route)) return false;
  return a.device === b.device && a.viewport === b.viewport && a.quality === b.quality && a.route === b.route;
}

function metric(value: number | undefined): Metric {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return PENDING_DEVICE;
  return value;
}

function label(value: string | undefined): string | PendingDevice {
  if (typeof value !== "string") return PENDING_DEVICE;
  const trimmed = value.trim();
  if (!trimmed || trimmed === PENDING_DEVICE) return PENDING_DEVICE;
  return trimmed;
}

function qualityOf(value: string | undefined): QualityTierId | PendingDevice {
  return isQualityTier(value) ? value : PENDING_DEVICE;
}

function knownText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value !== PENDING_DEVICE;
}

function isQualityTier(value: unknown): value is QualityTierId {
  return typeof value === "string" && (QUALITY_TIERS as readonly string[]).includes(value);
}

function isRouteSegment(value: unknown): value is RouteSegment {
  return typeof value === "string" && (ROUTE_SEGMENTS as readonly string[]).includes(value);
}
