// src/logic/templateScoring.ts
import type { BigExpense, Horizon, Profile, Template, Volatility } from "../types";

/**
 * 템플릿 점수화: 가장 높은 점수 템플릿 선택
 * - 단기목표/큰 지출 예정이면 T5 가산
 * - 현금흐름 필요면 T4 가산
 * - 변동성 LOW면 T2, HIGH면 T3 가산
 * - 10년+ 장기면 T3(공격)/T1(균형) 가산
 */
export function pickBestTemplate(profile: Profile, templates: Template[]) {
  if (!templates.length) return null;

  const scores = templates.map((t) => {
    const s = scoreTemplate(profile, t.id);
    return { template: t, score: s };
  });

  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.template ?? null;
}

function scoreTemplate(profile: Profile, templateId: string): number {
  let s = 0;

  const { horizon, volatility, cashflowNeed, bigExpense } = profile;

  // 1) 단기/큰지출
  s += shortTermScore(horizon, bigExpense, templateId);

  // 2) 현금흐름 니즈
  if (cashflowNeed.enabled) {
    if (templateId === "T4") s += 60;
    if (templateId === "T5") s += 5; // 단기 + 현금흐름이면 현금성도 어느 정도 필요
    if (templateId === "T3") s -= 15; // 현금흐름이 필요한데 공격형은 부담
  }

  // 3) 변동성 감내
  s += volatilityScore(volatility, templateId);

  // 4) 투자 기간(장기)
  s += horizonScore(horizon, templateId);

  // 5) 기본 선호(초심자 default는 T1에 약간 가산)
  if (templateId === "T1") s += 5;

  // 6) 충돌 페널티: 단기 목표인데 공격형 선택 방지
  if ((horizon === "1_3" || bigExpense === "IN_1Y") && templateId === "T3") s -= 80;

  return s;
}

function shortTermScore(horizon: Horizon, bigExpense: BigExpense, tid: string): number {
  let s = 0;
  const isShort = horizon === "1_3";
  const isSoonExpense = bigExpense === "IN_1Y";

  if (isShort) {
    if (tid === "T5") s += 90;
    if (tid === "T2") s += 25;
    if (tid === "T1") s += 10;
    if (tid === "T3") s -= 30;
  }
  if (isSoonExpense) {
    if (tid === "T5") s += 80;
    if (tid === "T2") s += 20;
    if (tid === "T3") s -= 20;
  }
  if (bigExpense === "IN_3Y") {
    if (tid === "T2") s += 15;
    if (tid === "T1") s += 10;
    if (tid === "T5") s += 10; // 3년 내 목표면 안전 쪽도 고려
  }
  return s;
}

function volatilityScore(vol: Volatility, tid: string): number {
  if (vol === "LOW") {
    if (tid === "T2") return 60;
    if (tid === "T1") return 20;
    if (tid === "T5") return 15;
    if (tid === "T3") return -50;
    if (tid === "T4") return -10; // 인컴도 변동성/구조 이해 필요
  }
  if (vol === "HIGH") {
    if (tid === "T3") return 60;
    if (tid === "T1") return 15;
    if (tid === "T2") return -10;
    if (tid === "T5") return -20;
  }
  // MED
  if (tid === "T1") return 25;
  if (tid === "T2") return 15;
  if (tid === "T3") return 10;
  if (tid === "T5") return 10;
  return 0;
}

function horizonScore(h: Horizon, tid: string): number {
  if (h === "10_PLUS") {
    if (tid === "T3") return 30;
    if (tid === "T1") return 20;
    if (tid === "T2") return 5;
  }
  if (h === "5_10") {
    if (tid === "T1") return 25;
    if (tid === "T3") return 15;
    if (tid === "T2") return 10;
  }
  if (h === "3_5") {
    if (tid === "T1") return 20;
    if (tid === "T2") return 20;
    if (tid === "T5") return 10;
  }
  // 1_3 은 shortTermScore에서 처리
  return 0;
}

/** 선택 근거를 짧게 만들어 UI에 표시(신뢰↑) */
export function explainPick(profile: Profile, pickedId: string): string[] {
  const r: string[] = [];
  if (profile.horizon === "1_3") r.push("목표 기간이 짧아 변동성을 낮추는 구성이 유리할 수 있어요.");
  if (profile.bigExpense === "IN_1Y") r.push("1년 내 큰 지출 예정이라 현금성/안정 비중을 높이는 쪽을 우선 고려했어요.");
  if (profile.cashflowNeed.enabled) r.push("현금흐름 필요가 있어 배당/인컴 비중을 반영했어요.");
  if (profile.volatility === "LOW") r.push("변동성 감내가 낮아 안정형/균형형에 가중치를 뒀어요.");
  if (profile.volatility === "HIGH") r.push("변동성 감내가 높아 장기 성장 비중을 더 고려했어요.");
  r.push(`선택 템플릿: ${pickedId}`);
  return r.slice(0, 4);
}
