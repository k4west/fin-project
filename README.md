# 계좌 배치 결정기 (MVP)

FastAPI 백엔드 + Vite(React/TypeScript) 프론트로 구성된 Starter 포트폴리오/계좌 배치 제안 MVP입니다.

## 폴더 구조 제안
- `app/` : FastAPI 애플리케이션 진입점(`main.py`)
- `fonts/` : PDF에 임베드할 Noto Sans KR TTF 파일 위치 (필수)
- `frontend/` : Vite + React + TypeScript 프론트엔드 소스
- `fin_project_ex/` : 제공된 참고 자료(변경 없음)
- `requirements.txt` : 백엔드 의존성 목록

## 사전 준비
- `fonts/NotoSansKR-Regular.ttf` 파일을 직접 추가해야 PDF 한글 깨짐을 막을 수 있습니다. (Google Fonts "Noto Sans KR" Regular TTF 파일명 그대로 배치)
- `.env` 또는 `frontend/.env`에 `VITE_API_BASE`가 설정되어야 합니다. 기본 예시는 `.env.example` 참조.

## 실행 방법
### 백엔드 (FastAPI)
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 프론트엔드 (Vite + React)
```bash
cd frontend
npm install
npm run dev # 기본 포트 5173
```

## 주요 흐름
1. `/onboarding` 설문 5문항 → 점수 기반 템플릿 자동 선택
2. `/portfolio`에서 템플릿/슬라이더로 비중 조정(합계 100 검증) + 배당 경고 동의
3. 추천 생성(BASE/GROWTH/CASHFLOW) 호출 → `/result`에서 확인 및 PDF 다운로드
4. 로컬 저장(localStorage key: `portfolio_draft_v1`)으로 새로고침/재방문 시 상태 복원, "새로 시작"으로 초기화

## PDF 생성 주의
- `fonts/NotoSansKR-Regular.ttf`가 없으면 `/api/pdf`는 500 에러와 함께 추가 안내를 반환합니다. 폰트 파일을 추가한 뒤 다시 시도하세요.

