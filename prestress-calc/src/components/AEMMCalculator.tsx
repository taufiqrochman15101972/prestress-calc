"use client";

import React, { useState, useMemo } from "react";
import { computeAEMM, computeJointMovement } from "@/engine/aemm";
import type { AEMMInputs } from "@/engine/aemm";
import { computePTApproxLoss } from "@/engine/losses";

// Benchmark girder defaults (A_g, I_g from the verified PRD section)
const DEFAULT: AEMMInputs = {
  A: 535000, I: 1.7746e11, yb: 769.86, h: 1650,
  Ec: 33234, Eps: 197000, Aps: 3553.2, e: 650,
  Pe: 4200, Msus: 2800,
  phi: 2.0, chi: 0.80, epsShMicro: 400, deltaSigmaRel: 35,
  spanMm: 30000,
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

export function AEMMCalculator() {
  const [inp, setInp] = useState<AEMMInputs>(DEFAULT);
  const set = (k: keyof AEMMInputs, v: number) => setInp(prev => ({ ...prev, [k]: v }));
  const r = useMemo(() => computeAEMM(inp), [inp]);
  const f = (v: number, d = 2) => v.toFixed(d);

  // curvature diagram (κ at t0 → t∞)
  const kMax = Math.max(1e-6, Math.abs(r.kappa0), Math.abs(r.kappaFinal));
  const kx = 70 / kMax;

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-56 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Penampang & Material</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="A bruto" unit="mm²" value={inp.A} onChange={v => set("A", v)} step={1e4} />
            <Nf label="I bruto" unit="mm⁴" value={inp.I} onChange={v => set("I", v)} step={1e10} />
            <Nf label="y_b sentroid" unit="mm" value={inp.yb} onChange={v => set("yb", v)} step={10} />
            <Nf label="h tinggi" unit="mm" value={inp.h} onChange={v => set("h", v)} step={50} />
            <Nf label="E_c (umur t₀)" unit="MPa" value={inp.Ec} onChange={v => set("Ec", v)} step={500} />
            <Nf label="E_p strand" unit="MPa" value={inp.Eps} onChange={v => set("Eps", v)} step={1000} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Prategang & Beban Tetap</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="A_ps" unit="mm²" value={inp.Aps} onChange={v => set("Aps", v)} step={100} />
            <Nf label="e eksentrisitas" unit="mm" value={inp.e} onChange={v => set("e", v)} step={25} />
            <Nf label="P_e efektif" unit="kN" value={inp.Pe} onChange={v => set("Pe", v)} step={100} />
            <Nf label="M tetap (g+sdl)" unit="kN·m" value={inp.Msus} onChange={v => set("Msus", v)} step={100} />
            <Nf label="L bentang" unit="mm" value={inp.spanMm} onChange={v => set("spanMm", v)} step={1000} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Parameter Waktu (EC2 / Gilbert)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="φ(t,t₀) creep" value={inp.phi} onChange={v => set("phi", v)} step={0.1} />
            <Nf label="χ ageing (≈0.8)" value={inp.chi} onChange={v => set("chi", v)} step={0.05} />
            <Nf label="ε_sh susut" unit="×10⁻⁶" value={inp.epsShMicro} onChange={v => set("epsShMicro", v)} step={25} />
            <Nf label="Δσ relaksasi" unit="MPa" value={inp.deltaSigmaRel} onChange={v => set("deltaSigmaRel", v)} step={5} />
          </div>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">
          Modulus Efektif Terkoreksi Umur (AEMM)
        </p>
        <table className="w-full"><tbody>
          <Row label="E_e = E_c/(1+φ)" value={f(r.Ee, 0)} unit="MPa" />
          <Row label="Ē_e = E_c/(1+χ·φ) (age-adjusted)" value={f(r.EeBar, 0)} unit="MPa" hi />
        </tbody></table>

        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Regangan & Kelengkungan</p>
        <table className="w-full"><tbody>
          <Row label="ε₀ aksial seketika" value={f(r.eps0, 1)} unit="×10⁻⁶" />
          <Row label="κ₀ kelengkungan seketika" value={f(r.kappa0, 4)} unit="×10⁻⁶/mm" />
          <Row label="Δε akibat waktu (creep+susut+relaks)" value={f(r.dEps, 1)} unit="×10⁻⁶" />
          <Row label="Δκ akibat waktu" value={f(r.dKappa, 4)} unit="×10⁻⁶/mm" />
          <Row label="κ∞ akhir" value={f(r.kappaFinal, 4)} unit="×10⁻⁶/mm" hi />
        </tbody></table>

        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Lendutan Tengah Bentang (δ ≈ 5/48·κ·L²)</p>
        <table className="w-full"><tbody>
          <Row label="δ₀ seketika (+ = lendut bawah)" value={f(r.deltaInstMm, 1)} unit="mm" />
          <Row label="δ∞ jangka panjang" value={f(r.deltaFinalMm, 1)} unit="mm" hi />
          <Row label="Pengali δ∞/δ₀ (banding PCI 2.45)" value={f(r.multiplier, 2)} />
        </tbody></table>

        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Cross-Check Kehilangan & Tegangan Serat</p>
        <table className="w-full"><tbody>
          <Row label="Δσ_p baja (− = loss)" value={f(r.dSigmaP, 1)} unit="MPa" />
          <Row label="Kehilangan waktu (AEMM)" value={f(r.lossPct, 2)} unit="%" hi />
          <Row label="σ atas t₀ / t∞" value={`${f(r.sigmaTop0)} / ${f(r.sigmaTopInf)}`} unit="MPa" />
          <Row label="σ bawah t₀ / t∞" value={`${f(r.sigmaBot0)} / ${f(r.sigmaBotInf)}`} unit="MPa" />
        </tbody></table>

        {/* curvature bar diagram */}
        <svg width="280" height="74" viewBox="0 0 280 74" className="bg-white border border-gray-100 rounded">
          <line x1="100" y1="8" x2="100" y2="66" stroke="#94a3b8" strokeWidth="1" />
          <line x1="100" y1="22" x2={100 + r.kappa0 * kx} y2="22" stroke="#1d4ed8" strokeWidth="7" />
          <text x={106 + Math.max(0, r.kappa0 * kx)} y="25" fontSize="8" fill="#1d4ed8">κ₀ = {f(r.kappa0, 3)}</text>
          <line x1="100" y1="46" x2={100 + r.kappaFinal * kx} y2="46" stroke="#60a5fa" strokeWidth="7" />
          <text x={106 + Math.max(0, r.kappaFinal * kx)} y="49" fontSize="8" fill="#3b82f6">κ∞ = {f(r.kappaFinal, 3)}</text>
          <text x="4" y="25" fontSize="8" fill="#475569">t₀</text>
          <text x="4" y="49" fontSize="8" fill="#475569">t∞</text>
          <text x="150" y="66" fontSize="7" fill="#94a3b8">×10⁻⁶/mm (+ = sagging)</text>
        </svg>

        <p className="text-[9px] text-gray-400">
          Metode Trost–Bažant: tegangan berubah bertahap → creep tereduksi dengan
          koefisien penuaan χ. Restraint penuh efek waktu dilepas pada penampang
          transformasi age-adjusted [Ā B̄; B̄ Ī]. Negatif δ = camber (lendut ke atas).
        </p>

        <JointMovementBlock Pe={inp.Pe} A={inp.A} Ec={inp.Ec}
          phi={inp.phi} epsShMicro={inp.epsShMicro} />

        <PTApproxLossBlock A={inp.A} Aps={inp.Aps} />
      </div>
    </div>
  );
}

