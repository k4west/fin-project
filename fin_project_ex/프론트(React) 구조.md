### 라우팅
- `/` Landing
- `/onboarding` 설문(5문항)
- `/portfolio` 템플릿 선택 + 비중 편집
- `/result` 추천 3안 + PDF 버튼

### 상태(로컬 저장)
- `useLocalStorageState('portfolio_draft_v1')`
- 저장 항목: profile / portfolio / result / meta

### 컴포넌트 설계(최소)
- `OnboardingForm`
- `TemplateSelector`
- `WeightSliderRow` (자산군별)
- `ResultTabs` (BASE/GROWTH/CASHFLOW)
- `DisclaimerBox` (고정)
- `PdfDownloadButton`

### 모바일 UX 팁(구현 규칙)
- 슬라이더는 “증감 버튼(+/-)”도 같이 제공(모바일 조작성↑)
- 합 100이 아니면 “자동 보정(나머지에 반영)” 옵션 1개 제공
- 배당 비중 > 0이면 “경고 체크박스 동의” 노출 후 진행 가능

### API 호출
- `GET /api/templates` (초기 1회)
- `POST /api/recommend` (결과 생성)
- `POST /api/pdf` (blob 다운로드)