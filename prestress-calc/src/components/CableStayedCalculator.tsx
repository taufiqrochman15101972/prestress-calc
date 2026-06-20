"use client";

import React, { useState, useMemo } from "react";
import { computeCableStayed, type CableStayedInputs, type StayLayout } from "@/engine/cablestayed";

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
const f = (v: number, d = 1) => (isFinite(v) ? v.toFixed(d) : "—");

export function CableStayedCalculator() {
  const [inp, setInp] = useState<CableStayedInputs>({
    mainSpan: 200, pylonHeight: 50, nStays: 8, layout: "SEMI_FAN",
    w: 180, sigmaAllow: 720, gammaCable: 78.5, Ecable: 195000,
  });
  const r = useMemo(() => computeCableStayed(inp), [inp]);
  const set = (k: keyof CableStayedInputs, v: number | string) => setInp(p => ({ ...p, [k]: v }));

  // elevation diagram
  const W = 320, H = 150, deckY = 110, pylonX = 30, base = 30;
  const sx = (W - base - 6) / (inp.mainSpan / 2);
  const pyTop = deckY - inp.pylonHeight * (deckY - 14) / Math.max(inp.pylonHeight, inp.mainSpan / 2 * 0.5);

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-60 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Jembatan Kabel (Gimsing & Georgakis)</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="bentang utama" unit="m" value={inp.mainSpan} step={10} onChange={v => set("mainSpan", v)} />
          <Nf label="tinggi pilon" unit="m" value={inp.pylonHeight} step={5} onChange={v => set("pylonHeight", v)} />
          <Nf label="stay / sisi" value={inp.nStays} step={1} onChange={v => set("nStays", v)} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-medium text-gray-500">layout</span>
            <select value={inp.layout} onChange={e => set("layout", e.target.value as StayLayout)}
              className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px]">
              <option value="FAN">Fan (kipas)</option>
              <option value="SEMI_FAN">Semi-fan</option>
              <option value="HARP">Harp (harpa)</option>
            </select>
          </div>
          <Nf label="w dek (DL+LL)" unit="kN/m" value={inp.w} step={10} onChange={v => set("w", v)} />
          <Nf label="σ izin stay" unit="MPa" value={inp.sigmaAllow} step={20} onChange={v => set("sigmaAllow", v)} />
          <Nf label="E kabel" unit="MPa" value={inp.Ecable} step={5000} onChange={v => set("Ecable", v)} />
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-gray-200 rounded bg-slate-50">
          {/* pylon */}
          <line x1={pylonX} y1={deckY} x2={pylonX} y2={pyTop} stroke="#475569" strokeWidth="3" />
          {/* deck */}
          <line x1={pylonX} y1={deckY} x2={W - 4} y2={deckY} stroke="#1e293b" strokeWidth="2.5" />
          {/* stays */}
          {r.stays.map(s => {
            const x = pylonX + s.x * sx;
            const topY = inp.layout === "HARP"
              ? deckY - (pyTop < deckY ? (deckY - pyTop) * s.index / inp.nStays : 0)
              : pyTop;
            return <line key={s.index} x1={pylonX} y1={topY} x2={x} y2={deckY} stroke="#2563eb" strokeWidth="0.8" />;
          })}
          <text x={pylonX - 8} y={pyTop - 2} fontSize="7" fill="#475569">pilon</text>
        </svg>
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">{r.note}</p>
        <table className="w-full max-w-lg text-[10px]">
          <thead><tr className="text-gray-400 border-b border-gray-200">
            <th className="text-left py-0.5">stay</th><th className="text-right">x (m)</th>
            <th className="text-right">θ (°)</th><th className="text-right">gaya (kN)</th>
            <th className="text-right">A (mm²)</th><th className="text-right">E_eff (MPa)</th>
          </tr></thead>
          <tbody className="font-mono">
            {r.stays.map(s => (
              <tr key={s.index} className="border-b border-gray-100">
                <td className="py-0.5">{s.index}</td>
                <td className="text-right">{f(s.x, 1)}</td>
                <td className="text-right">{f(s.angle, 1)}</td>
                <td className="text-right text-blue-700">{f(s.force, 0)}</td>
                <td className="text-right">{f(s.area, 0)}</td>
                <td className="text-right">{f(s.Eeff, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="w-full max-w-md"><tbody>
          <tr className="border-b border-gray-100"><td className="py-0.5 pr-3 text-gray-500 text-[10px]">Σ gaya stay</td><td className="py-0.5 font-mono text-right text-[10px] font-semibold text-blue-700">{f(r.totalCableForce, 0)}</td><td className="text-gray-400 text-[9px] pl-1">kN</td></tr>
          <tr className="border-b border-gray-100"><td className="py-0.5 pr-3 text-gray-500 text-[10px]">Aksial pilon (Σ V)</td><td className="py-0.5 font-mono text-right text-[10px] font-semibold text-blue-700">{f(r.pylonAxial, 0)}</td><td className="text-gray-400 text-[9px] pl-1">kN</td></tr>
          <tr className="border-b border-gray-100"><td className="py-0.5 pr-3 text-gray-500 text-[10px]">Tekan dek (Σ H)</td><td className="py-0.5 font-mono text-right text-[10px] font-semibold text-blue-700">{f(r.deckCompression, 0)}</td><td className="text-gray-400 text-[9px] pl-1">kN</td></tr>
        </tbody></table>
        <p className="text-[9px] text-gray-500 leading-snug">Gaya stay = beban vertikal tributari / sin θ; luas perlu = gaya/σ_izin; modulus efektif Ernst memperhitungkan kelendutan kabel (sag). Komponen vertikal → aksial pilon; komponen horizontal → tekan dek menuju pilon.</p>
      </div>
    </div>
  );
}
