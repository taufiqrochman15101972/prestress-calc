"use client";

import React, { useState, useMemo } from "react";
import { computeColumnPM, computeSlenderness } from "@/engine/column";
import type { ColumnInputs, SlendernessInputs } from "@/engine/column";

const DEFAULT_SLEND: SlendernessInputs = {
  k: 1.0, Lu: 4000, Ig: 7_200_000_000, Ec: 29725,
  beta_dns: 0.6, Pu: 2500, M1: 200, M2: 300, isSway: false,
};

// Default: 400×600 rectangular prestressed column
const DEFAULT: ColumnInputs = {
  section: { b: 400, h: 600, fc: 40 },
  strandLayers: [
    { d: 60,  Aps: 4 * 98.7, fse: 1100, Eps: 197_000, fpu: 1860 },
    { d: 540, Aps: 4 * 98.7, fse: 1100, Eps: 197_000, fpu: 1860 },
  ],
  mildLayers: [
    { d: 50,  As: 4 * 314, fy: 420 },
    { d: 550, As: 4 * 314, fy: 420 },
  ],
  Pu: 2500,
  Mu: 300,
};

const W = 300, H = 340;
const PAD = { t: 20, r: 20, b: 30, l: 50 };
const CW = W - PAD.l - PAD.r;
const CH = H - PAD.t - PAD.b;

function lerp(v: number, lo: number, hi: number, pLo: number, pHi: number) {
  return pLo + ((v - lo) / (hi - lo)) * (pHi - pLo);
}

