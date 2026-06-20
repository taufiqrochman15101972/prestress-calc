"use client";

import React, { useMemo, useState } from "react";
import { computeNewmarkSDOF, type Forcing } from "@/engine/timehistory";

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
const f = (v: number, d = 3) => (isFinite(v) ? v.toFixed(d) : "—");

export function TimeHistoryCalculator() {
  const [s, setS] = useState({ m: 50000, k: 2e7, zeta: 0.05, forcing: "GROUND_SINE" as Forcing, p0: 3.5, freqRatio: 1.0, dt: 0.005, tEnd: 15 });
  const set = (k: keyof typeof s, v: number | string) => setS(p => ({ ...p, [k]: v }));
  const wn = Math.sqrt(s.k / s.m);
  const r = useMemo(() => computeNewmarkSDOF({ m: s.m, k: s.k, zeta: s.zeta, dt: s.dt, tEnd: s.tEnd, forcing: s.forcing, p0: s.p0, omega: s.freqRatio * wn }), [s, wn]);

  // plot u(t)
  const W = 540, H = 150, padL = 8, padT = 8, padB = 18;
  const umax = Math.max(...r.u.map(Math.abs), 1e-12);
  const x2 = (i: number) => padL + (r.t[i] / s.tEnd) * (W - 2 * padL);
  const y2 = (u: number) => padT + (H - padT - padB) / 2 - (u / umax) * ((H - padT - padB) / 2);
  const path = r.u.map((u, i) => `${i === 0 ? "M" : "L"}${x2(i).toFixed(1)},${y2(u).toFixed(1)}`).join(" ");

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-56 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Time-History (Newmark-β, linear)</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="m massa" unit="kg" value={s.m} step={5000} onChange={v => set("m", v)} />
          <Nf label="k kekakuan" unit="N/m" value={s.k} step={1e6} onChange={v => set("k", v)} />
          <Nf label="ζ redaman" value={s.zeta} step={0.01} onChange={v => set("zeta", v)} />
          <div className="flex flex-col gap-0.5"><span className="text-[9px] text-gray-500">eksitasi</span>
            <select value={s.forcing} onChange={e => set("forcing", e.target.value)} className="rounded border border-gray-300 px-1 py-1 text-[10px]">
              <option value="GROUND_SINE">Gempa sinus (a_g)</option>
              <option value="HARMONIC">Gaya harmonik</option>
              <option value="PULSE">Pulsa</option>
            </select></div>
          <Nf label={s.forcing === "GROUND_SINE" ? "PGA a_g" : "P₀ gaya"} unit={s.forcing === "GROUND_SINE" ? "m/s²" : "N"} value={s.p0} step={s.forcing === "GROUND_SINE" ? 0.5 : 1000} onChange={v => set("p0", v)} />
          <Nf label="ω/ωn rasio" value={s.freqRatio} step={0.1} onChange={v => set("freqRatio", v)} />
          <Nf label="Δt" unit="s" value={s.dt} step={0.001} onChange={v => set("dt", v)} />
          <Nf label="durasi" unit="s" value={s.tEnd} step={1} onChange={v => set("tEnd", v)} />
        </div>
        <table className="w-full"><tbody>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">ωn</td><td className="font-mono text-right text-[10px]">{f(wn, 2)} rad/s</td></tr>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">Tn perioda</td><td className="font-mono text-right text-[10px]">{f(r.Tn, 3)} s</td></tr>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">u_puncak</td><td className="font-mono text-right text-[10px] font-semibold text-red-600">{f(r.peak * 1000, 2)} mm</td></tr>
          <tr><td className="text-[10px] text-gray-500 py-0.5">DAF (puncak/statik)</td><td className="font-mono text-right text-[10px] font-semibold text-blue-700">{f(r.DAF, 2)}</td></tr>
        </tbody></table>
        <p className="text-[9px] text-gray-400 leading-snug">Integrasi langsung Newmark rata-rata percepatan (γ=½, β=¼, stabil tanpa syarat). Resonansi ω≈ωn → DAF≈1/2ζ. Setara fitur time-history MIDAS/Robot (SDOF; MDOF berikutnya di atas solver FEM).</p>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">Riwayat perpindahan u(t) — puncak {f(r.peak * 1000, 1)} mm</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-gray-200 rounded bg-slate-50">
          <line x1={padL} y1={padT + (H - padT - padB) / 2} x2={W - padL} y2={padT + (H - padT - padB) / 2} stroke="#94a3b8" strokeWidth="0.6" />
          <path d={path} fill="none" stroke="#dc2626" strokeWidth="1" />
          <text x={W - 28} y={H - 5} fontSize="8" fill="#64748b">t={f(s.tEnd, 0)}s</text>
          <text x={padL + 2} y={padT + 8} fontSize="8" fill="#64748b">u</text>
        </svg>
      </div>
    </div>
  );
}
