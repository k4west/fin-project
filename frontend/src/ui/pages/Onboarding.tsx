import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchTemplates } from "../../api";
import type { Profile, Template } from "../../types";
import { pickBestTemplate, explainPick } from "../../logic/templateScoring";
import { useDraft } from "../../store/useDraft";

const defaultProfile: Profile = {
  horizon: "10_PLUS",
  volatility: "MED",
  cashflowNeed: { enabled: false, monthlyTarget: null },
  bigExpense: "NONE",
  accounts: { isa: true, pension: true, irp: false, taxable: true },
};

export default function Onboarding() {
  const nav = useNavigate();
  const { state: draft, setState: setDraft } = useDraft();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [meta, setMeta] = useState({ asOf: draft.meta.asOf, disclaimerVersion: draft.meta.disclaimerVersion });

  const [profile, setProfile] = useState<Profile>(draft.profile ?? defaultProfile);

  useEffect(() => {
    fetchTemplates()
      .then((d) => {
        setTemplates(d.templates);
        setMeta({ asOf: d.asOf, disclaimerVersion: d.disclaimerVersion });
      })
      .catch(() => setMsg("템플릿을 불러오지 못했어요."));
  }, []);

  const picked = useMemo(() => {
    if (!templates.length) return null;
    return pickBestTemplate(profile, templates);
  }, [profile, templates]);

  const reasons = useMemo(() => {
    if (!picked) return [];
    return explainPick(profile, picked.id);
  }, [profile, picked]);

  const apply = async () => {
    if (!picked) return;
    setLoading(true);
    setMsg(null);
    try {
      setDraft((prev) => ({
        ...prev,
        meta: { ...prev.meta, savedAt: new Date().toISOString(), asOf: meta.asOf, disclaimerVersion: meta.disclaimerVersion },
        profile,
        portfolio: { templateId: picked.id, weights: picked.weights },
        result: null,
        agreedDividendWarning: false,
      }));
      nav("/portfolio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 8px" }}>설문 (5문항)</h2>
      {msg && <div style={{ padding: 12, border: "1px solid #ddd", marginBottom: 12 }}>{msg}</div>}

      <Section title="1) 투자 기간">
        <Select
          value={profile.horizon}
          onChange={(v) => setProfile((p) => ({ ...p, horizon: v as Profile["horizon"] }))}
          options={[
            ["1_3", "1~3년"],
            ["3_5", "3~5년"],
            ["5_10", "5~10년"],
            ["10_PLUS", "10년+"],
          ]}
        />
      </Section>

      <Section title="2) 변동성 감내">
        <Select
          value={profile.volatility}
          onChange={(v) => setProfile((p) => ({ ...p, volatility: v as Profile["volatility"] }))}
          options={[
            ["LOW", "낮음(하락 스트레스 큼)"],
            ["MED", "중간"],
            ["HIGH", "높음(변동성 감내 가능)"],
          ]}
        />
      </Section>

      <Section title="3) 현금흐름 필요">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label>
            <input
              type="checkbox"
              checked={profile.cashflowNeed.enabled}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  cashflowNeed: { ...p.cashflowNeed, enabled: e.target.checked },
                }))
              }
            />{" "}
            필요함
          </label>
          <input
            type="number"
            placeholder="월 목표(선택)"
            value={profile.cashflowNeed.monthlyTarget ?? ""}
            disabled={!profile.cashflowNeed.enabled}
            onChange={(e) =>
              setProfile((p) => ({
                ...p,
                cashflowNeed: { ...p.cashflowNeed, monthlyTarget: e.target.value ? Number(e.target.value) : null },
              }))
            }
            style={{ width: 160 }}
          />
        </div>
      </Section>

      <Section title="4) 큰 지출 예정">
        <Select
          value={profile.bigExpense}
          onChange={(v) => setProfile((p) => ({ ...p, bigExpense: v as Profile["bigExpense"] }))}
          options={[
            ["NONE", "없음"],
            ["IN_1Y", "1년 내"],
            ["IN_3Y", "3년 내"],
          ]}
        />
      </Section>

      <Section title="5) 보유 계좌(모르면 그대로 두세요)">
        <div style={{ display: "grid", gap: 6 }}>
          <Check
            label="ISA"
            checked={profile.accounts.isa}
            onChange={(checked) => setProfile((p) => ({ ...p, accounts: { ...p.accounts, isa: checked } }))}
          />
          <Check
            label="연금저축"
            checked={profile.accounts.pension}
            onChange={(checked) => setProfile((p) => ({ ...p, accounts: { ...p.accounts, pension: checked } }))}
          />
          <Check
            label="IRP"
            checked={profile.accounts.irp}
            onChange={(checked) => setProfile((p) => ({ ...p, accounts: { ...p.accounts, irp: checked } }))}
          />
          <Check
            label="일반계좌"
            checked={profile.accounts.taxable}
            onChange={(checked) => setProfile((p) => ({ ...p, accounts: { ...p.accounts, taxable: checked } }))}
          />
        </div>
      </Section>

      <hr style={{ margin: "16px 0" }} />

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <b>자동 선택 템플릿</b>
        <div style={{ marginTop: 6 }}>{picked ? `${picked.id} · ${picked.name}` : "계산 중..."}</div>
        {reasons.length > 0 && (
          <ul style={{ marginTop: 8 }}>
            {reasons.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button onClick={apply} disabled={!picked || loading}>
            {loading ? "적용 중..." : "이 템플릿으로 시작"}
          </button>
          <button onClick={() => nav("/portfolio")}>건너뛰고 포트로</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ marginBottom: 6 }}>
        <b>{title}</b>
      </div>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
