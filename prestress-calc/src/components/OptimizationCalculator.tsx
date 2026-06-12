"use client";

import React, { useState, useMemo } from "react";
import { computeCostOptimization, concreteMixCostRatio } from "@/engine/optimization";
import type { OptimizationInputs, CostAlternative } from "@/engine/optimization";

// Hassanain & Loov (PCI J. 1999) two-lane overpass layout:
// 12 m deck, CPCI-range girder areas, HPC 40–80 MPa alternatives.
const DEFAULT: Omit<OptimizationInputs, "alternatives"> = {
  W: 12, L: 30, td: 225, fcRef: 40,
  cGirderConc: 2400,   // per m³ girder concrete in place (forms+labour)
  cDeckConc: 1600,     // per m³ deck
  cSteel: 14,          // per kg mild steel
  mSteelDeck: 18000,   // kg
  cFixedTE: 25000,     // mobilization
  cPerGirderTE: 6000,  // per girder transport+erection
};

const DEFAULT_ALTS: CostAlternative[] = [
  { name: "5 gelagar · f'c 40", ng: 5, Ag: 499000, fcGirder: 40 },
  { name: "4 gelagar · f'c 60", ng: 4, Ag: 544000, fcGirder: 60 },
  { name: "3 gelagar · f'c 80", ng: 3, Ag: 604000, fcGirder: 80 },
  { name: "2 gelagar · f'c 100", ng: 2, Ag: 604000, fcGirder: 100 },
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

export function OptimizationCalculator() {
  const [inp, setInp] = useState(DEFAULT);
  const [alts, setAlts] = useState<CostAlternative[]>(DEFAULT_ALTS);
  const set = (k: keyof typeof DEFAULT, v: number) => setInp(p => ({ ...p, [k]: v }));
  const setAlt = (i: number, k: "ng" | "Ag" | "fcGirder", v: number) =>
    setAlts(prev => prev.map((a, j) => j === i
      ? { ...a, [k]: v, name: `${k === "ng" ? v : a.ng} gelagar · f'c ${k === "fcGirder" ? v : a.fcGirder}` }
      : a));

  const r = useMemo(() => computeCostOptimization({ ...inp, alternatives: alts }), [inp, alts]);
  const f = (v: number, d = 0) => v.toLocaleString("id-ID", { maximumFractionDigits: d });

  const maxCost = Math.max(...r.alternatives.map(a => a.costPerM2), 1);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-60 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Geometri Jembatan</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="W lebar dek" unit="m" value={inp.W} onChange={v => set("W", v)} step={0.5} />
            <Nf label="L bentang" unit="m" value={inp.L} onChange={v => set("L", v)} step={5} />
            <Nf label="t_d tebal dek (≥225)" unit="mm" value={inp.td} onChange={v => set("td", v)} step={25} />
            <Nf label="f'c acuan mix" unit="MPa" value={inp.fcRef} onChange={v => set("fcRef", v)} step={5} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Harga Satuan (mata uang bebas, konsisten)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="Beton gelagar @40MPa" unit="/m³" value={inp.cGirderConc} onChange={v => set("cGirderConc", v)} step={100} />
            <Nf label="Beton dek terpasang" unit="/m³" value={inp.cDeckConc} onChange={v => set("cDeckConc", v)} step={100} />
            <Nf label="Baja non-prategang" unit="/kg" value={inp.cSteel} onChange={v => set("cSteel", v)} step={1} />
            <Nf label="Massa baja total" unit="kg" value={inp.mSteelDeck} onChange={v => set("mSteelDeck", v)} step={1000} />
            <Nf label="Mobilisasi angkut+ereksi" value={inp.cFixedTE} onChange={v => set("cFixedTE", v)} step={5000} />
            <Nf label="Angkut+ereksi /gelagar" value={inp.cPerGirderTE} onChange={v => set("cPerGirderTE", v)} step={500} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Alternatif (n_g · A_g · f'c HPC)</p>
          <div className="space-y-1">
            {alts.map((a, i) => (
              <div key={i} className="grid grid-cols-3 gap-1">
                <Nf label={`n_g #${i + 1}`} value={a.ng} onChange={v => setAlt(i, "ng", v)} step={1} />
                <Nf label="A_g" unit="mm²" value={a.Ag} onChange={v => setAlt(i, "Ag", v)} step={1e4} />
                <Nf label="f'c" unit="MPa" value={a.fcGirder} onChange={v => setAlt(i, "fcGirder", v)} step={10} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">
          CMCR — Rasio Biaya Mix Beton (eq. 2a): CMCR = 0.936 + (f&apos;c/100)³
        </p>
        <div className="flex gap-3 text-[10px] font-mono text-gray-600">
          {[40, 60, 80, 100].map(fc => (
            <span key={fc}>f&apos;c {fc} → <b className="text-blue-700">{concreteMixCostRatio(fc).toFixed(3)}</b></span>
          ))}
        </div>

        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">
          Biaya per m² Dek — C = [n_g·C_g + C_c·V_c + C_s·m_s]/(W·L)
        </p>
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-gray-400 text-left border-b border-gray-200">
              <th className="py-0.5 pr-2 font-medium">Alternatif</th>
              <th className="py-0.5 pr-2 font-medium text-right">S (m)</th>
              <th className="py-0.5 pr-2 font-medium text-right">CMCR</th>
              <th className="py-0.5 pr-2 font-medium text-right">Gelagar</th>
              <th className="py-0.5 pr-2 font-medium text-right">Dek</th>
              <th className="py-0.5 pr-2 font-medium text-right">Angkut+Ereksi</th>
              <th className="py-0.5 pr-2 font-medium text-right">C /m²</th>
              <th className="py-0.5 font-medium">Layak?</th>
            </tr>
          </thead>
          <tbody>
            {r.alternatives.map((a, i) => (
              <tr key={i} className={`border-b border-gray-100 ${i === r.bestIdx ? "bg-blue-50" : ""}`}>
                <td className="py-0.5 pr-2 text-gray-700">{a.name}{i === r.bestIdx && <span className="text-blue-700 font-bold"> ★</span>}</td>
                <td className="py-0.5 pr-2 font-mono text-right">{a.spacing.toFixed(2)}</td>
                <td className="py-0.5 pr-2 font-mono text-right">{a.CMCR.toFixed(3)}</td>
                <td className="py-0.5 pr-2 font-mono text-right">{f(a.costGirders)}</td>
                <td className="py-0.5 pr-2 font-mono text-right">{f(a.costDeck)}</td>
                <td className="py-0.5 pr-2 font-mono text-right">{f(a.costTE)}</td>
                <td className="py-0.5 pr-2 font-mono text-right font-semibold text-blue-700">{f(a.costPerM2)}</td>
                <td className={`py-0.5 font-semibold ${a.feasible ? "text-emerald-600" : "text-red-500"}`}>
                  {a.feasible ? "OK" : a.spacingOk ? "n_g<2" : "S∉[3,6]m"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* cost bar chart */}
        <svg width="100%" height={26 * r.alternatives.length + 18} viewBox={`0 0 420 ${26 * r.alternatives.length + 18}`}
          className="bg-white border border-gray-100 rounded">
          {r.alternatives.map((a, i) => {
            const w = (a.costPerM2 / maxCost) * 270;
            const y = 8 + i * 26;
            return (
              <g key={i}>
                <text x="4" y={y + 12} fontSize="8" fill="#475569">{a.name}</text>
                <rect x="110" y={y} width={Math.max(2, w)} height="16" rx="2"
                  fill={i === r.bestIdx ? "#1d4ed8" : a.feasible ? "#93c5fd" : "#e2e8f0"} />
                <text x={114 + w} y={y + 12} fontSize="8" fill={i === r.bestIdx ? "#1d4ed8" : "#64748b"}>
                  {f(a.costPerM2)} /m²
                </text>
              </g>
            );
          })}
        </svg>

        <div className={`rounded px-3 py-2 text-[10px] font-semibold ${r.bestIdx >= 0 ? "bg-blue-50 text-blue-800" : "bg-red-50 text-red-700"}`}>
          {r.bestIdx >= 0
            ? <>Termurah & layak: <b>{r.bestName}</b> — hemat {r.savingPct.toFixed(1)}% terhadap alternatif layak termahal.
              {!r.deckOk && <span className="text-red-600"> ⚠ t_d &lt; 225 mm (OHBDC/CSA minimum dek).</span>}</>
            : "Tidak ada alternatif layak — periksa jarak gelagar 3.0–6.0 m dan n_g ≥ 2."}
        </div>

        <p className="text-[9px] text-gray-400 leading-snug">
          Mengangkat f&apos;c gelagar (HPC) memungkinkan gelagar lebih sedikit dengan jarak lebih besar:
          biaya mix naik hanya ∝ CMCR tetapi jumlah gelagar, angkut dan ereksi turun — kesimpulan
          Hassanain–Loov. Minimum n_g = 2; banyak otoritas memakai ≥ 3 agar dek dapat diperbaiki
          bertahap (redundansi). Kelayakan struktural tiap alternatif tetap harus diperiksa di panel
          utama (SLS/ULS) — modul ini hanya membandingkan biaya.
        </p>
      </div>
    </div>
  );
}
