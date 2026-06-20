"use client";

import React, { useState, useMemo } from "react";
import { computeSteelTruss, type SteelTrussInputs, type TrussType } from "@/engine/steeltruss";

function Nf({ label, unit, value, onChange, step = 1 }: {
  label: string; unit?: string; value: number; onChange: (v: number) => void; step?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-gray-500 leading-tight">{label}</span>
      <div className="relative flex items-center">
        <input type="number" value={value} step={step}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          className={`w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ${unit ? "pr-10" : ""}`} />
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
function Chk({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className={`flex justify-between items-center px-2 py-1 rounded text-[10px] my-0.5 border ${ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
      <span>{label}</span><span className="font-mono">{detail}</span>
      <span className="font-bold">{ok ? "✓ OK" : "✗ NG"}</span>
    </div>
  );
}
const f = (v: number, d = 1) => (isFinite(v) ? v.toFixed(d) : "—");

export function SteelTrussCalculator() {
  const [inp, setInp] = useState<SteelTrussInputs>({
    span: 60, panels: 8, height: 7, type: "WARREN", w: 60,
    Fy: 290, Fu: 500, E: 200000, area: 12000, rGyration: 120, Kfac: 1.0,
  });
  const r = useMemo(() => computeSteelTruss(inp), [inp]);
  const set = (k: keyof SteelTrussInputs, v: number | string) => setInp(p => ({ ...p, [k]: v }));

  // truss elevation
  const W = 320, H = 110, pad = 14, by = H - 18, ty = 24;
  const sx = (W - 2 * pad) / inp.span;
  const Lp = inp.span / inp.panels;

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-60 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Jembatan Rangka Baja (Rochman & Suhariyanto)</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="bentang" unit="m" value={inp.span} step={5} onChange={v => set("span", v)} />
          <Nf label="jumlah panel" value={inp.panels} step={1} onChange={v => set("panels", v)} />
          <Nf label="tinggi rangka" unit="m" value={inp.height} step={0.5} onChange={v => set("height", v)} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-medium text-gray-500">tipe</span>
            <select value={inp.type} onChange={e => set("type", e.target.value as TrussType)}
              className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px]">
              <option value="PRATT">Pratt</option><option value="WARREN">Warren</option><option value="HOWE">Howe</option>
            </select>
          </div>
          <Nf label="w beban" unit="kN/m" value={inp.w} step={5} onChange={v => set("w", v)} />
          <Nf label="F_y" unit="MPa" value={inp.Fy} step={10} onChange={v => set("Fy", v)} />
          <Nf label="F_u" unit="MPa" value={inp.Fu} step={10} onChange={v => set("Fu", v)} />
          <Nf label="E" unit="MPa" value={inp.E} step={5000} onChange={v => set("E", v)} />
          <Nf label="A batang" unit="mm²" value={inp.area} step={500} onChange={v => set("area", v)} />
          <Nf label="r girasi" unit="mm" value={inp.rGyration} step={5} onChange={v => set("rGyration", v)} />
          <Nf label="K efektif" value={inp.Kfac} step={0.1} onChange={v => set("Kfac", v)} />
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-gray-200 rounded bg-slate-50">
          <line x1={pad} y1={ty} x2={W - pad} y2={ty} stroke="#1e293b" strokeWidth="1.6" />
          <line x1={pad} y1={by} x2={W - pad} y2={by} stroke="#1e293b" strokeWidth="1.6" />
          {Array.from({ length: inp.panels + 1 }).map((_, k) => {
            const x = pad + k * Lp * sx;
            return <line key={k} x1={x} y1={ty} x2={x} y2={by} stroke="#64748b" strokeWidth="0.7" />;
          })}
          {Array.from({ length: inp.panels }).map((_, k) => {
            const x0 = pad + k * Lp * sx, x1 = pad + (k + 1) * Lp * sx;
            const up = inp.type === "WARREN" ? (k % 2 === 0) : (k < inp.panels / 2);
            return <line key={k} x1={up ? x0 : x1} y1={by} x2={up ? x1 : x0} y2={ty} stroke="#2563eb" strokeWidth="0.8" />;
          })}
          <polygon points={`${pad - 4},${by + 6} ${pad + 4},${by + 6} ${pad},${by}`} fill="#475569" />
          <circle cx={W - pad} cy={by + 4} r="3" fill="none" stroke="#475569" />
        </svg>
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">Gaya batang — M/h (chord) & V/sinθ (diagonal)</p>
        <table className="w-full max-w-md"><tbody>
          <Row label="panjang panel" value={f(r.panelLength, 2)} unit="m" />
          <Row label="beban titik buhul P" value={f(r.panelLoad, 1)} unit="kN" />
          <Row label="reaksi tumpuan" value={f(r.reaction, 1)} unit="kN" />
          <Row label="gaya chord maks (M/h)" value={f(r.maxChordForce, 0)} unit="kN" hi />
          <Row label="gaya diagonal ujung (V/sinθ)" value={f(r.maxDiagForce, 0)} unit="kN" hi />
          <Row label="sudut diagonal θ" value={f(r.diagAngle, 1)} unit="°" />
        </tbody></table>
        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Kapasitas batang (AASHTO/SNI 1729)</p>
        <table className="w-full max-w-md"><tbody>
          <Row label="P_n tarik = F_y·A" value={f(r.Pn_tension, 0)} unit="kN" />
          <Row label="φP_n tarik (φ=0,90)" value={f(r.phiPn_tension, 0)} unit="kN" hi />
          <Row label="λ = KL/r" value={f(r.lambda, 1)} />
          <Row label="F_cr tekuk lentur" value={f(r.Fcr, 1)} unit="MPa" />
          <Row label="P_n tekan = F_cr·A" value={f(r.Pn_comp, 0)} unit="kN" />
          <Row label="φP_n tekan (φ=0,90)" value={f(r.phiPn_comp, 0)} unit="kN" hi />
        </tbody></table>
        <Chk label="Chord tarik: φP_n ≥ gaya" detail={`${f(r.phiPn_tension, 0)} ≥ ${f(r.maxChordForce, 0)} kN`} ok={r.tensionOk} />
        <Chk label="Chord tekan: φP_n ≥ gaya" detail={`${f(r.phiPn_comp, 0)} ≥ ${f(r.maxChordForce, 0)} kN`} ok={r.compressionOk} />
      </div>
    </div>
  );
}
