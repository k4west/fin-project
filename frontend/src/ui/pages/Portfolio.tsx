import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ASSET_LABEL, AssetBucket, Portfolio as PortfolioType, Profile, Template } from "../../types";
import { useDraft } from "../../store/useDraft";
import { fetchTemplates, postRecommend } from "../../api";
import { normalizeWeights, sumWeights } from "../../utils/weights";

const defaultProfile: Profile = {
  horizon: "10_PLUS",
  volatility: "MED",
  cashflowNeed: { enabled: false, monthlyTarget: null },
  bigExpense: "NONE",
  accounts: { isa: true, pension: true, irp: false, taxable: true },
};

export default function Portfolio() {
  const { state: draft, setState: setDraft, reset } = useDraft();
  const nav = useNavigate();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [asOf, setAsOf] = useState(draft.meta.asOf);
  const [disclaimerVersion, setDisclaimerVersion] = useState(draft.meta.disclaimerVersion);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTemplates()
      .then((d) => {
        setTemplates(d.templates);
        setAsOf(d.asOf);
        setDisclaimerVersion(d.disclaimerVersion);
      })
      .catch(() => setErr("템플릿을 불러오지 못했어요."));
  }, []);

  useEffect(() => {
    if (!draft.profile) {
      setDraft((prev) => ({ ...prev, profile: defaultProfile }));
    }
  }, [draft.profile, setDraft]);

  const profile = draft.profile ?? defaultProfile;

  const currentTemplate = useMemo(() => {
    if (!templates.length) return null;
    const tid = draft.portfolio?.templateId ?? "T1";
    return templates.find((t) => t.id === tid) ?? templates[0];
  }, [templates, draft.portfolio?.templateId]);

  const portfolio: PortfolioType | null = useMemo(() => {
    if (!currentTemplate) return null;
    if (draft.portfolio) return draft.portfolio;
    return { templateId: currentTemplate.id, weights: currentTemplate.weights };
  }, [draft.portfolio, currentTemplate]);

  useEffect(() => {
    if (!portfolio || !currentTemplate) return;
    if (!draft.portfolio) {
      setDraft((prev) => ({
        ...prev,
        meta: { ...prev.meta, savedAt: new Date().toISOString(), asOf, disclaimerVersion },
        profile,
        portfolio,
      }));
    }
  }, [portfolio, draft.portfolio, setDraft, asOf, disclaimerVersion, profile, currentTemplate]);

  const weights = portfolio?.weights ?? (currentTemplate?.weights ?? {} as any);
  const sum = weights ? sumWeights(weights as any) : 0;
  const dividendPct = (weights as any)?.DIVIDEND ?? 0;

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
    if (!draft.portfolio || !draft.profile) return;
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
      nav("/result");
    } catch {
      setErr("추천 생성에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>포트폴리오 설정</h2>
        <button onClick={() => nav("/onboarding")}>설문 수정</button>
      </div>

      {err && <div style={{ padding: 12, border: "1px solid #ddd" }}>{err}</div>}

      <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <b>템플릿</b>
          <select value={portfolio?.templateId ?? ""} onChange={(e) => onChangeTemplate(e.target.value)}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} · {t.name}
              </option>
            ))}
          </select>
          <button onClick={reset}>새로 시작</button>
        </div>
        {currentTemplate?.warnings?.length ? (
          <ul style={{ marginTop: 8 }}>
            {currentTemplate.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
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
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onChangeWeight(k, Math.max(0, weights[k] - 5))}>-5</button>
                  <button onClick={() => onChangeWeight(k, Math.min(100, weights[k] + 5))}>+5</button>
                </div>
              </div>
            ))}
        </div>
        {dividendPct > 0 && (
          <label style={{ display: "block", marginTop: 12, lineHeight: 1.5 }}>
            <input
              type="checkbox"
              checked={draft.agreedDividendWarning === true}
              onChange={(e) => setDraft((prev) => ({ ...prev, agreedDividendWarning: e.target.checked }))}
            />{" "}
            배당/커버드콜/리츠는 구조에 따라 총수익이 낮아질 수 있음(경고를 이해했어요)
          </label>
        )}
      </section>

      <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <button disabled={!canRecommend || loading} onClick={runRecommend}>
          {loading ? "추천 생성 중..." : "추천 생성"}
        </button>
        {!canRecommend && (
          <div style={{ marginTop: 8, color: "#666" }}>
            조건: (1) 설문/포트 완료 (2) 비중 합 100 (3) 배당 비중이 있으면 경고 동의
          </div>
        )}
      </section>
    </div>
  );
}
