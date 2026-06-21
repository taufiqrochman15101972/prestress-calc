"use client";

import React, { useMemo, useState } from "react";
import { infiniteSlopeFS, slopeSlicesFS } from "@/engine/slopestability";

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
function Chk({ label, fs }: { label: string; fs: number }) {
  const ok = fs >= 1.5, warn = fs >= 1.0 && fs < 1.5;
  return <div className={`flex justify-between items-center px-2 py-1 rounded text-[10px] my-0.5 border ${ok ? "bg-green-50 border-green-200 text-green-800" : warn ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-red-50 border-red-200 text-red-700"}`}>
    <span>{label}</span><span className="font-mono font-bold">FS = {isFinite(fs) ? fs.toFixed(3) : "—"}</span><span>{ok ? "✓ aman" : warn ? "marginal" : "✗ longsor"}</span>
  </div>;
}
const f = (v: number, d = 2) => (isFinite(v) ? v.toFixed(d) : "—");

export function SlopeStabilityCalculator() {
  const [inf, setInf] = useState({ c: 5, phi: 30, gamma: 18, z: 3, beta: 22, seepage: false });
  const [sl, setSl] = useState({ H: 10, beta: 30, c: 20, phi: 20, gamma: 18, ru: 0, xc: 10, yc: 16, R: 18 });
  const fsInf = useMemo(() => infiniteSlopeFS(inf), [inf]);
  const r = useMemo(() => slopeSlicesFS(sl), [sl]);
  const si = (k: keyof typeof inf, v: number | boolean) => setInf(p => ({ ...p, [k]: v }));
  const ss = (k: keyof typeof sl, v: number) => setSl(p => ({ ...p, [k]: v }));

  // slope+circle sketch
  const W = 300, H = 170, pad = 16; const B = sl.H / Math.tan(sl.beta * Math.PI / 180);
  const xmin = -5, xmax = Math.max(B + 8, sl.xc + sl.R), ymin = -4, ymax = Math.max(sl.H + 4, sl.yc);
  const sc = Math.min((W - 2 * pad) / (xmax - xmin), (H - 2 * pad) / (ymax - ymin));
  const X = (x: number) => pad + (x - xmin) * sc, Y = (y: number) => H - pad - (y - ymin) * sc;

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-56 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Lereng tak-hingga (translasi)</p>
        <div className="grid grid-cols-3 gap-1.5">
          <Nf label="c" unit="kPa" value={inf.c} step={1} onChange={v => si("c", v)} />
          <Nf label="φ" unit="°" value={inf.phi} step={1} onChange={v => si("phi", v)} />
          <Nf label="β" unit="°" value={inf.beta} step={1} onChange={v => si("beta", v)} />
          <Nf label="γ" unit="kN/m³" value={inf.gamma} step={0.5} onChange={v => si("gamma", v)} />
          <Nf label="z" unit="m" value={inf.z} step={0.5} onChange={v => si("z", v)} />
          <label className="flex items-center gap-1 text-[9px] mt-3"><input type="checkbox" checked={inf.seepage} onChange={e => si("seepage", e.target.checked)} />seepage</label>
        </div>
        <Chk label="FS lereng tak-hingga" fs={fsInf} />
        <p className="text-[9px] font-bold text-gray-500 uppercase pt-1">Busur lingkaran (metode irisan)</p>
        <div className="grid grid-cols-3 gap-1.5">
          <Nf label="H" unit="m" value={sl.H} step={1} onChange={v => ss("H", v)} />
          <Nf label="β" unit="°" value={sl.beta} step={1} onChange={v => ss("beta", v)} />
          <Nf label="γ" unit="kN/m³" value={sl.gamma} step={0.5} onChange={v => ss("gamma", v)} />
          <Nf label="c" unit="kPa" value={sl.c} step={2} onChange={v => ss("c", v)} />
          <Nf label="φ" unit="°" value={sl.phi} step={1} onChange={v => ss("phi", v)} />
          <Nf label="r_u" value={sl.ru} step={0.05} onChange={v => ss("ru", v)} />
          <Nf label="x_c" unit="m" value={sl.xc} step={1} onChange={v => ss("xc", v)} />
          <Nf label="y_c" unit="m" value={sl.yc} step={1} onChange={v => ss("yc", v)} />
          <Nf label="R" unit="m" value={sl.R} step={1} onChange={v => ss("R", v)} />
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">Lereng + bidang gelincir (irisan: {r.nSlices})</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm border border-gray-200 rounded bg-slate-50">
          <line x1={X(xmin)} y1={Y(0)} x2={X(0)} y2={Y(0)} stroke="#92400e" strokeWidth="1.2" />
          <line x1={X(0)} y1={Y(0)} x2={X(B)} y2={Y(sl.H)} stroke="#92400e" strokeWidth="1.2" />
          <line x1={X(B)} y1={Y(sl.H)} x2={X(xmax)} y2={Y(sl.H)} stroke="#92400e" strokeWidth="1.2" />
          <circle cx={X(sl.xc)} cy={Y(sl.yc)} r={sl.R * sc} fill="none" stroke="#dc2626" strokeWidth="1" strokeDasharray="3 2" />
          <circle cx={X(sl.xc)} cy={Y(sl.yc)} r="2" fill="#dc2626" />
        </svg>
        <Chk label="FS Bishop simplified" fs={r.FS_bishop} />
        <Chk label="FS Fellenius (ordinary)" fs={r.FS_fellenius} />
        {!r.valid && <p className="text-[10px] text-amber-700">Lingkaran tak memotong lereng dengan benar — sesuaikan x_c, y_c, R.</p>}
        <p className="text-[9px] text-gray-500 leading-snug">Metode irisan busur lingkaran (Bishop iteratif & Fellenius). Geser x_c/y_c/R mencari FS minimum (lingkaran kritis). FS≥1,5 lazimnya disyaratkan untuk lereng permanen.</p>
      </div>
    </div>
  );
}
