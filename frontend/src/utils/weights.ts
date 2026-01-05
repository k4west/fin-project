import type { AssetBucket } from "../types";

export function sumWeights(w: Record<AssetBucket, number>) {
  return Object.values(w).reduce((a, b) => a + b, 0);
}

export function normalizeWeights(
  w: Record<AssetBucket, number>,
  targetKey: AssetBucket,
  newVal: number,
  fallbackKey: AssetBucket = "CASH"
) {
  const next = { ...w };
  next[targetKey] = clamp(newVal, 0, 100);

  let s = sumWeights(next);
  let diff = 100 - s;

  if (diff === 0) return next;

  const fb: AssetBucket = fallbackKey === targetKey ? "CASH" : fallbackKey;
  next[fb] = clamp(next[fb] + diff, 0, 100);

  s = sumWeights(next);
  if (s !== 100) {
    next[targetKey] = clamp(next[targetKey] + (100 - s), 0, 100);
  }
  return next;
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}
