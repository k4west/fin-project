// src/ui/RootLayout.tsx
import { Outlet, Link, useNavigate } from "react-router-dom";
import { useDraft } from "../store/useDraft";

export default function RootLayout() {
  const nav = useNavigate();
  const { reset } = useDraft();

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link to="/" style={{ textDecoration: "none" }}>
          <b>계좌 배치 결정기</b>
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => nav("/onboarding")}>설문</button>
          <button onClick={() => nav("/portfolio")}>포트</button>
          <button
            onClick={() => {
              reset();
              nav("/");
            }}
          >
            새로 시작
          </button>
        </div>
      </header>

      <hr style={{ margin: "16px 0" }} />
      <Outlet />
      <hr style={{ margin: "16px 0" }} />

      <footer style={{ fontSize: 12, color: "#666", lineHeight: 1.4 }}>
        <div>교육/정보 목적이며 투자 조언이 아닙니다.</div>
        <div>원금 손실 가능. 과거 성과가 미래 수익을 보장하지 않습니다.</div>
        <div>세제/제도는 기준 시점 단순화 모델이며 실제와 다를 수 있습니다.</div>
      </footer>
    </div>
  );
}
