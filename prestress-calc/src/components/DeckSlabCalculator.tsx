"use client";

import React, { useState, useMemo } from "react";
import { computeDeckSlab } from "@/engine/deckslab";
import type { DeckSlabInputs } from "@/engine/deckslab";

const DEFAULT: DeckSlabInputs = {
  S: 2.1, td: 200, wSdl: 1.5, X: 0.9, P: 72.5,
  cont: 0.8, fc: 30, fy: 420, d: 145, gammaC: 24,
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

export function DeckSlabCalculator() {
  const [inp, setInp] = useState<DeckSlabInputs>(DEFAULT);
  const set = (k: keyof DeckSlabInputs, v: number) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const r = useMemo(() => computeDeckSlab(inp), [inp]);
  const f = (v: number, d = 2) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-60 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Geometri Pelat Dek (arah transversal)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="S bentang antar gelagar" unit="m" value={inp.S} onChange={v => set("S", v)} step={0.1} />
            <Nf label="t_d tebal struktural" unit="mm" value={inp.td} onChange={v => set("td", v)} step={5} />
            <Nf label="X overhang luar" unit="m" value={inp.X} onChange={v => set("X", v)} step={0.1} />
            <Nf label="d efektif tulangan" unit="mm" value={inp.d} onChange={v => set("d", v)} step={5} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Beban</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="P roda (HS20/HL-93)" unit="kN" value={inp.P} onChange={v => set("P", v)} step={2.5} />
            <Nf label="SDL aspal dll" unit="kPa" value={inp.wSdl} onChange={v => set("wSdl", v)} step={0.25} />
            <Nf label="Faktor kontinuitas" value={inp.cont} onChange={v => set("cont", v)} step={0.05} />
            <Nf label="γ beton" unit="kN/m³" value={inp.gammaC} onChange={v => set("gammaC", v)} step={0.5} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Material</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="f'c dek" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} step={5} />
            <Nf label="f_y tulangan" unit="MPa" value={inp.fy} onChange={v => set("fy", v)} step={20} />
          </div>
        </div>
        <p className="text-[9px] text-gray-400 leading-snug">
          Dua jalur dihitung paralel: AASHTO Standard M = c·(S+2)/32·P (impak 30%) dan
          LRFD metode strip E⁺/E⁻ (IM 33%). Panel SIP prategang + topping CIP: momen positif
          sebagai penampang komposit prategang, momen negatif tulangan biasa di topping.
        </p>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">
          Jalur 1 — AASHTO Standard (STD 3.24.3): M = c·((S+2)/32)·P
        </p>
        <table className="w-full max-w-md">
          <tbody>
            <Row label="Berat sendiri pelat" value={f(r.wSelf)} unit="kPa" />
            <Row label="M_D mati ≈ w·S²/10" value={f(r.M_D)} unit="kN·m/m" />
            <Row label="M_LL (tanpa impak)" value={f(r.M_LL_std)} unit="kN·m/m" />
            <Row label="M_LL+I (impak 30%)" value={f(r.M_LLI_std)} unit="kN·m/m" hi />
            <Row label="M_u = 1,3(M_D + 1,67·M_LL+I)" value={f(r.Mu_std)} unit="kN·m/m" hi />
          </tbody>
        </table>

        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">
          Jalur 2 — LRFD Metode Strip (4.6.2.1.3): E⁺ = 660+0,55S · E⁻ = 1220+0,25S
        </p>
        <table className="w-full max-w-md">
          <tbody>
            <Row label="E⁺ lebar strip momen positif" value={f(r.Epos, 0)} unit="mm" />
            <Row label="E⁻ lebar strip momen negatif" value={f(r.Eneg, 0)} unit="mm" />
            <Row label="E overhang = 1140+0,833X" value={f(r.Eov, 0)} unit="mm" />
            <Row label="M_LL+IM positif" value={f(r.M_LL_pos)} unit="kN·m/m" />
            <Row label="M_LL+IM negatif" value={f(r.M_LL_neg)} unit="kN·m/m" />
            <Row label="M overhang (roda di kantilever)" value={f(r.M_ov)} unit="kN·m/m" />
            <Row label="M_u⁺ = 1,25M_DC + 1,75M_LL" value={f(r.Mu_lrfd_pos)} unit="kN·m/m" hi />
            <Row label="M_u⁻ (maks. negatif/overhang)" value={f(r.Mu_lrfd_neg)} unit="kN·m/m" hi />
          </tbody>
        </table>

        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Desain Penampang (momen terbesar)</p>
        <table className="w-full max-w-md">
          <tbody>
            <Row label="M_u desain (terbesar 2 jalur)" value={f(r.Mu_gov)} unit="kN·m/m" hi />
            <Row label="A_s butuh ≈ M_u/(0,9·f_y·0,9d)" value={f(r.As_req, 0)} unit="mm²/m" hi />
            <Row label="M_cr = 0,62√f'c·Z" value={f(r.Mcr)} unit="kN·m/m" />
            <Row label="Batas lendutan LL = S/800" value={f(r.deflLimit, 1)} unit="mm" />
          </tbody>
        </table>
        <Chk label="Tebal minimum LRFD 9.7.1.1" detail={`${inp.td} ≥ ${r.tdMin} mm`} ok={r.thicknessOk} />
        <Chk label="Tulangan minimum (1,2M_cr / 4⁄3·M_u)" detail={`φM_n(A_s) cukup`} ok={r.minReinfOk} />
        <p className="text-[9px] text-gray-400 leading-snug">
          Selimut: 50 mm atas (garam de-icing 65) / 25 mm bawah. Panel SIP: tebal panel ≤ 55%·t_d,
          ≥ 89 mm (LRFD 9.7.4.3.1). Distribusi longitudinal bawah: 3840/√S ≤ 67% (LRFD 9.7.3.2).
        </p>
      </div>
    </div>
  );
}
