"use client";

import React, { useState, useMemo } from "react";
import { computeSegmental, computePrelimPT } from "@/engine/segmental";
import type { SegmentalInputs, ErectionMethod, PrelimPTInputs } from "@/engine/segmental";

const DEFAULT: SegmentalInputs = {
  // Deep balanced-cantilever pier-segment box (≈6 m deep): properties coupled to span
  method: "BALANCED_CANTILEVER",
  A: 1.2e7, Ztop: 2.5e10, Zbot: 2.5e10, fc: 45, fci: 32,
  w: 300,
  Lcant: 50, Lseg: 3.5, Ptrav: 900, qConstr: 5, eCant: 2500, Pcant: 80000,
  Lspan: 45, Lnose: 27, noseEff: 0.5, Pcentral: 60000,
  phiCreep: 2.0, Mbuilt: -380000, Mmono: -260000,
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
function Chk({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`flex justify-between items-center px-2 py-1 rounded text-[10px] my-0.5 border ${ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
      <span>{label}</span>
      <span className="font-mono font-bold">{value}</span>
      <span className="font-bold">{ok ? "✓ OK" : "✗ NG"}</span>
    </div>
  );
}

export function SegmentalCalculator() {
  const [inp, setInp] = useState<SegmentalInputs>(DEFAULT);
  const set = (k: keyof SegmentalInputs, v: number | string) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const res = useMemo(() => computeSegmental(inp), [inp]);
  const f = (v: number, d = 1) => v.toFixed(d);
  const isBC = inp.method === "BALANCED_CANTILEVER";

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-56 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Metode Ereksi</p>
          <select value={inp.method}
            onChange={ev => set("method", ev.target.value as ErectionMethod)}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="BALANCED_CANTILEVER">Kantilever Seimbang (Balanced Cantilever)</option>
            <option value="INCREMENTAL_LAUNCH">Peluncuran Bertahap (Incremental Launch)</option>
          </select>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Penampang Kritis</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="A" unit="mm²" value={inp.A} onChange={v => set("A", v)} step={1e4} />
            <Nf label="w sw" unit="kN/m" value={inp.w} onChange={v => set("w", v)} step={10} />
            <Nf label="Z_top" unit="mm³" value={inp.Ztop} onChange={v => set("Ztop", v)} step={1e7} />
            <Nf label="Z_bot" unit="mm³" value={inp.Zbot} onChange={v => set("Zbot", v)} step={1e7} />
            <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
            <Nf label="f'ci ereksi" unit="MPa" value={inp.fci} onChange={v => set("fci", v)} />
          </div>
        </div>
        {isBC ? (
          <div>
            <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Kantilever Seimbang</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Nf label="L kantilever" unit="m" value={inp.Lcant} onChange={v => set("Lcant", v)} step={1} />
              <Nf label="L segmen" unit="m" value={inp.Lseg} onChange={v => set("Lseg", v)} step={0.5} />
              <Nf label="P traveller" unit="kN" value={inp.Ptrav} onChange={v => set("Ptrav", v)} step={50} />
              <Nf label="q ereksi" unit="kN/m" value={inp.qConstr} onChange={v => set("qConstr", v)} step={0.5} />
              <Nf label="e tendon atas" unit="mm" value={inp.eCant} onChange={v => set("eCant", v)} step={25} />
              <Nf label="P cantilever" unit="kN" value={inp.Pcant} onChange={v => set("Pcant", v)} step={500} />
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Peluncuran Bertahap</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Nf label="L bentang" unit="m" value={inp.Lspan} onChange={v => set("Lspan", v)} step={1} />
              <Nf label="L hidung" unit="m" value={inp.Lnose} onChange={v => set("Lnose", v)} step={1} />
              <Nf label="efisiensi hidung" value={inp.noseEff} onChange={v => set("noseEff", v)} step={0.05} />
              <Nf label="P sentris" unit="kN" value={inp.Pcentral} onChange={v => set("Pcentral", v)} step={500} />
            </div>
          </div>
        )}
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Redistribusi Rangkak (ganti sistem)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="φ creep" value={inp.phiCreep} onChange={v => set("phiCreep", v)} step={0.1} />
            <Nf label="M as-built" unit="kN·m" value={inp.Mbuilt} onChange={v => set("Mbuilt", v)} step={1000} />
            <Nf label="M monolit" unit="kN·m" value={inp.Mmono} onChange={v => set("Mmono", v)} step={1000} />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">Hewson §13/§15 + PTI §2.7:</p>
          <p className="text-blue-600 mt-0.5">Beban saat konstruksi sering menentukan. Redistribusi: M_fin = M_built + (M_mono − M_built)(1 − e^−φ).</p>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 space-y-2 min-w-0">
        {/* Method sketch */}
        <div className="flex gap-3">
          <svg width="210" height="92" viewBox="0 0 210 92" className="flex-none border border-gray-200 rounded bg-gray-50">
            {isBC ? (
              <>
                {/* pier */}
                <rect x="100" y="40" width="10" height="44" fill="#94a3b8" stroke="#475569" />
                {/* two cantilever arms */}
                <line x1="20" y1="40" x2="190" y2="40" stroke="#1d4ed8" strokeWidth="5" />
                {/* traveller weights */}
                <line x1="22" y1="22" x2="22" y2="38" stroke="#dc2626" strokeWidth="1.5" markerEnd="url(#sg_ar)" />
                <line x1="188" y1="22" x2="188" y2="38" stroke="#dc2626" strokeWidth="1.5" markerEnd="url(#sg_ar)" />
                <text x="60" y="20" fontSize="7" fill="#dc2626" fontWeight="bold">M_hog di pier</text>
                {/* top tendon */}
                <line x1="20" y1="36" x2="190" y2="36" stroke="#16a34a" strokeWidth="1" strokeDasharray="3 1.5" />
                <text x="78" y="58" fontSize="7" fill="#475569">balanced cantilever</text>
              </>
            ) : (
              <>
                {/* piers */}
                <rect x="40" y="46" width="8" height="38" fill="#94a3b8" stroke="#475569" />
                <rect x="120" y="46" width="8" height="38" fill="#94a3b8" stroke="#475569" />
                {/* deck being launched */}
                <line x1="20" y1="46" x2="160" y2="46" stroke="#1d4ed8" strokeWidth="5" />
                {/* launching nose */}
                <line x1="160" y1="46" x2="195" y2="50" stroke="#f59e0b" strokeWidth="3" />
                <text x="162" y="44" fontSize="6" fill="#b45309">nose</text>
                {/* push arrow */}
                <line x1="8" y1="46" x2="22" y2="46" stroke="#16a34a" strokeWidth="2" markerEnd="url(#sg_ar2)" />
                <text x="44" y="68" fontSize="7" fill="#475569">incremental launch →</text>
                <text x="100" y="30" fontSize="7" fill="#dc2626" fontWeight="bold">±M bolak-balik</text>
              </>
            )}
            <defs>
              <marker id="sg_ar" markerWidth="6" markerHeight="6" refX="3" refY="5" orient="auto"><path d="M0,0 L6,0 L3,6 Z" fill="#dc2626" /></marker>
              <marker id="sg_ar2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#16a34a" /></marker>
            </defs>
          </svg>
          <table className="flex-1"><tbody>
            {isBC ? <>
              <Row label="M self-weight" value={f(res.Mself, 0)} unit="kN·m" />
              <Row label="M traveller" value={f(res.Mtrav, 0)} unit="kN·m" />
              <Row label="M ereksi LL" value={f(res.Mconstr, 0)} unit="kN·m" />
              <Row label="M_pier (hogging)" value={f(res.Mpier, 0)} unit="kN·m" hi />
              <Row label="M out-of-balance" value={f(res.Munbal, 0)} unit="kN·m" />
            </> : <>
              <Row label="M cantilever tanpa hidung" value={f(res.McantNoNose, 0)} unit="kN·m" />
              <Row label="M_hog (dgn hidung)" value={f(res.Mhog, 0)} unit="kN·m" hi />
              <Row label="M_sag mid-span" value={f(res.Msag, 0)} unit="kN·m" hi />
            </>}
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Tegangan Serat (saat ereksi)</p>
          <table className="w-full"><tbody>
            <Row label="σ_top" value={f(res.sigmaTop, 2)} unit="MPa" />
            <Row label="σ_bot" value={f(res.sigmaBot, 2)} unit="MPa" />
            <Row label="batas tarik / tekan" value={`${f(res.limTens, 2)} / ${f(res.limComp, 2)}`} unit="MPa" />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Redistribusi Rangkak (Sistem Berubah)</p>
          <table className="w-full"><tbody>
            <Row label="faktor (1 − e^−φ)" value={f(res.redistFactor, 3)} hi />
            <Row label="M_final (terdistribusi)" value={f(res.Mfinal, 0)} unit="kN·m" hi />
          </tbody></table>
        </div>

        <Chk label="Tegangan serat dalam batas (ereksi)"
          value={`σ ∈ [${f(res.limComp, 1)}, ${f(res.limTens, 1)}]`} ok={res.stressOk} />

        <PrelimPTBlock />
      </div>
    </div>
  );
}

// ── Preliminary PT-layout estimator (Montgomery / ASPIRE) ─────────
const DEFAULT_PT: PrelimPTInputs = {
  A: 1.2e7, I: 3.0e13, c: 2800, e: 2400, eta: 0.75, Pstrand: 160,
  M_DC: 180000, M_DW: 25000, M_CR: 12000, M_SH: 3000, M_LL: 60000, M_TG: 18000,
  fc: 45, strandsPerTendon: 19,
};

function PrelimPTBlock() {
  const [inp, setInp] = useState<PrelimPTInputs>(DEFAULT_PT);
  const set = (k: keyof PrelimPTInputs, v: number) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const r = useMemo(() => computePrelimPT(inp), [inp]);
  const f = (v: number, d = 2) => v.toFixed(d);

  return (
    <div className="border-t border-gray-200 pt-2 mt-2">
      <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">
        Estimasi Awal Jumlah Strand PT — Efisiensi Tendon (Montgomery, ASPIRE)
      </p>
      <div className="flex gap-3">
        <div className="w-60 flex-none grid grid-cols-2 gap-1.5">
          <Nf label="A penampang" unit="mm²" value={inp.A} onChange={v => set("A", v)} step={1e5} />
          <Nf label="I" unit="mm⁴" value={inp.I} onChange={v => set("I", v)} step={1e12} />
          <Nf label="c serat tarik" unit="mm" value={inp.c} onChange={v => set("c", v)} step={50} />
          <Nf label="e tendon" unit="mm" value={inp.e} onChange={v => set("e", v)} step={50} />
          <Nf label="η efisiensi (1−M₂/M₁)" value={inp.eta} onChange={v => set("eta", v)} step={0.05} />
          <Nf label="P₁ per strand" unit="kN" value={inp.Pstrand} onChange={v => set("Pstrand", v)} step={5} />
          <Nf label="M_DC" unit="kN·m" value={inp.M_DC} onChange={v => set("M_DC", v)} step={1000} />
          <Nf label="M_DW" unit="kN·m" value={inp.M_DW} onChange={v => set("M_DW", v)} step={500} />
          <Nf label="M_CR redistribusi" unit="kN·m" value={inp.M_CR} onChange={v => set("M_CR", v)} step={500} />
          <Nf label="M_SH susut" unit="kN·m" value={inp.M_SH} onChange={v => set("M_SH", v)} step={500} />
          <Nf label="M_LL+IM" unit="kN·m" value={inp.M_LL} onChange={v => set("M_LL", v)} step={1000} />
          <Nf label="M_TG gradien T" unit="kN·m" value={inp.M_TG} onChange={v => set("M_TG", v)} step={500} />
          <Nf label="f'c layan" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
          <Nf label="strand per tendon" value={inp.strandsPerTendon} onChange={v => set("strandsPerTendon", v)} />
        </div>
        <div className="flex-1 min-w-0">
          <table className="w-full"><tbody>
            <Row label="M_design = ΣM + 0.8·M_LL + 0.5·M_TG (Service III)" value={f(r.Mdesign, 0)} unit="kN·m" hi />
            <Row label="σ_design = M·c/I (+tarik)" value={f(r.sigmaDesign, 2)} unit="MPa" />
            <Row label="σ_limit = 0.5√f'c" value={f(r.sigmaLimit, 2)} unit="MPa" />
            <Row label="σ_PT,1 = P₁/A + η·P₁·e·c/I (1 strand)" value={f(r.sigmaPT1, 3)} unit="MPa" hi />
            <Row label="n strand perlu" value={`${r.nStrands}`} hi />
            <Row label={`jumlah tendon @ ${inp.strandsPerTendon} strand`} value={`${r.nTendons}`} hi />
            <Row label="ΣP efektif layout" value={f(r.Ptotal, 0)} unit="kN" />
            <Row label="σ serat dengan layout" value={f(r.sigmaFinal, 2)} unit="MPa" />
          </tbody></table>
          <Chk label="σ_final ≤ σ_limit (tarik Service III)"
            value={`${f(r.sigmaFinal, 2)} ≤ ${f(r.sigmaLimit, 2)} MPa`} ok={r.ok} />
        </div>
      </div>
    </div>
  );
}
