export type FrameStats = {
  count: number;
  median: number;
  p95: number;
};

/**
 * P95 is an observed sample, nearest-rank: sorted[ceil(0.95 * n) - 1].
 * Interpolation is not used, so the result is never a frame time that was not supplied.
 * An empty list throws. Zero is not returned as a stand-in for "not measured".
 */
export function frameStats(samplesMs: readonly number[]): FrameStats {
  if (!Array.isArray(samplesMs) || samplesMs.length === 0) {
    throw new Error("frameStats requires measured samples; refusing to report 0");
  }
  for (const sample of samplesMs) {
    if (typeof sample !== "number" || !Number.isFinite(sample) || sample < 0) {
      throw new Error("frameStats requires finite non-negative frame times");
    }
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  return {
    count: sorted.length,
    median: medianOf(sorted),
    p95: nearestRank(sorted, 0.95),
  };
}

function medianOf(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function nearestRank(sorted: readonly number[], fraction: number): number {
  const rank = Math.ceil(fraction * sorted.length);
  const index = Math.min(sorted.length, Math.max(1, rank)) - 1;
  return sorted[index];
}
