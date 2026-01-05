import { downloadPdf } from "../../api";
import { useDraft } from "../../store/useDraft";
import { useNavigate } from "react-router-dom";

export default function Result() {
  const { state: draft } = useDraft();
  const nav = useNavigate();

  if (!draft.result || !draft.portfolio || !draft.profile) {
    return (
      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <div style={{ marginBottom: 8 }}>추천 결과가 아직 없어요.</div>
        <button onClick={() => nav("/portfolio")}>포트폴리오로 이동</button>
      </div>
    );
  }

  const onDownloadPdf = async () => {
    const payload = {
      asOf: draft.meta.asOf,
      disclaimerVersion: draft.meta.disclaimerVersion,
      profile: draft.profile,
      portfolio: draft.portfolio,
      variants: draft.result?.variants ?? [],
      assumptions: draft.result?.assumptions ?? [],
    };
    await downloadPdf(payload);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>추천 결과</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => nav("/portfolio")}>비중 다시 조정</button>
          <button onClick={onDownloadPdf}>PDF 다운로드</button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#555" }}>기준일: {draft.meta.asOf} · 면책 버전: {draft.meta.disclaimerVersion}</div>

      <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
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

            {v.warnings.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <b>경고</b>
                <ul>{v.warnings.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            )}
          </div>
        ))}
      </section>

      <div style={{ marginTop: 12, padding: 10, border: "1px solid #eee", background: "#fafafa" }}>
        <b>면책/가정</b>
        <ul style={{ marginTop: 6 }}>
          <li>교육/정보 목적이며 투자 조언이 아닙니다.</li>
          <li>원금 손실 가능. 과거 성과가 미래 수익을 보장하지 않습니다.</li>
          <li>세제/제도는 기준 시점 단순화 모델로 실제와 다를 수 있습니다.</li>
          {draft.result.assumptions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
