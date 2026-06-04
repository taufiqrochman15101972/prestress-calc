"use client";

import React, { useState, useMemo } from "react";
import { computeColumnPM } from "@/engine/column";
import type { ColumnInputs } from "@/engine/column";

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

  const res = useMemo(() =>
    computeColumnPM({ ...inp, Pu, Mu }), [inp, Pu, Mu]);

  const f = (v: number, d = 1) => v.toFixed(d);

  // Axis ranges
  const Mmax = Math.max(...res.curve.map(p => p.Mn), Mu * 1.2, 100);
  const Pmax = Math.max(...res.curve.map(p => p.Pn), Pu * 1.2, 500);
  const Pmin = Math.min(...res.curve.map(p => p.Pn), -200);

  const cx = (M: number) => lerp(M, 0, Mmax, PAD.l, PAD.l + CW);
  const cy = (P: number) => lerp(P, Pmin, Pmax, PAD.t + CH, PAD.t);

  const curvePts = res.curve.map(p => `${cx(p.Mn).toFixed(1)},${cy(p.Pn).toFixed(1)}`).join(" ");

  return (
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
  );
}