// ── Kehilangan jangka panjang PASCA-TARIK — metode aproksimasi ────
// Shing & Kottari (UCSD SSRP-11/02, Caltrans): AASHTO approximate
// yang diperluas untuk POST-TENSIONED — umur beton saat stressing t_i
// dan restraint tulangan lunak ρ_ns ikut diperhitungkan.
function PTApproxLossBlock({ A, Aps }: { A: number; Aps: number }) {
  const [fpi, setFpi] = useState(1395);
  const [fc, setFc] = useState(35);
  const [ti, setTi] = useState(30);
  const [RH, setRH] = useState(70);
  const [rhoNsPct, setRhoNsPct] = useState(0.7);
  const r = useMemo(
    () => computePTApproxLoss({ fpi, Aps, At: A, fc, ti, RH, rhoNs: rhoNsPct / 100 }),
    [fpi, Aps, A, fc, ti, RH, rhoNsPct]);
  const f = (v: number, d = 1) => v.toFixed(d);

  return (
    <div className="border-t border-gray-200 pt-2">
      <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">
        Kehilangan Jangka Panjang Pasca-Tarik — Aproksimasi PT (Shing–Kottari / Caltrans SSRP-11/02 eq. 6.7)
      </p>
      <div className="flex gap-3">
        <div className="w-40 flex-none grid grid-cols-1 gap-1.5">
          <Nf label="f_pi setelah angkur" unit="MPa" value={fpi} onChange={setFpi} step={25} />
          <Nf label="f'c 28-hari" unit="MPa" value={fc} onChange={setFc} step={5} />
          <Nf label="t_i umur saat PT" unit="hari" value={ti} onChange={setTi} step={5} />
          <Nf label="RH kelembaban" unit="%" value={RH} onChange={setRH} step={5} />
          <Nf label="ρ_ns tulangan lunak" unit="%" value={rhoNsPct} onChange={setRhoNsPct} step={0.1} />
        </div>
        <table className="flex-1"><tbody>
          <Row label="γ_st = 1/(0.67+f'c/62)" value={f(r.gamma_st, 3)} />
          <Row label={`γ_ac = t_i^−0.118 · γ_as susut tersisa`} value={`${f(r.gamma_ac, 3)} / ${f(r.gamma_as, 3)}`} />
          <Row label="γ_h = 1.7−0.01H" value={f(r.gamma_h, 3)} />
          <Row label={`γ_sr restraint baja (η̄=${f(r.etaBar, 1)}, ρ_ps=${f(r.rhoPs * 100, 2)}%)`} value={f(r.gamma_sr, 3)} hi />
          <Row label="Δf_p creep+susut ·γ_h·γ_sr" value={f(r.deltaFp_creepShrink)} unit="MPa" />
          <Row label="Δf_pR relaksasi" value={f(r.deltaFp_relax)} unit="MPa" />
          <Row label="Δf_pLT TOTAL" value={f(r.deltaFpLT)} unit="MPa" hi />
          <Row label="terhadap f_pi" value={f(r.lossPct, 2)} unit="%" hi />
        </tbody></table>
      </div>
      <p className="text-[9px] text-gray-400 mt-1 leading-snug">
        Berbeda dari aproksimasi AASHTO pratarik: makin tua beton saat di-stressing (t_i besar)
        → creep & susut tersisa makin kecil; tulangan lunak banyak (box girder CIP) → γ_sr &lt; 1
        menahan creep/susut. Bandingkan dengan loss AEMM di atas — keduanya cross-check.
      </p>
    </div>
  );
}

