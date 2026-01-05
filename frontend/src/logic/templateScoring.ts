import type { BigExpense, Profile, Template, Volatility, Horizon } from "../types";

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

  s += shortTermScore(horizon, bigExpense, templateId);

  if (cashflowNeed.enabled) {
    if (templateId === "T4") s += 60;
    if (templateId === "T5") s += 5;
    if (templateId === "T3") s -= 15;
  }

  s += volatilityScore(volatility, templateId);

  s += horizonScore(horizon, templateId);

  if (templateId === "T1") s += 5;

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
    if (tid === "T5") s += 10;
  }
  return s;
}

function volatilityScore(vol: Volatility, tid: string): number {
  if (vol === "LOW") {
    if (tid === "T2") return 60;
    if (tid === "T1") return 20;
    if (tid === "T5") return 15;
    if (tid === "T3") return -50;
    if (tid === "T4") return -10;
  }
  if (vol === "HIGH") {
    if (tid === "T3") return 60;
    if (tid === "T1") return 15;
    if (tid === "T2") return -10;
    if (tid === "T5") return -20;
  }
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
  return 0;
}

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
