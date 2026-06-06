"use client";

import React, { useState, useMemo } from "react";
import { computeSlabOnGrade } from "@/engine/slabongrade";
import type { SlabOnGradeInputs } from "@/engine/slabongrade";

const DEFAULT: SlabOnGradeInputs = {
  thickness_mm: 200, fc: 32, poisson: 0.15, k_subgrade: 0.054,
  P_load: 60, contactRadius_mm: 100, Pe_perWidth: 250,
  slabLength_m: 40, mu_friction: 0.7, unitWeight: 24,
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

export function SlabOnGradeCalculator() {
  const [inp, setInp] = useState<SlabOnGradeInputs>(DEFAULT);
  const set = (k: keyof SlabOnGradeInputs, v: number) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const res = useMemo(() => computeSlabOnGrade(inp), [inp]);
  const f = (v: number, d = 2) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-52 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Pelat & Tanah Dasar</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="h tebal" unit="mm" value={inp.thickness_mm} onChange={v => set("thickness_mm", v)} step={10} />
            <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
            <Nf label="ν Poisson" value={inp.poisson} onChange={v => set("poisson", v)} step={0.01} />
            <Nf label="k subgrade" unit="N/mm³" value={inp.k_subgrade} onChange={v => set("k_subgrade", v)} step={0.01} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Beban Terpusat</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="P beban" unit="kN" value={inp.P_load} onChange={v => set("P_load", v)} step={5} />
            <Nf label="a radius kontak" unit="mm" value={inp.contactRadius_mm} onChange={v => set("contactRadius_mm", v)} step={10} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Prategang & Friksi Tanah</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="Pe per lebar" unit="kN/m" value={inp.Pe_perWidth} onChange={v => set("Pe_perWidth", v)} step={20} />
            <Nf label="L panjang pelat" unit="m" value={inp.slabLength_m} onChange={v => set("slabLength_m", v)} step={5} />
            <Nf label="μ friksi tanah" value={inp.mu_friction} onChange={v => set("mu_friction", v)} step={0.1} />
            <Nf label="γ beton" unit="kN/m³" value={inp.unitWeight} onChange={v => set("unitWeight", v)} step={0.5} />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">Khan §11 — Slab on Grade:</p>
          <p className="text-blue-600 mt-0.5">Westergaard di atas fondasi elastis (ℓ); PT memberi kompresi residu yang menahan friksi tanah & retak.</p>
        </div>
      </div>

      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex gap-3">
          <svg width="150" height="110" viewBox="0 0 150 110" className="flex-none border border-gray-200 rounded bg-gray-50">
            {/* slab */}
            <rect x="10" y="30" width="130" height="20" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="1.5" />
            {/* subgrade springs */}
            {[18, 38, 58, 78, 98, 118].map((x, i) => (
              <path key={i} d={`M${x},50 l4,6 l-8,6 l8,6 l-8,6 l4,6`} fill="none" stroke="#94a3b8" strokeWidth="1" />
            ))}
            <rect x="10" y="86" width="130" height="8" fill="#78716c" />
            {/* concentrated load */}
            <line x1="75" y1="10" x2="75" y2="30" stroke="#dc2626" strokeWidth="2" markerEnd="url(#arsg)" />
            <text x="78" y="18" fontSize="7" fill="#dc2626" fontWeight="bold">P</text>
            {/* PT arrows */}
            <line x1="2" y1="40" x2="18" y2="40" stroke="#16a34a" strokeWidth="1.5" markerEnd="url(#arsg)" />
            <line x1="148" y1="40" x2="132" y2="40" stroke="#16a34a" strokeWidth="1.5" markerEnd="url(#arsg)" />
            <text x="55" y="64" fontSize="6" fill="#16a34a">PT compression</text>
            <defs>
              <marker id="arsg" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#111827" />
              </marker>
            </defs>
          </svg>
          <table className="flex-1"><tbody>
            <Row label="E_c beton" value={f(res.Ec, 0)} unit="MPa" />
            <Row label="ℓ radius kekakuan relatif" value={f(res.radiusRelStiffness, 0)} unit="mm" hi />
            <Row label="b radius ekuivalen" value={f(res.b_equiv, 1)} unit="mm" />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Tegangan Westergaard (lentur)</p>
          <table className="w-full"><tbody>
            <Row label="σ interior" value={f(res.sigma_interior, 2)} unit="MPa" />
            <Row label="σ tepi (edge)" value={f(res.sigma_edge, 2)} unit="MPa" hi />
            <Row label="σ sudut (corner)" value={f(res.sigma_corner, 2)} unit="MPa" />
            <Row label="σ governing (tarik maks)" value={f(res.sigma_governing, 2)} unit="MPa" hi />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Prategang vs Friksi Tanah</p>
          <table className="w-full"><tbody>
            <Row label="Kompresi residu PT = Pe/h" value={f(res.residualCompression, 2)} unit="MPa" />
            <Row label="Friksi tanah (drag) di tengah" value={f(res.frictionRestraintStress, 2)} unit="MPa" />
            <Row label="Kompresi residu neto" value={f(res.netResidualComp, 2)} unit="MPa" />
            <Row label="Tarik neto = σ_gov − komp.neto" value={f(res.netTension, 2)} unit="MPa" hi />
            <Row label="f_r modulus runtuh 0.62√f'c" value={f(res.fr_allow, 2)} unit="MPa" />
          </tbody></table>
        </div>

        <div className="space-y-0.5">
          <Chk label="Bebas retak (tarik neto ≤ 0)"
            value={`${f(res.netTension, 2)} MPa`} ok={res.isCrackFree} />
          <Chk label="Tarik neto ≤ f_r (tak retak lentur)"
            value={`${f(res.netTension, 2)} ${res.isOk ? "≤" : ">"} ${f(res.fr_allow, 2)} MPa`} ok={res.isOk} />
        </div>
      </div>
    </div>
  );
}
