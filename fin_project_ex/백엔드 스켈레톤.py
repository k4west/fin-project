# app/main.py
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field, validator
from typing import Literal, Optional, Dict, List
from datetime import date

app = FastAPI(title="Account Allocator API", version="0.1.0")

AssetBucket = Literal["EQUITY_INDEX", "BOND", "CASH", "DIVIDEND"]
AccountType = Literal["ISA", "PENSION", "IRP", "TAXABLE", "PENSION_OR_IRP"]

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
    weights: Dict[AssetBucket, int]

    @validator("weights")
    def weights_sum_100(cls, v):
        s = sum(v.values())
        if s != 100:
            raise ValueError(f"weights sum must be 100, got {s}")
        return v

class RecommendRequest(BaseModel):
    asOf: str
    disclaimerVersion: str
    profile: Profile
    portfolio: Portfolio

class Allocation(BaseModel):
    accountType: AccountType
    assetBucket: AssetBucket
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

TEMPLATES = [
    {
        "id": "T1",
        "name": "초심자 기본(균형형)",
        "weights": {"EQUITY_INDEX": 60, "BOND": 30, "CASH": 10, "DIVIDEND": 0},
        "examples": {
            "EQUITY_INDEX": ["S&P 500", "MSCI ACWI"],
            "BOND": ["국채(중장기)", "종합채권"],
            "CASH": ["MMF", "단기채"],
            "DIVIDEND": ["배당 ETF", "커버드콜 ETF", "리츠"],
        },
        "warnings": [],
    },
    {
        "id": "T2",
        "name": "안정형(변동성 최소)",
        "weights": {"EQUITY_INDEX": 30, "BOND": 55, "CASH": 15, "DIVIDEND": 0},
        "examples": {
            "EQUITY_INDEX": ["KOSPI 200", "MSCI ACWI"],
            "BOND": ["국채(중장기)", "우량채/종합채권"],
            "CASH": ["MMF", "단기채"],
            "DIVIDEND": ["배당 ETF", "커버드콜 ETF", "리츠"],
        },
        "warnings": ["안정형은 장기 수익률이 낮아질 수 있습니다."],
    },
    {
        "id": "T3",
        "name": "공격형(성장 최우선)",
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
        "name": "현금흐름형(배당 중심)",
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
            "리츠/하이일드 등은 금리·경기 영향이 큽니다.",
        ],
    },
    {
        "id": "T5",
        "name": "단기목표형(1~3년)",
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

@app.get("/api/templates")
def get_templates():
    return {
        "asOf": str(date.today()),
        "disclaimerVersion": "v1",
        "templates": TEMPLATES,
    }

def build_variants(req: RecommendRequest) -> List[Variant]:
    w = req.portfolio.weights
    acc = req.profile.accounts
    cashflow = req.profile.cashflowNeed.enabled or (w.get("DIVIDEND", 0) > 0)

    # 계좌 사용 가능 여부에 따라 fallback
    long_acc: AccountType = "PENSION_OR_IRP" if (acc.pension or acc.irp) else ("ISA" if acc.isa else "TAXABLE")
    mid_acc: AccountType = "ISA" if acc.isa else "TAXABLE"
    cash_acc: AccountType = "TAXABLE"

    base_allocs: List[Allocation] = []
    # 기본: 주식지수는 장기 계좌, 채권은 ISA, 현금은 일반, 배당은 ISA/일반(현금흐름이면 ISA 우선)
    if w["EQUITY_INDEX"] > 0:
        base_allocs.append(Allocation(accountType=long_acc, assetBucket="EQUITY_INDEX", weightPct=w["EQUITY_INDEX"]))
    if w["BOND"] > 0:
        base_allocs.append(Allocation(accountType=mid_acc, assetBucket="BOND", weightPct=w["BOND"]))
    if w["CASH"] > 0:
        base_allocs.append(Allocation(accountType=cash_acc, assetBucket="CASH", weightPct=w["CASH"]))
    if w["DIVIDEND"] > 0:
        div_acc: AccountType = mid_acc if cashflow else long_acc
        base_allocs.append(Allocation(accountType=div_acc, assetBucket="DIVIDEND", weightPct=w["DIVIDEND"]))

    common_warnings = [
        "본 결과는 교육 목적이며 투자 조언이 아닙니다.",
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
        rationale=["장기 성장 자산은 장기 계좌 우선", "현금성은 출금 유연성 우선"],
        warnings=common_warnings,
        todos=["보유 계좌의 투자 가능 범위를 확인", "배당/커버드콜 구조(분배 정책)를 확인"],
    )

    # GROWTH: 주식/성장 자산을 ISA/연금에 최대한, 현금 최소
    growth = Variant(
        type="GROWTH",
        allocations=base_allocs,  # MVP에선 동일 + rationale만 다르게(추후 고도화)
        rationale=["성장 자산의 과세/운영 효율을 고려해 장기 계좌 활용을 강조"],
        warnings=common_warnings,
        todos=["장기 유지 가능한지(인출 계획) 점검"],
    )

    # CASHFLOW: 배당은 ISA/일반 쪽 강조 + 현금흐름 사용 계획 점검
    cashflow_v = Variant(
        type="CASHFLOW",
        allocations=base_allocs,
        rationale=["현금흐름 자산은 활용(출금/재투자) 계획이 핵심"],
        warnings=common_warnings,
        todos=["분배금을 사용할지/재투자할지 계획", "배당 자산은 변동성/총수익 관점 재점검"],
    )

    return [base, growth, cashflow_v]

@app.post("/api/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest):
    variants = build_variants(req)
    return RecommendResponse(
        asOf=req.asOf,
        disclaimerVersion=req.disclaimerVersion,
        variants=variants,
        assumptions=[f"기준 시점: {req.asOf} (단순화 모델)"],
    )

# ---- PDF ----
# reportlab로 폰트 임베드해서 1장 생성 (폰트 파일을 프로젝트에 포함시키면 한글 안 깨짐)
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from io import BytesIO

class PdfRequest(BaseModel):
    asOf: str
    disclaimerVersion: str
    profile: dict
    portfolio: dict
    variants: list
    assumptions: list

@app.post("/api/pdf")
def make_pdf(req: PdfRequest):
    try:
        buf = BytesIO()

        # 폰트 파일 경로: 예) ./fonts/NotoSansKR-Regular.ttf
        pdfmetrics.registerFont(TTFont("NotoSansKR", "fonts/NotoSansKR-Regular.ttf"))

        c = canvas.Canvas(buf, pagesize=A4)
        c.setFont("NotoSansKR", 14)
        c.drawString(40, 800, f"계좌 배치 제안서 (기준: {req.asOf})")

        c.setFont("NotoSansKR", 10)
        c.drawString(40, 775, f"면책 버전: {req.disclaimerVersion}")

        # 요약(간단)
        y = 745
        c.setFont("NotoSansKR", 11)
        c.drawString(40, y, "1) 선택 템플릿 및 비중"); y -= 18
        c.setFont("NotoSansKR", 10)
        weights = req.portfolio.get("weights", {})
        c.drawString(55, y, f"- 주식지수 {weights.get('EQUITY_INDEX',0)}% / 채권 {weights.get('BOND',0)}% / 현금 {weights.get('CASH',0)}% / 배당 {weights.get('DIVIDEND',0)}%"); y -= 22

        c.setFont("NotoSansKR", 11)
        c.drawString(40, y, "2) 추천 3안(요약)"); y -= 18
        c.setFont("NotoSansKR", 9)
        for v in req.variants[:3]:
            c.drawString(55, y, f"- {v.get('type')}: " + ", ".join([f"{a['accountType']}에 {a['assetBucket']} {a['weightPct']}%" for a in v.get("allocations", [])])); y -= 14
            if y < 130:
                break

        # 하단 면책
        c.setFont("NotoSansKR", 8)
        footer = [
            "본 결과는 교육/정보 목적이며 투자 조언이 아닙니다.",
            "원금 손실 가능. 과거 성과가 미래 수익을 보장하지 않습니다.",
            "세제/제도는 기준 시점 단순화 모델로 실제와 다를 수 있습니다.",
        ]
        fy = 70
        for line in footer:
            c.drawString(40, fy, line); fy -= 12

        c.showPage()
        c.save()

        pdf = buf.getvalue()
        return Response(content=pdf, media_type="application/pdf")
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": {"code": "PDF_ERROR", "message": str(e)}})
