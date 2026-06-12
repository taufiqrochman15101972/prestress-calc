"use client";

import React, { useState, useMemo } from "react";
import { computeCurvedTendon } from "@/engine/curvedtendon";
import type { CurvedTendonInputs } from "@/engine/curvedtendon";

const DEFAULT: CurvedTendonInputs = {
  Pu: 3500, R: 8, cover: 75, ductOD: 90, webThickness: 350,
  fci: 35, fy: 420, tieSpacing: 150,
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
function Badge({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {ok ? yes : no}
    </span>
  );
}

export function CurvedTendonCalculator() {
  const [inp, setInp] = useState<CurvedTendonInputs>(DEFAULT);
  const set = (k: keyof CurvedTendonInputs, v: number) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const res = useMemo(() => computeCurvedTendon(inp), [inp]);
  const f = (v: number, d = 2) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-56 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Tendon & Kelengkungan</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="P_u terfaktor" unit="kN" value={inp.Pu} onChange={v => set("Pu", v)} step={100} />
            <Nf label="R kelengkungan" unit="m" value={inp.R} onChange={v => set("R", v)} step={0.5} />
            <Nf label="Ø duct (luar)" unit="mm" value={inp.ductOD} onChange={v => set("ductOD", v)} step={5} />
            <Nf label="Cover ke duct d_c" unit="mm" value={inp.cover} onChange={v => set("cover", v)} step={5} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Web & Material</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="Tebal web b_w" unit="mm" value={inp.webThickness} onChange={v => set("webThickness", v)} step={25} />
            <Nf label="f'ci saat stressing" unit="MPa" value={inp.fci} onChange={v => set("fci", v)} />
            <Nf label="f_y sengkang" unit="MPa" value={inp.fy} onChange={v => set("fy", v)} step={20} />
            <Nf label="Jarak tieback s" unit="mm" value={inp.tieSpacing} onChange={v => set("tieSpacing", v)} step={25} />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">Stone & Breen CTR 208-3F / AASHTO §5.9.5.4.3:</p>
          <p className="text-blue-600 mt-0.5">F_in = P_u/R (radial sebidang); F_out = P_u/(π·R) (multistrand flattening). Cover menahan via geser 2 bidang pada d_eff = d_c + Ø/4; bila gagal → tieback memikul penuh.</p>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex gap-3">
          {/* plan view: curved duct in the web with radial arrows */}
          <svg width="170" height="110" viewBox="0 0 170 110" className="flex-none border border-gray-200 rounded bg-gray-50">
            {/* web (plan strip) */}
            <rect x="20" y="30" width="130" height="50" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="0.8" />
            {/* curved duct */}
            <path d="M 22 70 Q 85 38 148 70" fill="none" stroke="#1d4ed8" strokeWidth="6" opacity="0.35" />
            <path d="M 22 70 Q 85 38 148 70" fill="none" stroke="#1d4ed8" strokeWidth="1.2" strokeDasharray="4 2" />
            {/* radial arrows toward cover (top) */}
            {[55, 85, 115].map(x => {
              const y = x === 85 ? 52 : 57;
              return (
                <g key={x}>
                  <line x1={x} y1={y} x2={x} y2={y - 16} stroke="#dc2626" strokeWidth="1.2" />
                  <polygon points={`${x - 2.5},${y - 13} ${x + 2.5},${y - 13} ${x},${y - 18}`} fill="#dc2626" />
                </g>
              );
            })}
            <text x="62" y="26" fontSize="6.5" fill="#dc2626">F = P_u/R → cover</text>
            <text x="24" y="90" fontSize="6" fill="#6b7280">web (denah) · duct melengkung R</text>
            <text x="24" y="100" fontSize="6" fill="#1d4ed8">tendon multistrand</text>
          </svg>
          <table className="flex-1"><tbody>
            <Row label="F_in = P_u/R (sebidang)" value={f(res.Fin, 1)} unit="kN/m" hi />
            <Row label="F_out = P_u/(π·R)" value={f(res.Fout, 1)} unit="kN/m" />
            <Row label="d_eff = d_c + Ø/4" value={f(res.dEff, 0)} unit="mm" />
            <Row label="V_r cover (2 bidang geser)" value={f(res.Vr, 1)} unit="kN/m" hi />
            <Row label="σ lentur lateral web" value={f(res.sigmaWebBend, 2)} unit="MPa" />
          </tbody></table>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded border border-gray-200 p-2 text-center">
            <p className="text-[9px] text-gray-500">Sebidang F_in ≤ V_r</p>
            <Badge ok={res.inPlaneOk} yes="COVER CUKUP" no="PERLU TIEBACK" />
          </div>
          <div className="rounded border border-gray-200 p-2 text-center">
            <p className="text-[9px] text-gray-500">Luar bidang F_out ≤ V_r</p>
            <Badge ok={res.outPlaneOk} yes="AMAN" no="SPLITTING" />
          </div>
          <div className="rounded border border-gray-200 p-2 text-center">
            <p className="text-[9px] text-gray-500">R ≥ R_min {f(res.Rmin, 0)} m</p>
            <Badge ok={res.radiusOk} yes="OK" no="PAKAI DEVIATOR" />
          </div>
        </div>

        {!res.inPlaneOk && (
          <div>
            <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Tulangan Tieback (memikul F_in penuh)</p>
            <table className="w-full"><tbody>
              <Row label="A_s perlu per meter" value={f(res.AsPerM, 0)} unit="mm²/m" hi />
              <Row label={`A_s per sengkang @ s=${inp.tieSpacing} mm`} value={f(res.AsPerTie, 0)} unit="mm²" hi />
            </tbody></table>
          </div>
        )}

        <div className={`rounded px-2 py-1.5 text-[10px] border ${res.inPlaneOk && res.outPlaneOk && res.radiusOk ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
          {res.inPlaneOk && res.outPlaneOk && res.radiusOk
            ? "Cover beton sendiri mampu menahan gaya radial tendon melengkung — tanpa tulangan tieback khusus."
            : "Gaya radial tendon melengkung melebihi kapasitas cover — pasang tieback/sengkang pengekang sepanjang kurva (mekanisme multistrand side-face, Stone & Breen), atau perbesar R / pindahkan ke deviator eksternal."}
        </div>
      </div>
    </div>
  );
}
