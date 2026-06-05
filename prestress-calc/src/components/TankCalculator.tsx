"use client";

import React, { useState, useMemo } from "react";
import { computeCircularPrestress } from "@/engine/tank";
import type { TankInputs, TankBaseCondition } from "@/engine/tank";

const DEFAULT: TankInputs = {
  r: 6_000, t: 250, H: 5_000,
  gamma_l: 10, fc: 35, fpy: 1580, fpu: 1860, Eps: 197_000,
  Aps_per_m: 600, jackingRatio: 0.70,
  baseCondition: "FIXED",
};

function Nf({ label, unit, value, onChange, step=1, min=0 }: {
  label: string; unit?: string; value: number;
  onChange: (v: number) => void; step?: number; min?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-gray-500 uppercase">{label}</span>
      <div className="relative flex items-center">
        <input type="number" value={value} min={min} step={step}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          className={`w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ${unit?"pr-10":""}`} />
        {unit && <span className="absolute right-2 text-[9px] text-gray-400 pointer-events-none">{unit}</span>}
      </div>
    </div>
  );
}
function Row({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-0.5 pr-3 text-gray-500 text-[10px]">{label}</td>
      <td className="py-0.5 font-mono text-right text-[10px] font-semibold text-gray-800">{value}</td>
      {unit && <td className="py-0.5 pl-1 text-gray-400 text-[9px]">{unit}</td>}
    </tr>
  );
}
function Chk({ label, value, limit, ok }: { label: string; value: string; limit: string; ok: boolean }) {
  return (
    <div className={`flex justify-between items-center px-2 py-1 rounded text-[10px] my-0.5 border ${ok?"bg-green-50 border-green-200 text-green-800":"bg-red-50 border-red-200 text-red-700"}`}>
      <span>{label}</span>
      <span className="font-mono font-bold">{value} {ok?"≤":">"} {limit}</span>
      <span className="font-bold">{ok?"✓ OK":"✗ NG"}</span>
    </div>
  );
}

