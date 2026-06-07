"use client";

import React, { useState, useMemo } from "react";
import { computeLateralStability, K_FACTORS } from "@/engine/lateralstability";
import type { LateralStabilityInputs, SupportLoadCase, LoadHeight } from "@/engine/lateralstability";

const DEFAULT: LateralStabilityInputs = {
  b1: 500, h1: 150, b2: 160, h2: 1500, b3: 650, h3: 200,
  L: 30000, fc: 45, Ec: 0, nu: 0.2, phiCreep: 0,
  loadCase: "SS_UDL", Wapplied: 280, loadHeight: "CENTROID",
};

function Nf({ label, unit, value, onChange, step = 1, min = 0 }: {
  label: string; unit?: string; value: number;
  onChange: (v: number) => void; step?: number; min?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-gray-500 leading-tight">{label}</span>
      <div className="relative flex items-center">
        <input type="number" value={value} min={min} step={step}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          className={`w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ${unit ? "pr-9" : ""}`} />
        {unit && <span className="absolute right-1.5 text-[9px] text-gray-400 pointer-events-none">{unit}</span>}
      </div>
    </div>
  );
}
function Row({ label, value, unit, hi }: { label: string; value: string; unit?: string; hi?: boolean }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-0.5 pr-3 text-gray-500 text-[10px]">{label}</td>
      <td className={`py-0.5 font-mono text-right text-[10px] font-semibold ${hi ? "text-blue-700" : "text-gray-800"}`}>{value}</td>
      {unit && <td className="py-0.5 pl-1 text-gray-400 text-[9px]">{unit}</td>}
    </tr>
  );
}
function Chk({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`flex justify-between items-center px-2 py-1 rounded text-[10px] my-0.5 border ${ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
      <span>{label}</span>
      <span className="font-mono font-bold">{value}</span>
      <span className="font-bold">{ok ? "✓ OK" : "✗ NG"}</span>
    </div>
  );
}

export function LateralStabilityCalculator() {
  const [inp, setInp] = useState<LateralStabilityInputs>(DEFAULT);
  const set = (k: keyof LateralStabilityInputs, v: number | string) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const res = useMemo(() => computeLateralStability(inp), [inp]);
  const f = (v: number, d = 1) => v.toFixed(d);
  const e = (v: number, d = 3) => v.toExponential(d);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-56 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Penampang (3 persegi simetris)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="b₁ flens tekan" unit="mm" value={inp.b1} onChange={v => set("b1", v)} step={10} />
            <Nf label="h₁ tebal" unit="mm" value={inp.h1} onChange={v => set("h1", v)} step={10} />
            <Nf label="b₂ web tebal" unit="mm" value={inp.b2} onChange={v => set("b2", v)} step={10} />
            <Nf label="h₂ web tinggi" unit="mm" value={inp.h2} onChange={v => set("h2", v)} step={50} />
            <Nf label="b₃ flens bawah" unit="mm" value={inp.b3} onChange={v => set("b3", v)} step={10} />
            <Nf label="h₃ tebal" unit="mm" value={inp.h3} onChange={v => set("h3", v)} step={10} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Bentang & Material</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="L tak-tertumpu" unit="mm" value={inp.L} onChange={v => set("L", v)} step={500} />
            <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
            <Nf label="ν Poisson" value={inp.nu} onChange={v => set("nu", v)} step={0.05} />
            <Nf label="φ creep" value={inp.phiCreep} onChange={v => set("phiCreep", v)} step={0.1} />
            <Nf label="W total" unit="kN" value={inp.Wapplied} onChange={v => set("Wapplied", v)} step={10} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Tumpuan & Beban (faktor K)</p>
          <select value={inp.loadCase}
            onChange={ev => set("loadCase", ev.target.value as SupportLoadCase)}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-400">
            {(Object.keys(K_FACTORS) as SupportLoadCase[]).map(k => (
              <option key={k} value={k}>{K_FACTORS[k].label} (K={K_FACTORS[k].K})</option>
            ))}
          </select>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1 mt-2">Posisi beban</p>
          <select value={inp.loadHeight}
            onChange={ev => set("loadHeight", ev.target.value as LoadHeight)}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="ABOVE">Di atas centroid (destabilisasi)</option>
            <option value="CENTROID">Di centroid</option>
            <option value="BELOW">Di bawah centroid (stabilisasi)</option>
          </select>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">Abeles §13.3 / Timoshenko:</p>
          <p className="text-blue-600 mt-0.5">W_cr = (K/L²)·√(B₁·C), B₁=E·I_y, C=G·J. Selidiki bila L/b &gt; 30; FS = W_cr/W ≥ 3.</p>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 space-y-2 min-w-0">
        {/* Buckled-beam sketch (plan view, lateral sway) */}
        <div className="flex gap-3">
          <svg width="200" height="96" viewBox="0 0 200 96" className="flex-none border border-gray-200 rounded bg-gray-50">
            {/* straight (unbuckled) reference */}
            <line x1="16" y1="34" x2="184" y2="34" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2" />
            {/* buckled (laterally swayed) shape */}
            <path d="M16,34 Q100,12 184,34" fill="none" stroke="#dc2626" strokeWidth="2.5" />
            {/* supports */}
            <polygon points="16,34 11,42 21,42" fill="#374151" />
            <polygon points="184,34 179,42 189,42" fill="#374151" />
            {/* twist arrows */}
            <text x="86" y="10" fontSize="7" fill="#dc2626" fontWeight="bold">lateral sway + twist</text>
            {/* cross-section mini (narrow tall) */}
            <g transform="translate(150,52)">
              <rect x="0" y="0" width="26" height="6" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="0.8" />
              <rect x="9" y="6" width="8" height="26" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="0.8" />
              <rect x="-3" y="32" width="32" height="7" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="0.8" />
              <text x="-2" y="50" fontSize="6" fill="#64748b">narrow b, deep h</text>
            </g>
            <text x="20" y="64" fontSize="7" fill="#374151">L/b = {f(res.slenderness, 0)}</text>
            <text x="20" y="78" fontSize="7" fill={res.isStable ? "#16a34a" : "#dc2626"} fontWeight="bold">
              FS = {isFinite(res.FS) ? f(res.FS, 2) : "∞"}
            </text>
          </svg>
          <table className="flex-1"><tbody>
            <Row label="I_y (sumbu lemah)" value={e(res.Iy, 3)} unit="mm⁴" />
            <Row label="J (St. Venant, terbuka)" value={e(res.J, 3)} unit="mm⁴" hi />
            <Row label="E_eff (creep-modified)" value={f(res.Ec_eff, 0)} unit="MPa" />
            <Row label="G modulus geser" value={f(res.G, 0)} unit="MPa" />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Kekakuan & Tekuk (Timoshenko)</p>
          <table className="w-full"><tbody>
            <Row label="B₁ = E·I_y" value={e(res.B1, 3)} unit="N·mm²" />
            <Row label="C = G·J" value={e(res.C, 3)} unit="N·mm²" />
            <Row label={`K (${K_FACTORS[inp.loadCase].label})`} value={f(res.K, 3)} />
            <Row label="W_cr = (K/L²)·√(B₁·C)" value={f(res.Wcr, 1)} unit="kN" hi />
            <Row label={`× faktor posisi beban (${f(res.heightFactor, 2)})`} value={f(res.WcrAdj, 1)} unit="kN" />
            <Row label="M_cr ekivalen" value={f(res.Mcr, 1)} unit="kN·m" />
          </tbody></table>
        </div>

        <div className="space-y-0.5">
          <Chk label="Kelangsingan L/b ≤ 30 (CP 115 — perlu diselidiki bila >30)"
            value={`${f(res.slenderness, 1)} ${res.mustInvestigate ? ">" : "≤"} 30`} ok={!res.mustInvestigate} />
          <Chk label="Faktor keamanan tekuk lateral FS ≥ 3"
            value={`${isFinite(res.FS) ? f(res.FS, 2) : "∞"} ${res.isStable ? "≥" : "<"} 3.0`} ok={res.isStable} />
        </div>

        {res.mustInvestigate && (
          <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1.5 text-[10px] text-amber-700">
            L/b = {f(res.slenderness, 0)} &gt; 30 → balok langsing: stabilitas lateral wajib diperiksa
            (saat angkat/transport/ereksi). Sediakan penopang lateral atau pengaku bila FS &lt; 3.
          </div>
        )}
      </div>
    </div>
  );
}
