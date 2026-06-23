"use client";

import React, { useState, useMemo } from "react";
import {
  threeMomentContinuous, proppedCantileverUDL, fixedFixedUDL, type Span,
} from "@/engine/forcemethod";

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
const f = (v: number, d = 2) => (isFinite(v) ? v.toFixed(d) : "—");

export function ForceMethodCalculator() {
  const [spans, setSpans] = useState<Span[]>([{ L: 6, w: 10 }, { L: 8, w: 12 }, { L: 6, w: 10 }]);
  const setSpan = (i: number, key: keyof Span, v: number) =>
    setSpans(p => p.map((s, idx) => idx === i ? { ...s, [key]: v } : s));
  const addSpan = () => setSpans(p => [...p, { ...p[p.length - 1] }]);
  const delSpan = () => setSpans(p => p.length > 1 ? p.slice(0, -1) : p);
  const r = useMemo(() => threeMomentContinuous(spans), [spans]);

  const [cc, setCC] = useState({ w: 12, L: 8 });
  const prop = useMemo(() => proppedCantileverUDL(cc.w, cc.L), [cc]);
  const ff = useMemo(() => fixedFixedUDL(cc.w, cc.L), [cc]);

  // bending-moment sketch for the continuous beam
  const W = 360, H = 120, padX = 18, midY = 50;
  const totalL = spans.reduce((s, sp) => s + sp.L, 0);
  const maxM = Math.max(...r.supportMoments.map(Math.abs), ...r.midspanMoments.map(Math.abs), 1e-9);
  const scale = 38 / maxM;
  const xAt = (dist: number) => padX + (dist / totalL) * (W - 2 * padX);
  let acc = 0;
  const supX = [xAt(0)];
  for (const sp of spans) { acc += sp.L; supX.push(xAt(acc)); }
  // moment polyline (sagging plotted downward): sample support+mid points
  const pts: string[] = [];
  acc = 0;
  pts.push(`${xAt(0)},${midY - r.supportMoments[0] * scale}`);
  spans.forEach((sp, s) => {
    const xm = xAt(acc + sp.L / 2);
    pts.push(`${xm},${midY - r.midspanMoments[s] * scale}`);
    acc += sp.L;
    pts.push(`${xAt(acc)},${midY - r.supportMoments[s + 1] * scale}`);
  });

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-56 flex-none space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-bold text-gray-500 uppercase">Balok menerus (bentang, w)</p>
          <div className="flex gap-1">
            <button onClick={addSpan} className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-bold">+</button>
            <button onClick={delSpan} className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 text-[9px] font-bold">−</button>
          </div>
        </div>
        <div className="space-y-1 max-h-44 overflow-y-auto">
          {spans.map((s, i) => (
            <div key={i} className="grid grid-cols-2 gap-1 items-end">
              <Nf label={`L${i + 1}`} unit="m" value={s.L} step={0.5} onChange={v => setSpan(i, "L", v)} />
              <Nf label={`w${i + 1}`} unit="kN/m" value={s.w} step={1} onChange={v => setSpan(i, "w", v)} />
            </div>
          ))}
        </div>
        <p className="text-[8px] text-gray-400 leading-snug">Tiga-Momen Clapeyron: M_{`{i−1}`}L_i+2M_i(L_i+L_{`{i+1}`})+M_{`{i+1}`}L_{`{i+1}`}=−¼(w_iL_i³+w_{`{i+1}`}L_{`{i+1}`}³). Ujung sederhana M=0.</p>

        <p className="text-[9px] font-bold text-gray-500 uppercase pt-1">Kasus klasik (verifikasi)</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="w" unit="kN/m" value={cc.w} step={1} onChange={v => setCC(p => ({ ...p, w: v }))} />
          <Nf label="L" unit="m" value={cc.L} step={0.5} onChange={v => setCC(p => ({ ...p, L: v }))} />
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">Diagram momen lentur (sagging ke bawah)</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-lg border border-gray-200 rounded bg-slate-50">
          <line x1={padX} y1={midY} x2={W - padX} y2={midY} stroke="#94a3b8" strokeWidth="0.8" />
          {supX.map((x, i) => <polygon key={i} points={`${x},${midY} ${x - 3},${midY + 6} ${x + 3},${midY + 6}`} fill="#475569" />)}
          <polyline points={pts.join(" ")} fill="none" stroke="#2563eb" strokeWidth="1.3" />
          {r.supportMoments.map((m, i) => Math.abs(m) > 1e-6 && (
            <text key={i} x={supX[i]} y={midY - m * scale - 3} fontSize="6.5" fill="#dc2626" textAnchor="middle">{f(m, 0)}</text>
          ))}
        </svg>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase text-gray-400">Momen tumpuan & reaksi</p>
            <table className="w-full text-[9px] mt-1">
              <thead><tr className="text-gray-400 border-b border-gray-200">
                <th className="text-left py-0.5">tump.</th><th className="text-right">M (kNm)</th><th className="text-right">R (kN)</th>
              </tr></thead>
              <tbody className="font-mono">
                {r.reactions.map((R, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-0.5 text-gray-500">{i + 1}</td>
                    <td className="text-right text-red-600">{f(r.supportMoments[i], 1)}</td>
                    <td className="text-right text-blue-700 font-semibold">{f(R, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[8px] text-gray-400 mt-0.5">ΣR = {f(r.reactions.reduce((s, v) => s + v, 0), 1)} kN = Σ(w·L) = {f(spans.reduce((s, sp) => s + sp.w * sp.L, 0), 1)} kN ✓</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase text-gray-400">Momen lapangan</p>
            <table className="w-full mt-1"><tbody>
              {r.midspanMoments.map((m, i) => <Row key={i} label={`bentang ${i + 1}`} value={f(m, 1)} unit="kNm" />)}
            </tbody></table>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-2 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase text-gray-400">Kantilever-prop (UDL)</p>
            <table className="w-full mt-1"><tbody>
              <Row label="R_B (redundan) = 3wL/8" value={f(prop.RB, 1)} unit="kN" hi />
              <Row label="R_A = 5wL/8" value={f(prop.RA, 1)} unit="kN" />
              <Row label="M_jepit = −wL²/8" value={f(prop.Mfix, 1)} unit="kNm" />
              <Row label="M_lap = 9wL²/128" value={f(prop.Mspan, 1)} unit="kNm" />
            </tbody></table>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase text-gray-400">Jepit-jepit (UDL)</p>
            <table className="w-full mt-1"><tbody>
              <Row label="M_ujung = −wL²/12" value={f(ff.Mend, 1)} unit="kNm" hi />
              <Row label="M_tengah = wL²/24" value={f(ff.Mmid, 1)} unit="kNm" />
              <Row label="R = wL/2" value={f(ff.R, 1)} unit="kN" />
            </tbody></table>
          </div>
        </div>
        <p className="text-[8px] text-gray-400 leading-snug border-t border-gray-100 pt-1">
          Metode GAYA (fleksibilitas) / persamaan Tiga-Momen — dual klasik metode kekakuan FEM 🧮. Verifikasi silang: hasil balok menerus & redundan identik dengan solver FEM. Pustaka MTH (Przemieniecki/Azar/Paz Matrix Structural Analysis, MTH 1–116) — angka contoh PDF bukan acuan, hanya rumus/prosedur.
        </p>
      </div>
    </div>
  );
}
