"use client";

import React, { useState, useMemo } from "react";
import { computeDistribution } from "@/engine/distribution";
import type { DistributionInputs } from "@/engine/distribution";

const DEFAULT: DistributionInputs = {
  S: 2100, L: 30000, ts: 200, Nb: 5, de: 900, wheelGauge: 1800,
  n: 1.29, I: 1.7746e11, A: 5.35e5, eg: 925,
};

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
function Row({ label, value, unit, hi }: { label: string; value: string; unit?: string; hi?: boolean }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-0.5 pr-3 text-gray-500 text-[10px]">{label}</td>
      <td className={`py-0.5 font-mono text-right text-[10px] font-semibold ${hi ? "text-blue-700" : "text-gray-800"}`}>{value}</td>
      {unit && <td className="py-0.5 pl-1 text-gray-400 text-[9px]">{unit}</td>}
    </tr>
  );
}

export function DistributionCalculator() {
  const [inp, setInp] = useState<DistributionInputs>(DEFAULT);
  const set = (k: keyof DistributionInputs, v: number) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const res = useMemo(() => computeDistribution(inp), [inp]);
  const f = (v: number, d = 3) => v.toFixed(d);
  const e = (v: number, d = 3) => v.toExponential(d);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-56 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Geometri Jembatan</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="S spasi gelagar" unit="mm" value={inp.S} onChange={v => set("S", v)} step={50} />
            <Nf label="L bentang" unit="mm" value={inp.L} onChange={v => set("L", v)} step={500} />
            <Nf label="t_s tebal deck" unit="mm" value={inp.ts} onChange={v => set("ts", v)} step={10} />
            <Nf label="N_b jml gelagar" value={inp.Nb} onChange={v => set("Nb", v)} step={1} />
            <Nf label="d_e overhang" unit="mm" value={inp.de} onChange={v => set("de", v)} step={50} />
            <Nf label="wheel gauge" unit="mm" value={inp.wheelGauge} onChange={v => set("wheelGauge", v)} step={50} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Kekakuan Longitudinal K_g</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="n = E_g/E_d" value={inp.n} onChange={v => set("n", v)} step={0.01} />
            <Nf label="I gelagar" unit="mm⁴" value={inp.I} onChange={v => set("I", v)} step={1e10} />
            <Nf label="A gelagar" unit="mm²" value={inp.A} onChange={v => set("A", v)} step={1e4} />
            <Nf label="e_g jarak centroid" unit="mm" value={inp.eg} onChange={v => set("eg", v)} step={25} />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">AASHTO LRFD §4.6.2.2 (Tipe k):</p>
          <p className="text-blue-600 mt-0.5">K_g = n(I + A·e_g²). g_M,int = 0.075 + (S/2900)^0.6·(S/L)^0.2·(K_g/(L·t_s³))^0.1. Eksterior: lever rule / e·g_int.</p>
          <p className="text-blue-600 mt-1">g hasil bisa dipakai sebagai <span className="font-mono">DF girder</span> di tab Beban Jembatan.</p>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 space-y-2 min-w-0">
        {/* Cross-section sketch */}
        <div className="flex gap-3">
          <svg width="210" height="70" viewBox="0 0 210 70" className="flex-none border border-gray-200 rounded bg-gray-50">
            {/* deck */}
            <rect x="8" y="14" width="194" height="8" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="0.8" />
            {/* girders */}
            {Array.from({ length: Math.max(2, Math.min(inp.Nb, 7)) }).map((_, i, arr) => {
              const N = arr.length; const x = 18 + (194 - 20) * (i / (N - 1));
              const ext = i === 0 || i === N - 1;
              return <g key={i}>
                <line x1={x} y1="22" x2={x} y2="50" stroke={ext ? "#dc2626" : "#475569"} strokeWidth={ext ? "3" : "2"} />
                <rect x={x - 6} y="48" width="12" height="6" fill={ext ? "#fecaca" : "#cbd5e1"} stroke="#475569" strokeWidth="0.6" />
              </g>;
            })}
            <text x="14" y="64" fontSize="6" fill="#dc2626">eksterior</text>
            <text x="150" y="64" fontSize="6" fill="#475569">interior</text>
            <text x="70" y="12" fontSize="7" fill="#1d4ed8">deck slab t_s</text>
          </svg>
          <table className="flex-1"><tbody>
            <Row label="K_g = n(I + A·e_g²)" value={e(res.Kg)} unit="mm⁴" hi />
            <Row label="g_M interior (govern)" value={f(res.gMoment)} unit="lane/grdr" hi />
            <Row label="g_V interior (govern)" value={f(res.gShear)} unit="lane/grdr" hi />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Gelagar Interior</p>
          <table className="w-full"><tbody>
            <Row label="g_M (1 lajur)" value={f(res.gM_int_1)} />
            <Row label="g_M (2+ lajur)" value={f(res.gM_int_2)} hi />
            <Row label="g_V (1 lajur)" value={f(res.gV_int_1)} />
            <Row label="g_V (2+ lajur)" value={f(res.gV_int_2)} hi />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Gelagar Eksterior</p>
          <table className="w-full"><tbody>
            <Row label="e_M = 0.77 + d_e/2800" value={f(res.e_moment)} />
            <Row label="g_M lever rule (1 lajur, m=1.2)" value={f(res.gM_ext_lever)} />
            <Row label="g_M (2+ lajur) = e·g_int" value={f(res.gM_ext_2)} hi />
            <Row label="e_V = 0.6 + d_e/3000" value={f(res.e_shear)} />
            <Row label="g_V (2+ lajur) = e·g_int" value={f(res.gV_ext_2)} hi />
          </tbody></table>
        </div>

        <div className="bg-green-50 border border-green-200 rounded px-2 py-1.5 text-[10px] flex justify-between items-center">
          <span className="text-green-800">DF menentukan → pakai di tab 🚚 Beban Jembatan:</span>
          <span className="font-mono font-bold text-green-700">g_M = {f(res.gMoment)}, g_V = {f(res.gShear)}</span>
        </div>
      </div>
    </div>
  );
}
