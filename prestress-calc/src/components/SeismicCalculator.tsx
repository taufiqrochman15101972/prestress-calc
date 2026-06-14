"use client";

import React, { useState, useMemo } from "react";
import { computeSeismic } from "@/engine/seismic";
import type { SeismicInputs } from "@/engine/seismic";

// PCI BDM Ch.15 example scale: 2×42,7 m bulb-tee, W=16,5 MN, A=0,15
const DEFAULT: SeismicInputs = {
  W: 16500, A: 0.15, S: 1.2, R: 3,
  K: 0, EIcol: 4.4e6, hCol: 9.3, doubleCurvature: false,
  L: 85, Hsup: 8, skew: 0, DLreaction: 1200,
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

export function SeismicCalculator() {
  const [inp, setInp] = useState<SeismicInputs>(DEFAULT);
  const set = (k: keyof SeismicInputs, v: number | boolean) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const r = useMemo(() => computeSeismic(inp), [inp]);
  const f = (v: number, d = 2) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-60 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Bahaya Gempa & Sistem</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="A koef. percepatan" unit="g" value={inp.A} onChange={v => set("A", v)} step={0.05} />
            <Nf label="S koef. situs (1–2)" value={inp.S} onChange={v => set("S", v)} step={0.1} />
            <Nf label="R faktor modifikasi" value={inp.R} onChange={v => set("R", v)} step={0.5} />
            <Nf label="W berat tributari" unit="kN" value={inp.W} onChange={v => set("W", v)} step={500} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Kekakuan (K langsung, atau EI kolom)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="K langsung (0 = pakai EI)" unit="kN/m" value={inp.K} onChange={v => set("K", v)} step={1000} />
            <Nf label="E·I kolom" unit="kN·m²" value={inp.EIcol} onChange={v => set("EIcol", v)} step={1e5} />
            <Nf label="h kolom" unit="m" value={inp.hCol} onChange={v => set("hCol", v)} step={0.5} />
          </div>
          <label className="flex items-center gap-1.5 mt-1.5 text-[10px] text-gray-600">
            <input type="checkbox" checked={inp.doubleCurvature} onChange={e => set("doubleCurvature", e.target.checked)} />
            Lengkung ganda 12EI/h³ (longitudinal) — else 3EI/h³
          </label>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Dudukan & Sambungan</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="L bentang/segmen" unit="m" value={inp.L} onChange={v => set("L", v)} step={5} />
            <Nf label="H tinggi pilar/abut" unit="m" value={inp.Hsup} onChange={v => set("Hsup", v)} step={0.5} />
            <Nf label="Sudut skew" unit="°" value={inp.skew} onChange={v => set("skew", v)} step={5} />
            <Nf label="Reaksi beban mati" unit="kN" value={inp.DLreaction} onChange={v => set("DLreaction", v)} step={50} />
          </div>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">
          Metode Beban Seragam (Mode Tunggal) — STD Div. I-A / LRFD §4.7.4
        </p>
        <table className="w-full max-w-md">
          <tbody>
            <Row label="Kategori kinerja seismik (SPC)" value={r.SPC} hi />
            <Row label="K kekakuan ekuivalen" value={f(r.K, 0)} unit="kN/m" />
            <Row label="T = 2π·√(W/(g·K))" value={f(r.T, 3)} unit="s" hi />
            <Row label={`C_s = 1,2AS/T^⅔ ${r.CsCapped ? "(dibatasi 2,5A)" : ""}`} value={f(r.Cs, 3)} hi />
            <Row label="V elastis = C_s·W" value={f(r.Velastic, 0)} unit="kN" />
            <Row label="V desain = V/R" value={f(r.Vdesign, 0)} unit="kN" hi />
            <Row label="p_e beban statik ekuivalen" value={f(r.pe, 1)} unit="kN/m" />
            <Row label="F sambungan min (SPC A) = 0,20·DL" value={f(r.Fconn, 0)} unit="kN" />
          </tbody>
        </table>

        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">
          Lebar Dudukan Minimum N (anti loss-of-span)
        </p>
        <table className="w-full max-w-md">
          <tbody>
            <Row label="N — STD Div. I-A: (8+0,02L+0,08H)(1+0,000125·S_k²) in" value={f(r.N_std_mm, 0)} unit="mm" hi />
            <Row label="N — LRFD 4.7.4.4: (200+0,0017L+0,0067H)(…)" value={f(r.N_lrfd_mm, 0)} unit="mm" hi />
          </tbody>
        </table>
        <p className="text-[9px] text-gray-400 leading-snug">
          Gelagar pracetak prategang umumnya force-protected — kolom & sambungannya yang
          menyerap gempa (R kolom 3–5, sambungan 0,8–1,0; desain kapasitas momen lebih-kuat
          kolom 1,3·M_n). Zona 2–4: N dikalikan 100–150%. Diafragma ujung meneruskan geser
          ke perletakan; periksa juga gaya angkat (hold-down) bila A ≥ 0,19.
        </p>
      </div>
    </div>
  );
}
