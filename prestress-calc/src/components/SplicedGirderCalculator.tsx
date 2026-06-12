"use client";

import React, { useState, useMemo } from "react";
import { computeSplicedGirder } from "@/engine/splicedgirder";
import type { SplicedGirderInputs, StageStress } from "@/engine/splicedgirder";

const DEFAULT: SplicedGirderInputs = {
  A: 535000, Ztg: 201.6e6, Zbg: 230.5e6,
  Ac: 860331, Ztgc: 731.9e6, Zbc: 327.0e6,
  Ppre: 2200, ePre: 550, Ppt1: 2800, ePt1: 600, Ppt2: 2400, ePt2: 950,
  Mg: 1500, Mdeck: 1300, Msdl: 600, Mll: 2200,
  fci: 40, fc: 50,
  bw: 200, ductOD: 90, grouted: true, VcPlusVs: 1400, Vp: 250,
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

function StageCard({ name, desc, s }: { name: string; desc: string; s: StageStress }) {
  const f = (v: number) => v.toFixed(2);
  return (
    <div className={`rounded border p-2 flex-1 ${s.ok ? "border-gray-200" : "border-red-300 bg-red-50"}`}>
      <div className="flex justify-between items-center">
        <p className="text-[10px] font-bold text-gray-700">{name}</p>
        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${s.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {s.ok ? "OK" : "LEWAT BATAS"}
        </span>
      </div>
      <p className="text-[8px] text-gray-400 mb-1 leading-tight">{desc}</p>
      <table className="w-full"><tbody>
        <Row label="Δσ_top / Δσ_bot tahap ini" value={`${f(s.dTop)} / ${f(s.dBot)}`} unit="MPa" />
        <Row label="σ kumulatif top" value={f(s.top)} unit="MPa" hi />
        <Row label="σ kumulatif bot" value={f(s.bot)} unit="MPa" hi />
        <Row label="batas tarik / tekan" value={`+${f(s.limT)} / ${f(s.limC)}`} unit="MPa" />
      </tbody></table>
    </div>
  );
}

export function SplicedGirderCalculator() {
  const [inp, setInp] = useState<SplicedGirderInputs>(DEFAULT);
  const set = (k: keyof SplicedGirderInputs, v: number | boolean) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const r = useMemo(() => computeSplicedGirder(inp), [inp]);
  const f = (v: number, d = 2) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-60 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Penampang Pracetak / Komposit</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="A pracetak" unit="mm²" value={inp.A} onChange={v => set("A", v)} step={1e4} />
            <Nf label="A_c komposit" unit="mm²" value={inp.Ac} onChange={v => set("Ac", v)} step={1e4} />
            <Nf label="Z_tg" unit="mm³" value={inp.Ztg} onChange={v => set("Ztg", v)} step={1e6} />
            <Nf label="Z_tgc" unit="mm³" value={inp.Ztgc} onChange={v => set("Ztgc", v)} step={1e6} />
            <Nf label="Z_bg" unit="mm³" value={inp.Zbg} onChange={v => set("Zbg", v)} step={1e6} />
            <Nf label="Z_bc" unit="mm³" value={inp.Zbc} onChange={v => set("Zbc", v)} step={1e6} />
            <Nf label="f'ci" unit="MPa" value={inp.fci} onChange={v => set("fci", v)} />
            <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Prategang per Tahap (e + di bawah NA)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="P pretension" unit="kN" value={inp.Ppre} onChange={v => set("Ppre", v)} step={100} />
            <Nf label="e_pre" unit="mm" value={inp.ePre} onChange={v => set("ePre", v)} step={25} />
            <Nf label="P PT tahap-1" unit="kN" value={inp.Ppt1} onChange={v => set("Ppt1", v)} step={100} />
            <Nf label="e_pt1 (NA pracetak)" unit="mm" value={inp.ePt1} onChange={v => set("ePt1", v)} step={25} />
            <Nf label="P PT tahap-2" unit="kN" value={inp.Ppt2} onChange={v => set("Ppt2", v)} step={100} />
            <Nf label="e_pt2 (NA komposit)" unit="mm" value={inp.ePt2} onChange={v => set("ePt2", v)} step={25} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Momen (kN·m) & Geser Duct</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="M_g girder" value={inp.Mg} onChange={v => set("Mg", v)} step={50} />
            <Nf label="M_deck+closure" value={inp.Mdeck} onChange={v => set("Mdeck", v)} step={50} />
            <Nf label="M_sdl" value={inp.Msdl} onChange={v => set("Msdl", v)} step={50} />
            <Nf label="M_LL+IM" value={inp.Mll} onChange={v => set("Mll", v)} step={50} />
            <Nf label="b_w web" unit="mm" value={inp.bw} onChange={v => set("bw", v)} step={10} />
            <Nf label="Ø duct" unit="mm" value={inp.ductOD} onChange={v => set("ductOD", v)} step={5} />
            <Nf label="V_c+V_s tanpa duct" unit="kN" value={inp.VcPlusVs} onChange={v => set("VcPlusVs", v)} step={50} />
            <Nf label="V_p" unit="kN" value={inp.Vp} onChange={v => set("Vp", v)} step={25} />
          </div>
          <label className="flex items-center gap-1.5 mt-1.5 text-[10px] text-gray-600">
            <input type="checkbox" checked={inp.grouted} onChange={e => set("grouted", e.target.checked)} />
            Duct tergrout (bonded)
          </label>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">Ronald (PCI J. 2001) + TxDOT 0-6652:</p>
          <p className="text-blue-600 mt-0.5">Tegangan terakumulasi pada penampang saat tahap itu (pracetak → komposit). Joint closure tanpa pretension → wajib tetap tertekan. Duct di web: λ_duct = 1 − 2(Ø/b_w)².</p>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 space-y-2 min-w-0">
        {/* staged elevation sketch */}
        <svg width="100%" height="64" viewBox="0 0 460 64" className="border border-gray-200 rounded bg-gray-50" preserveAspectRatio="xMidYMid meet">
          {/* three girder segments + closure pours */}
          {[[10, 130], [165, 130], [320, 130]].map(([x, w], i) => (
            <rect key={i} x={x} y={30} width={w} height={12} fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="0.8" />
          ))}
          <rect x={142} y={30} width={21} height={12} fill="#fde68a" stroke="#b45309" strokeWidth="0.8" />
          <rect x={297} y={30} width={21} height={12} fill="#fde68a" stroke="#b45309" strokeWidth="0.8" />
          {/* deck */}
          <rect x={10} y={22} width={440} height={6} fill="#e5e7eb" stroke="#9ca3af" strokeWidth="0.6" />
          {/* continuous PT tendon */}
          <path d="M 12 34 Q 75 44 150 33 Q 230 24 310 33 Q 385 44 448 34" fill="none" stroke="#16a34a" strokeWidth="1.4" strokeDasharray="4 2" />
          {/* piers */}
          <rect x={148} y={42} width={8} height={18} fill="#94a3b8" />
          <rect x={303} y={42} width={8} height={18} fill="#94a3b8" />
          <text x={12} y={12} fontSize="7" fill="#1d4ed8">segmen pracetak (pretension)</text>
          <text x={170} y={12} fontSize="7" fill="#b45309">closure pour (tanpa pretension)</text>
          <text x={330} y={12} fontSize="7" fill="#16a34a">tendon PT menerus 2 tahap</text>
        </svg>

        <div className="flex gap-2">
          <StageCard name="TAHAP A — Pabrikasi" desc="Pretension + M_g pada penampang pracetak (f'ci)" s={r.stageA} />
          <StageCard name="TAHAP B — PT-1 + Deck" desc="PT tahap-1 + berat deck, non-komposit (f'ci)" s={r.stageB} />
          <StageCard name="TAHAP C — PT-2 + Layan" desc="PT tahap-2 + SDL + LL pada komposit (f'c)" s={r.stageC} />
        </div>

        <div className="flex gap-2">
          <div className={`rounded border p-2 flex-1 ${r.jointOk ? "border-green-200 bg-green-50" : "border-red-300 bg-red-50"}`}>
            <p className="text-[10px] font-bold text-gray-700 mb-1">Joint Closure (hanya PT yang melintas)</p>
            <table className="w-full"><tbody>
              <Row label="σ_top joint" value={f(r.jointTop)} unit="MPa" hi />
              <Row label="σ_bot joint" value={f(r.jointBot)} unit="MPa" hi />
            </tbody></table>
            <p className={`text-[9px] mt-1 font-semibold ${r.jointOk ? "text-green-700" : "text-red-600"}`}>
              {r.jointOk ? "✓ Joint tetap tertekan (tanpa tarik) — OK" : "✗ Ada tarik di joint — tambah PT atau geser tendon"}
            </p>
          </div>
          <div className="rounded border border-gray-200 p-2 flex-1">
            <p className="text-[10px] font-bold text-gray-700 mb-1">Reduksi Geser akibat Duct di Web</p>
            <table className="w-full"><tbody>
              <Row label="λ_duct = 1 − 2(Ø/b_w)²" value={f(r.lambdaDuct, 3)} hi />
              <Row label="V_n dengan λ_duct" value={f(r.VnDuct, 0)} unit="kN" hi />
              <Row label={`b_v,eff = b_w − ${inp.grouted ? "0.25" : "0.50"}Ø (lama)`} value={f(r.bvEff, 0)} unit="mm" />
              <Row label="V_n dengan b_v,eff" value={f(r.VnBvEff, 0)} unit="kN" />
              <Row label="reduksi kapasitas" value={f(r.reductionPct, 1)} unit="%" />
            </tbody></table>
          </div>
        </div>
      </div>
    </div>
  );
}
