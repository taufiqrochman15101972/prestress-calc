"use client";

import React, { useState, useMemo } from "react";
import {
  computeBuildingSeismic, computeEC8,
  type BuildingSeismicInputs, type SiteClassASCE, type StructuralSystem,
} from "@/engine/buildingseismic";

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

export function BuildingSeismicCalculator() {
  const [b, setB] = useState<BuildingSeismicInputs>({
    Ss: 1.5, S1: 0.6, site: "D", TL: 8, R: 8, Cd: 5.5, Omega0: 3, Ie: 1,
    system: "steel_mrf", Cu: 1.4, driftLimit: 0.020, rho: 1.0,
    storeys: [
      { w: 5000, h: 4, deltaXe: 0.004 },
      { w: 5000, h: 8, deltaXe: 0.010 },
      { w: 5000, h: 12, deltaXe: 0.017 },
      { w: 4000, h: 16, deltaXe: 0.024 },
    ],
  });
  const r = useMemo(() => computeBuildingSeismic(b), [b]);
  const sB = (k: keyof BuildingSeismicInputs, v: number | string) => setB(p => ({ ...p, [k]: v }));
  const setStorey = (idx: number, key: "w" | "h" | "deltaXe", v: number) =>
    setB(p => ({ ...p, storeys: p.storeys.map((s, i) => i === idx ? { ...s, [key]: v } : s) }));
  const addStorey = () => setB(p => {
    const top = p.storeys[p.storeys.length - 1];
    return { ...p, storeys: [...p.storeys, { w: top.w, h: top.h + 4, deltaXe: (top.deltaXe ?? 0) + 0.006 }] };
  });
  const delStorey = () => setB(p => p.storeys.length > 1 ? { ...p, storeys: p.storeys.slice(0, -1) } : p);

  const [e8, setE8] = useState({ ag: 0.25, S: 1.15, TB: 0.15, TC: 0.5, TD: 2, q: 3.9, H: 16, Ct: 0.085, W: 19000 });
  const r8 = useMemo(() => computeEC8(e8), [e8]);
  const sE = (k: keyof typeof e8, v: number) => setE8(p => ({ ...p, [k]: v }));

  // ASCE design spectrum plot
  const W = 300, H = 120, pad = 22;
  const maxSa = Math.max(r.SDS, r.SaT) * 1.15;
  const pts = r.spectrum.map(s => {
    const x = pad + (s.T / 4) * (W - pad - 4);
    const y = H - pad - (s.Sa / maxSa) * (H - pad - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const xT = pad + (Math.min(r.T, 4) / 4) * (W - pad - 4);
  const yT = H - pad - (r.SaT / maxSa) * (H - pad - 4);

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-60 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">ASCE 7-16 / NEHRP — Parameter Situs</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="S_s (0,2s)" unit="g" value={b.Ss} step={0.05} onChange={v => sB("Ss", v)} />
          <Nf label="S_1 (1,0s)" unit="g" value={b.S1} step={0.05} onChange={v => sB("S1", v)} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-medium text-gray-500">Kelas situs</span>
            <select value={b.site} onChange={e => sB("site", e.target.value as SiteClassASCE)}
              className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px]">
              {["A", "B", "C", "D", "E"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Nf label="T_L" unit="s" value={b.TL} step={1} onChange={v => sB("TL", v)} />
          <Nf label="R" value={b.R} step={0.5} onChange={v => sB("R", v)} />
          <Nf label="C_d" value={b.Cd} step={0.5} onChange={v => sB("Cd", v)} />
          <Nf label="Ω₀" value={b.Omega0} step={0.5} onChange={v => sB("Omega0", v)} />
          <Nf label="I_e" value={b.Ie} step={0.25} onChange={v => sB("Ie", v)} />
          <div className="flex flex-col gap-0.5 col-span-2">
            <span className="text-[9px] font-medium text-gray-500">Sistem (periode pendekatan)</span>
            <select value={b.system} onChange={e => sB("system", e.target.value as StructuralSystem)}
              className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px]">
              <option value="steel_mrf">Rangka momen baja (0,0724·h^0,8)</option>
              <option value="concrete_mrf">Rangka momen beton (0,0466·h^0,9)</option>
              <option value="steel_ebf">Rangka bresing eksentris (0,0731·h^0,75)</option>
              <option value="other">Sistem lain (0,0488·h^0,75)</option>
            </select>
          </div>
          <Nf label="batas drift Δa/h" value={b.driftLimit ?? 0.02} step={0.005} onChange={v => sB("driftLimit", v)} />
          <Nf label="ρ redundansi" value={b.rho ?? 1} step={0.3} onChange={v => sB("rho", v)} />
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-[9px] font-bold text-gray-500 uppercase">Tingkat (w, h, δ_xe)</p>
          <div className="flex gap-1">
            <button onClick={addStorey} className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-bold">+</button>
            <button onClick={delStorey} className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 text-[9px] font-bold">−</button>
          </div>
        </div>
        <div className="space-y-1 max-h-44 overflow-y-auto">
          {b.storeys.map((s, idx) => (
            <div key={idx} className="grid grid-cols-3 gap-1 items-end">
              <Nf label={`w${idx + 1}`} unit="kN" value={s.w} step={250} onChange={v => setStorey(idx, "w", v)} />
              <Nf label="h" unit="m" value={s.h} step={1} onChange={v => setStorey(idx, "h", v)} />
              <Nf label="δ_xe" unit="m" value={s.deltaXe ?? 0} step={0.002} onChange={v => setStorey(idx, "deltaXe", v)} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">Spektrum desain ASCE 7-16 S_a(T)</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm border border-gray-200 rounded bg-slate-50">
          <line x1={pad} y1={H - pad} x2={W - 2} y2={H - pad} stroke="#94a3b8" strokeWidth="0.7" />
          <line x1={pad} y1={4} x2={pad} y2={H - pad} stroke="#94a3b8" strokeWidth="0.7" />
          <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth="1.4" />
          <circle cx={xT} cy={yT} r="2.5" fill="#dc2626" />
          <text x={xT + 3} y={yT - 2} fontSize="7" fill="#dc2626">T={f(r.T, 2)}s</text>
          <text x={W - 26} y={H - pad + 9} fontSize="7" fill="#64748b">T (s)</text>
          <text x={pad + 2} y={10} fontSize="7" fill="#64748b">S_a (g)</text>
        </svg>

        <div className="grid grid-cols-2 gap-3">
          <table className="w-full"><tbody>
            <Row label="F_a / F_v" value={`${f(r.Fa)} / ${f(r.Fv)}`} />
            <Row label="S_MS / S_M1" value={`${f(r.SMS, 3)} / ${f(r.SM1, 3)}`} unit="g" />
            <Row label="S_DS = ⅔S_MS" value={f(r.SDS, 3)} unit="g" hi />
            <Row label="S_D1 = ⅔S_M1" value={f(r.SD1, 3)} unit="g" hi />
            <Row label="T0 / Ts" value={`${f(r.T0)} / ${f(r.TS)}`} unit="s" />
            <Row label="SDC kategori" value={r.SDC} hi />
          </tbody></table>
          <table className="w-full"><tbody>
            <Row label="T_a periode" value={f(r.Ta, 3)} unit="s" />
            <Row label="S_a(T)" value={f(r.SaT, 3)} unit="g" />
            <Row label="C_s = S_DS/(R/Ie)" value={f(r.Cs, 4)} hi />
            <Row label="C_s,max / C_s,min" value={`${f(r.CsMax, 4)} / ${f(r.CsMin, 4)}`} />
            <Row label="W total" value={f(r.W, 0)} unit="kN" />
            <Row label="V = C_s·W" value={f(r.V, 0)} unit="kN" hi />
          </tbody></table>
        </div>

        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Distribusi vertikal F_x · drift · P-Δ (k = {f(r.k, 2)})</p>
        <table className="w-full text-[9px]">
          <thead><tr className="text-gray-400 border-b border-gray-200">
            <th className="text-left py-0.5">tk</th><th className="text-right">h</th><th className="text-right">C_vx</th>
            <th className="text-right">F_x</th><th className="text-right">V_x</th><th className="text-right">Δ/h</th><th className="text-right">θ</th>
          </tr></thead>
          <tbody className="font-mono">
            {r.storeys.slice().reverse().map((s, i) => {
              const idx = r.storeys.length - 1 - i;
              return (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-0.5 text-gray-500">{idx + 1}</td>
                  <td className="text-right">{f(s.h, 0)}</td>
                  <td className="text-right">{f(s.Cvx, 3)}</td>
                  <td className="text-right text-blue-700 font-semibold">{f(s.Fx, 0)}</td>
                  <td className="text-right">{f(s.Vx, 0)}</td>
                  <td className={`text-right ${s.driftOK ? "text-green-700" : "text-red-600 font-bold"}`}>{f(s.driftRatio * 100, 2)}%</td>
                  <td className={`text-right ${s.thetaOK ? "text-gray-700" : "text-red-600 font-bold"}`}>{f(s.theta, 3)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-[9px] text-gray-500 leading-snug">δ_x = C_d·δ_xe/I_e (§12.8.6); drift Δ/h ≤ {f((b.driftLimit ?? 0.02) * 100, 1)}% (Tabel 12.12-1); P-Δ θ = P_x·Δ·I_e/(V_x·h·C_d) ≤ θ_max={f(r.storeys[0]?.thetaMax ?? 0.25, 3)} (§12.8.7). Gaya gempa E = ρ·Q_E ± 0,2·S_DS·D, overstrength Ω₀={f(b.Omega0, 1)}.</p>

        <div className="border-t border-gray-200 pt-2">
          <p className="text-[9px] font-bold uppercase text-gray-400">Eurocode 8 (EN 1998-1) — gaya lateral paralel</p>
          <div className="grid grid-cols-4 gap-1.5 mt-1">
            <Nf label="a_g" unit="g" value={e8.ag} step={0.05} onChange={v => sE("ag", v)} />
            <Nf label="S tanah" value={e8.S} step={0.05} onChange={v => sE("S", v)} />
            <Nf label="q" value={e8.q} step={0.1} onChange={v => sE("q", v)} />
            <Nf label="T_C" unit="s" value={e8.TC} step={0.05} onChange={v => sE("TC", v)} />
            <Nf label="H" unit="m" value={e8.H} step={1} onChange={v => sE("H", v)} />
            <Nf label="C_t" value={e8.Ct} step={0.005} onChange={v => sE("Ct", v)} />
            <Nf label="W" unit="kN" value={e8.W} step={500} onChange={v => sE("W", v)} />
          </div>
          <table className="w-full max-w-md mt-1"><tbody>
            <Row label="T1 = C_t·H^0,75" value={f(r8.T1, 3)} unit="s" />
            <Row label="S_d(T1)" value={f(r8.Sd, 4)} unit="g" hi />
            <Row label="F_b = S_d·W·λ" value={f(r8.Fb, 0)} unit="kN" hi />
            <Row label="V (ASCE) bandingkan" value={f(r.V, 0)} unit="kN" />
          </tbody></table>
        </div>
      </div>
    </div>
  );
}
