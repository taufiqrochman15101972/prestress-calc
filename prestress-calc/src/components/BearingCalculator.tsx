"use client";

import React, { useState, useMemo } from "react";
import { computeBearing } from "@/engine/bearing";
import type { BearingInputs } from "@/engine/bearing";

const DEFAULT: BearingInputs = {
  R: 600, L: 300, W: 350, hri: 12, nLayers: 3,
  G: 0.9, deltaS: 15, sigmaLimit: 7.0,
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

export function BearingCalculator() {
  const [inp, setInp] = useState<BearingInputs>(DEFAULT);
  const set = (k: keyof BearingInputs, v: number) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const res = useMemo(() => computeBearing(inp), [inp]);
  const f = (v: number, d = 1) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-52 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Geometri Bantalan</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="L (arah bentang)" unit="mm" value={inp.L} onChange={v => set("L", v)} step={25} />
            <Nf label="W (melintang)" unit="mm" value={inp.W} onChange={v => set("W", v)} step={25} />
            <Nf label="h_ri lapis dalam" unit="mm" value={inp.hri} onChange={v => set("hri", v)} step={2} />
            <Nf label="n lapis" value={inp.nLayers} onChange={v => set("nLayers", v)} step={1} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Beban & Material</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="R reaksi layan" unit="kN" value={inp.R} onChange={v => set("R", v)} step={25} />
            <Nf label="Δs gerakan geser" unit="mm" value={inp.deltaS} onChange={v => set("deltaS", v)} step={2.5} />
            <Nf label="G modulus geser" unit="MPa" value={inp.G} onChange={v => set("G", v)} step={0.1} />
            <Nf label="σ batas" unit="MPa" value={inp.sigmaLimit ?? 7} onChange={v => set("sigmaLimit", v)} step={0.5} />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">Libby §12-9 / AASHTO §14.7.6 Metode A:</p>
          <p className="text-blue-600 mt-0.5">S = LW/(2·h_ri·(L+W)); σ ≤ 1.25·G·S; h_rt ≥ 2Δs; L,W ≥ 3·h_rt.</p>
        </div>
      </div>

      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex gap-3">
          <svg width="140" height="100" viewBox="0 0 140 100" className="flex-none border border-gray-200 rounded bg-gray-50">
            {/* girder */}
            <rect x="20" y="8" width="100" height="22" fill="#cbd5e1" stroke="#64748b" />
            <text x="58" y="23" fontSize="7" fill="#475569">girder</text>
            {/* laminated pad — alternating elastomer/steel */}
            {[0, 1, 2].map(i => (
              <g key={i}>
                <rect x="35" y={34 + i * 14} width="70" height="9" fill="#1e293b" />
                <rect x="35" y={43 + i * 14} width="70" height="4" fill="#94a3b8" />
              </g>
            ))}
            {/* pier */}
            <rect x="20" y="88" width="100" height="10" fill="#cbd5e1" stroke="#64748b" />
            {/* R arrow */}
            <line x1="70" y1="2" x2="70" y2="30" stroke="#dc2626" strokeWidth="1.5" markerEnd="url(#arb)" />
            <text x="73" y="8" fontSize="7" fill="#dc2626" fontWeight="bold">R</text>
            {/* shear movement */}
            <line x1="108" y1="55" x2="128" y2="55" stroke="#16a34a" strokeWidth="1.5" markerEnd="url(#arb)" />
            <text x="110" y="51" fontSize="7" fill="#16a34a">Δs</text>
            <defs>
              <marker id="arb" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#111827" />
              </marker>
            </defs>
          </svg>
          <table className="flex-1"><tbody>
            <Row label="S faktor bentuk lapis" value={f(res.S, 2)} hi />
            <Row label="h_rt total elastomer" value={f(res.hrt, 0)} unit="mm" />
            <Row label="δ_c lendutan tekan" value={f(res.deltaC, 2)} unit="mm" />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Tegangan Tekan</p>
          <table className="w-full"><tbody>
            <Row label="σ_s = R/(L·W)" value={f(res.sigma_s, 2)} unit="MPa" hi />
            <Row label="σ_allow = min(1.25GS, σbatas)" value={f(res.sigma_allow, 2)} unit="MPa" />
          </tbody></table>
        </div>

        <div className="space-y-0.5">
          <Chk label="Tegangan σ_s ≤ σ_allow"
            value={`${f(res.sigma_s, 2)} ${res.stressOk ? "≤" : ">"} ${f(res.sigma_allow, 2)}`} ok={res.stressOk} />
          <Chk label="Geser h_rt ≥ 2Δs"
            value={`${f(res.hrt, 0)} ${res.shearOk ? "≥" : "<"} ${f(2 * inp.deltaS, 0)} mm`} ok={res.shearOk} />
          <Chk label="Stabilitas L,W ≥ 3·h_rt"
            value={`${f(Math.min(inp.L, inp.W), 0)} ${res.stabilityOk ? "≥" : "<"} ${f(3 * res.hrt, 0)} mm`} ok={res.stabilityOk} />
        </div>
      </div>
    </div>
  );
}
