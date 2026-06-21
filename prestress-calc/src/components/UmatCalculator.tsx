"use client";

import React, { useMemo, useState } from "react";
import { umatLinear, umatHognestad, umatElastoPlastic, computeUmatCurve, type UMat } from "@/engine/umat";

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
const f = (v: number, d = 2) => (isFinite(v) ? v.toFixed(d) : "—");

export function UmatCalculator() {
  const [mat, setMat] = useState<"linear" | "hognestad" | "ep">("hognestad");
  const [s, setS] = useState({ E: 200000, fc: 30, eps0: 0.002, epscu: 0.0038, fy: 420, Eh: 2000, epsMax: 0.004 });
  const set = (k: keyof typeof s, v: number) => setS(p => ({ ...p, [k]: v }));
  const umat: UMat = useMemo(() => mat === "linear" ? umatLinear(s.E) : mat === "hognestad" ? umatHognestad(s.fc, s.eps0, s.epscu) : umatElastoPlastic(s.E, s.fy, s.Eh), [mat, s]);
  const c = useMemo(() => computeUmatCurve(umat, s.epsMax, 100), [umat, s.epsMax]);

  const W = 420, H = 230, padL = 46, padB = 26, padT = 10;
  const xMax = s.epsMax, yMax = Math.max(...c.curve.map(p => Math.abs(p.sigma)), 1);
  const X = (e: number) => padL + (e / xMax) * (W - padL - 10);
  const Y = (sig: number) => H - padB - (sig / yMax) * (H - padB - padT);
  const path = c.curve.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.eps).toFixed(1)},${Y(p.sigma).toFixed(1)}`).join(" ");

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-52 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">UMAT material (USSR / ABAQUS-style)</p>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-gray-500">model</span>
          <select value={mat} onChange={e => setMat(e.target.value as typeof mat)} className="rounded border border-gray-300 px-1.5 py-1 text-[10px]">
            <option value="linear">Linear elastik</option>
            <option value="hognestad">Beton Hognestad (nonlinear-elastik)</option>
            <option value="ep">Baja elasto-plastis (+hardening)</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {mat !== "hognestad" && <Nf label="E" unit="MPa" value={s.E} step={1000} onChange={v => set("E", v)} />}
          {mat === "hognestad" && <><Nf label="f'c" unit="MPa" value={s.fc} step={5} onChange={v => set("fc", v)} /><Nf label="ε0" value={s.eps0} step={0.0005} onChange={v => set("eps0", v)} /><Nf label="εcu" value={s.epscu} step={0.0002} onChange={v => set("epscu", v)} /></>}
          {mat === "ep" && <><Nf label="f_y" unit="MPa" value={s.fy} step={20} onChange={v => set("fy", v)} /><Nf label="E_h" unit="MPa" value={s.Eh} step={500} onChange={v => set("Eh", v)} /></>}
          <Nf label="ε maks" value={s.epsMax} step={0.001} onChange={v => set("epsMax", v)} />
        </div>
        <table className="w-full"><tbody>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">σ puncak</td><td className="font-mono text-right text-[10px] font-semibold text-blue-700">{f(c.peak, 1)} MPa</td></tr>
          <tr><td className="text-[10px] text-gray-500 py-0.5">ε @puncak</td><td className="font-mono text-right text-[10px]">{f(c.epsAtPeak, 4)}</td></tr>
        </tbody></table>
        <p className="text-[9px] text-gray-400 leading-snug">Antarmuka UMAT 1D: σ(ε) + tangen E_t, dapat dicolok ke serat penampang (M–φ 🧵) & elemen truss/fiber-frame. Mirip user-supplied subroutine MIDAS GTS / ABAQUS UMAT (file 255).</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">Kurva tegangan–regangan σ(ε)</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-gray-200 rounded bg-slate-50">
          <line x1={padL} y1={H - padB} x2={W - 8} y2={H - padB} stroke="#94a3b8" strokeWidth="0.8" />
          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="#94a3b8" strokeWidth="0.8" />
          <path d={path} fill="none" stroke="#1d4ed8" strokeWidth="1.8" />
          <text x={W - 18} y={H - padB + 16} fontSize="8" fill="#64748b">ε</text>
          <text x={padL - 40} y={padT + 8} fontSize="8" fill="#64748b">σ (MPa)</text>
        </svg>
      </div>
    </div>
  );
}
