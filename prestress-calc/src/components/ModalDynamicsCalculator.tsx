"use client";

import React, { useState, useMemo } from "react";
import { solveModal, shearBuilding, responseSpectrumAnalysis } from "@/engine/modaldynamics";
import { designSpectrumASCE } from "@/engine/buildingseismic";

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

export function ModalDynamicsCalculator() {
  // ── Lumped-mass shear building (editable stories) ──
  const [stories, setStories] = useState([
    { mass: 120000, k: 250e6 },
    { mass: 120000, k: 220e6 },
    { mass: 120000, k: 180e6 },
    { mass: 100000, k: 140e6 },
  ]);
  const setStory = (i: number, key: "mass" | "k", v: number) =>
    setStories(p => p.map((s, idx) => idx === i ? { ...s, [key]: v } : s));
  const addStory = () => setStories(p => [...p, { ...p[p.length - 1] }]);
  const delStory = () => setStories(p => p.length > 1 ? p.slice(0, -1) : p);

  // ── Design spectrum (ASCE 7-16, reused) ──
  const [sp, setSp] = useState({ SDS: 1.0, SD1: 0.6, TL: 8, zeta: 0.05 });
  const sSp = (k: keyof typeof sp, v: number) => setSp(p => ({ ...p, [k]: v }));
  const T0 = 0.2 * sp.SD1 / sp.SDS, TS = sp.SD1 / sp.SDS;
  const SaG = (T: number) => designSpectrumASCE(sp.SDS, sp.SD1, T0, TS, sp.TL, Math.max(T, 1e-6));

  const { M, K } = useMemo(
    () => shearBuilding(stories.map(s => s.mass), stories.map(s => s.k)),
    [stories]);
  const modal = useMemo(() => solveModal(K, M), [K, M]);
  const rsa = useMemo(
    () => responseSpectrumAnalysis({ M, K, Sa: (T) => SaG(T) * 9.81, zeta: sp.zeta }),
    [M, K, sp]);

  const n = stories.length;

  // ── Mode-shape sketch (first 3 modes) ──
  const W = 230, H = 210, padX = 30, padY = 16;
  const colW = (W - 2 * padX) / 3;
  const floorY = (i: number) => H - padY - (i + 1) / n * (H - 2 * padY);
  const colors = ["#2563eb", "#dc2626", "#16a34a"];
  const modeShapes = modal.modes.slice(0, 3).map((md, mi) => {
    const maxAbs = Math.max(...md.shape.map(Math.abs), 1e-9);
    const cx = padX + colW * (mi + 0.5);
    const pts = [`${cx},${H - padY}`]; // base
    md.shape.forEach((v, i) => pts.push(`${(cx + (v / maxAbs) * (colW * 0.4)).toFixed(1)},${floorY(i).toFixed(1)}`));
    return { pts: pts.join(" "), cx, color: colors[mi], T: md.T };
  });

  return (
    <div className="flex gap-4 text-[11px]">
      {/* Left: inputs */}
      <div className="w-60 flex-none space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-bold text-gray-500 uppercase">Bangunan geser (m, k tingkat)</p>
          <div className="flex gap-1">
            <button onClick={addStory} className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-bold">+</button>
            <button onClick={delStory} className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 text-[9px] font-bold">−</button>
          </div>
        </div>
        <div className="space-y-1 max-h-52 overflow-y-auto">
          {stories.map((s, i) => (
            <div key={i} className="grid grid-cols-2 gap-1 items-end">
              <Nf label={`m${i + 1}`} unit="kg" value={s.mass} step={5000} onChange={v => setStory(i, "mass", v)} />
              <Nf label={`k${i + 1}`} unit="N/m" value={s.k} step={10e6} onChange={v => setStory(i, "k", v)} />
            </div>
          ))}
        </div>
        <p className="text-[9px] font-bold text-gray-500 uppercase pt-1">Spektrum desain ASCE 7-16</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="S_DS" unit="g" value={sp.SDS} step={0.05} onChange={v => sSp("SDS", v)} />
          <Nf label="S_D1" unit="g" value={sp.SD1} step={0.05} onChange={v => sSp("SD1", v)} />
          <Nf label="T_L" unit="s" value={sp.TL} step={1} onChange={v => sSp("TL", v)} />
          <Nf label="ζ (CQC)" value={sp.zeta} step={0.01} onChange={v => sSp("zeta", v)} />
        </div>
        <p className="text-[8px] text-gray-400 leading-snug">Eigen K φ=ω²M φ (Cholesky+Jacobi) → modus → RSA: u=Γφ·Sa/ω², gaya=ΓMφ·Sa, kombinasi SRSS & CQC (korelasi ρᵢⱼ).</p>
      </div>

      {/* Right: results */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase text-gray-400">Ragam getar (3 pertama)</p>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[230px] border border-gray-200 rounded bg-slate-50">
              {modeShapes.map((ms, mi) => (
                <g key={mi}>
                  <line x1={ms.cx} y1={padY} x2={ms.cx} y2={H - padY} stroke="#e2e8f0" strokeWidth="0.6" />
                  <polyline points={ms.pts} fill="none" stroke={ms.color} strokeWidth="1.4" />
                  {modal.modes[mi].shape.map((_, i) => {
                    const maxAbs = Math.max(...modal.modes[mi].shape.map(Math.abs), 1e-9);
                    return <circle key={i} cx={ms.cx + (modal.modes[mi].shape[i] / maxAbs) * (colW * 0.4)} cy={floorY(i)} r="1.6" fill={ms.color} />;
                  })}
                  <text x={ms.cx} y={H - 3} fontSize="6.5" fill={ms.color} textAnchor="middle">T{mi + 1}={f(ms.T, 2)}s</text>
                </g>
              ))}
            </svg>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase text-gray-400">Properti modal</p>
            <table className="w-full text-[9px] mt-1">
              <thead><tr className="text-gray-400 border-b border-gray-200">
                <th className="text-left py-0.5">n</th><th className="text-right">T</th><th className="text-right">f</th>
                <th className="text-right">Γ</th><th className="text-right">M*/M</th><th className="text-right">ΣM*/M</th>
              </tr></thead>
              <tbody className="font-mono">
                {modal.modes.map((md, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-0.5 text-gray-500">{i + 1}</td>
                    <td className="text-right">{f(md.T, 3)}</td>
                    <td className="text-right">{f(md.f, 2)}</td>
                    <td className="text-right">{f(md.Gamma, 2)}</td>
                    <td className="text-right text-blue-700 font-semibold">{f(md.massRatio * 100, 1)}%</td>
                    <td className={`text-right ${modal.cumulativeMassRatio[i] >= 0.9 ? "text-green-700" : "text-gray-600"}`}>
                      {f(modal.cumulativeMassRatio[i] * 100, 1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[8px] text-gray-400 mt-0.5">≥90% massa partisipasi (hijau) = jumlah modus cukup (ASCE §12.9).</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-gray-200 pt-2">
          <table className="w-full"><tbody>
            <Row label="massa total" value={f(modal.totalMass, 0)} unit="kg" />
            <Row label="V dasar SRSS" value={f(rsa.baseShearSRSS / 1000, 1)} unit="kN" hi />
            <Row label="V dasar CQC" value={f(rsa.baseShearCQC / 1000, 1)} unit="kN" hi />
            <Row label="simpangan puncak" value={f(rsa.storyDispSRSS[n - 1] * 1000, 1)} unit="mm" />
          </tbody></table>
          <div>
            <p className="text-[9px] font-bold uppercase text-gray-400">Gaya lantai & simpangan (SRSS)</p>
            <table className="w-full text-[9px] mt-1">
              <thead><tr className="text-gray-400 border-b border-gray-200">
                <th className="text-left py-0.5">lt</th><th className="text-right">F (kN)</th><th className="text-right">u (mm)</th>
              </tr></thead>
              <tbody className="font-mono">
                {Array.from({ length: n }, (_, i) => n - 1 - i).map(i => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-0.5 text-gray-500">{i + 1}</td>
                    <td className="text-right text-blue-700">{f(rsa.storyForceSRSS[i] / 1000, 1)}</td>
                    <td className="text-right">{f(rsa.storyDispSRSS[i] * 1000, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[8px] text-gray-400 leading-snug border-t border-gray-100 pt-1">
          Analisis modal N-DOF umum & Response Spectrum Analysis (RSA): eigenproblem tergeneralisasi K φ=ω²M φ (reduksi Cholesky + Jacobi siklik), faktor partisipasi Γₙ, massa modal efektif Mₙ*, kombinasi SRSS & CQC (korelasi Der Kiureghian/Wilson). Spektrum desain ASCE 7-16 dipakai bersama tab 🏙️. Melengkapi time-history SDOF 🌊 & modal 2-DOF jembatan 🌋. Prosedur dari pustaka DS (Chopra, Craig & Kurdila, Gupta "Response Spectrum Method", Wilson, Paz, DS 1–96) — angka contoh PDF bukan acuan, hanya rumus/prosedur.
        </p>
      </div>
    </div>
  );
}
