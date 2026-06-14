"use client";

import React, { useState, useMemo } from "react";
import { computeTransversePT, requiredTransversePT } from "@/engine/transversept";
import type { TransversePTInputs } from "@/engine/transversept";

// PCI BDM §8.9.3.7 example: 28-ft wide, 95-ft span, BIII-48 (H=991), 160-ksi bars
const DEFAULT: TransversePTInputs = {
  L: 29, W: 8.5, H: 991,
  fpuBar: 1103, effRatio: 0.55, AbarOne: 388, nBars: 2,
  bGrout: 200, hGrout: 940, eBar: 25, bonded: true,
  beamWeight: 360,
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

export function TransversePTCalculator() {
  const [inp, setInp] = useState<TransversePTInputs>(DEFAULT);
  const set = (k: keyof TransversePTInputs, v: number | boolean) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const r = useMemo(() => computeTransversePT(inp), [inp]);
  const f = (v: number, d = 1) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-60 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Geometri Jembatan Box Berdampingan</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="L bentang" unit="m" value={inp.L} onChange={v => set("L", v)} step={1} />
            <Nf label="W lebar jembatan" unit="m" value={inp.W} onChange={v => set("W", v)} step={0.5} />
            <Nf label="H tinggi box" unit="mm" value={inp.H} onChange={v => set("H", v)} step={50} />
            <Nf label="Berat 1 gelagar" unit="kN" value={inp.beamWeight} onChange={v => set("beamWeight", v)} step={10} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Batang PT Transversal (per diafragma)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="f_pu batang" unit="MPa" value={inp.fpuBar} onChange={v => set("fpuBar", v)} step={10} />
            <Nf label="Rasio efektif (≈0.55)" value={inp.effRatio} onChange={v => set("effRatio", v)} step={0.01} />
            <Nf label="A satu batang" unit="mm²" value={inp.AbarOne} onChange={v => set("AbarOne", v)} step={10} />
            <Nf label="Jumlah batang" value={inp.nBars} onChange={v => set("nBars", v)} step={1} />
          </div>
          <label className="flex items-center gap-1.5 mt-1.5 text-[10px] text-gray-600">
            <input type="checkbox" checked={inp.bonded} onChange={e => set("bonded", e.target.checked)} />
            Tendon bonded (di-grout) — unbonded butuh +30% gaya
          </label>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Kantong Grout Diafragma</p>
          <div className="grid grid-cols-3 gap-1.5">
            <Nf label="b kantong" unit="mm" value={inp.bGrout} onChange={v => set("bGrout", v)} step={10} />
            <Nf label="h kantong" unit="mm" value={inp.hGrout} onChange={v => set("hGrout", v)} step={10} />
            <Nf label="e eksentrisitas" unit="mm" value={inp.eBar} onChange={v => set("eBar", v)} step={5} />
          </div>
        </div>
        <p className="text-[9px] text-gray-400 leading-snug">
          Grafik P(H, W) hasil digitalisasi Fig. 8.9.3-2 (El-Remaily 1996):
          P({f(inp.H / 25.4, 0)}&quot;, {f(inp.W / 0.3048, 0)}&apos;) = {f(requiredTransversePT(inp.H, inp.W), 1)} kN/m.
        </p>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">
          1 · Metode Rasional — Diafragma PT (El-Remaily / PCI BDM §8.9.3)
        </p>
        <table className="w-full max-w-md">
          <tbody>
            <Row label={`Jumlah diafragma (L ${inp.L > 18.3 ? ">" : "≤"} 18,3 m)`} value={`${r.nDiaphragms}`} unit="bh (ujung + ¼ bentang)" />
            <Row label="Jarak antar diafragma s = L/n" value={f(r.spacing, 2)} unit="m" />
            <Row label="P butuh per meter bentang (grafik)" value={f(r.P_perM, 1)} unit="kN/m" hi />
            <Row label="F per diafragma = P·s" value={f(r.F_required, 0)} unit="kN" hi />
            <Row label="A_pt butuh = F/(0,55·f_pu)" value={f(r.Apt_required, 0)} unit="mm²" />
            <Row label={`A_pt tersedia (${inp.nBars} batang)`} value={f(r.Apt_provided, 0)} unit="mm²" />
            <Row label="F_pe tersedia" value={f(r.Fpe_provided, 0)} unit="kN" />
            <Row label="σ atas kantong grout" value={f(r.sigmaTop, 2)} unit="MPa" />
            <Row label="σ bawah kantong grout" value={f(r.sigmaBot, 2)} unit="MPa" />
            <Row label="σ rata-rata (prategang sambungan)" value={f(r.sigmaMean, 2)} unit="MPa" />
          </tbody>
        </table>
        <Chk label="Luas batang PT" detail={`${f(r.Apt_provided, 0)} ≥ ${f(r.Apt_required, 0)} mm²`} ok={r.areaOk} />
        <Chk label="Tanpa tarik pada grout (WSD)" detail={`σ maks ${f(Math.max(r.sigmaTop, r.sigmaBot), 2)} ≤ 0`} ok={r.noTension} />
        <Chk label="Sambungan kaku LRFD §4.6.2.2.1" detail={`${f(r.sigmaMean, 2)} ≥ ${f(r.minRigid, 2)} MPa`} ok={r.rigidOk} />

        <p className="text-[9px] font-bold uppercase text-gray-400 pt-2">
          2 · Metode Empiris — Tie Rod Oregon (PCI BDM §8.9.2)
        </p>
        <table className="w-full max-w-md">
          <tbody>
            <Row label="Tata letak batang (Tabel 8.9.2.1-1)" value={r.tieDescription} />
            <Row label="Jumlah batang total" value={`${r.nRodsTotal}`} unit="bh Ø22 A449" />
            <Row label="Gaya per batang (39,25 kip)" value={f(r.rodForce, 0)} unit="kN" />
            <Row label="Total gaya transversal" value={f(r.tieTotalForce, 0)} unit="kN" hi />
          </tbody>
        </table>
        <Chk label="Total gaya ≥ berat 1 gelagar" detail={`${f(r.tieTotalForce, 0)} ≥ ${f(inp.beamWeight, 0)} kN`} ok={r.tieOk} />
        <p className="text-[9px] text-gray-400 leading-snug">
          Geser vertikal antar-box dicek dengan teori gesek-geser (lihat geser antarmuka, §8.5) —
          gaya jepit PT besar sehingga geser jarang menentukan. Kunci geser (shear key) digrout
          non-susut ≥ 34 MPa; skew &gt; 15° butuh analisis grid.
        </p>
      </div>
    </div>
  );
}
