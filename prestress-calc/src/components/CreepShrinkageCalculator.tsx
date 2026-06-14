"use client";

import React, { useState, useMemo } from "react";
import { compareAllModels } from "@/engine/creepshrinkage";
import type { CreepShrinkageInputs, CSModel } from "@/engine/creepshrinkage";

const DEFAULT: CreepShrinkageInputs = {
  fc: 40, t0: 28, t: 10000, RH: 70, h0: 200, cementType: "N", aciCorr: 1,
};

const MODELS: { k: CSModel; name: string; color: string }[] = [
  { k: "ACI209", name: "ACI 209R-92", color: "#2563eb" },
  { k: "CEB_FIP", name: "CEB-FIP MC90 / fib", color: "#dc2626" },
  { k: "GL2000", name: "GL2000", color: "#0891b2" },
  { k: "B3", name: "B3 (Bažant)", color: "#6b7280" },
];

function Nf({ label, unit, value, onChange, step = 1 }: {
  label: string; unit?: string; value: number; onChange: (v: number) => void; step?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-gray-500 leading-tight">{label}</span>
      <div className="relative flex items-center">
        <input type="number" value={value} step={step}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          className={`w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ${unit ? "pr-9" : ""}`} />
        {unit && <span className="absolute right-1.5 text-[9px] text-gray-400 pointer-events-none">{unit}</span>}
      </div>
    </div>
  );
}
const f = (v: number, d = 2) => (isFinite(v) ? v.toFixed(d) : "—");