export function TankCalculator() {
  const [inp, setInp] = useState<TankInputs>(DEFAULT);
  const set = (k: keyof TankInputs, v: number | string) =>
    setInp(prev => ({ ...prev, [k]: v }));

  const res = useMemo(() => computeCircularPrestress(inp), [inp]);
  const f = (v: number, d = 2) => v.toFixed(d);
  const r_m = inp.r / 1000, t_m = inp.t / 1000, H_m = inp.H / 1000;

  return (
    <div className="flex gap-4 text-[11px]">

      {/* Inputs */}
      <div className="w-52 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Geometri Tangki</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="Jari-jari r" unit="mm" value={inp.r} onChange={v=>set("r",v)} step={500} />
            <Nf label="Tebal dinding t" unit="mm" value={inp.t} onChange={v=>set("t",v)} step={25} />
            <Nf label="Tinggi H" unit="mm" value={inp.H} onChange={v=>set("H",v)} step={500} />
            <Nf label="γ cairan" unit="kN/m³" value={inp.gamma_l} onChange={v=>set("gamma_l",v)} step={0.5} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Material</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v=>set("fc",v)} />
            <Nf label="fpu kawat" unit="MPa" value={inp.fpu} onChange={v=>set("fpu",v)} step={10} />
            <Nf label="Aps/m (kawat)" unit="mm²/m" value={inp.Aps_per_m} onChange={v=>set("Aps_per_m",v)} step={50} />
            <Nf label="ρ jacking" value={inp.jackingRatio} onChange={v=>set("jackingRatio",v)} step={0.05} min={0.5} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Kondisi Tumpuan Bawah</p>
          <select value={inp.baseCondition}
            onChange={e => set("baseCondition", e.target.value as TankBaseCondition)}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="FIXED">Jepit (Fixed Base)</option>
            <option value="SLIDING">Geser Bebas (Sliding)</option>
            <option value="HINGED">Sendi (Hinged)</option>
          </select>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">Konsep TY Lin Ch.10:</p>
          <p className="text-blue-600 mt-0.5">wb = 8Pe·e/L² (linier) → sirkuler: σ_hoop = p·r/t — prategang → kompresi hoop mengimbangi tekanan cairan</p>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 space-y-2 min-w-0">

        {/* Section diagram */}
        <div className="flex gap-3">
          <svg width="100" height="100" viewBox="-55 -55 110 110" className="flex-none border border-gray-200 rounded bg-gray-50">
            <circle cx="0" cy="0" r="45" fill="none" stroke="#bae6fd" strokeWidth={inp.t/100*8} />
            <circle cx="0" cy="0" r="45" fill="none" stroke="#1d4ed8" strokeWidth="1.5" />
            {/* Winding wire indication */}
            {[0,30,60,90,120,150].map(deg => {
              const rad = deg*Math.PI/180;
              return <line key={deg} x1={40*Math.cos(rad)} y1={40*Math.sin(rad)}
                x2={50*Math.cos(rad)} y2={50*Math.sin(rad)} stroke="#dc2626" strokeWidth="1.5"/>;
            })}
            <text x="0" y="3" textAnchor="middle" fontSize="8" fill="#374151" fontFamily="monospace">r={r_m}m</text>
            <text x="0" y="13" textAnchor="middle" fontSize="7" fill="#6b7280">t={inp.t}mm</text>
          </svg>
          <div className="flex-1">
            <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Properti</p>
            <table className="w-full"><tbody>
              <Row label="Volume internal" value={f(res.volumeM3,1)} unit="m³" />
              <Row label="p_dasar = γ·H" value={f(res.p_base,2)} unit="kN/m²" />
              <Row label="N_h dasar = p·r" value={f(res.N_h_base,1)} unit="kN/m" />
              <Row label="N_h tengah" value={f(res.N_h_mid,1)} unit="kN/m" />
            </tbody></table>
          </div>
        </div>

        {/* Prestress */}
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Prategang Melingkar</p>
          <table className="w-full"><tbody>
            <Row label="f_se efektif" value={f(res.fse,1)} unit="MPa" />
            <Row label="Pe/m (gaya aksial sirkuler)" value={f(res.Pe_per_m,1)} unit="kN/m" />
            <Row label="σ_pe (kompresi hoop)" value={f(res.sigma_pe,2)} unit="MPa" />
          </tbody></table>
        </div>

        {/* Net stresses */}
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Tegangan Hoop Netto</p>
          <table className="w-full"><tbody>
            <Row label="σ_net dasar = σ_pe + N_h/t" value={f(res.sigma_hoop_base,2)} unit="MPa" />
            <Row label="σ_net tengah" value={f(res.sigma_hoop_mid,2)} unit="MPa" />
            {res.M_base_kNm > 0 && <>
              <Row label="M_lentur vertikal dasar" value={f(res.M_base_kNm,2)} unit="kN·m/m" />
              <Row label="σ_bending muka luar" value={f(res.sigma_bend_outer,2)} unit="MPa" />
            </>}
          </tbody></table>
        </div>

        {/* Checks */}
        <div className="space-y-0.5">
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Kontrol</p>
          <Chk label="ACI 350 (tangki) — σ ≤ 0 (tanpa tarik)"
            value={`σ=${f(res.sigma_hoop_base,2)} MPa`}
            limit="0 MPa" ok={res.isSls350Ok} />
          <Chk label="ACI 318 — σ ≤ 0.50√f'c"
            value={`σ=${f(res.sigma_hoop_base,2)} MPa`}
            limit={`${f(res.limTens,2)} MPa`} ok={res.isSlsACI} />
        </div>

        {/* Wire spacing recommendation */}
        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[10px]">
          <p className="font-bold text-amber-800">Rekomendasi Jarak Kawat</p>
          <p>Untuk memenuhi ACI 350 (σ ≤ 0): Aps_req/m ≈ {f(res.N_h_base*1000/res.fse,0)} mm²/m</p>
          <p>Jarak kawat yang ada: {isFinite(res.s_req_mm) ? f(res.s_req_mm,0)+" mm" : "—"}</p>
          <p className="mt-1 text-amber-700">h²/(r·t) = {f(inp.H**2/(inp.r*inp.t),2)}
            {" "}({inp.H**2/(inp.r*inp.t) < 3 ? "tangki pendek" : "tangki tinggi"})</p>
        </div>

      </div>
    </div>
  );
}
