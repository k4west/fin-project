# API 명세 v0 (FastAPI)

## Base
- Base URL: /api
- Auth: MVP는 인증 없음(게스트). 추후 확장 고려.

---

## 1) 템플릿 목록
GET /api/templates
### Response 200
{
  "asOf": "2026-01-05",
  "disclaimerVersion": "v1",
  "templates": [
    {
      "id": "T1",
      "name": "초심자 기본(균형형)",
      "weights": { "EQUITY_INDEX": 60, "BOND": 30, "CASH": 10, "DIVIDEND": 0 },
      "examples": {
        "EQUITY_INDEX": ["S&P 500", "MSCI ACWI"],
        "BOND": ["국채(중장기)", "종합채권"],
        "CASH": ["MMF", "단기채"],
        "DIVIDEND": ["배당 ETF", "커버드콜 ETF", "리츠"]
      },
      "warnings": []
    }
  ]
}

---

## 2) 추천 생성(결과 JSON)
POST /api/recommend
### Request
{
  "asOf": "2026-01-05",
  "disclaimerVersion": "v1",
  "profile": {
    "horizon": "10_PLUS",
    "volatility": "MED",
    "cashflowNeed": { "enabled": false, "monthlyTarget": null },
    "bigExpense": "NONE",
    "accounts": { "isa": true, "pension": true, "irp": false, "taxable": true }
  },
  "portfolio": {
    "templateId": "T1",
    "weights": { "EQUITY_INDEX": 60, "BOND": 30, "CASH": 10, "DIVIDEND": 0 }
  }
}

### Response 200
{
  "asOf": "2026-01-05",
  "disclaimerVersion": "v1",
  "variants": [
    {
      "type": "BASE",
      "allocations": [
        { "accountType": "PENSION_OR_IRP", "assetBucket": "EQUITY_INDEX", "weightPct": 60 },
        { "accountType": "ISA", "assetBucket": "BOND", "weightPct": 30 },
        { "accountType": "TAXABLE", "assetBucket": "CASH", "weightPct": 10 }
      ],
      "rationale": ["장기 성장 자산은 장기 계좌 우선", "중기 완충 자산은 ISA로 분산"],
      "warnings": ["본 결과는 교육 목적이며 투자 조언이 아님", "원금 손실 가능"],
      "todos": ["보유 계좌의 투자 가능 범위를 확인", "배당/커버드콜 구조를 확인"]
    }
  ],
  "assumptions": ["세제/제도는 2026-01 기준 단순화 모델"]
}

---

## 3) PDF 생성(1장)
POST /api/pdf
### Request
(recommend 응답 + 화면에 보여준 핵심을 그대로 전달)
```json
{
  "asOf": "2026-01-05",
  "disclaimerVersion": "v1",
  "profile": {...},
  "portfolio": {...},
  "variants": [...],
  "assumptions": [...]
}
```

### Response 200
- Content-Type: application/pdf
- Body: PDF bytes

---

## 에러 규격(공통)
```json
{
  "error": {
    "code": "VALIDATION_ERROR|PDF_ERROR|INTERNAL",
    "message": "human readable",
    "details": {...}
  }
}
```
