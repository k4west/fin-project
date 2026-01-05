from datetime import date
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field, validator
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ASSET_BUCKET = Literal["EQUITY_INDEX", "BOND", "CASH", "DIVIDEND"]
ACCOUNT_TYPE = Literal["ISA", "PENSION", "IRP", "TAXABLE", "PENSION_OR_IRP"]


class CashflowNeed(BaseModel):
    enabled: bool
    monthlyTarget: Optional[int] = None


class Accounts(BaseModel):
    isa: bool = True
    pension: bool = True
    irp: bool = False
    taxable: bool = True


class Profile(BaseModel):
    horizon: Literal["1_3", "3_5", "5_10", "10_PLUS"]
    volatility: Literal["LOW", "MED", "HIGH"]
    cashflowNeed: CashflowNeed
    bigExpense: Literal["NONE", "IN_1Y", "IN_3Y"]
    accounts: Accounts


class Portfolio(BaseModel):
    templateId: str
    weights: Dict[ASSET_BUCKET, int]

    @validator("weights")
    def weights_sum_100(cls, v: Dict[str, int]):
        s = sum(v.values())
        if s != 100:
            raise ValueError(f"weights sum must be 100, got {s}")
        return v


class RecommendRequest(BaseModel):
    asOf: str = Field(..., description="기준 시점 (yyyy-mm-dd)")
    disclaimerVersion: str
    profile: Profile
    portfolio: Portfolio


class Allocation(BaseModel):
    accountType: ACCOUNT_TYPE
    assetBucket: ASSET_BUCKET
    weightPct: int


class Variant(BaseModel):
    type: Literal["BASE", "GROWTH", "CASHFLOW"]
    allocations: List[Allocation]
    rationale: List[str]
    warnings: List[str]
    todos: List[str]


class RecommendResponse(BaseModel):
    asOf: str
    disclaimerVersion: str
    variants: List[Variant]
    assumptions: List[str]


class PdfRequest(BaseModel):
    asOf: str
    disclaimerVersion: str
    profile: dict
    portfolio: dict
    variants: list
    assumptions: list


