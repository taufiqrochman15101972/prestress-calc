"use client";

import React, { useState, useMemo } from "react";
import { computeSNISeismic, type SNISeismicInputs, type SiteClass } from "@/engine/sni2833seismic";
import { computeSecondaryLoads, type SecondaryLoadInputs } from "@/engine/bridgeload";

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
const f = (v: number, d = 2) => (isFinite(v) ? v.toFixed(d) : "—");

export function SeismicSNICalculator() {
  const [eq, setEq] = useState<SNISeismicInputs>({
    PGA: 0.35, Ss: 0.7, S1: 0.3, site: "SD", W: 5000, K: 40000, R: 3,
  });
  const eqR = useMemo(() => computeSNISeismic(eq), [eq]);
  const sEq = (k: keyof SNISeismicInputs, v: number | string) => setEq(p => ({ ...p, [k]: v }));

  const [sl, setSl] = useState<SecondaryLoadInputs>({
    L: 40, Vw: 30, windArea: 2.4, Cw: 1.2, qLane: 9, Plane: 49,
    alphaT: 1.0e-5, Esteel: 200000, Arestr: 500000, dT: 30, restrained: false,
  });
  const slR = useMemo(() => computeSecondaryLoads(sl), [sl]);
  const sSl = (k: keyof SecondaryLoadInputs, v: number | boolean) => setSl(p => ({ ...p, [k]: v }));

  // response-spectrum polyline
  const W = 300, H = 120, pad = 22;
  const maxC = Math.max(eqR.SDS, eqR.Csm) * 1.15;
  const pts = eqR.spectrum.map(s => {
    const x = pad + (s.T / 4) * (W - pad - 4);
    const y = H - pad - (s.Csm / maxC) * (H - pad - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const xAtT = pad + (Math.min(eqR.T, 4) / 4) * (W - pad - 4);
  const yAtT = H - pad - (eqR.Csm / maxC) * (H - pad - 4);

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-60 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">SNI 2833:2016 — Spektrum Respons Gempa</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="PGA" unit="g" value={eq.PGA} step={0.05} onChange={v => sEq("PGA", v)} />
          <Nf label="S_s (0,2s)" unit="g" value={eq.Ss} step={0.05} onChange={v => sEq("Ss", v)} />
          <Nf label="S_1 (1,0s)" unit="g" value={eq.S1} step={0.05} onChange={v => sEq("S1", v)} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-medium text-gray-500">Kelas situs</span>
            <select value={eq.site} onChange={e => sEq("site", e.target.value as SiteClass)}
              className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px]">
              {["SA", "SB", "SC", "SD", "SE"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Nf label="W tributari" unit="kN" value={eq.W} step={250} onChange={v => sEq("W", v)} />
          <Nf label="K pilar" unit="kN/m" value={eq.K} step={5000} onChange={v => sEq("K", v)} />
          <Nf label="R modifikasi" value={eq.R} step={0.5} onChange={v => sEq("R", v)} />
        </div>

        <p className="text-[9px] font-bold text-gray-500 uppercase pt-1">SNI 1725:2016 — Beban Sekunder</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="L bentang" unit="m" value={sl.L} step={1} onChange={v => sSl("L", v)} />
          <Nf label="V_w angin" unit="m/s" value={sl.Vw} step={1} onChange={v => sSl("Vw", v)} />
          <Nf label="luas sisi /m" unit="m²/m" value={sl.windArea} step={0.1} onChange={v => sSl("windArea", v)} />
          <Nf label="C_w drag" value={sl.Cw} step={0.1} onChange={v => sSl("Cw", v)} />
          <Nf label="q BTR" unit="kN/m" value={sl.qLane} step={0.5} onChange={v => sSl("qLane", v)} />
          <Nf label="P BGT" unit="kN" value={sl.Plane} step={1} onChange={v => sSl("Plane", v)} />
          <Nf label="ΔT" unit="°C" value={sl.dT} step={5} onChange={v => sSl("dT", v)} />
          <Nf label="A tertahan" unit="mm²" value={sl.Arestr} step={50000} onChange={v => sSl("Arestr", v)} />
          <div className="flex items-center gap-1 col-span-2">
            <input type="checkbox" checked={sl.restrained} onChange={e => sSl("restrained", e.target.checked)} />
            <span className="text-[9px] text-gray-500">tertahan (timbul gaya suhu EUn)</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">Spektrum desain C_sm(T) — As, S_DS, S_D1, T0, Ts</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm border border-gray-200 rounded bg-slate-50">
          <line x1={pad} y1={H - pad} x2={W - 2} y2={H - pad} stroke="#94a3b8" strokeWidth="0.7" />
          <line x1={pad} y1={4} x2={pad} y2={H - pad} stroke="#94a3b8" strokeWidth="0.7" />
          <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth="1.4" />
          <circle cx={xAtT} cy={yAtT} r="2.5" fill="#dc2626" />
          <text x={xAtT + 3} y={yAtT - 2} fontSize="7" fill="#dc2626">T={f(eqR.T, 2)}s</text>
          <text x={W - 26} y={H - pad + 9} fontSize="7" fill="#64748b">T (s)</text>
          <text x={pad + 2} y={10} fontSize="7" fill="#64748b">C_sm</text>
        </svg>
        <table className="w-full max-w-md"><tbody>
          <Row label="F_pga / F_a / F_v" value={`${f(eqR.Fpga)} / ${f(eqR.Fa)} / ${f(eqR.Fv)}`} />
          <Row label="A_s = F_pga·PGA" value={f(eqR.As, 3)} unit="g" />
          <Row label="S_DS = F_a·S_s" value={f(eqR.SDS, 3)} unit="g" hi />
          <Row label="S_D1 = F_v·S_1" value={f(eqR.SD1, 3)} unit="g" hi />
          <Row label="T0 / Ts" value={`${f(eqR.T0)} / ${f(eqR.Ts)}`} unit="s" />
          <Row label="T struktur" value={f(eqR.T, 3)} unit="s" />
          <Row label="C_sm @T" value={f(eqR.Csm, 3)} unit="g" hi />
          <Row label="Zona (SDC)" value={eqR.zone} />
          <Row label="EQ elastik = C_sm·W" value={f(eqR.EQelastic, 0)} unit="kN" />
          <Row label={`EQ desain = EQ/R`} value={f(eqR.EQdesign, 0)} unit="kN" hi />
        </tbody></table>

        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Beban sekunder SNI 1725</p>
        <table className="w-full max-w-md"><tbody>
          <Row label="Tekanan angin = 0,0006·C_w·V²" value={f(slR.windPressure, 3)} unit="kPa" />
          <Row label="EWs angin pada struktur" value={f(slR.EWs, 2)} unit="kN/m" hi />
          <Row label="EWl angin pada beban hidup" value={f(slR.EWl, 2)} unit="kN/m" />
          <Row label="TB gaya rem" value={f(slR.TB, 1)} unit="kN" hi />
          <Row label="ε_T = α·ΔT" value={slR.epsT.toExponential(2)} />
          <Row label="ΔL bebas = ε·L" value={f(slR.dLfree, 1)} unit="mm" />
          <Row label="EUn gaya suhu (jika tertahan)" value={f(slR.EUn, 1)} unit="kN" hi />
        </tbody></table>
        <p className="text-[9px] text-gray-500 leading-snug">Gaya gempa & sekunder ini masuk ke kombinasi beban AASHTO/SNI di tab 🏛️ Bangunan Bawah (Extreme I, Strength III/V) untuk desain pilar, telapak & abutmen.</p>
      </div>
    </div>
  );
}
