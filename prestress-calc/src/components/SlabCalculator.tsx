"use client";

import React, { useState, useMemo } from "react";
import { computePTSlab, computeSlabMomentTransfer } from "@/engine/slab";
import { computeFloorVibration } from "@/engine/vibration";
import type { PTSlabInputs } from "@/engine/slab";

const DEFAULT: PTSlabInputs = {
  Lx: 7_000, Ly: 8_000, t: 220,
  cx: 500, cy: 500,
  fc: 35, gamma: 24,
  wSDL: 2, wLive: 5,
  Pe_x: 400, Pe_y: 320,
  e_x: 60, e_y: 60,
};

function Nf({ label, unit, value, onChange, step = 1, min = 0 }: {
  label: string; unit?: string; value: number; onChange: (v: number) => void; step?: number; min?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <div className="relative flex items-center">
        <input type="number" value={value} min={min} step={step}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          className={`w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ${unit ? "pr-10" : ""}`} />
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
    <div className={`flex justify-between items-center px-2 py-1 rounded text-[10px] my-0.5 border ${ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
      <span>{label}</span>
      <span className="font-mono font-bold">{value} {ok ? "✓" : "✗"} {limit}</span>
    </div>
  );
}

export function SlabCalculator() {
  const [inp, setInp] = useState<PTSlabInputs>(DEFAULT);
  const set = (k: keyof PTSlabInputs, v: number) =>
    setInp(prev => ({ ...prev, [k]: v }));

  const [Munb, setMunb] = useState(80); // kN·m unbalanced moment to column
  const res = useMemo(() => computePTSlab(inp), [inp]);
  const mt = useMemo(() => computeSlabMomentTransfer({
    Vu: res.Vu_punch, M_unb: Munb, cx: inp.cx, cy: inp.cy, t: inp.t, fc: inp.fc,
  }), [res.Vu_punch, Munb, inp.cx, inp.cy, inp.t, inp.fc]);

  // Floor vibration (Khan §9.2) — uses permanent mass: self + SDL + 10% live.
  const [zeta, setZeta] = useState(0.03); // damping ratio (furnished floor)
  const vib = useMemo(() => computeFloorVibration({
    spanL_m: inp.Lx / 1000, width_m: inp.Ly / 1000, t_mm: inp.t, fc: inp.fc,
    wPermanent: res.wSelf + inp.wSDL + 0.1 * inp.wLive,
    dampingRatio: zeta, use: "office",
  }), [inp.Lx, inp.Ly, inp.t, inp.fc, res.wSelf, inp.wSDL, inp.wLive, zeta]);
  const f = (v: number, d = 2) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">

      {/* Inputs */}
      <div className="w-52 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Geometri Panel</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="Lx (short)" unit="mm" value={inp.Lx} onChange={v=>set("Lx",v)} step={500} />
            <Nf label="Ly (long)" unit="mm" value={inp.Ly} onChange={v=>set("Ly",v)} step={500} />
            <Nf label="Tebal t" unit="mm" value={inp.t} onChange={v=>set("t",v)} step={10} />
            <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v=>set("fc",v)} />
            <Nf label="cx (kolom)" unit="mm" value={inp.cx} onChange={v=>set("cx",v)} step={50} />
            <Nf label="cy (kolom)" unit="mm" value={inp.cy} onChange={v=>set("cy",v)} step={50} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Beban</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="γ beton" unit="kN/m³" value={inp.gamma} onChange={v=>set("gamma",v)} step={0.5} />
            <Nf label="wSDL" unit="kN/m²" value={inp.wSDL} onChange={v=>set("wSDL",v)} step={0.5} />
            <Nf label="wLive" unit="kN/m²" value={inp.wLive} onChange={v=>set("wLive",v)} step={0.5} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Prategang (per meter lebar)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="Pe_x" unit="kN/m" value={inp.Pe_x} onChange={v=>set("Pe_x",v)} step={20} />
            <Nf label="Pe_y" unit="kN/m" value={inp.Pe_y} onChange={v=>set("Pe_y",v)} step={20} />
            <Nf label="e_x (sag)" unit="mm" value={inp.e_x} onChange={v=>set("e_x",v)} step={5} />
            <Nf label="e_y (sag)" unit="mm" value={inp.e_y} onChange={v=>set("e_y",v)} step={5} />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 space-y-2 min-w-0">

        {/* Load balance summary */}
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Berat sendiri","bg-gray-100",f(res.wSelf,2),"kN/m²"],
            ["Beban total","bg-gray-100",f(res.wTotal,2),"kN/m²"],
            ["% terkompensasi","bg-blue-50",f(res.percentBalanced,1),"%"],
            ["wb imbang total","bg-green-50",f(res.wb_total,2),"kN/m²"],
            ["wu sisa (unfact)","bg-amber-50",f(res.wu_net,2),"kN/m²"],
            ["wu ULS (fact)","bg-red-50",f(res.wu_factored,2),"kN/m²"],
          ].map(([l,bg,v,u]) => (
            <div key={String(l)} className={`${bg} rounded p-2 text-center`}>
              <p className="text-[9px] text-gray-500">{l}</p>
              <p className="font-bold text-gray-800 text-sm">{v}</p>
              <p className="text-[9px] text-gray-400">{u}</p>
            </div>
          ))}
        </div>

        {/* Keseimbangan detail */}
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Keseimbangan Beban (TY Lin)</p>
          <table className="w-full"><tbody>
            <Row label="wb_x = 8·Pe_x·e_x/Lx²" value={f(res.wb_x,2)} unit="kN/m²" />
            <Row label="wb_y = 8·Pe_y·e_y/Ly²" value={f(res.wb_y,2)} unit="kN/m²" />
            <Row label="M_unbal x-dir" value={f(res.M_unbal_x,2)} unit="kN·m/m" />
            <Row label="M_unbal y-dir" value={f(res.M_unbal_y,2)} unit="kN·m/m" />
          </tbody></table>
        </div>

        {/* Tegangan serat */}
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Tegangan Serat (SLS)</p>
          <table className="w-full"><tbody>
            <Row label="σ atas (net gabungan)" value={f(res.sigma_top_net,2)} unit="MPa" />
            <Row label="σ bawah (net gabungan)" value={f(res.sigma_bot_net,2)} unit="MPa" />
            <Row label="Batas tekan" value={f(res.limComp,2)} unit="MPa" />
            <Row label="Batas tarik" value={f(res.limTens,2)} unit="MPa" />
          </tbody></table>
        </div>

        {/* Checks */}
        <div className="space-y-0.5">
          <Chk label="SLS: Tegangan serat" value={`σ_max=${f(Math.max(res.sigma_bot_net,res.sigma_top_net),2)}`}
            limit={`${f(res.limTens,2)} MPa`} ok={res.isSlsOk} />
          <Chk label="Geser Pons — φVc ≥ Vu"
            value={`φVc=${f(res.phiVc_punch,1)} kN`} limit={`Vu=${f(res.Vu_punch,1)} kN`} ok={res.isPunchOk} />
          <Chk label="Lendutan — δ ≤ Ly/240"
            value={`δ=${f(res.delta_unbal,2)} mm`} limit={`${f(res.limitDefl,1)} mm`} ok={res.isDeflOk} />
        </div>

        {/* Punching detail */}
        <div className="bg-indigo-50 border border-indigo-200 rounded p-2 text-[10px] space-y-0.5">
          <p className="font-bold text-indigo-800">Detail Geser Pons (ACI §22.6)</p>
          <p>bo (keliling kritis) = {f(res.bo,0)} mm &nbsp;·&nbsp; Vu = {f(res.Vu_punch,1)} kN</p>
          <p>Vc = {f(res.Vc_punch,1)} kN &nbsp;·&nbsp; φVc = {f(res.phiVc_punch,1)} kN (φ=0.75)</p>
        </div>

        {/* Floor vibration (Khan §9.2 / SCI P354) */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-[9px] font-bold text-gray-500 uppercase">Vibrasi Lantai — Footfall (Khan §9.2)</p>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-gray-500">ζ redaman</span>
              <input type="number" value={zeta} step={0.005}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setZeta(v); }}
                className="w-16 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
          </div>
          <table className="w-full"><tbody>
            <Row label="δ massa permanen (gross)" value={f(vib.deflection_mm,2)} unit="mm" />
            <Row label="f₀ = 18/√δ (frek. alami)" value={f(vib.f0,2)} unit="Hz" />
            <Row label={`Tipe lantai`} value={vib.isLowFrequency ? "frekuensi-rendah (resonan)" : "frekuensi-tinggi (transien)"} />
            <Row label={`Harmonik pemicu h (α=${f(vib.alphaH,2)})`} value={`${vib.harmonic}`} />
            <Row label="Massa modal" value={f(vib.modalMass,0)} unit="kg" />
            <Row label="a puncak" value={f(vib.accelPeak,3)} unit="m/s²" />
            <Row label="a/g" value={f(vib.accelRatioG,2)} unit="%" />
            <Row label="Faktor respons R" value={f(vib.responseFactor,2)} />
          </tbody></table>
          <div className="mt-0.5">
            <Chk label="Respons R ≤ batas (kantor=8)"
              value={`R=${f(vib.responseFactor,2)}`} limit={`${vib.limitR}`} ok={vib.isOk} />
          </div>
        </div>

        {/* Moment transfer at column (Nilson §10.15, ACI §8.4.2.3) */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-[9px] font-bold text-gray-500 uppercase">Transfer Momen di Kolom (Nilson §10.15)</p>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-gray-500">M_unb</span>
              <input type="number" value={Munb} step={10}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setMunb(v); }}
                className="w-16 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400" />
              <span className="text-[9px] text-gray-400">kN·m</span>
            </div>
          </div>
          <table className="w-full"><tbody>
            <Row label="γ_f (lentur) = 1/(1+⅔√(b1/b2))" value={f(mt.gamma_f,3)} />
            <Row label="γ_v (geser eksentris) = 1−γ_f" value={f(mt.gamma_v,3)} />
            <Row label="M_f pita lentur = γ_f·M_unb" value={f(mt.Mf_band,1)} unit="kN·m" />
            <Row label="v_u langsung = Vu/(bo·d)" value={f(mt.vu_direct,3)} unit="MPa" />
            <Row label="v_u momen = γ_v·M·c/Jc" value={f(mt.vu_moment,3)} unit="MPa" />
            <Row label="v_u gabungan" value={f(mt.vu_combined,3)} unit="MPa" />
          </tbody></table>
          <div className="mt-0.5">
            <Chk label="Geser gabungan v_u ≤ φv_c"
              value={`${f(mt.vu_combined,3)}`} limit={`${f(mt.phi_vc,3)} MPa`} ok={mt.isOk} />
          </div>
        </div>

        {/* Visualization: schematic plan */}
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Sketsa Panel (tendons ditunjukkan)</p>
          <svg viewBox="0 0 200 160" className="w-full max-h-36 border border-gray-200 rounded bg-white">
            {/* Panel outline */}
            <rect x="20" y="20" width="160" height="120" fill="#dbeafe" stroke="#1d4ed8" strokeWidth="1.5" fillOpacity="0.3" />
            {/* X-direction tendons */}
            {[0.25,0.5,0.75].map(f => (
              <line key={f} x1="20" y1={20+120*f} x2="180" y2={20+120*f}
                stroke="#16a34a" strokeWidth="1" strokeDasharray="4,3" />
            ))}
            {/* Y-direction tendons */}
            {[0.3,0.6].map(f => (
              <line key={f} x1={20+160*f} y1="20" x2={20+160*f} y2="140"
                stroke="#7c3aed" strokeWidth="1" strokeDasharray="4,3" />
            ))}
            {/* Column */}
            <rect x="88" y="58" width="24" height="24" fill="#374151" />
            {/* Critical perimeter */}
            <rect x="83" y="53" width="34" height="34" fill="none" stroke="#dc2626" strokeWidth="1" strokeDasharray="3,2" />
            {/* Labels */}
            <text x="100" y="155" fontSize="7" textAnchor="middle" fill="#374151">
              Lx={inp.Lx/1000}m × Ly={inp.Ly/1000}m
            </text>
            <text x="5" y="80" fontSize="6" fill="#16a34a" transform="rotate(-90 5 80)">Pe_x={inp.Pe_x} kN/m</text>
            <text x="30" y="15" fontSize="6" fill="#7c3aed">Pe_y={inp.Pe_y} kN/m</text>
          </svg>
        </div>

      </div>
    </div>
  );
}
