// src/types.ts
export type AssetBucket = "EQUITY_INDEX" | "BOND" | "CASH" | "DIVIDEND";
export type AccountType = "ISA" | "PENSION" | "IRP" | "TAXABLE" | "PENSION_OR_IRP";
export type Horizon = "1_3" | "3_5" | "5_10" | "10_PLUS";
export type Volatility = "LOW" | "MED" | "HIGH";
export type BigExpense = "NONE" | "IN_1Y" | "IN_3Y";

export type CashflowNeed = { enabled: boolean; monthlyTarget?: number | null };

export type Accounts = {
  isa: boolean;
  pension: boolean;
  irp: boolean;
  taxable: boolean;
};

export type Profile = {
  horizon: Horizon;
  volatility: Volatility;
  cashflowNeed: CashflowNeed;
  bigExpense: BigExpense;
  accounts: Accounts;
};

export type Template = {
  id: string;
  name: string;
  weights: Record<AssetBucket, number>;
  examples: Record<AssetBucket, string[]>;
  warnings: string[];
};

export type Portfolio = {
  templateId: string;
  weights: Record<AssetBucket, number>;
};

export type Allocation = {
  accountType: AccountType;
  assetBucket: AssetBucket;
  weightPct: number;
};

export type Variant = {
  type: "BASE" | "GROWTH" | "CASHFLOW";
  allocations: Allocation[];
  rationale: string[];
  warnings: string[];
  todos: string[];
};

export type RecommendResponse = {
  asOf: string;
  disclaimerVersion: string;
  variants: Variant[];
  assumptions: string[];
};

export type Draft = {
  meta: { savedAt: string; asOf: string; disclaimerVersion: string };
  profile: Profile | null;
  portfolio: Portfolio | null;
  result: RecommendResponse | null;
  agreedDividendWarning?: boolean; // 배당>0일 때 경고 동의
};

export const ASSET_LABEL: Record<AssetBucket, string> = {
  EQUITY_INDEX: "주식지수",
  BOND: "채권",
  CASH: "현금",
  DIVIDEND: "배당/인컴",
};
