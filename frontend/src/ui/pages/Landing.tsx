import { useNavigate } from "react-router-dom";
import { useDraft } from "../../store/useDraft";

export default function Landing() {
  const nav = useNavigate();
  const { state: draft } = useDraft();
  const hasProgress = !!draft.profile || !!draft.portfolio || !!draft.result;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ margin: "0 0 8px" }}>계좌 배치 결정기</h1>
        <p style={{ margin: 0, color: "#444" }}>설문 5문항만으로 Starter 포트폴리오와 계좌 배치 3안을 받아보세요.</p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => nav("/onboarding")}>바로 시작하기</button>
        {hasProgress && <button onClick={() => nav("/portfolio")}>이어하기</button>}
      </div>

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, lineHeight: 1.6 }}>
        <b>동작 흐름</b>
        <ol style={{ marginTop: 8 }}>
          <li>설문(5문항)으로 템플릿 자동 선택</li>
          <li>비중 슬라이더로 조정 &amp; 배당 경고 동의</li>
          <li>추천 3안(BASE/GROWTH/CASHFLOW) 확인</li>
          <li>PDF 1장으로 저장</li>
        </ol>
      </div>
    </div>
  );
}