export function ColumnCalculator() {
  const [inp, setInp] = useState<ColumnInputs>(DEFAULT);
  const [Pu, setPu] = useState(DEFAULT.Pu);
  const [Mu, setMu] = useState(DEFAULT.Mu);
  const [slendInp, setSlendInp] = useState<SlendernessInputs>(DEFAULT_SLEND);
  const [showSlend, setShowSlend] = useState(false);

  const res = useMemo(() =>
    computeColumnPM({ ...inp, Pu, Mu }), [inp, Pu, Mu]);
  const slend = useMemo(() => computeSlenderness(slendInp), [slendInp]);

  const f = (v: number, d = 1) => v.toFixed(d);

  // Axis ranges
  const Mmax = Math.max(...res.curve.map(p => p.Mn), Mu * 1.2, 100);
  const Pmax = Math.max(...res.curve.map(p => p.Pn), Pu * 1.2, 500);
  const Pmin = Math.min(...res.curve.map(p => p.Pn), -200);

  const cx = (M: number) => lerp(M, 0, Mmax, PAD.l, PAD.l + CW);
  const cy = (P: number) => lerp(P, Pmin, Pmax, PAD.t + CH, PAD.t);

  const curvePts = res.curve.map(p => `${cx(p.Mn).toFixed(1)},${cy(p.Pn).toFixed(1)}`).join(" ");

  return (
    <>
    <div className="flex gap-4 text-[11px]">

      {/* Inputs */}
      <div className="w-52 flex-none space-y-3">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Penampang</p>
          <div className="grid grid-cols-2 gap-1.5">
            {([["b","mm",400],["h","mm",600]] as const).map(([k,u,def]) => (
              <div key={k} className="flex flex-col gap-0.5">
                <span className="text-[9px] font-medium text-gray-500 uppercase">{k}</span>
                <div className="relative flex items-center">
                  <input type="number" defaultValue={def} step={50}
                    onChange={e => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) setInp(prev => ({...prev, section: {...prev.section, [k]: v}}));
                    }}
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 pr-8" />
                  <span className="absolute right-2 text-[9px] text-gray-400">{u}</span>
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-medium text-gray-500 uppercase">f'c</span>
              <div className="relative flex items-center">
                <input type="number" defaultValue={40}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) setInp(prev => ({...prev, section: {...prev.section, fc: v}}));
                  }}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 pr-12" />
                <span className="absolute right-2 text-[9px] text-gray-400">MPa</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Strand (2 baris simetris)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-medium text-gray-500 uppercase">n/baris</span>
              <input type="number" defaultValue={4} min={1}
                onChange={e => {
                  const n = Math.round(parseFloat(e.target.value));
                  if (n > 0) setInp(prev => ({...prev, strandLayers: [
                    {...prev.strandLayers[0], Aps: n * 98.7},
                    {...prev.strandLayers[1], Aps: n * 98.7},
                  ]}));
                }}
                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-medium text-gray-500 uppercase">f_se MPa</span>
              <input type="number" defaultValue={1100} step={50}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) setInp(prev => ({...prev, strandLayers: prev.strandLayers.map(s => ({...s, fse: v}))}));
                }}
                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
          </div>
        </div>

        <div className="pt-1 border-t border-gray-200">
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Beban Rencana</p>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-medium text-gray-500 uppercase">Pu kN</span>
              <input type="number" value={Pu} step={100}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setPu(v); }}
                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-medium text-gray-500 uppercase">Mu kN·m</span>
              <input type="number" value={Mu} step={50}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setMu(v); }}
                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
          </div>
        </div>

        <div className="space-y-0.5 pt-1">
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Kapasitas</p>
          {[
            ["P_n0 (aksial murni)", f(res.Pn0,0)+" kN"],
            ["M_n0 (lentur murni)", f(res.Mn0,1)+" kN·m"],
            ["P_bal", f(res.Pn_bal,0)+" kN"],
            ["M_bal", f(res.Mn_bal,1)+" kN·m"],
            ["Rasio permintaan", f(res.demandRatio,3)],
          ].map(([l,v]) => (
            <div key={l} className="flex justify-between text-[10px]">
              <span className="text-gray-500">{l}</span>
              <span className="font-mono font-semibold text-gray-800">{v}</span>
            </div>
          ))}
          <div className={`mt-1 px-2 py-1 rounded text-[10px] font-bold text-center ${res.isAdequate ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
            {res.isAdequate ? "✓ Titik demand DALAM diagram P-M" : "✗ Titik demand LUAR diagram P-M"}
          </div>
        </div>
      </div>

      {/* P-M diagram */}
      <div className="flex-1">
        <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Diagram Interaksi P-M (φ applied)</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-gray-200 rounded bg-white">
          {/* Grid */}
          {[0.25,0.5,0.75,1].map(frac => (
            <React.Fragment key={frac}>
              <line x1={cx(Mmax*frac)} y1={PAD.t} x2={cx(Mmax*frac)} y2={PAD.t+CH} stroke="#f1f5f9" strokeWidth={1} />
              <text x={cx(Mmax*frac)} y={PAD.t+CH+12} fontSize={7} textAnchor="middle" fill="#9ca3af">{f(Mmax*frac,0)}</text>
            </React.Fragment>
          ))}
          {[0,0.25,0.5,0.75,1].map(frac => {
            const P = Pmin + (Pmax-Pmin)*frac;
            return (
              <React.Fragment key={frac}>
                <line x1={PAD.l} y1={cy(P)} x2={PAD.l+CW} y2={cy(P)} stroke="#f1f5f9" strokeWidth={1} />
                <text x={PAD.l-4} y={cy(P)+3} fontSize={7} textAnchor="end" fill="#9ca3af">{P.toFixed(0)}</text>
              </React.Fragment>
            );
          })}
          {/* Axes */}
          <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t+CH} stroke="#374151" strokeWidth={1.5} />
          <line x1={PAD.l} y1={PAD.t+CH} x2={PAD.l+CW} y2={PAD.t+CH} stroke="#374151" strokeWidth={1.5} />
          {/* Zero axis */}
          {Pmin < 0 && <line x1={PAD.l} y1={cy(0)} x2={PAD.l+CW} y2={cy(0)} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3,2" />}
          {/* P-M envelope */}
          <polyline points={curvePts} fill="#dbeafe" fillOpacity={0.4} stroke="#1d4ed8" strokeWidth={2} />
          {/* Close envelope at origin */}
          <line x1={cx(0)} y1={cy(res.curve[0]?.Pn??0)} x2={cx(0)} y2={cy(res.curve[res.curve.length-1]?.Pn??0)}
            stroke="#1d4ed8" strokeWidth={1.5} />
          {/* Demand point */}
          <circle cx={cx(Mu)} cy={cy(Pu)} r={5}
            fill={res.isAdequate ? "#16a34a" : "#dc2626"} />
          <text x={cx(Mu)+7} y={cy(Pu)-4} fontSize={8} fill={res.isAdequate?"#16a34a":"#dc2626"} fontWeight="bold">
            ({f(Mu,0)}, {f(Pu,0)})
          </text>
          {/* Labels */}
          <text x={PAD.l+CW/2} y={H-2} fontSize={8} textAnchor="middle" fill="#374151">Mn (kN·m)</text>
          <text x={10} y={PAD.t+CH/2} fontSize={8} textAnchor="middle" fill="#374151"
            transform={`rotate(-90 10 ${PAD.t+CH/2})`}>Pn (kN)</text>
          {/* Balanced point label */}
          <circle cx={cx(res.Mn_bal)} cy={cy(res.Pn_bal)} r={3} fill="#f97316" />
          <text x={cx(res.Mn_bal)+5} y={cy(res.Pn_bal)-3} fontSize={7} fill="#f97316">titik imbang</text>
        </svg>
        <div className="text-[9px] text-gray-400 mt-1">
          Titik hijau/merah = titik demand (Pu={Pu} kN, Mu={Mu} kN·m) &nbsp;·&nbsp; Titik oranye = titik imbang (balanced)
        </div>
      </div>

    </div>

    {/* Slenderness Section */}
    <div className="mt-3 border-t border-gray-200 pt-2">
      <button onClick={() => setShowSlend(v => !v)}
        className="flex items-center gap-1.5 text-[10px] font-bold text-blue-700 hover:text-blue-900">
        <span>{showSlend ? "▼" : "▶"}</span>
        Kelangsingan Kolom — Pembesaran Momen ACI §6.6.4 (TY Lin Ch.11)
      </button>

      {showSlend && (
        <div className="mt-2 flex gap-4 text-[11px]">
          <div className="w-64 flex-none">
            <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Parameter Kelangsingan</p>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                ["k (faktor panjang efektif)", "k", slendInp.k, 0.05, 0, ""],
                ["Lu (panjang tak ditopang)", "Lu", slendInp.Lu, 500, 0, "mm"],
                ["β_dns (sustained load ratio)", "beta_dns", slendInp.beta_dns, 0.05, 0, ""],
                ["Pu beban terfaktor", "Pu", slendInp.Pu, 100, 0, "kN"],
                ["M1 momen lebih kecil", "M1", slendInp.M1, 10, undefined, "kN·m"],
                ["M2 momen lebih besar", "M2", slendInp.M2, 10, 0, "kN·m"],
              ] as [string, keyof SlendernessInputs, number, number, number|undefined, string][]).map(([lbl, key, val, step, min, unit]) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-medium text-gray-500 leading-tight">{lbl}</span>
                  <div className="relative flex items-center">
                    <input type="number" value={val} step={step} {...(min !== undefined ? {min} : {})}
                      onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setSlendInp(prev => ({...prev, [key]: v})); }}
                      className={`w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ${unit?"pr-10":""}`} />
                    {unit && <span className="absolute right-1 text-[9px] text-gray-400 pointer-events-none">{unit}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <label className="text-[10px] text-gray-600 flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={slendInp.isSway}
                  onChange={e => setSlendInp(prev => ({...prev, isSway: e.target.checked}))}
                  className="w-3 h-3" />
                Rangka tak-berpengaku (sway)
              </label>
            </div>
            <div className="mt-1.5 bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
              <p className="font-semibold text-blue-700">ACI §6.6.4 (TY Lin Ch.11):</p>
              <p className="text-blue-600 mt-0.5">Mc = δ_ns·M2 ≥ M2<br/>δ_ns = Cm / (1 − Pu/0.75Pc) ≥ 1.0<br/>Cm = 0.6 + 0.4·(M1/M2) ≥ 0.4</p>
            </div>
          </div>

          <div className="flex-1">
            <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Hasil Kelangsingan</p>
            <table className="w-full text-[10px]"><tbody>
              {([
                ["kLu/r (rasio kelangsingan)", f(slend.slenderness_ratio, 1)],
                ["EI efektif (ACI §6.6.4.4.4)", (slend.Pc * slendInp.k * slendInp.Lu * slendInp.k * slendInp.Lu / Math.PI**2 / 1e9).toFixed(3) + " ×10⁹ N·mm²"],
                ["Pc (beban kritis Euler)", f(slend.Pc, 0) + " kN"],
                ["Cm (faktor momen ekivalen)", f(slend.Cm, 3)],
                ["δ_ns (faktor pembesaran)", f(slend.delta_ns, 3)],
                ["Mc = δ_ns·M2 (momen desain)", f(slend.Mc, 1) + " kN·m"],
              ] as [string, string][]).map(([lbl, val]) => (
                <tr key={lbl} className="border-b border-gray-100">
                  <td className="py-0.5 pr-3 text-gray-500">{lbl}</td>
                  <td className="py-0.5 font-mono font-semibold text-gray-800 text-right">{val}</td>
                </tr>
              ))}
            </tbody></table>

            <div className={`mt-2 px-2 py-1.5 rounded border text-[10px] font-bold ${slend.secondOrderRequired ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-green-50 border-green-200 text-green-800"}`}>
              {slend.secondOrderRequired
                ? `⚠ kLu/r = ${f(slend.slenderness_ratio,1)} > 22 — efek orde kedua diperhitungkan (pembesaran momen)`
                : `✓ kLu/r = ${f(slend.slenderness_ratio,1)} ≤ 22 — kelangsingan dapat diabaikan per ACI §6.2.5`}
            </div>
            {slend.secondOrderRequired && (
              <div className="mt-1.5 bg-yellow-50 border border-yellow-200 rounded p-2 text-[10px]">
                <span className="font-semibold">Gunakan Mc = {f(slend.Mc,1)} kN·m</span> sebagai pengganti M2 = {f(slendInp.M2,1)} kN·m
                dalam kontrol P-M interaction diagram di atas.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