export function CreepShrinkageCalculator() {
  const [inp, setInp] = useState<CreepShrinkageInputs>(DEFAULT);
  const set = (k: keyof CreepShrinkageInputs, v: number | string) =>
    setInp(p => ({ ...p, [k]: v }));
  const r = useMemo(() => compareAllModels(inp), [inp]);

  // ── chart: φ(t) vs log10(t) ───────────────────────────────────
  const W = 300, Hh = 170, pad = 30;
  const allT = r.ACI209.series.map(s => s.t);
  const tMin = Math.log10(Math.max(allT[0], 1)), tMax = Math.log10(allT[allT.length - 1]);
  const phiMax = Math.max(...MODELS.flatMap(m => r[m.k].series.map(s => s.phi)), 0.1) * 1.1;
  const sx = (t: number) => pad + (Math.log10(t) - tMin) / (tMax - tMin) * (W - 2 * pad);
  const sy = (p: number) => Hh - pad - p / phiMax * (Hh - 2 * pad);
  const pathOf = (k: CSModel) =>
    r[k].series.map((s, i) => `${i ? "L" : "M"}${sx(s.t).toFixed(1)},${sy(s.phi).toFixed(1)}`).join(" ");

  // shrinkage chart (×10⁻⁶, magnitude)
  const epsMax = Math.max(...MODELS.flatMap(m => r[m.k].series.map(s => Math.abs(s.eps_sh))), 1e-6) * 1.1;
  const syE = (ep: number) => Hh - pad - Math.abs(ep) / epsMax * (Hh - 2 * pad);
  const pathE = (k: CSModel) =>
    r[k].series.map((s, i) => `${i ? "L" : "M"}${sx(s.t).toFixed(1)},${syE(s.eps_sh).toFixed(1)}`).join(" ");

  return (
    <div className="flex gap-4 text-[11px]">
      {/* Inputs */}
      <div className="w-56 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Parameter material & lingkungan</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="f'c 28 hari" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} step={5} />
          <Nf label="t₀ umur bebani" unit="hari" value={inp.t0} onChange={v => set("t0", v)} step={1} />
          <Nf label="t evaluasi" unit="hari" value={inp.t} onChange={v => set("t", v)} step={100} />
          <Nf label="RH kelembapan" unit="%" value={inp.RH} onChange={v => set("RH", v)} step={5} />
          <Nf label="h₀ = 2A_c/u" unit="mm" value={inp.h0} onChange={v => set("h0", v)} step={25} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-medium text-gray-500">Jenis semen</span>
          <select value={inp.cementType} onChange={e => set("cementType", e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-[11px]">
            <option value="R">R — cepat (rapid)</option>
            <option value="N">N — normal</option>
            <option value="S">S — lambat (slow)</option>
          </select>
        </div>
        <p className="text-[9px] text-gray-400 leading-snug">
          Empat model dihitung paralel. Pemilihan model menentukan lendutan jangka panjang &amp;
          kehilangan prategang (tema buku 123–135). Output φ &amp; χ memberi makan tab ⏳ AEMM,
          camber PCI, dan kehilangan creep/shrinkage. h₀ kecil (tebal tipis) → susut & rangkak lebih besar.
        </p>
      </div>

      {/* Results */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* φ chart */}
        <div>
          <p className="text-[9px] font-bold uppercase text-gray-400 mb-0.5">Koefisien rangkak φ(t, t₀) vs waktu (skala log)</p>
          <svg width={W} height={Hh} className="border border-gray-200 rounded bg-white">
            <line x1={pad} y1={pad} x2={pad} y2={Hh - pad} stroke="#9ca3af" />
            <line x1={pad} y1={Hh - pad} x2={W - pad} y2={Hh - pad} stroke="#9ca3af" />
            {MODELS.map(m => <path key={m.k} d={pathOf(m.k)} fill="none" stroke={m.color} strokeWidth={1.5} />)}
            <text x={W / 2} y={Hh - 6} textAnchor="middle" fontSize={8} className="fill-gray-500">log₁₀(hari) — 3 d → 50 thn</text>
            <text x={8} y={pad - 4} fontSize={8} className="fill-gray-500">φ = {f(phiMax, 1)} maks</text>
          </svg>
        </div>
        {/* shrinkage chart */}
        <div>
          <p className="text-[9px] font-bold uppercase text-gray-400 mb-0.5">Regangan susut |ε_sh(t)| vs waktu</p>
          <svg width={W} height={Hh} className="border border-gray-200 rounded bg-white">
            <line x1={pad} y1={pad} x2={pad} y2={Hh - pad} stroke="#9ca3af" />
            <line x1={pad} y1={Hh - pad} x2={W - pad} y2={Hh - pad} stroke="#9ca3af" />
            {MODELS.map(m => <path key={m.k} d={pathE(m.k)} fill="none" stroke={m.color} strokeWidth={1.5} strokeDasharray="3 2" />)}
            <text x={8} y={pad - 4} fontSize={8} className="fill-gray-500">|ε_sh| = {(epsMax * 1e6).toFixed(0)}με maks</text>
          </svg>
        </div>
        {/* legend */}
        <div className="flex flex-wrap gap-2">
          {MODELS.map(m => (
            <span key={m.k} className="flex items-center gap-1 text-[9px]">
              <span style={{ background: m.color }} className="inline-block w-3 h-1 rounded" /> {m.name}
            </span>
          ))}
        </div>
        {/* comparison table */}
        <table className="w-full">
          <thead><tr className="text-[9px] text-gray-400 border-b">
            <th className="text-left">Model</th><th>φ(t,t₀)</th><th>ε_sh (×10⁻⁶)</th><th>E_eff</th><th>χ</th><th>E_adj</th>
          </tr></thead>
          <tbody>
            {MODELS.map(m => {
              const x = r[m.k];
              return (
                <tr key={m.k} className="border-b border-gray-100">
                  <td className="py-0.5 text-[10px]" style={{ color: m.color }}>{m.name}</td>
                  <td className="py-0.5 font-mono text-right text-[10px] font-semibold">{f(x.phi, 2)}</td>
                  <td className="py-0.5 font-mono text-right text-[10px]">{f(x.eps_sh * 1e6, 0)}</td>
                  <td className="py-0.5 font-mono text-right text-[10px]">{f(x.Eeff, 0)}</td>
                  <td className="py-0.5 font-mono text-right text-[10px]">{f(x.chi, 2)}</td>
                  <td className="py-0.5 font-mono text-right text-[10px]">{f(x.Eadj, 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-[9px] text-gray-400 leading-snug">
          E_eff = E_c/(1+φ) (modulus efektif) · χ = koefisien penuaan Trost–Bažant ·
          E_adj = E_c/(1+χφ) (AEMM age-adjusted, dipakai tab ⏳). Satuan E dalam MPa.
        </p>
      </div>
    </div>
  );
}
