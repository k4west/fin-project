// src/api.ts
import type { RecommendResponse, Template, Profile, Portfolio } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? ""; // 예: http://localhost:8000

export async function fetchTemplates(): Promise<{ asOf: string; disclaimerVersion: string; templates: Template[] }> {
  const r = await fetch(`${API_BASE}/api/templates`);
  if (!r.ok) throw new Error("templates fetch failed");
  return r.json();
}

export async function postRecommend(input: {
  asOf: string;
  disclaimerVersion: string;
  profile: Profile;
  portfolio: Portfolio;
}): Promise<RecommendResponse> {
  const r = await fetch(`${API_BASE}/api/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error("recommend failed");
  return r.json();
}

export async function downloadPdf(payload: unknown, filename = "계좌배치_제안서.pdf"): Promise<void> {
  const r = await fetch(`${API_BASE}/api/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("pdf failed");

  const blob = await r.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}
