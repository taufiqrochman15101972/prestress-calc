"use client";

import React, { useState, useMemo } from "react";
import { computeDiffShrinkage } from "@/engine/diffshrinkage";
import type { DiffShrinkageInputs } from "@/engine/diffshrinkage";

const DEFAULT: DiffShrinkageInputs = {
  epsDiffMicro: 150, Edeck: 0, fcDeck: 30, bEff: 2100, td: 200,
  Ac: 8.6e5, Ic: 3.729e11, yTopSlab: 709.5, Htotal: 1850, phiCreep: 2.0,
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

export function DiffShrinkageCalculator() {
  const [inp, setInp] = useState<DiffShrinkageInputs>(DEFAULT);
  const set = (k: keyof DiffShrinkageInputs, v: number) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const res = useMemo(() => computeDiffShrinkage(inp), [inp]);
  const f = (v: number, d = 2) => v.toFixed(d);

  // stress-diagram scale
  const smax = Math.max(0.5, Math.abs(res.sigmaTopSlab), Math.abs(res.sigmaBotGirder),
    Math.abs(res.sigmaTopGirder), Math.abs(res.sigmaBotSlab));
  const sx = 32 / smax; // px per MPa
  const oy = 12, totH = 76;
  const yScale = totH / inp.Htotal;
  const yIntfPx = oy + inp.td * yScale;
  const axisX = 96;
  const bar = (sigma: number, yPx: number) => {
    const w = sigma * sx;
    return <line x1={axisX} y1={yPx} x2={axisX + w} y2={yPx} stroke={sigma >= 0 ? "#dc2626" : "#1d4ed8"} strokeWidth="2" />;
  };

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-56 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Susut Diferensial & Deck</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="Δε susut diff" unit="×10⁻⁶" value={inp.epsDiffMicro} onChange={v => set("epsDiffMicro", v)} step={10} />
            <Nf label="φ creep" value={inp.phiCreep} onChange={v => set("phiCreep", v)} step={0.1} />
            <Nf label="E_deck (0=auto)" unit="MPa" value={inp.Edeck} onChange={v => set("Edeck", v)} step={1000} />
            <Nf label="f'c deck" unit="MPa" value={inp.fcDeck} onChange={v => set("fcDeck", v)} />
            <Nf label="b_eff deck" unit="mm" value={inp.bEff} onChange={v => set("bEff", v)} step={50} />
            <Nf label="t_d tebal deck" unit="mm" value={inp.td} onChange={v => set("td", v)} step={10} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Penampang Komposit</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="A_c" unit="mm²" value={inp.Ac} onChange={v => set("Ac", v)} step={1e4} />
            <Nf label="I_c" unit="mm⁴" value={inp.Ic} onChange={v => set("Ic", v)} step={1e10} />
            <Nf label="y NA→atas deck" unit="mm" value={inp.yTopSlab} onChange={v => set("yTopSlab", v)} step={10} />
            <Nf label="H total komposit" unit="mm" value={inp.Htotal} onChange={v => set("Htotal", v)} step={25} />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">Abeles §11.5/§11.7.4 (Evans–Parker):</p>
          <p className="text-blue-600 mt-0.5">F_sh = Δε·E_d·A_d·φ_red; M_cs = F_sh·a_cent; φ_red = (1−e^−φ)/φ. Deck → tarik; soffit gelagar dapat tarik (tambah cek retak).</p>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex gap-3">
          {/* composite section + self-equilibrating stress diagram */}
          <svg width="170" height="100" viewBox="0 0 170 100" className="flex-none border border-gray-200 rounded bg-gray-50">
            {/* deck */}
            <rect x="40" y={oy} width="40" height={inp.td * yScale} fill="#fde68a" stroke="#b45309" strokeWidth="0.8" />
            {/* girder (trapezoid hint) */}
            <polygon points={`46,${yIntfPx} 74,${yIntfPx} 70,${oy + totH} 50,${oy + totH}`} fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="0.8" />
            {/* stress axis */}
            <line x1={axisX} y1={oy} x2={axisX} y2={oy + totH} stroke="#9ca3af" strokeWidth="0.8" />
            {/* stress bars */}
            {bar(res.sigmaTopSlab, oy + 1)}
            {bar(res.sigmaBotSlab, yIntfPx - 1)}
            {bar(res.sigmaTopGirder, yIntfPx + 1)}
            {bar(res.sigmaBotGirder, oy + totH - 1)}
            {/* connect profile */}
            <polyline points={`${axisX + res.sigmaTopSlab * sx},${oy + 1} ${axisX + res.sigmaBotSlab * sx},${yIntfPx - 1}`} fill="none" stroke="#dc2626" strokeWidth="0.8" strokeDasharray="2 1" />
            <polyline points={`${axisX + res.sigmaTopGirder * sx},${yIntfPx + 1} ${axisX + res.sigmaBotGirder * sx},${oy + totH - 1}`} fill="none" stroke="#1d4ed8" strokeWidth="0.8" strokeDasharray="2 1" />
            <text x="40" y={oy - 3} fontSize="6" fill="#b45309">deck (tarik)</text>
            <text x="104" y={oy + 6} fontSize="6" fill="#dc2626">+tarik</text>
            <text x="60" y={oy + totH + 10} fontSize="6" fill="#1d4ed8">soffit</text>
          </svg>
          <table className="flex-1"><tbody>
            <Row label="E_deck" value={f(res.Edeck, 0)} unit="MPa" />
            <Row label="φ_red = (1−e^−φ)/φ" value={f(res.phiRed, 3)} hi />
            <Row label="F_sh (tarik di deck)" value={f(res.Fsh, 1)} unit="kN" hi />
            <Row label="M_cs = F_sh·a_cent" value={f(res.Mcs, 1)} unit="kN·m" hi />
            <Row label="a_cent (NA→deck)" value={f(res.aCent, 0)} unit="mm" />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Tegangan Self-Equilibrating (+tarik)</p>
          <table className="w-full"><tbody>
            <Row label="σ atas deck" value={f(res.sigmaTopSlab, 2)} unit="MPa" />
            <Row label="σ bawah deck (antarmuka)" value={f(res.sigmaBotSlab, 2)} unit="MPa" />
            <Row label="σ atas gelagar (antarmuka)" value={f(res.sigmaTopGirder, 2)} unit="MPa" />
            <Row label="σ soffit gelagar" value={f(res.sigmaBotGirder, 2)} unit="MPa" hi />
          </tbody></table>
        </div>

        <div className={`rounded px-2 py-1.5 text-[10px] border ${res.addsSoffitTension ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-green-50 border-green-200 text-green-800"}`}>
          {res.addsSoffitTension
            ? `Soffit gelagar mengalami TARIK +${f(res.sigmaBotGirder, 2)} MPa akibat susut diferensial → tambahkan ke tegangan tarik layan untuk cek retak (SLS).`
            : `Soffit gelagar tetap tertekan (${f(res.sigmaBotGirder, 2)} MPa) — susut diferensial tidak menambah tarik soffit.`}
        </div>
      </div>
    </div>
  );
}
