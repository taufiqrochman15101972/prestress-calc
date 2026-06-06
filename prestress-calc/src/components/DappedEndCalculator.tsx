"use client";

import React, { useState, useMemo } from "react";
import { computeDappedEnd } from "@/engine/dappedend";
import type { DappedEndInputs } from "@/engine/dappedend";

const DEFAULT: DappedEndInputs = {
  Vu: 300, Nu: 60, a: 150, h: 900, d: 450,
  fy: 420, fc: 35, bw: 200, lambda: 1.0, mu: 1.4,
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

export function DappedEndCalculator() {
  const [inp, setInp] = useState<DappedEndInputs>(DEFAULT);
  const set = (k: keyof DappedEndInputs, v: number) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const res = useMemo(() => computeDappedEnd(inp), [inp]);
  const f = (v: number, d = 1) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-52 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Geometri Dap</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="h balok penuh" unit="mm" value={inp.h} onChange={v => set("h", v)} step={50} />
            <Nf label="d efektif nib" unit="mm" value={inp.d} onChange={v => set("d", v)} step={25} />
            <Nf label="a shear span" unit="mm" value={inp.a} onChange={v => set("a", v)} step={25} />
            <Nf label="bw web" unit="mm" value={inp.bw} onChange={v => set("bw", v)} step={25} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Beban & Material</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="Vu reaksi" unit="kN" value={inp.Vu} onChange={v => set("Vu", v)} step={25} />
            <Nf label="Nu horizontal" unit="kN" value={inp.Nu ?? 0} onChange={v => set("Nu", v)} step={10} />
            <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
            <Nf label="fy" unit="MPa" value={inp.fy} onChange={v => set("fy", v)} step={20} />
            <Nf label="μ friksi" value={inp.mu ?? 1.4} onChange={v => set("mu", v)} step={0.2} />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">Libby §12-6 / PCI — 5 mode runtuh:</p>
          <p className="text-blue-600 mt-0.5">lentur+aksial nib, geser langsung, tarik diagonal sudut masuk, tarik diagonal ujung, tumpu.</p>
        </div>
      </div>

      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex gap-3">
          <svg width="140" height="120" viewBox="0 0 140 120" className="flex-none border border-gray-200 rounded bg-gray-50">
            {/* full beam */}
            <polygon points="20,20 130,20 130,100 60,100 60,60 20,60" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="1.5" />
            {/* re-entrant corner */}
            <circle cx="60" cy="60" r="3" fill="none" stroke="#dc2626" strokeWidth="1" />
            {/* hanger Ash at corner */}
            <line x1="62" y1="22" x2="62" y2="58" stroke="#dc2626" strokeWidth="2" />
            <text x="64" y="38" fontSize="7" fill="#dc2626" fontWeight="bold">Ash</text>
            {/* main As in nib */}
            <line x1="22" y1="26" x2="58" y2="26" stroke="#7c3aed" strokeWidth="2.5" />
            <text x="26" y="23" fontSize="7" fill="#7c3aed" fontWeight="bold">As</text>
            {/* Avf at dap face */}
            <line x1="60" y1="60" x2="60" y2="98" stroke="#16a34a" strokeWidth="2" />
            <text x="46" y="80" fontSize="7" fill="#16a34a">Avf</text>
            {/* reaction */}
            <line x1="38" y1="75" x2="38" y2="58" stroke="#111827" strokeWidth="1.5" markerEnd="url(#ard)" />
            <text x="28" y="78" fontSize="7" fill="#111827">Vu</text>
            <defs>
              <marker id="ard" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#111827" />
              </marker>
            </defs>
          </svg>
          <table className="flex-1"><tbody>
            <Row label="Nu desain (≥0.2Vu)" value={f(res.Nu, 0)} unit="kN" />
            <Row label="Vn,max nib" value={f(res.Vn_max, 0)} unit="kN" />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Tulangan (5 Mode)</p>
          <table className="w-full"><tbody>
            <Row label="1. As lentur+aksial nib" value={f(res.As_flexure, 0)} unit="mm²" hi />
            <Row label="2. Avf geser langsung" value={f(res.Avf_shear, 0)} unit="mm²" hi />
            <Row label="3. Ash hanger sudut masuk" value={f(res.Ash_corner, 0)} unit="mm²" hi />
            <Row label="4. Av tarik diagonal ujung" value={f(res.Av_diag, 0)} unit="mm²" />
            <Row label="4. Ah bar horizontal" value={f(res.Ah_diag, 0)} unit="mm²" />
          </tbody></table>
        </div>

        <Chk label="Geser nib φVn,max ≥ Vu"
          value={`${f(0.75 * res.Vn_max, 0)} ${res.isShearOk ? "≥" : "<"} ${f(inp.Vu, 0)} kN`} ok={res.isShearOk} />
      </div>
    </div>
  );
}
