"use client";

import React, { useState, useMemo } from "react";
import { computeFireResistance } from "@/engine/fireresistance";
import type { FireInputs, Aggregate } from "@/engine/fireresistance";

const DEFAULT: FireInputs = {
  rating: 2, aggregate: "CARBONATE", isSlab: false, thickness: 1650, cover: 64, restrained: false,
  Aps: 3553, fpu: 1860, dp: 1730, b: 2100, fc: 50, Mfire: 6500, strandTemp: 0,
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

export function FireResistanceCalculator() {
  const [inp, setInp] = useState<FireInputs>(DEFAULT);
  const set = (k: keyof FireInputs, v: number | string | boolean) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const res = useMemo(() => computeFireResistance(inp), [inp]);
  const f = (v: number, d = 1) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-56 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Rating & Geometri</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="rating" unit="jam" value={inp.rating} onChange={v => set("rating", v)} step={0.5} />
            <Nf label="tebal/tinggi" unit="mm" value={inp.thickness} onChange={v => set("thickness", v)} step={25} />
            <Nf label="cover ke strand" unit="mm" value={inp.cover} onChange={v => set("cover", v)} step={5} />
            <Nf label="θ_s strand (0=auto)" unit="°C" value={inp.strandTemp} onChange={v => set("strandTemp", v)} step={25} />
          </div>
          <div className="mt-1.5 space-y-1">
            <select value={inp.aggregate}
              onChange={ev => set("aggregate", ev.target.value as Aggregate)}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="SILICEOUS">Agregat silika (siliceous)</option>
              <option value="CARBONATE">Agregat karbonat</option>
              <option value="LIGHTWEIGHT">Beton ringan (lightweight)</option>
            </select>
            <label className="flex items-center gap-1.5 text-[10px] text-gray-600">
              <input type="checkbox" checked={inp.isSlab} onChange={e => set("isSlab", e.target.checked)} /> Pelat (bukan balok)
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-gray-600">
              <input type="checkbox" checked={inp.restrained} onChange={e => set("restrained", e.target.checked)} /> Restrained (kontinuitas)
            </label>
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Kekuatan saat Kebakaran</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="A_ps" unit="mm²" value={inp.Aps} onChange={v => set("Aps", v)} step={100} />
            <Nf label="f_pu" unit="MPa" value={inp.fpu} onChange={v => set("fpu", v)} step={20} />
            <Nf label="d_p" unit="mm" value={inp.dp} onChange={v => set("dp", v)} step={25} />
            <Nf label="b" unit="mm" value={inp.b} onChange={v => set("b", v)} step={50} />
            <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
            <Nf label="M_fire (1.0D+1.0L)" unit="kN·m" value={inp.Mfire} onChange={v => set("Mfire", v)} step={100} />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">PCI Ch.10 / Abeles §16 / ACI 216:</p>
          <p className="text-blue-600 mt-0.5">Cek (1) tebal & cover min per rating; (2) kekuatan: f_pu,θ = k_θ·f_pu (turun dgn suhu), M_n,θ ≥ M_fire.</p>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 space-y-2 min-w-0">
        {/* Section + heat sketch */}
        <div className="flex gap-3">
          <svg width="150" height="92" viewBox="0 0 150 92" className="flex-none border border-gray-200 rounded bg-gray-50">
            {/* heat gradient bottom */}
            <defs>
              <linearGradient id="fr_grad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#f87171" /><stop offset="55%" stopColor="#fdba74" /><stop offset="100%" stopColor="#bfdbfe" />
              </linearGradient>
            </defs>
            <rect x="30" y="10" width="90" height="62" fill="url(#fr_grad)" stroke="#475569" />
            {/* strand */}
            <circle cx="75" cy={72 - Math.min(inp.cover / 12, 40)} r="3" fill="#111827" />
            <text x="80" y={75 - Math.min(inp.cover / 12, 40)} fontSize="6" fill="#111827">strand</text>
            {/* fire arrows */}
            {[42, 60, 78, 96, 108].map((x, i) => (
              <line key={i} x1={x} y1="86" x2={x} y2="74" stroke="#dc2626" strokeWidth="1.4" markerEnd="url(#fr_ar)" />
            ))}
            <text x="44" y="92" fontSize="7" fill="#dc2626" fontWeight="bold">api ({f(inp.rating, 1)} jam)</text>
            <text x="34" y="22" fontSize="6" fill="#1e3a8a">dingin</text>
            <defs>
              <marker id="fr_ar" markerWidth="6" markerHeight="6" refX="3" refY="0" orient="auto"><path d="M0,6 L6,6 L3,0 Z" fill="#dc2626" /></marker>
            </defs>
          </svg>
          <table className="flex-1"><tbody>
            <Row label="tebal min perlu" value={f(res.reqThickness, 0)} unit="mm" />
            <Row label="cover min perlu" value={f(res.reqCover, 0)} unit="mm" hi />
            <Row label="θ_s strand dipakai" value={f(res.strandTempUsed, 0)} unit="°C" />
            <Row label="k_θ retensi kekuatan" value={f(res.kTheta, 3)} hi />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Kapasitas Lentur saat Kebakaran</p>
          <table className="w-full"><tbody>
            <Row label="f_pu,θ = k_θ·f_pu" value={f(res.fpuTheta, 0)} unit="MPa" />
            <Row label="a blok (saat api)" value={f(res.aTheta, 1)} unit="mm" />
            <Row label="M_n,θ kapasitas api" value={f(res.MnFire, 0)} unit="kN·m" hi />
            <Row label="M_fire / M_n,θ" value={f(res.demandCapacityRatio, 3)} hi />
          </tbody></table>
        </div>

        <div className="space-y-0.5">
          <Chk label="Tebal ≥ tebal min rating" value={`${f(inp.thickness, 0)} ${res.thicknessOk ? "≥" : "<"} ${f(res.reqThickness, 0)}`} ok={res.thicknessOk} />
          <Chk label="Cover ≥ cover min rating" value={`${f(inp.cover, 0)} ${res.coverOk ? "≥" : "<"} ${f(res.reqCover, 0)}`} ok={res.coverOk} />
          <Chk label="Kekuatan M_n,θ ≥ M_fire" value={`rasio ${f(res.demandCapacityRatio, 2)}`} ok={res.strengthOk} />
        </div>
        <p className="text-[9px] text-gray-400">{res.note}</p>
      </div>
    </div>
  );
}