app = FastAPI(title="Account Allocator API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FONT_PATH = Path(__file__).resolve().parent.parent / "fonts" / "NotoSansKR-Regular.ttf"

TEMPLATES = [
    {
        "id": "T1",
        "name": "초심자 기본(균형)",
        "weights": {"EQUITY_INDEX": 60, "BOND": 30, "CASH": 10, "DIVIDEND": 0},
        "examples": {
            "EQUITY_INDEX": ["S&P 500", "MSCI ACWI", "NASDAQ 100", "KOSPI 200"],
            "BOND": ["국채(중장기)", "종합채권"],
            "CASH": ["MMF", "단기채", "예금/현금성"],
            "DIVIDEND": ["배당 ETF", "커버드콜 ETF", "리츠", "인컴형 펀드"],
        },
        "warnings": [],
    },
    {
        "id": "T2",
        "name": "안정형",
        "weights": {"EQUITY_INDEX": 30, "BOND": 55, "CASH": 15, "DIVIDEND": 0},
        "examples": {
            "EQUITY_INDEX": ["KOSPI 200", "MSCI ACWI"],
            "BOND": ["국채(중장기)", "종합채권"],
            "CASH": ["MMF", "단기채"],
            "DIVIDEND": ["배당 ETF", "커버드콜 ETF", "리츠"],
        },
        "warnings": ["안정형은 장기 수익률이 낮아질 수 있습니다."],
    },
    {
        "id": "T3",
        "name": "공격형",
        "weights": {"EQUITY_INDEX": 85, "BOND": 10, "CASH": 5, "DIVIDEND": 0},
        "examples": {
            "EQUITY_INDEX": ["S&P 500", "NASDAQ 100", "MSCI ACWI"],
            "BOND": ["국채(중장기)", "종합채권"],
            "CASH": ["MMF", "단기채"],
            "DIVIDEND": ["배당 ETF", "커버드콜 ETF", "리츠"],
        },
        "warnings": ["큰 낙폭이 발생할 수 있습니다. 감내 가능 범위 점검이 필요합니다."],
    },
    {
        "id": "T4",
        "name": "현금흐름형",
        "weights": {"EQUITY_INDEX": 40, "BOND": 20, "CASH": 10, "DIVIDEND": 30},
        "examples": {
            "EQUITY_INDEX": ["S&P 500", "MSCI ACWI"],
            "BOND": ["국채(중장기)", "종합채권"],
            "CASH": ["MMF", "단기채"],
            "DIVIDEND": ["배당 ETF", "커버드콜 ETF", "리츠", "인컴형 펀드"],
        },
        "warnings": [
            "분배금이 있어도 총수익이 더 낮을 수 있습니다.",
            "커버드콜은 상승 수익을 제한할 수 있습니다.",
            "리츠/인컴 자산은 금리·경기 영향이 큽니다.",
        ],
    },
    {
        "id": "T5",
        "name": "단기목표",
        "weights": {"EQUITY_INDEX": 20, "BOND": 45, "CASH": 35, "DIVIDEND": 0},
        "examples": {
            "EQUITY_INDEX": ["S&P 500", "MSCI ACWI"],
            "BOND": ["단기~중기 국채", "종합채권"],
            "CASH": ["MMF", "단기채", "예금/현금성"],
            "DIVIDEND": ["배당 ETF", "커버드콜 ETF", "리츠"],
        },
        "warnings": ["단기 목표라면 투자 자체가 부적합할 수 있습니다. 현금성 우선 고려."],
    },
]


def today_str():
    return str(date.today())


@app.get("/api/templates")
def get_templates():
    return {
        "asOf": today_str(),
        "disclaimerVersion": "v1",
        "templates": TEMPLATES,
    }


def _preferred_account(accounts: Accounts, priority: List[str]) -> ACCOUNT_TYPE:
    for key in priority:
        if key == "PENSION_OR_IRP" and (accounts.pension or accounts.irp):
            return "PENSION_OR_IRP"
        if key == "PENSION" and accounts.pension:
            return "PENSION"
        if key == "IRP" and accounts.irp:
            return "IRP"
        if key == "ISA" and accounts.isa:
            return "ISA"
        if key == "TAXABLE" and accounts.taxable:
            return "TAXABLE"
    return "TAXABLE"


def build_variants(req: RecommendRequest) -> List[Variant]:
    w = req.portfolio.weights
    accounts = req.profile.accounts
    cashflow_focus = req.profile.cashflowNeed.enabled or w.get("DIVIDEND", 0) > 0

    long_term_acc = _preferred_account(accounts, ["PENSION_OR_IRP", "PENSION", "IRP", "ISA", "TAXABLE"])
    mid_term_acc = _preferred_account(accounts, ["ISA", "PENSION", "IRP", "TAXABLE"])
    cash_acc = _preferred_account(accounts, ["TAXABLE", "ISA", "PENSION", "IRP"])

    dividend_acc = mid_term_acc if cashflow_focus else long_term_acc

    base_allocs: List[Allocation] = []
    if w.get("EQUITY_INDEX", 0) > 0:
        base_allocs.append(
            Allocation(accountType=long_term_acc, assetBucket="EQUITY_INDEX", weightPct=w["EQUITY_INDEX"])
        )
    if w.get("BOND", 0) > 0:
        base_allocs.append(Allocation(accountType=mid_term_acc, assetBucket="BOND", weightPct=w["BOND"]))
    if w.get("CASH", 0) > 0:
        base_allocs.append(Allocation(accountType=cash_acc, assetBucket="CASH", weightPct=w["CASH"]))
    if w.get("DIVIDEND", 0) > 0:
        base_allocs.append(Allocation(accountType=dividend_acc, assetBucket="DIVIDEND", weightPct=w["DIVIDEND"]))

    common_warnings = [
        "교육/정보 목적이며 투자 조언이 아닙니다.",
        "원금 손실 가능. 과거 성과가 미래 수익을 보장하지 않습니다.",
        "세제/제도는 기준 시점 단순화 모델로 실제와 다를 수 있습니다.",
    ]
    if w.get("DIVIDEND", 0) > 0:
        common_warnings += [
            "배당/커버드콜/리츠는 구조에 따라 총수익이 낮아질 수 있습니다.",
            "커버드콜은 상승 수익을 제한할 수 있습니다.",
        ]

    base = Variant(
        type="BASE",
        allocations=base_allocs,
        rationale=[
            "장기 성장 자산은 연금/IRP 우선 배치",
            "채권은 ISA·연금 등 과세 이점이 있는 계좌 활용",
            "현금성은 출금 유연성이 높은 일반 계좌 우선",
        ],
        warnings=common_warnings,
        todos=["보유 계좌별 투자 가능/한도 확인", "배당·커버드콜 구조(분배 정책) 확인"],
    )

    growth = Variant(
        type="GROWTH",
        allocations=base_allocs,
        rationale=[
            "성장 자산 과세이연/저율 계좌(ISAs, 연금/IRP) 활용 강조",
            "현금 비중 최소화로 투자 효율 극대화(단기 지출 시 별도 현금 관리)",
        ],
        warnings=common_warnings,
        todos=["장기 유지 가능한 자금인지 점검", "인출 시점의 세제/규정 확인"],
    )

    cashflow_v = Variant(
        type="CASHFLOW",
        allocations=base_allocs,
        rationale=["분배금 활용 계획(인출/재투자)에 맞춰 ISA·일반 계좌를 우선 사용"],
        warnings=common_warnings,
        todos=["분배금 세후 현금흐름 예상", "재투자/사용 비중 계획"],
    )

    return [base, growth, cashflow_v]


@app.post("/api/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest):
    variants = build_variants(req)
    return RecommendResponse(
        asOf=req.asOf,
        disclaimerVersion=req.disclaimerVersion,
        variants=variants,
        assumptions=[
            f"기준 시점: {req.asOf} (단순화 모델)",
            "세금/수수료/상품 제약은 간략화되어 있습니다.",
        ],
    )


def _load_font_or_fail():
    if not FONT_PATH.exists():
        raise HTTPException(
            status_code=500,
            detail={
                "error": {
                    "code": "FONT_MISSING",
                    "message": "fonts/NotoSansKR-Regular.ttf 파일을 추가한 뒤 다시 시도해주세요.",
                }
            },
        )
    pdfmetrics.registerFont(TTFont("NotoSansKR", str(FONT_PATH)))


@app.post("/api/pdf")
def make_pdf(req: PdfRequest):
    try:
        _load_font_or_fail()
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail={"error": {"code": "FONT_ERROR", "message": str(exc)}})

    try:
        buf = BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        width, height = A4

        c.setFont("NotoSansKR", 14)
        c.drawString(40, height - 50, f"계좌 배치 제안서 (기준: {req.asOf})")

        c.setFont("NotoSansKR", 10)
        c.drawString(40, height - 70, f"면책 버전: {req.disclaimerVersion}")

        y = height - 100
        c.setFont("NotoSansKR", 11)
        c.drawString(40, y, "1) 선택 템플릿 및 비중")
        y -= 18
        weights = req.portfolio.get("weights", {}) if isinstance(req.portfolio, dict) else {}
        c.setFont("NotoSansKR", 10)
        c.drawString(
            55,
            y,
            f"주식지수 {weights.get('EQUITY_INDEX', 0)}% / 채권 {weights.get('BOND', 0)}% / 현금 {weights.get('CASH', 0)}% / 배당 {weights.get('DIVIDEND', 0)}%",
        )
        y -= 22

        c.setFont("NotoSansKR", 11)
        c.drawString(40, y, "2) 추천 3안 요약")
        y -= 18
        c.setFont("NotoSansKR", 9)
        for v in req.variants[:3]:
            allocations = v.get("allocations", []) if isinstance(v, dict) else []
            alloc_str = ", ".join(
                [f"{a['accountType']}에 {a['assetBucket']} {a['weightPct']}%" for a in allocations if isinstance(a, dict)]
            )
            c.drawString(55, y, f"- {v.get('type')}: {alloc_str}")
            y -= 14
            rationale = v.get("rationale", []) if isinstance(v, dict) else []
            if rationale:
                c.drawString(65, y, "이유: " + "; ".join(rationale[:2]))
                y -= 14
            if y < 120:
                break

        footer_lines = [
            "본 결과는 교육/정보 목적이며 투자 조언이 아닙니다.",
            "원금 손실 가능. 과거 성과가 미래 수익을 보장하지 않습니다.",
            "세제/제도는 기준 시점 단순화 모델로 실제와 다를 수 있습니다.",
        ]
        c.setFont("NotoSansKR", 8)
        fy = 70
        for line in footer_lines:
            c.drawString(40, fy, line)
            fy -= 12

        c.showPage()
        c.save()

        pdf = buf.getvalue()
        return Response(content=pdf, media_type="application/pdf")
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail={"error": {"code": "PDF_ERROR", "message": str(exc)}})
