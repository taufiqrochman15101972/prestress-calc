"use client";

import React, { useState, useMemo } from "react";
import { computeMadeContinuous } from "@/engine/madecontinuous";
import type { MadeContinuousInputs } from "@/engine/madecontinuous";

const DEFAULT: MadeContinuousInputs = {
  nSpans: 2, L: 30000, fc: 40, Ic: 3.729e11, Pe: 4500, eDrape: 650,
  wSelf: 14, phi: 2.0, Msh: 180, fcDeck: 30, Zconn: 3.0e7, fy: 420, jd: 1500,
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
function Chk({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className={`flex justify-between items-center px-2 py-1 rounded text-[10px] my-0.5 border ${ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
      <span>{label}</span>
      <span className="font-mono">{detail}</span>
      <span className="font-bold">{ok ? "✓ OK" : "✗ NG"}</span>
    </div>
  );
}

export function MadeContinuousCalculator() {
  const [inp, setInp] = useState<MadeContinuousInputs>(DEFAULT);
  const set = (k: keyof MadeContinuousInputs, v: number) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const r = useMemo(() => computeMadeContinuous(inp), [inp]);
  const f = (v: number, d = 1) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-60 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Geometri & Bentang</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="Jumlah bentang (2/3)" value={inp.nSpans} onChange={v => set("nSpans", (v >= 3 ? 3 : 2))} />
            <Nf label="L per bentang" unit="mm" value={inp.L} onChange={v => set("L", v)} step={500} />
            <Nf label="I komposit I_c" unit="mm⁴" value={inp.Ic} onChange={v => set("Ic", v)} step={1e10} />
            <Nf label="f'c gelagar" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} step={5} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Prategang & Beban Terkunci</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="P_e efektif" unit="kN" value={inp.Pe} onChange={v => set("Pe", v)} step={100} />
            <Nf label="Drape e_mid−e_end" unit="mm" value={inp.eDrape} onChange={v => set("eDrape", v)} step={25} />
            <Nf label="w sendiri+dek" unit="kN/m" value={inp.wSelf} onChange={v => set("wSelf", v)} step={0.5} />
            <Nf label="φ rangkak (→∞)" value={inp.phi} onChange={v => set("phi", v)} step={0.1} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Susut Diferensial & Sambungan</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="M susut diferensial" unit="kN·m" value={inp.Msh ?? 0} onChange={v => set("Msh", v)} step={10} />
            <Nf label="f'c dek/diafragma" unit="MPa" value={inp.fcDeck} onChange={v => set("fcDeck", v)} step={5} />
            <Nf label="Z sambungan I/y" unit="mm³" value={inp.Zconn} onChange={v => set("Zconn", v)} step={1e6} />
            <Nf label="f_y batang sambungan" unit="MPa" value={inp.fy} onChange={v => set("fy", v)} step={20} />
            <Nf label="lengan jd sambungan" unit="mm" value={inp.jd} onChange={v => set("jd", v)} step={50} />
          </div>
        </div>
        <p className="text-[9px] text-gray-400 leading-snug">
          Gelagar pracetak diereksi sebagai <b>bentang sederhana</b>, lalu dek CIP + diafragma di
          atas pilar membuatnya menerus. Prategang ingin camber naik → ditahan → momen restraint
          <b> positif</b> (tarik di dasar diafragma) yang berkembang lewat rangkak (1−e^−φ); berat
          sendiri menambah momen <b>negatif</b>; susut diferensial meredam momen positif.
        </p>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">
          Metode rotasi — 2/3 bentang sama, M_support = −3·E·I·θ/L
        </p>
        <table className="w-full max-w-md">
          <tbody>
            <Row label="E_c gelagar = 4700√f'c" value={f(r.Ec, 0)} unit="MPa" />
            <Row label="w_p ekuivalen prategang = 8Pe/L²" value={f(r.wp, 2)} unit="N/mm" />
            <Row label="θ_p rotasi prategang" value={r.thetaP.toExponential(2)} unit="rad" />
            <Row label="θ_g rotasi berat sendiri" value={r.thetaG.toExponential(2)} unit="rad" />
            <Row label="M_p,cont (jika menerus t=0)" value={f(r.MpCont)} unit="kN·m" />
            <Row label="M_g,cont (hogging)" value={f(r.MgCont)} unit="kN·m" />
          </tbody>
        </table>

        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">
          Momen restraint time-dependent (NCHRP 322 / PCA)
        </p>
        <table className="w-full max-w-md">
          <tbody>
            <Row label="Faktor rangkak (1−e^−φ)" value={f(r.creepFactor, 3)} />
            <Row label="Faktor susut (1−e^−φ)/φ" value={f(r.shFactor, 3)} />
            <Row label="M_r rangkak (prategang+sendiri)" value={f(r.MrCreep)} unit="kN·m" />
            <Row label="M_r susut diferensial (redam)" value={f(r.MrShrink)} unit="kN·m" />
            <Row label="M_r NET di pilar" value={f(r.Mr)} unit="kN·m" hi />
            <Row label="M_r positif govern (tanpa redam)" value={f(r.MrPosGov)} unit="kN·m" hi />
          </tbody>
        </table>

        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">
          Sambungan momen-positif (AASHTO LRFD §5.12.3.3)
        </p>
        <table className="w-full max-w-md">
          <tbody>
            <Row label="M_cr = 0,5√f'c·Z" value={f(r.Mcr)} unit="kN·m" />
            <Row label="M sambungan = maks(1,2M_cr, M_r⁺)" value={f(r.MconnReq)} unit="kN·m" hi />
            <Row label="A_s sambungan = M/(φ·f_y·jd)" value={f(r.AsConn, 0)} unit="mm²" hi />
          </tbody>
        </table>
        <Chk label={r.isPositive ? "Restraint NET positif (sagging)" : "Restraint NET negatif (hogging)"}
          detail={`M_r = ${f(r.Mr)} kN·m`} ok={true} />
        <Chk label="Kapasitas sambungan momen-positif" detail={`φM_n ≥ ${f(r.MconnReq)} kN·m`} ok={r.connectionOk} />
        <p className="text-[9px] text-gray-500 leading-snug">{r.note}</p>
      </div>
    </div>
  );
}
