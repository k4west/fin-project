// src/utils/weights.ts
import type { AssetBucket } from "../types";

export function sumWeights(w: Record<AssetBucket, number>) {
  return Object.values(w).reduce((a, b) => a + b, 0);
}

/**
 * targetKey를 newVal로 바꾸고, 나머지 차이는 가장 큰 bucket(또는 지정 bucket)에 반영하는 간단 보정.
 * MVP용으로 "자동 보정" 버튼에 사용.
 */
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

  // diff를 fallbackKey에 반영 (fallbackKey가 targetKey면 CASH로 우회)
  const fb: AssetBucket = fallbackKey === targetKey ? "CASH" : fallbackKey;
  next[fb] = clamp(next[fb] + diff, 0, 100);

  // 다시 합이 100이 아닐 수 있어(클램프 때문에). 그럼 마지막으로 targetKey에 보정
  s = sumWeights(next);
  if (s !== 100) {
    next[targetKey] = clamp(next[targetKey] + (100 - s), 0, 100);
  }
  return next;
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}
