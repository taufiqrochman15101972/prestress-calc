"use client";

import React, { useState, useMemo } from "react";
import { computePile } from "@/engine/pile";
import type { PileInputs, PileShape } from "@/engine/pile";

const DEFAULT: PileInputs = {
  shape: "SQUARE", size: 400, cover: 60,
  fci: 40, fc: 50, fpu: 1860, fpy: 1580, Eps: 197_000,
  nStrands: 8, strandArea: 98.7, jackingRatio: 0.75,
  lengthMm: 12_000, Pu: 500, Mu: 80, Vu: 50,
};

function Lbl({ children }: { children: React.ReactNode }) {
  return <span className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">{children}</span>;
}
function Nf({ label, unit, value, onChange, step = 1, min = 0 }: {
  label: string; unit?: string; value: number; onChange: (v: number) => void; step?: number; min?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <Lbl>{label}</Lbl>
      <div className="relative flex items-center">
        <input type="number" value={value} min={min} step={step}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          className={`w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ${unit ? "pr-9" : ""}`} />
        {unit && <span className="absolute right-2 text-[9px] text-gray-400 pointer-events-none">{unit}</span>}
      </div>
    </div>
  );
}
function Row({ label, value, unit, ok }: { label: string; value: string; unit?: string; ok?: boolean }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-0.5 pr-3 text-gray-500 text-[10px]">{label}</td>
      <td className={`py-0.5 font-mono text-right text-[10px] font-semibold ${ok === false ? "text-red-600" : ok === true ? "text-green-700" : "text-gray-800"}`}>{value}</td>
      {unit && <td className="py-0.5 pl-1 text-gray-400 text-[9px]">{unit}</td>}
    </tr>
  );
}
function Check({ label, value, limit, ok }: { label: string; value: string; limit: string; ok: boolean }) {
  return (
    <div className={`flex justify-between items-center px-2 py-1 rounded text-[10px] my-0.5 border ${ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
      <span>{label}</span>
      <span className="font-mono font-bold">{value} {ok ? "≤" : ">"} {limit}</span>
      <span className="font-bold">{ok ? "✓ OK" : "✗ NG"}</span>
    </div>
  );
}

export function PileCalculator() {
  const [inp, setInp] = useState<PileInputs>(DEFAULT);
  const set = (k: keyof PileInputs, v: number | string) =>
    setInp(prev => ({ ...prev, [k]: v }));

  const res = useMemo(() => computePile(inp), [inp]);
  const { sec } = res;
  const f = (v: number, d = 2) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px] overflow-auto">

      {/* ─ Inputs ─ */}
      <div className="w-52 flex-none space-y-3">
        <div>
          <Lbl>Bentuk Penampang</Lbl>
          <select value={inp.shape} onChange={e => set("shape", e.target.value as PileShape)}
            className="mt-0.5 w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="SQUARE">Persegi (Square)</option>
            <option value="CIRCULAR">Bulat (Circular)</option>
            <option value="OCTAGONAL">Segi-8 (Octagonal)</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label={inp.shape === "CIRCULAR" || inp.shape === "OCTAGONAL" ? "Diameter" : "Sisi b"} unit="mm"
            value={inp.size} onChange={v => set("size", v)} step={50} />
          <Nf label="Cover" unit="mm" value={inp.cover} onChange={v => set("cover", v)} step={5} />
          <Nf label="f'ci" unit="MPa" value={inp.fci} onChange={v => set("fci", v)} />
          <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
          <Nf label="fpu" unit="MPa" value={inp.fpu} onChange={v => set("fpu", v)} step={10} />
          <Nf label="n strand" value={inp.nStrands} onChange={v => set("nStrands", Math.round(v))} min={1} />
          <Nf label="A₁ strand" unit="mm²" value={inp.strandArea} onChange={v => set("strandArea", v)} step={0.1} />
          <Nf label="ρ jacking" value={inp.jackingRatio} onChange={v => set("jackingRatio", v)} step={0.01} min={0.5} />
          <Nf label="Panjang L" unit="mm" value={inp.lengthMm} onChange={v => set("lengthMm", v)} step={500} />
          <div /> {/* spacer */}
        </div>
        <div className="pt-1 border-t border-gray-200">
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Beban Rencana</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="Pu" unit="kN" value={inp.Pu} onChange={v => set("Pu", v)} step={50} />
            <Nf label="Mu" unit="kN·m" value={inp.Mu} onChange={v => set("Mu", v)} step={10} />
            <Nf label="Vu" unit="kN" value={inp.Vu} onChange={v => set("Vu", v)} step={10} />
          </div>
        </div>
      </div>

      {/* ─ Results ─ */}
      <div className="flex-1 space-y-2 min-w-0">

        {/* Section diagram (SVG) */}
        <div className="flex gap-3 items-start">
          <svg width="90" height="90" viewBox="-55 -55 110 110" className="flex-none border border-gray-200 rounded bg-gray-50">
            {inp.shape === "SQUARE" && (
              <rect x={-inp.size/2*0.8} y={-inp.size/2*0.8} width={inp.size*0.8} height={inp.size*0.8}
                fill="#dbeafe" stroke="#1d4ed8" strokeWidth="2" />
            )}
            {inp.shape === "CIRCULAR" && (
              <circle cx="0" cy="0" r={inp.size/2*0.8} fill="#dbeafe" stroke="#1d4ed8" strokeWidth="2" />
            )}
            {inp.shape === "OCTAGONAL" && (
              <polygon
                points={Array.from({length:8},(_,i)=>{
                  const a=(i*45+22.5)*Math.PI/180; const r=inp.size/2*0.75;
                  return `${(r*Math.cos(a)).toFixed(1)},${(r*Math.sin(a)).toFixed(1)}`;
                }).join(" ")}
                fill="#dbeafe" stroke="#1d4ed8" strokeWidth="2" />
            )}
            {/* Strand dots */}
            {Array.from({length: Math.min(inp.nStrands, 16)}, (_,i) => {
              const n = Math.min(inp.nStrands, 16);
              const a = (i / n) * 2 * Math.PI;
              const r = (inp.size/2 - inp.cover) * 0.75;
              return <circle key={i} cx={r*Math.cos(a)} cy={r*Math.sin(a)}
                r={3} fill="#dc2626" />;
            })}
            <text x="0" y="0" textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fill="#374151" fontFamily="monospace">
              {inp.size}mm
            </text>
          </svg>
          <div className="flex-1">
            <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Properti Penampang</p>
            <table className="w-full"><tbody>
              <Row label="A_g" value={f(sec.Ag,0)} unit="mm²" />
              <Row label="I_g" value={`${(sec.Ig/1e8).toFixed(3)}×10⁸`} unit="mm⁴" />
              <Row label="Z_g" value={f(sec.Zg/1e3,1)} unit="×10³ mm³" />
              <Row label="d_p (strands)" value={f(sec.dp,0)} unit="mm" />
            </tbody></table>
          </div>
        </div>

        {/* Prestress */}
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Prategang</p>
          <table className="w-full"><tbody>
            <Row label="A_ps = n × A₁" value={f(res.Aps,1)} unit="mm²" />
            <Row label="f_jack" value={f(res.fjack,1)} unit="MPa" />
            <Row label="P_j" value={f(res.Pj,1)} unit="kN" />
            <Row label="f_se (setelah losses)" value={f(res.fse,1)} unit="MPa" />
            <Row label="P_e efektif" value={f(res.Pe,1)} unit="kN" />
            <Row label="η_loss" value={f(res.etaLoss*100,1)} unit="%" />
          </tbody></table>
        </div>

        {/* Capacity */}
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Kapasitas ULS</p>
          <table className="w-full"><tbody>
            <Row label="P_n0 (aksial murni)" value={f(res.Pn0,1)} unit="kN" />
            <Row label="φP_n0 (φ=0.80)" value={f(res.phiPn0,1)} unit="kN" />
            <Row label="f_ps (lentur)" value={f(res.fps_bending,1)} unit="MPa" />
            <Row label="a (Whitney block)" value={f(res.a_bending,1)} unit="mm" />
            <Row label="M_n nominal" value={f(res.Mn,1)} unit="kN·m" />
            <Row label="φM_n (φ=0.90)" value={f(res.phiMn,1)} unit="kN·m" />
          </tbody></table>
        </div>

        {/* Interaction checks */}
        <div className="space-y-0.5">
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Kontrol</p>
          <Check label="P-M Interaction (Pu/φPn+Mu/φMn)"
            value={f(res.PMRatio,3)} limit="1.000" ok={res.isAdequate} />
          <Check label="Gantung — σ_tarik ≤ 0.50√f'ci"
            value={f(res.sigma_hang_tens,2)+" MPa"} limit={f(res.limitHangTens,2)+" MPa"} ok={res.isHangOk} />
          <Check label="SLS fiber stress"
            value={f(Math.max(res.sigma_bot,res.sigma_top),2)+" MPa"} limit={f(0.5*Math.sqrt(inp.fc),2)+" MPa"} ok={res.isSlsOk} />
        </div>

        {/* Hanging details */}
        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[10px] space-y-0.5">
          <p className="font-bold text-amber-800">Kontrol Pengangkatan (2 titik angkat @ 0.207L)</p>
          <p>w_self = {f(res.wSelf,3)} kN/m · M_hang = {f(res.M_hang,2)} kN·m</p>
          <p>σ_tarik (bawah) = {f(res.sigma_hang_tens,2)} MPa | Batas = {f(res.limitHangTens,2)} MPa</p>
          <p>σ_tekan (atas) = {f(res.sigma_hang_comp,2)} MPa | Batas = {f(res.limitHangComp,2)} MPa</p>
          <p>Batas dinamis pemancangan = {f(res.sigma_drive_limit,2)} MPa (3√f'ci)</p>
        </div>

      </div>
    </div>
  );
}
