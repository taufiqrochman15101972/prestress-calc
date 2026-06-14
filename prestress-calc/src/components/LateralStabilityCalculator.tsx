"use client";

import React, { useState, useMemo } from "react";
import { computeLateralStability, computeMastHanging, computeMastHauling, K_FACTORS } from "@/engine/lateralstability";
import type { LateralStabilityInputs, SupportLoadCase, LoadHeight, MastHangingInputs, MastHaulingInputs } from "@/engine/lateralstability";

const DEFAULT: LateralStabilityInputs = {
  b1: 500, h1: 150, b2: 160, h2: 1500, b3: 650, h3: 200,
  L: 30000, fc: 45, Ec: 0, nu: 0.2, phiCreep: 0,
  loadCase: "SS_UDL", Wapplied: 280, loadHeight: "CENTROID",
};

function Nf({ label, unit, value, onChange, step = 1, min = 0 }: {
  label: string; unit?: string; value: number;
  onChange: (v: number) => void; step?: number; min?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-gray-500 leading-tight">{label}</span>
      <div className="relative flex items-center">
        <input type="number" value={value} min={min} step={step}
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
function Chk({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`flex justify-between items-center px-2 py-1 rounded text-[10px] my-0.5 border ${ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
      <span>{label}</span>
      <span className="font-mono font-bold">{value}</span>
      <span className="font-bold">{ok ? "✓ OK" : "✗ NG"}</span>
    </div>
  );
}

export function LateralStabilityCalculator() {
  const [inp, setInp] = useState<LateralStabilityInputs>(DEFAULT);
  const set = (k: keyof LateralStabilityInputs, v: number | string) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const res = useMemo(() => computeLateralStability(inp), [inp]);
  const f = (v: number, d = 1) => v.toFixed(d);
  const e = (v: number, d = 3) => v.toExponential(d);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-56 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Penampang (3 persegi simetris)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="b₁ flens tekan" unit="mm" value={inp.b1} onChange={v => set("b1", v)} step={10} />
            <Nf label="h₁ tebal" unit="mm" value={inp.h1} onChange={v => set("h1", v)} step={10} />
            <Nf label="b₂ web tebal" unit="mm" value={inp.b2} onChange={v => set("b2", v)} step={10} />
            <Nf label="h₂ web tinggi" unit="mm" value={inp.h2} onChange={v => set("h2", v)} step={50} />
            <Nf label="b₃ flens bawah" unit="mm" value={inp.b3} onChange={v => set("b3", v)} step={10} />
            <Nf label="h₃ tebal" unit="mm" value={inp.h3} onChange={v => set("h3", v)} step={10} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Bentang & Material</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="L tak-tertumpu" unit="mm" value={inp.L} onChange={v => set("L", v)} step={500} />
            <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
            <Nf label="ν Poisson" value={inp.nu} onChange={v => set("nu", v)} step={0.05} />
            <Nf label="φ creep" value={inp.phiCreep} onChange={v => set("phiCreep", v)} step={0.1} />
            <Nf label="W total" unit="kN" value={inp.Wapplied} onChange={v => set("Wapplied", v)} step={10} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Tumpuan & Beban (faktor K)</p>
          <select value={inp.loadCase}
            onChange={ev => set("loadCase", ev.target.value as SupportLoadCase)}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-400">
            {(Object.keys(K_FACTORS) as SupportLoadCase[]).map(k => (
              <option key={k} value={k}>{K_FACTORS[k].label} (K={K_FACTORS[k].K})</option>
            ))}
          </select>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1 mt-2">Posisi beban</p>
          <select value={inp.loadHeight}
            onChange={ev => set("loadHeight", ev.target.value as LoadHeight)}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="ABOVE">Di atas centroid (destabilisasi)</option>
            <option value="CENTROID">Di centroid</option>
            <option value="BELOW">Di bawah centroid (stabilisasi)</option>
          </select>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">Abeles §13.3 / Timoshenko:</p>
          <p className="text-blue-600 mt-0.5">W_cr = (K/L²)·√(B₁·C), B₁=E·I_y, C=G·J. Selidiki bila L/b &gt; 30; FS = W_cr/W ≥ 3.</p>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 space-y-2 min-w-0">
        {/* Buckled-beam sketch (plan view, lateral sway) */}
        <div className="flex gap-3">
          <svg width="200" height="96" viewBox="0 0 200 96" className="flex-none border border-gray-200 rounded bg-gray-50">
            {/* straight (unbuckled) reference */}
            <line x1="16" y1="34" x2="184" y2="34" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2" />
            {/* buckled (laterally swayed) shape */}
            <path d="M16,34 Q100,12 184,34" fill="none" stroke="#dc2626" strokeWidth="2.5" />
            {/* supports */}
            <polygon points="16,34 11,42 21,42" fill="#374151" />
            <polygon points="184,34 179,42 189,42" fill="#374151" />
            {/* twist arrows */}
            <text x="86" y="10" fontSize="7" fill="#dc2626" fontWeight="bold">lateral sway + twist</text>
            {/* cross-section mini (narrow tall) */}
            <g transform="translate(150,52)">
              <rect x="0" y="0" width="26" height="6" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="0.8" />
              <rect x="9" y="6" width="8" height="26" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="0.8" />
              <rect x="-3" y="32" width="32" height="7" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="0.8" />
              <text x="-2" y="50" fontSize="6" fill="#64748b">narrow b, deep h</text>
            </g>
            <text x="20" y="64" fontSize="7" fill="#374151">L/b = {f(res.slenderness, 0)}</text>
            <text x="20" y="78" fontSize="7" fill={res.isStable ? "#16a34a" : "#dc2626"} fontWeight="bold">
              FS = {isFinite(res.FS) ? f(res.FS, 2) : "∞"}
            </text>
          </svg>
          <table className="flex-1"><tbody>
            <Row label="I_y (sumbu lemah)" value={e(res.Iy, 3)} unit="mm⁴" />
            <Row label="J (St. Venant, terbuka)" value={e(res.J, 3)} unit="mm⁴" hi />
            <Row label="E_eff (creep-modified)" value={f(res.Ec_eff, 0)} unit="MPa" />
            <Row label="G modulus geser" value={f(res.G, 0)} unit="MPa" />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Kekakuan & Tekuk (Timoshenko)</p>
          <table className="w-full"><tbody>
            <Row label="B₁ = E·I_y" value={e(res.B1, 3)} unit="N·mm²" />
            <Row label="C = G·J" value={e(res.C, 3)} unit="N·mm²" />
            <Row label={`K (${K_FACTORS[inp.loadCase].label})`} value={f(res.K, 3)} />
            <Row label="W_cr = (K/L²)·√(B₁·C)" value={f(res.Wcr, 1)} unit="kN" hi />
            <Row label={`× faktor posisi beban (${f(res.heightFactor, 2)})`} value={f(res.WcrAdj, 1)} unit="kN" />
            <Row label="M_cr ekivalen" value={f(res.Mcr, 1)} unit="kN·m" />
          </tbody></table>
        </div>

        <div className="space-y-0.5">
          <Chk label="Kelangsingan L/b ≤ 30 (CP 115 — perlu diselidiki bila >30)"
            value={`${f(res.slenderness, 1)} ${res.mustInvestigate ? ">" : "≤"} 30`} ok={!res.mustInvestigate} />
          <Chk label="Faktor keamanan tekuk lateral FS ≥ 3"
            value={`${isFinite(res.FS) ? f(res.FS, 2) : "∞"} ${res.isStable ? "≥" : "<"} 3.0`} ok={res.isStable} />
        </div>

        {res.mustInvestigate && (
          <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1.5 text-[10px] text-amber-700">
            L/b = {f(res.slenderness, 0)} &gt; 30 → balok langsing: stabilitas lateral wajib diperiksa
            (saat angkat/transport/ereksi). Sediakan penopang lateral atau pengaku bila FS &lt; 3.
          </div>
        )}

        <MastBlock Iy={res.Iy} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Mast roll-equilibrium method — PCI BDM §8.10 (Mast 1989/1993)
// Hanging from loops (roll axis ABOVE c.g.) + on truck (roll axis BELOW)
// ════════════════════════════════════════════════════════════════
function MastBlock({ Iy }: { Iy: number }) {
  const [hang, setHang] = useState<MastHangingInputs>({
    L: 41.5, a: 2.7, w: 12.0, Ec: 33700, Iy,
    yr: 870, sweep: 43, placementTol: 6,
    fr: 3.74, fTopComp: 0.8, Mg: 1800, bTop: 1070,
  });
  const [haul, setHaul] = useState<MastHaulingInputs>({
    L: 41.5, a: 2.7, w: 12.0, Ec: 34500, Iy,
    Ktheta: 4580, hcg: 2740, hr: 610, alpha: 0.06,
    sweep: 86, placementTol: 25, zmax: 915,
    fr: 3.95, fTopComp: 2.3, Mg: 1800, bTop: 1070,
  });
  const setH = (k: keyof MastHangingInputs, v: number) => setHang(p => ({ ...p, [k]: v }));
  const setT = (k: keyof MastHaulingInputs, v: number) => setHaul(p => ({ ...p, [k]: v }));
  const rh = useMemo(() => computeMastHanging({ ...hang, Iy }), [hang, Iy]);
  const rt = useMemo(() => computeMastHauling({ ...haul, Iy }), [haul, Iy]);
  const f = (v: number, d = 2) => v.toFixed(d);

  return (
    <div className="border-t border-gray-200 pt-2 space-y-2">
      <p className="text-[9px] font-bold uppercase text-gray-400">
        Metode Mast (PCI BDM §8.10) — Keseimbangan Guling Angkat & Hauling
      </p>

      {/* hanging */}
      <p className="text-[9px] font-semibold text-gray-500">A · Balok Tergantung Lifting Loop (sumbu guling DI ATAS c.g.)</p>
      <div className="grid grid-cols-6 gap-1.5">
        <Nf label="L total" unit="m" value={hang.L} onChange={v => setH("L", v)} step={0.5} />
        <Nf label="a overhang" unit="m" value={hang.a} onChange={v => setH("a", v)} step={0.1} />
        <Nf label="w berat" unit="kN/m" value={hang.w} onChange={v => setH("w", v)} step={0.5} />
        <Nf label="E_ci" unit="MPa" value={hang.Ec} onChange={v => setH("Ec", v)} step={500} />
        <Nf label="y_r poros–c.g." unit="mm" value={hang.yr} onChange={v => setH("yr", v)} step={10} />
        <Nf label="sweep total" unit="mm" value={hang.sweep} onChange={v => setH("sweep", v)} step={2} />
        <Nf label="tol. loop" unit="mm" value={hang.placementTol} onChange={v => setH("placementTol", v)} step={1} />
        <Nf label="f_r" unit="MPa" value={hang.fr} onChange={v => setH("fr", v)} step={0.1} />
        <Nf label="f_top tekan" unit="MPa" value={hang.fTopComp} onChange={v => setH("fTopComp", v)} step={0.1} />
        <Nf label="M_g harp" unit="kN·m" value={hang.Mg} onChange={v => setH("Mg", v)} step={50} />
        <Nf label="b flens atas" unit="mm" value={hang.bTop} onChange={v => setH("bTop", v)} step={10} />
      </div>
      <table className="w-full max-w-lg"><tbody>
        <Row label="e_i = ½sweep·[(l₁/l)²−⅓] + tol" value={f(rh.ei, 1)} unit="mm" />
        <Row label="z̄_o lendut lateral c.g. (Eq. 8.10.1.1-1)" value={f(rh.zo, 1)} unit="mm" hi />
        <Row label="θ_i = e_i/y_r" value={f(rh.thetaI, 4)} unit="rad" />
        <Row label="M_lat = (f_r+f_top)·I_y/(b/2)" value={f(rh.Mlat, 0)} unit="kN·m" />
        <Row label="θ_max = M_lat/M_g" value={f(rh.thetaMax, 4)} unit="rad" />
      </tbody></table>
      <Chk label="FS_c = 1/(z̄_o/y_r + θ_i/θ_max) ≥ 1,5 (= FS_f)"
        value={`${f(rh.FSc, 2)} ${rh.ok ? "≥" : "<"} 1,5`} ok={rh.ok} />

      {/* hauling */}
      <p className="text-[9px] font-semibold text-gray-500 pt-1">B · Balok di Atas Truk/Perletakan Fleksibel (sumbu guling DI BAWAH c.g.)</p>
      <div className="grid grid-cols-6 gap-1.5">
        <Nf label="K_θ rig" unit="kN·m/rad" value={haul.Ktheta} onChange={v => setT("Ktheta", v)} step={100} />
        <Nf label="h_cg" unit="mm" value={haul.hcg} onChange={v => setT("hcg", v)} step={25} />
        <Nf label="h_r poros" unit="mm" value={haul.hr} onChange={v => setT("hr", v)} step={25} />
        <Nf label="α superelevasi" unit="rad" value={haul.alpha} onChange={v => setT("alpha", v)} step={0.01} />
        <Nf label="z_max roda" unit="mm" value={haul.zmax} onChange={v => setT("zmax", v)} step={25} />
        <Nf label="sweep kirim" unit="mm" value={haul.sweep} onChange={v => setT("sweep", v)} step={2} />
        <Nf label="tol. posisi" unit="mm" value={haul.placementTol} onChange={v => setT("placementTol", v)} step={5} />
        <Nf label="E_c" unit="MPa" value={haul.Ec} onChange={v => setT("Ec", v)} step={500} />
        <Nf label="f_r" unit="MPa" value={haul.fr} onChange={v => setT("fr", v)} step={0.1} />
        <Nf label="f_top tekan" unit="MPa" value={haul.fTopComp} onChange={v => setT("fTopComp", v)} step={0.1} />
        <Nf label="M_g harp" unit="kN·m" value={haul.Mg} onChange={v => setT("Mg", v)} step={50} />
      </div>
      <table className="w-full max-w-lg"><tbody>
        <Row label="r = K_θ/W (radius stabilitas)" value={f(rt.r, 0)} unit="mm" hi />
        <Row label="y = (h_cg − h_r)·1,02" value={f(rt.y, 0)} unit="mm" />
        <Row label="θ̄ ekuilibrium = (αr+e_i)/(r−y−z̄_o)" value={f(rt.thetaEq, 4)} unit="rad" />
        <Row label="M_lat = θ̄·M_g (tambahkan ke f_b!)" value={f(rt.Mlat, 0)} unit="kN·m" hi />
        <Row label="θ'_max = (z_max − h_r·α)/r + α" value={f(rt.thetaPrimeMax, 4)} unit="rad" />
        <Row label="z̄'_o retak = z̄_o(1 + 2,5·θ'_max)" value={f(rt.zoPrime, 1)} unit="mm" />
      </tbody></table>
      <Chk label="FS_c retak = r(θ_max−α)/(z̄_o·θ_max+e_i+y·θ_max) ≥ 1,0"
        value={`${f(rt.FSc, 2)} ${rt.okCrack ? "≥" : "<"} 1,0`} ok={rt.okCrack} />
      <Chk label="FS_f rollover (pakai z̄'_o, θ'_max) ≥ 1,5"
        value={`${f(rt.FSf, 2)} ${rt.okRollover ? "≥" : "<"} 1,5`} ok={rt.okRollover} />
      <p className="text-[9px] text-gray-400 leading-snug">
        Fisika berbeda dari tekuk Timoshenko di atas: balok menggulung sebagai benda kaku +
        lentur lateral. Sweep PCI = 3 mm per 3 m panjang (angkat: ½-nya); creep & tumpuan lunak
        memperbesar sweep saat pengiriman. I_y diambil dari penampang panel ini ({(Iy / 1e9).toFixed(2)}×10⁹ mm⁴).
      </p>
    </div>
  );
}
