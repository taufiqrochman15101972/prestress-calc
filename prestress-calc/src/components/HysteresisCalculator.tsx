"use client";

import React, { useState, useMemo } from "react";
import {
  cyclicProtocol, traceHysteresis, cyclicAssessment, nonlinearTH,
  parkAngDamage, infillStrut, type HysteresisParams, type HysteresisModel,
} from "@/engine/hysteresis";

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

export function HysteresisCalculator() {
  // ── Constitutive params ──
  const [p, setP] = useState<HysteresisParams>({
    model: "BILINEAR", k0: 4000, Fy: 120, alpha: 0.05,
    A: 1, beta: 0.5, gamma: 0.5, n: 1, stiffDegr: 0.5, pinch: 1,
  });
  const sP = (k: keyof HysteresisParams, v: number | string) => setP(prev => ({ ...prev, [k]: v }));
  const uy = p.Fy / p.k0;

  // ── Cyclic protocol (amplitudes as ductility ratios) ──
  const [mus, setMus] = useState<number[]>([1, 2, 4, 6]);
  const amps = useMemo(() => mus.map(m => m * uy), [mus, uy]);
  const trace = useMemo(() => traceHysteresis(p, cyclicProtocol(amps, 40)), [p, amps]);
  const cycles = useMemo(() => cyclicAssessment(p, amps, 80), [p, amps]);

  // ── Nonlinear time-history ──
  const [th, setTh] = useState({ m: 1000, zeta: 0.05, PGA: 0.5, freq: 1.0, dur: 12, dt: 0.01 });
  const sTh = (k: keyof typeof th, v: number) => setTh(prev => ({ ...prev, [k]: v }));
  const thRes = useMemo(() => {
    const ag: number[] = [];
    const N = Math.round(th.dur / th.dt);
    for (let i = 0; i < N; i++) {
      const t = i * th.dt;
      const env = Math.min(1, t / 1.5) * Math.exp(-0.12 * t); // build-up + decay envelope
      ag.push(th.PGA * 9.81 * env * Math.sin(2 * Math.PI * th.freq * t));
    }
    return nonlinearTH({ p, m: th.m, zeta: th.zeta, dt: th.dt, ag });
  }, [p, th]);

  const [muCap, setMuCap] = useState(8);
  const damage = useMemo(
    () => parkAngDamage(thRes.mu, muCap, thRes.Ehyst, p.Fy, uy, 0.1),
    [thRes, muCap, p.Fy, uy]);

  // ── Masonry infill strut ──
  const [inf, setInf] = useState({ Em: 5000, tInf: 150, hInf: 3000, LInf: 4000, Ec: 25000, Icol: 400e6, hCol: 3300, fmPrime: 8 });
  const sInf = (k: keyof typeof inf, v: number) => setInf(prev => ({ ...prev, [k]: v }));
  const strut = useMemo(() => infillStrut(inf), [inf]);

  // ── Hysteresis loop plot ──
  const W = 320, H = 200, pad = 26;
  const uAbs = Math.max(...trace.u.map(Math.abs), 1e-9);
  const fAbs = Math.max(...trace.F.map(Math.abs), 1e-9);
  const X = (u: number) => pad + (u / uAbs * 0.5 + 0.5) * (W - 2 * pad);
  const Y = (fv: number) => (H - pad) - (fv / fAbs * 0.5 + 0.5) * (H - 2 * pad);
  const loopPts = trace.u.map((u, i) => `${X(u).toFixed(1)},${Y(trace.F[i]).toFixed(1)}`).join(" ");

  // ── u(t) plot ──
  const Wt = 320, Ht = 90, padt = 22;
  const uMax = Math.max(...thRes.u.map(Math.abs), 1e-9);
  const tEnd = thRes.t[thRes.t.length - 1] || 1;
  const uPts = thRes.u.map((u, i) =>
    `${(padt + thRes.t[i] / tEnd * (Wt - padt - 4)).toFixed(1)},${(Ht / 2 - u / uMax * (Ht / 2 - 6)).toFixed(1)}`
  ).join(" ");

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Left: parameters ── */}
      <div className="w-60 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Model histeresis</p>
        <select value={p.model} onChange={e => sP("model", e.target.value as HysteresisModel)}
          className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px]">
          <option value="BILINEAR">Bilinear (kinematik, elasto-plastis)</option>
          <option value="BOUCWEN">Bouc-Wen (mulus)</option>
          <option value="TAKEDA">Takeda (degradasi kekakuan RC)</option>
        </select>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="k₀ kekakuan awal" unit="N/m" value={p.k0} step={500} onChange={v => sP("k0", v)} />
          <Nf label="F_y leleh" unit="N" value={p.Fy} step={10} onChange={v => sP("Fy", v)} />
          <Nf label="α = k₁/k₀" value={p.alpha} step={0.01} onChange={v => sP("alpha", v)} />
          <Nf label="u_y = F_y/k₀" unit="m" value={uy} step={0.001} onChange={() => {}} />
        </div>
        {p.model === "BOUCWEN" && (
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="A" value={p.A ?? 1} step={0.1} onChange={v => sP("A", v)} />
            <Nf label="n ketajaman" value={p.n ?? 1} step={1} onChange={v => sP("n", v)} />
            <Nf label="β" value={p.beta ?? 0.5} step={0.05} onChange={v => sP("beta", v)} />
            <Nf label="γ" value={p.gamma ?? 0.5} step={0.05} onChange={v => sP("gamma", v)} />
          </div>
        )}
        {p.model === "TAKEDA" && (
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="β_s degr. kekakuan" value={p.stiffDegr ?? 0.5} step={0.1} onChange={v => sP("stiffDegr", v)} />
            <Nf label="pinching 0..1" value={p.pinch ?? 1} step={0.1} onChange={v => sP("pinch", v)} />
          </div>
        )}

        <p className="text-[9px] font-bold text-gray-500 uppercase pt-1">Protokol siklik (μ = u/u_y)</p>
        <input type="text" value={mus.join(", ")}
          onChange={e => {
            const arr = e.target.value.split(",").map(s => parseFloat(s.trim())).filter(x => isFinite(x) && x > 0);
            if (arr.length) setMus(arr);
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-[10px] font-mono" />

        <div className="border-t border-gray-200 pt-2">
          <p className="text-[9px] font-bold text-gray-500 uppercase">Riwayat-waktu nonlinier</p>
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            <Nf label="massa m" unit="kg" value={th.m} step={100} onChange={v => sTh("m", v)} />
            <Nf label="ζ viskos" value={th.zeta} step={0.01} onChange={v => sTh("zeta", v)} />
            <Nf label="PGA" unit="g" value={th.PGA} step={0.05} onChange={v => sTh("PGA", v)} />
            <Nf label="freq" unit="Hz" value={th.freq} step={0.1} onChange={v => sTh("freq", v)} />
            <Nf label="durasi" unit="s" value={th.dur} step={1} onChange={v => sTh("dur", v)} />
            <Nf label="μ kapasitas" value={muCap} step={1} onChange={v => setMuCap(v)} />
          </div>
        </div>
      </div>

      {/* ── Right: plots + results ── */}
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">Kurva histeresis F–u (protokol amplitudo bertingkat)</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md border border-gray-200 rounded bg-slate-50">
          <line x1={pad} y1={H / 2} x2={W - 4} y2={H / 2} stroke="#cbd5e1" strokeWidth="0.6" />
          <line x1={W / 2} y1={4} x2={W / 2} y2={H - pad} stroke="#cbd5e1" strokeWidth="0.6" />
          <polyline points={loopPts} fill="none" stroke="#2563eb" strokeWidth="1" />
          <text x={W - 22} y={H / 2 - 3} fontSize="7" fill="#64748b">u</text>
          <text x={W / 2 + 3} y={10} fontSize="7" fill="#64748b">F</text>
        </svg>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase text-gray-400">Energi & redaman ekuivalen per siklus</p>
            <table className="w-full text-[9px] mt-1">
              <thead><tr className="text-gray-400 border-b border-gray-200">
                <th className="text-left py-0.5">μ</th><th className="text-right">F_max</th>
                <th className="text-right">k_sec</th><th className="text-right">E_D</th><th className="text-right">ξ_eq</th>
              </tr></thead>
              <tbody className="font-mono">
                {cycles.map((c, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-0.5 text-gray-500">{f(mus[i], 1)}</td>
                    <td className="text-right">{f(c.Fmax, 0)}</td>
                    <td className="text-right">{f(c.kSec, 0)}</td>
                    <td className="text-right text-blue-700 font-semibold">{f(c.Ed, 1)}</td>
                    <td className="text-right text-green-700">{f(c.xiEq * 100, 1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[8px] text-gray-400 mt-1 leading-snug">ξ_eq = E_D/(4π·E_so); elasto-plastis → (2/π)(1−1/μ).</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase text-gray-400">Demand riwayat-waktu nonlinier</p>
            <svg viewBox={`0 0 ${Wt} ${Ht}`} className="w-full border border-gray-200 rounded bg-slate-50 mt-1">
              <line x1={padt} y1={Ht / 2} x2={Wt - 4} y2={Ht / 2} stroke="#cbd5e1" strokeWidth="0.6" />
              <polyline points={uPts} fill="none" stroke="#dc2626" strokeWidth="0.9" />
              <text x={padt + 2} y={9} fontSize="7" fill="#64748b">u(t)</text>
            </svg>
            <table className="w-full mt-1"><tbody>
              <Row label="T_n perioda" value={f(thRes.Tn, 3)} unit="s" />
              <Row label="puncak |u|" value={f(thRes.peak * 1000, 1)} unit="mm" hi />
              <Row label="duktilitas μ" value={f(thRes.mu, 2)} hi />
              <Row label="u residu" value={f(thRes.residual * 1000, 1)} unit="mm" />
              <Row label="E_hist" value={f(thRes.Ehyst, 1)} unit="J" />
            </tbody></table>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-2 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase text-gray-400">Indeks kerusakan Park-Ang</p>
            <table className="w-full mt-1"><tbody>
              <Row label="suku deformasi μ/μ_cap" value={f(damage.deformationTerm, 3)} />
              <Row label="suku energi β·E_H/(F_y·u_u)" value={f(damage.energyTerm, 3)} />
              <Row label="DI total" value={f(damage.DI, 3)} hi />
            </tbody></table>
            <p className={`text-[10px] mt-1 font-semibold ${damage.DI < 0.4 ? "text-green-700" : damage.DI < 1 ? "text-amber-600" : "text-red-600"}`}>
              ⇒ {damage.state}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase text-gray-400">Strat diagonal ekuivalen infill (Mainstone/FEMA 356)</p>
            <div className="grid grid-cols-3 gap-1 mt-1">
              <Nf label="E_m" unit="MPa" value={inf.Em} step={500} onChange={v => sInf("Em", v)} />
              <Nf label="t" unit="mm" value={inf.tInf} step={10} onChange={v => sInf("tInf", v)} />
              <Nf label="h_inf" unit="mm" value={inf.hInf} step={100} onChange={v => sInf("hInf", v)} />
              <Nf label="L_inf" unit="mm" value={inf.LInf} step={100} onChange={v => sInf("LInf", v)} />
              <Nf label="f'_m" unit="MPa" value={inf.fmPrime} step={1} onChange={v => sInf("fmPrime", v)} />
              <Nf label="h_kol" unit="mm" value={inf.hCol} step={100} onChange={v => sInf("hCol", v)} />
            </div>
            <table className="w-full mt-1"><tbody>
              <Row label="θ inklinasi" value={f(strut.theta * 180 / Math.PI, 1)} unit="°" />
              <Row label="lebar strat a" value={f(strut.aStrut, 0)} unit="mm" hi />
              <Row label="kekakuan lateral" value={f(strut.kLateral, 0)} unit="N/mm" />
              <Row label="V_strat (crush)" value={f(strut.Vstrut, 0)} unit="kN" />
            </tbody></table>
          </div>
        </div>
        <p className="text-[8px] text-gray-400 leading-snug border-t border-gray-100 pt-1">
          Histeresis nonlinier rate-independent (bilinear kinematik / Bouc-Wen mulus / Takeda RC dengan degradasi kekakuan & pinching) + dinamika langkah-demi-langkah Newmark-β + Newton-Raphson (demand μ, energi histeretik, u residu) + asesmen energi Park-Ang + strat ekuivalen infill bata. Prosedur dari pustaka GM 257–272 (model histeresis, dinamika degradasi, asesmen energi kolom RC, FEMA 356) — angka contoh bukan acuan.
        </p>
      </div>
    </div>
  );
}
