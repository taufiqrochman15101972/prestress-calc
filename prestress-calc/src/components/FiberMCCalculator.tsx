"use client";

import React, { useMemo, useState } from "react";
import { computeFiberMC, type SteelBar } from "@/engine/fibermomentcurvature";

function Nf({ label, unit, value, onChange, step = 1 }: { label: string; unit?: string; value: number; onChange: (v: number) => void; step?: number; }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-gray-500 leading-tight">{label}</span>
      <div className="relative flex items-center">
        <input type="number" value={value} step={step} onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          className={`w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ${unit ? "pr-9" : ""}`} />
        {unit && <span className="absolute right-1.5 text-[9px] text-gray-400 pointer-events-none">{unit}</span>}
      </div>
    </div>
  );
}
function Row({ label, value, unit, hi }: { label: string; value: string; unit?: string; hi?: boolean }) {
  return <tr className="border-b border-gray-100"><td className="py-0.5 pr-3 text-gray-500 text-[10px]">{label}</td><td className={`py-0.5 font-mono text-right text-[10px] font-semibold ${hi ? "text-blue-700" : "text-gray-800"}`}>{value}</td>{unit && <td className="py-0.5 pl-1 text-gray-400 text-[9px]">{unit}</td>}</tr>;
}
const f = (v: number, d = 1) => (isFinite(v) ? v.toFixed(d) : "—");

export function FiberMCCalculator() {
  const [s, setS] = useState({ b: 300, h: 500, fc: 30, AsT: 1500, dT: 450, AsC: 600, dC: 50, fy: 420, Es: 200000 });
  const set = (k: keyof typeof s, v: number) => setS(p => ({ ...p, [k]: v }));
  const r = useMemo(() => {
    const bars: SteelBar[] = [{ A: s.AsT, d: s.dT, Es: s.Es, fy: s.fy }];
    if (s.AsC > 0) bars.push({ A: s.AsC, d: s.dC, Es: s.Es, fy: s.fy });
    return computeFiberMC({ b: s.b, h: s.h, fc: s.fc, bars });
  }, [s]);

  const W = 420, H = 230, padL = 48, padB = 28, padT = 10;
  const phiMax = Math.max(...r.curve.map(p => p.phi), 1e-9), Mmax = Math.max(...r.curve.map(p => p.M), 1);
  const x2 = (phi: number) => padL + (phi / phiMax) * (W - padL - 10);
  const y2 = (M: number) => H - padB - (M / Mmax) * (H - padB - padT);
  const path = r.curve.map((p, i) => `${i === 0 ? "M" : "L"}${x2(p.phi).toFixed(1)},${y2(p.M).toFixed(1)}`).join(" ");

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-52 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Fiber M–φ (UMAT nonlinier)</p>
        <div className="grid grid-cols-3 gap-1.5">
          <Nf label="b" unit="mm" value={s.b} step={25} onChange={v => set("b", v)} />
          <Nf label="h" unit="mm" value={s.h} step={25} onChange={v => set("h", v)} />
          <Nf label="f'c" unit="MPa" value={s.fc} step={5} onChange={v => set("fc", v)} />
        </div>
        <p className="text-[9px] font-bold text-gray-500 uppercase">Baja tarik / tekan</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="As tarik" unit="mm²" value={s.AsT} step={100} onChange={v => set("AsT", v)} />
          <Nf label="d tarik" unit="mm" value={s.dT} step={10} onChange={v => set("dT", v)} />
          <Nf label="As tekan" unit="mm²" value={s.AsC} step={100} onChange={v => set("AsC", v)} />
          <Nf label="d' tekan" unit="mm" value={s.dC} step={5} onChange={v => set("dC", v)} />
          <Nf label="f_y" unit="MPa" value={s.fy} step={20} onChange={v => set("fy", v)} />
          <Nf label="E_s" unit="MPa" value={s.Es} step={1000} onChange={v => set("Es", v)} />
        </div>
        <table className="w-full"><tbody>
          <Row label="M_y leleh" value={f(r.My / 1e6, 1)} unit="kN·m" />
          <Row label="M_u ultimit" value={f(r.Mu / 1e6, 1)} unit="kN·m" hi />
          <Row label="φ_u kurvatur" value={r.phiU.toExponential(2)} unit="1/mm" />
          <Row label="daktilitas μ_φ" value={f(r.ductility, 1)} hi />
        </tbody></table>
        <p className="text-[9px] text-gray-400 leading-snug">Penampang dipotong jadi serat beton (Hognestad + crushing) + lapis baja (elastik-plastis); Newton-Raphson cari regangan atas tiap kurvatur → kurva M–φ (basis pushover fiber & nonlinier material UMAT).</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">Kurva Momen–Kurvatur (M–φ)</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-gray-200 rounded bg-slate-50">
          <line x1={padL} y1={H - padB} x2={W - 8} y2={H - padB} stroke="#94a3b8" strokeWidth="0.8" />
          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="#94a3b8" strokeWidth="0.8" />
          <path d={path} fill="none" stroke="#1d4ed8" strokeWidth="1.8" />
          <text x={W - 24} y={H - padB + 16} fontSize="8" fill="#64748b">φ</text>
          <text x={padL - 40} y={padT + 8} fontSize="8" fill="#64748b">M (N·mm)</text>
        </svg>
      </div>
    </div>
  );
}
