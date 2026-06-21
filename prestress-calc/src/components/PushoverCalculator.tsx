"use client";

import React, { useMemo, useState } from "react";
import { computePushover } from "@/engine/fem/pushover";
import type { FrameModel } from "@/engine/fem/frame";

const SEC = { E: 200000, A: 12000, I: 3e8 };
const PORTAL: FrameModel = {
  nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: 3500 }, { id: 3, x: 6000, y: 3500 }, { id: 4, x: 6000, y: 0 }],
  members: [{ id: 1, n1: 1, n2: 2, ...SEC }, { id: 2, n1: 2, n2: 3, ...SEC }, { id: 3, n1: 4, n2: 3, ...SEC }],
  supports: [{ node: 1, ux: true, uy: true, rz: true }, { node: 4, ux: true, uy: true, rz: true }],
  nodalLoads: [], memberLoads: [],
};
const f = (v: number, d = 1) => (isFinite(v) ? v.toFixed(d) : "—");

export function PushoverCalculator() {
  const [Mp, setMp] = useState(300);   // kN·m
  const r = useMemo(() => computePushover({ model: PORTAL, refLoads: [{ node: 2, fx: 1 }, { node: 3, fx: 1 }], Mp: Mp * 1e6, controlNode: 2 }), [Mp]);

  const W = 420, H = 240, padL = 44, padB = 28, padT = 12;
  const dMax = Math.max(...r.curve.map(p => p.disp), 1), vMax = Math.max(...r.curve.map(p => p.baseShear), 1);
  const x2 = (d: number) => padL + (d / dMax) * (W - padL - 10);
  const y2 = (v: number) => H - padB - (v / vMax) * (H - padB - padT);
  const path = r.curve.map((p, i) => `${i === 0 ? "M" : "L"}${x2(p.disp).toFixed(1)},${y2(p.baseShear).toFixed(1)}`).join(" ");

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-52 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Pushover (sendi plastis, event-to-event)</p>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-gray-500">M_p plastis (kN·m)</span>
          <input type="number" value={Mp} step={25} onChange={e => setMp(+e.target.value)} className="rounded border border-gray-300 px-2 py-1 font-mono text-[11px]" />
        </div>
        <table className="w-full"><tbody>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">V_base maks</td><td className="font-mono text-right text-[10px] font-semibold text-blue-700">{f(r.Vmax / 1e3, 1)} kN</td></tr>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">Δ kontrol akhir</td><td className="font-mono text-right text-[10px] font-semibold text-red-600">{f(r.dispMax, 1)} mm</td></tr>
          <tr className="border-b border-gray-100"><td className="text-[10px] text-gray-500 py-0.5">jumlah sendi</td><td className="font-mono text-right text-[10px]">{r.nHinges}</td></tr>
          <tr><td className="text-[10px] text-gray-500 py-0.5">mekanisme runtuh</td><td className="font-mono text-right text-[10px]">{r.mechanism ? "ya" : "—"}</td></tr>
        </tbody></table>
        <p className="text-[9px] text-gray-400 leading-snug">Portal 1-lantai dorong lateral; tiap langkah satu sendi plastis terbentuk (kondensasi statik) sampai mekanisme. Kurva kapasitas = base shear vs perpindahan kontrol (gaya MIDAS/Robot pushover).</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">Kurva kapasitas (base shear − perpindahan)</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-gray-200 rounded bg-slate-50">
          <line x1={padL} y1={H - padB} x2={W - 8} y2={H - padB} stroke="#94a3b8" strokeWidth="0.8" />
          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="#94a3b8" strokeWidth="0.8" />
          <path d={path} fill="none" stroke="#1d4ed8" strokeWidth="1.8" />
          {r.curve.map((p, i) => <circle key={i} cx={x2(p.disp)} cy={y2(p.baseShear)} r="2" fill="#dc2626" />)}
          <text x={W - 36} y={H - padB + 16} fontSize="8" fill="#64748b">Δ (mm)</text>
          <text x={padL - 38} y={padT + 8} fontSize="8" fill="#64748b">V (N)</text>
        </svg>
        <p className="text-[9px] text-gray-400 mt-0.5">Titik merah = pembentukan sendi plastis berturut-turut.</p>
      </div>
    </div>
  );
}
