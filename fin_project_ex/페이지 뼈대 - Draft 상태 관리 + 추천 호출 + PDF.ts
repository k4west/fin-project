// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import type { Draft, Profile, Portfolio, Template, AssetBucket } from "./types";
import { ASSET_LABEL } from "./types";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import { fetchTemplates, postRecommend, downloadPdf } from "./api";
import { normalizeWeights, sumWeights } from "./utils/weights";

const DRAFT_KEY = "portfolio_draft_v1";

const emptyDraft: Draft = {
  meta: { savedAt: new Date().toISOString(), asOf: new Date().toISOString().slice(0, 10), disclaimerVersion: "v1" },
  profile: null,
  portfolio: null,
  result: null,
  agreedDividendWarning: false,
};

export default function App() {
  const { state: draft, setState: setDraft, reset } = useLocalStorageState<Draft>(DRAFT_KEY, emptyDraft);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [asOf, setAsOf] = useState(draft.meta.asOf);
  const [disclaimerVersion, setDisclaimerVersion] = useState(draft.meta.disclaimerVersion);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates()
      .then((d) => {
        setTemplates(d.templates);
        setAsOf(d.asOf);
        setDisclaimerVersion(d.disclaimerVersion);
      })
      .catch(() => setErr("템플릿을 불러오지 못했어요."));
  }, []);

  // MVP: 설문 대신 임시 기본 profile (나중에 /onboarding 페이지에서 채움)
  const profile: Profile = useMemo(
    () =>
      draft.profile ?? {
        horizon: "10_PLUS",
        volatility: "MED",
        cashflowNeed: { enabled: false, monthlyTarget: null },
        bigExpense: "NONE",
        accounts: { isa: true, pension: true, irp: false, taxable: true },
      },
    [draft.profile]
  );

  const currentTemplate = useMemo(() => {
    if (!templates.length) return null;
    const tid = draft.portfolio?.templateId ?? "T1";
    return templates.find((t) => t.id === tid) ?? templates[0];
  }, [templates, draft.portfolio?.templateId]);

  const portfolio: Portfolio | null = useMemo(() => {
    if (!currentTemplate) return null;
    if (draft.portfolio) return draft.portfolio;
    return { templateId: currentTemplate.id, weights: currentTemplate.weights };
  }, [draft.portfolio, currentTemplate]);

  useEffect(() => {
    // 초기 portfolio가 비어있으면 템플릿 기반으로 세팅
    if (!portfolio) return;
    if (!draft.portfolio) {
      setDraft((prev) => ({
        ...prev,
        meta: { ...prev.meta, savedAt: new Date().toISOString(), asOf, disclaimerVersion },
        profile,
        portfolio,
      }));
    }
  }, [portfolio, draft.portfolio, setDraft, asOf, disclaimerVersion, profile]);

  const weights = portfolio?.weights;
  const sum = weights ? sumWeights(weights) : 0;
  const dividendPct = weights?.DIVIDEND ?? 0;

  const canRecommend =
    !!draft.profile &&
    !!draft.portfolio &&
    sum === 100 &&
    (dividendPct === 0 || draft.agreedDividendWarning === true);

  const onChangeTemplate = (tid: string) => {
    const t = templates.find((x) => x.id === tid);
    if (!t) return;
    setDraft((prev) => ({
      ...prev,
      meta: { ...prev.meta, savedAt: new Date().toISOString(), asOf, disclaimerVersion },
      profile,
      portfolio: { templateId: t.id, weights: t.weights },
      result: null,
      agreedDividendWarning: false,
    }));
  };

  const onChangeWeight = (key: AssetBucket, newVal: number) => {
    if (!draft.portfolio) return;
    const nextWeights = normalizeWeights(draft.portfolio.weights, key, newVal, "CASH");
    setDraft((prev) => ({
      ...prev,
      meta: { ...prev.meta, savedAt: new Date().toISOString(), asOf, disclaimerVersion },
      profile,
      portfolio: { ...prev.portfolio!, weights: nextWeights },
      result: null,
    }));
  };

  const runRecommend = async () => {
    if (!draft.portfolio) return;
    setErr(null);
    setLoading(true);
    try {
      const res = await postRecommend({
        asOf,
        disclaimerVersion,
        profile,
        portfolio: draft.portfolio,
      });
      setDraft((prev) => ({
        ...prev,
        meta: { ...prev.meta, savedAt: new Date().toISOString(), asOf, disclaimerVersion },
        profile,
        result: res,
      }));
    } catch {
      setErr("추천 생성에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  const onDownloadPdf = async () => {
    if (!draft.result || !draft.portfolio) return;
    const payload = {
      asOf,
      disclaimerVersion,
      profile,
      portfolio: draft.portfolio,
      variants: draft.result.variants,
      assumptions: draft.result.assumptions,
    };
    await downloadPdf(payload);
  };

  if (err) {
    // 최소 오류 화면
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>계좌 배치 결정기 (MVP)</h1>

      {err && <div style={{ marginBottom: 12, padding: 12, border: "1px solid #ddd" }}>{err}</div>}

      {/* 템플릿 선택 */}
      <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <b>템플릿</b>
          <select value={portfolio?.templateId ?? "T1"} onChange={(e) => onChangeTemplate(e.target.value)}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} · {t.name}
              </option>
            ))}
          </select>
          <button onClick={reset}>새로 시작</button>
        </div>

        {currentTemplate?.warnings?.length ? (
          <ul>
            {currentTemplate.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* 비중 편집 */}
      <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
        <b>자산 비중 (합계 {sum}%)</b>
        <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
          {weights &&
            (Object.keys(weights) as AssetBucket[]).map((k) => (
              <div key={k} style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>
                    {ASSET_LABEL[k]} <span style={{ color: "#666" }}>({currentTemplate?.examples?.[k]?.join(", ")})</span>
                  </span>
                  <span>{weights[k]}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={weights[k]}
                  onChange={(e) => onChangeWeight(k, Number(e.target.value))}
                />
                {/* 모바일 조작성 보완 */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onChangeWeight(k, Math.max(0, weights[k] - 5))}>-5</button>
                  <button onClick={() => onChangeWeight(k, Math.min(100, weights[k] + 5))}>+5</button>
                </div>
              </div>
            ))}
        </div>

        {/* 배당 경고 동의 */}
        {dividendPct > 0 && (
          <label style={{ display: "block", marginTop: 12 }}>
            <input
              type="checkbox"
              checked={draft.agreedDividendWarning === true}
              onChange={(e) => setDraft((prev) => ({ ...prev, agreedDividendWarning: e.target.checked }))}
            />{" "}
            배당/커버드콜/리츠는 구조에 따라 총수익이 낮아질 수 있음(경고를 이해했어요)
          </label>
        )}
      </section>

      {/* 추천 실행 */}
      <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
        <button disabled={!canRecommend || loading} onClick={runRecommend}>
          {loading ? "추천 생성 중..." : "추천 생성"}
        </button>
        {!canRecommend && (
          <div style={{ marginTop: 8, color: "#666" }}>
            조건: (1) 설문/포트 완료 (2) 비중 합 100 (3) 배당 비중이 있으면 경고 동의
          </div>
        )}
      </section>

      {/* 결과 */}
      {draft.result && (
        <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <b>추천 결과</b>
            <button onClick={onDownloadPdf}>PDF 다운로드</button>
          </div>

          {draft.result.variants.map((v) => (
            <div key={v.type} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
              <b>{v.type}</b>
              <ul>
                {v.allocations.map((a, idx) => (
                  <li key={idx}>
                    {a.accountType} ← {a.assetBucket} {a.weightPct}%
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: 8 }}>
                <b>이유</b>
                <ul>{v.rationale.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>

              <div style={{ marginTop: 8 }}>
                <b>다음 행동</b>
                <ul>{v.todos.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 12, padding: 10, border: "1px solid #eee" }}>
            <b>면책/가정</b>
            <ul style={{ marginTop: 6 }}>
              <li>교육/정보 목적이며 투자 조언이 아닙니다.</li>
              <li>원금 손실 가능. 과거 성과가 미래 수익을 보장하지 않습니다.</li>
              <li>세제/제도는 기준 시점 단순화 모델로 실제와 다를 수 있습니다.</li>
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