// ── Pemendekan superstruktur & pergerakan expansion joint ─────────
// (memakai parameter waktu AEMM yang sama agar konsisten)
function JointMovementBlock({ Pe, A, Ec, phi, epsShMicro }: {
  Pe: number; A: number; Ec: number; phi: number; epsShMicro: number;
}) {
  const [L, setL] = useState(30);
  const [alphaMicro, setAlpha] = useState(10);
  const [dTplus, setDTp] = useState(15);
  const [dTminus, setDTm] = useState(15);
  const [gamma, setGamma] = useState(1.2);
  const r = useMemo(
    () => computeJointMovement({ L, Pe, A, Ec, phi, epsShMicro, alphaMicro, dTplus, dTminus, gamma }),
    [L, Pe, A, Ec, phi, epsShMicro, alphaMicro, dTplus, dTminus, gamma]);
  const f = (v: number, d = 1) => v.toFixed(d);

  return (
    <div className="border-t border-gray-200 pt-2">
      <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">
        Pemendekan Superstruktur → Pergerakan Expansion Joint (WSDOT §5.8.1.E)
      </p>
      <div className="flex gap-3">
        <div className="w-40 flex-none grid grid-cols-1 gap-1.5">
          <Nf label="L ke joint" unit="m" value={L} onChange={setL} step={5} />
          <Nf label="α termal" unit="×10⁻⁶/°C" value={alphaMicro} onChange={setAlpha} step={0.5} />
          <Nf label="ΔT⁺ naik / ΔT⁻ turun" unit="°C" value={dTplus} onChange={v => { setDTp(v); setDTm(v); }} step={1} />
          <Nf label="γ faktor gerak" value={gamma} onChange={setGamma} step={0.05} />
        </div>
        <table className="flex-1"><tbody>
          <Row label="δ elastis P/(A·E)·L" value={f(r.dElastic)} unit="mm" />
          <Row label="δ rangkak φ·δ_el" value={f(r.dCreep)} unit="mm" />
          <Row label="δ susut ε_sh·L" value={f(r.dShrink)} unit="mm" />
          <Row label="δ termal ± α·ΔT·L" value={`${f(r.dThermalPlus)} / ${f(r.dThermalMinus)}`} unit="mm" />
          <Row label="joint MEMBUKA total" value={f(r.openTotal)} unit="mm" hi />
          <Row label="joint MENUTUP total" value={f(r.closeTotal)} unit="mm" />
          <Row label={`rentang desain γ=${gamma}`} value={f(r.designRange)} unit="mm" hi />
        </tbody></table>
      </div>
    </div>
  );
}
