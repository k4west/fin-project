// src/store/useDraft.ts
import { useLocalStorageState } from "../hooks/useLocalStorageState";
import type { Draft } from "../types";

const KEY = "portfolio_draft_v1";

const emptyDraft: Draft = {
  meta: { savedAt: new Date().toISOString(), asOf: new Date().toISOString().slice(0, 10), disclaimerVersion: "v1" },
  profile: null,
  portfolio: null,
  result: null,
  agreedDividendWarning: false,
};

export function useDraft() {
  return useLocalStorageState<Draft>(KEY, emptyDraft);
}
