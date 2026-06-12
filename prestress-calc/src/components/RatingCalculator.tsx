"use client";

import React, { useState, useMemo } from "react";
import { computeRating } from "@/engine/rating";
import type { RatingInputs, RatingLine } from "@/engine/rating";

const DEFAULT: RatingInputs = {
  Mn: 10811, Vn: 1850, phiF: 0.9, phiV: 0.9, phiC: 1.0, phiS: 1.0,
  M_DC: 2800, M_DW: 450, M_LL: 2200,
  V_DC: 380, V_DW: 60, V_LL: 320,
  fD_bot: -2.5, fLL_bot: 4.2, fc: 50,
  vehicleWeight: 320,
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

function RFRow({ name, l, unit }: { name: string; l: RatingLine; unit: string }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-1 pr-2 text-gray-600 text-[10px]">{name}</td>
      <td className="py-1 px-1 font-mono text-right text-[10px] text-gray-500">{l.C.toFixed(1)}</td>
      <td className="py-1 px-1 font-mono text-right text-[10px] text-gray-500">{l.D.toFixed(1)}</td>
      <td className="py-1 px-1 font-mono text-right text-[10px] text-gray-500">{l.L.toFixed(1)}</td>
      <td className="py-1 px-1 text-[9px] text-gray-400">{unit}</td>
      <td className={`py-1 pl-2 font-mono text-right text-[11px] font-bold ${l.ok ? "text-green-700" : "text-red-600"}`}>
        {Number.isFinite(l.RF) ? l.RF.toFixed(3) : "∞"}
      </td>
      <td className="py-1 pl-1.5">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold ${l.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {l.ok ? "LULUS" : "GAGAL"}
        </span>
      </td>
    </tr>
  );
}

export function RatingCalculator() {
  const [inp, setInp] = useState<RatingInputs>(DEFAULT);
  const set = (k: keyof RatingInputs, v: number) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const res = useMemo(() => computeRating(inp), [inp]);
  const f = (v: number, d = 2) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-60 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Kapasitas Nominal & Faktor</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="M_n lentur" unit="kN·m" value={inp.Mn} onChange={v => set("Mn", v)} step={100} />
            <Nf label="V_n geser" unit="kN" value={inp.Vn} onChange={v => set("Vn", v)} step={50} />
            <Nf label="φ lentur" value={inp.phiF} onChange={v => set("phiF", v)} step={0.05} />
            <Nf label="φ geser" value={inp.phiV} onChange={v => set("phiV", v)} step={0.05} />
            <Nf label="φ_c kondisi" value={inp.phiC} onChange={v => set("phiC", v)} step={0.05} />
            <Nf label="φ_s sistem" value={inp.phiS} onChange={v => set("phiS", v)} step={0.05} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Efek Beban — Momen / Geser</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="M_DC" unit="kN·m" value={inp.M_DC} onChange={v => set("M_DC", v)} step={50} />
            <Nf label="V_DC" unit="kN" value={inp.V_DC} onChange={v => set("V_DC", v)} step={10} />
            <Nf label="M_DW" unit="kN·m" value={inp.M_DW} onChange={v => set("M_DW", v)} step={25} />
            <Nf label="V_DW" unit="kN" value={inp.V_DW} onChange={v => set("V_DW", v)} step={5} />
            <Nf label="M_LL+IM" unit="kN·m" value={inp.M_LL} onChange={v => set("M_LL", v)} step={50} />
            <Nf label="V_LL+IM" unit="kN" value={inp.V_LL} onChange={v => set("V_LL", v)} step={10} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Service III & Kendaraan Rating</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="σ_b D+P_e (+tarik)" unit="MPa" value={inp.fD_bot} onChange={v => set("fD_bot", v)} step={0.1} />
            <Nf label="σ_b akibat LL" unit="MPa" value={inp.fLL_bot} onChange={v => set("fLL_bot", v)} step={0.1} />
            <Nf label="f'c layan" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
            <Nf label="Berat kendaraan" unit="kN" value={inp.vehicleWeight} onChange={v => set("vehicleWeight", v)} step={10} />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">LRFR (AASHTO MBE §6A / CDOT 9B):</p>
          <p className="text-blue-600 mt-0.5">RF = (φ_c·φ_s·φ·R_n − 1.25·DC − 1.50·DW)/(γ_LL·LL); γ_LL = 1.75 inventory, 1.35 operating, 0.80 Service III. RF ≥ 1 = memadai.</p>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 space-y-2 min-w-0">
        <table className="w-full">
          <thead>
            <tr className="text-[8px] uppercase text-gray-400 border-b border-gray-200">
              <th className="text-left py-1">Pemeriksaan</th>
              <th className="text-right px-1">C</th>
              <th className="text-right px-1">ΣγD</th>
              <th className="text-right px-1">γL·LL</th>
              <th></th>
              <th className="text-right pl-2">RF</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <RFRow name="Lentur — Inventory (γ_LL=1.75)" l={res.flexInv} unit="kN·m" />
            <RFRow name="Lentur — Operating (γ_LL=1.35)" l={res.flexOp} unit="kN·m" />
            <RFRow name="Geser — Inventory" l={res.shearInv} unit="kN" />
            <RFRow name="Geser — Operating" l={res.shearOp} unit="kN" />
            <RFRow name="Service III — tarik serat bawah (γ_LL=0.80)" l={res.serviceIII} unit="MPa" />
          </tbody>
        </table>

        <div className="grid grid-cols-3 gap-2">
          <div className={`rounded border p-2 text-center ${res.adequate ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
            <p className="text-[9px] text-gray-500">RF Menentukan (Inventory)</p>
            <p className={`font-mono font-bold text-base ${res.adequate ? "text-green-700" : "text-red-600"}`}>{f(res.RFgoverning, 3)}</p>
            <p className="text-[8px] text-gray-400 leading-tight">{res.governs}</p>
          </div>
          <div className="rounded border border-gray-200 p-2 text-center">
            <p className="text-[9px] text-gray-500">Beban Aman Inventory</p>
            <p className="font-mono font-bold text-base text-blue-700">{f(res.safeLoadInv, 0)} kN</p>
            <p className="text-[8px] text-gray-400">≈ {f(res.safeLoadInv / 9.81, 1)} ton</p>
          </div>
          <div className="rounded border border-gray-200 p-2 text-center">
            <p className="text-[9px] text-gray-500">Beban Operating Maks</p>
            <p className="font-mono font-bold text-base text-blue-700">{f(res.safeLoadOp, 0)} kN</p>
            <p className="text-[8px] text-gray-400">≈ {f(res.safeLoadOp / 9.81, 1)} ton</p>
          </div>
        </div>

        <div className={`rounded px-2 py-1.5 text-[10px] border ${res.adequate ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
          {res.adequate
            ? `Jembatan MEMADAI untuk kendaraan rating ${f(inp.vehicleWeight, 0)} kN — RF terkecil ${f(res.RFgoverning, 3)} ≥ 1.0 (${res.governs}).`
            : `Jembatan TIDAK memadai — RF terkecil ${f(res.RFgoverning, 3)} < 1.0 pada ${res.governs}; perlu pembatasan beban (posting) ≈ ${f(res.safeLoadInv / 9.81, 1)} ton atau perkuatan.`}
        </div>
      </div>
    </div>
  );
}
