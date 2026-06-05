"use client";

import React, { useState, useMemo } from "react";
import { computeCorbel } from "@/engine/corbel";
import type { CorbelInputs, CorbelConcrete } from "@/engine/corbel";

const DEFAULT: CorbelInputs = {
  Vu: 350, Nuc: 70, av: 150, b: 350, h: 450, d: 400,
  fc: 35, fy: 420, concrete: "MONOLITHIC", phi: 0.75,
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

export function CorbelCalculator() {
  const [inp, setInp] = useState<CorbelInputs>(DEFAULT);
  const set = (k: keyof CorbelInputs, v: number | string) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const res = useMemo(() => computeCorbel(inp), [inp]);
  const f = (v: number, d = 1) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* Inputs */}
      <div className="w-52 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Geometri Korbel</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="b lebar" unit="mm" value={inp.b} onChange={v => set("b", v)} step={25} />
            <Nf label="h tinggi" unit="mm" value={inp.h} onChange={v => set("h", v)} step={25} />
            <Nf label="d efektif" unit="mm" value={inp.d} onChange={v => set("d", v)} step={25} />
            <Nf label="a_v shear span" unit="mm" value={inp.av} onChange={v => set("av", v)} step={25} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Beban & Material</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="Vu vertikal" unit="kN" value={inp.Vu} onChange={v => set("Vu", v)} step={25} />
            <Nf label="Nuc horizontal" unit="kN" value={inp.Nuc} onChange={v => set("Nuc", v)} step={10} />
            <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
            <Nf label="fy" unit="MPa" value={inp.fy} onChange={v => set("fy", v)} step={20} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Antarmuka (μ)</p>
          <select value={inp.concrete}
            onChange={e => set("concrete", e.target.value as CorbelConcrete)}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="MONOLITHIC">Monolit (μ=1.4)</option>
            <option value="ROUGHENED">Dikasarkan (μ=1.0)</option>
            <option value="SMOOTH">Halus (μ=0.6)</option>
          </select>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">Nilson §12.5 / ACI §16.5:</p>
          <p className="text-blue-600 mt-0.5">Asc = max(Af+An, ⅔Avf+An, min). Ah = 0.5(Asc−An). Berlaku a_v/d ≤ 1.</p>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 space-y-2 min-w-0">
        {/* Sketch */}
        <div className="flex gap-3">
          <svg width="130" height="120" viewBox="0 0 130 120" className="flex-none border border-gray-200 rounded bg-gray-50">
            {/* column */}
            <rect x="10" y="10" width="32" height="100" fill="#cbd5e1" stroke="#64748b" />
            {/* corbel trapezoid */}
            <polygon points="42,25 110,40 110,70 42,75" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="1.5" />
            {/* primary steel (top bar) */}
            <line x1="44" y1="30" x2="106" y2="44" stroke="#dc2626" strokeWidth="2.5" />
            <text x="70" y="26" fontSize="7" fill="#dc2626" fontWeight="bold">Asc</text>
            {/* stirrups */}
            <line x1="60" y1="45" x2="60" y2="68" stroke="#16a34a" strokeWidth="1" />
            <line x1="78" y1="48" x2="78" y2="69" stroke="#16a34a" strokeWidth="1" />
            <text x="62" y="63" fontSize="6" fill="#16a34a">Ah</text>
            {/* Vu arrow */}
            <line x1="95" y1="20" x2="95" y2="42" stroke="#111827" strokeWidth="1.5" markerEnd="url(#ar)" />
            <text x="98" y="22" fontSize="7" fill="#111827">Vu</text>
            {/* Nuc arrow */}
            <line x1="112" y1="42" x2="92" y2="42" stroke="#7c3aed" strokeWidth="1.5" markerEnd="url(#ar)" />
            <text x="100" y="55" fontSize="6" fill="#7c3aed">Nuc</text>
            <defs>
              <marker id="ar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#111827" />
              </marker>
            </defs>
          </svg>
          <table className="flex-1"><tbody>
            <Row label="μ koef. geser-friksi" value={f(res.mu, 1)} />
            <Row label="Nuc desain (≥0.2Vu)" value={f(res.Nuc_design, 0)} unit="kN" />
            <Row label="Mu = Vu·av + Nuc·(h−d)" value={f(res.Mu, 1)} unit="kN·m" />
            <Row label="a_v/d" value={f(res.av_d_ratio, 2)} />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Tulangan</p>
          <table className="w-full"><tbody>
            <Row label="Avf geser-friksi" value={f(res.Avf, 0)} unit="mm²" />
            <Row label="Af lentur" value={f(res.Af, 0)} unit="mm²" />
            <Row label="An tarik langsung" value={f(res.An, 0)} unit="mm²" />
            <Row label={`Asc primer (${res.AscGovern})`} value={f(res.Asc, 0)} unit="mm²" hi />
            <Row label="Ah sengkang tertutup" value={f(res.Ah, 0)} unit="mm²" hi />
          </tbody></table>
        </div>

        <div className="space-y-0.5">
          <Chk label="Geometri a_v/d ≤ 1.0"
            value={`${f(res.av_d_ratio, 2)} ${res.geometryOk ? "≤" : ">"} 1.0`} ok={res.geometryOk} />
          <Chk label="Kapasitas φVn,max ≥ Vu"
            value={`${f(res.phiVn_max, 0)} ${res.capacityOk ? "≥" : "<"} ${f(inp.Vu, 0)} kN`} ok={res.capacityOk} />
        </div>
      </div>
    </div>
  );
}
