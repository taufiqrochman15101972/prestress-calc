"use client";

import React, { useState, useMemo } from "react";
import { computeTensionMember } from "@/engine/tension";
import type { TensionMemberInputs } from "@/engine/tension";

const DEFAULT: TensionMemberInputs = {
  Ac: 300 * 300, Aps: 6 * 98.7, As: 4 * 200,
  fse: 1100, fpu: 1860, fpy: 1580, Ep: 197_000,
  fy: 420, Es: 200_000, fc: 40, L: 9_000,
  N_service: 600, N_ultimate: 950, ctFactor: 0.50,
};

function Nf({ label, unit, value, onChange, step = 1, min = 0 }: {
  label: string; unit?: string; value: number;
  onChange: (v: number) => void; step?: number; min?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-gray-500 leading-tight">{label}</span>
      <div className="relative flex items-center">
        <input type="number" value={value} min={min} step={step}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          className={`w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ${unit ? "pr-9" : ""}`} />
        {unit && <span className="absolute right-1.5 text-[9px] text-gray-400 pointer-events-none">{unit}</span>}
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
function Chk({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`flex justify-between items-center px-2 py-1 rounded text-[10px] my-0.5 border ${ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
      <span>{label}</span>
      <span className="font-mono font-bold">{value}</span>
      <span className="font-bold">{ok ? "✓ OK" : "✗ NG"}</span>
    </div>
  );
}

export function TensionCalculator() {
  const [inp, setInp] = useState<TensionMemberInputs>(DEFAULT);
  const set = (k: keyof TensionMemberInputs, v: number) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const res = useMemo(() => computeTensionMember(inp), [inp]);
  const f = (v: number, d = 1) => v.toFixed(d);

  // Load-stage bar positions (relative to N_n)
  const scale = (n: number) => Math.max(0, Math.min(100, (n / res.N_n) * 100));

  return (
    <div className="flex gap-4 text-[11px]">
      {/* Inputs */}
      <div className="w-56 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Penampang & Baja</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="Ac luas beton" unit="mm²" value={inp.Ac} onChange={v => set("Ac", v)} step={1000} />
            <Nf label="Aps strand" unit="mm²" value={inp.Aps} onChange={v => set("Aps", v)} step={50} />
            <Nf label="As tul. lunak" unit="mm²" value={inp.As} onChange={v => set("As", v)} step={50} />
            <Nf label="L panjang" unit="mm" value={inp.L} onChange={v => set("L", v)} step={500} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Material</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="f_se efektif" unit="MPa" value={inp.fse} onChange={v => set("fse", v)} step={50} />
            <Nf label="fpu" unit="MPa" value={inp.fpu} onChange={v => set("fpu", v)} step={10} />
            <Nf label="fpy" unit="MPa" value={inp.fpy} onChange={v => set("fpy", v)} step={10} />
            <Nf label="fy lunak" unit="MPa" value={inp.fy} onChange={v => set("fy", v)} step={20} />
            <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
            <Nf label="Ep" unit="MPa" value={inp.Ep} onChange={v => set("Ep", v)} step={1000} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Beban Tarik Aksial</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="N layan" unit="kN" value={inp.N_service} onChange={v => set("N_service", v)} step={50} />
            <Nf label="N ultimit" unit="kN" value={inp.N_ultimate} onChange={v => set("N_ultimate", v)} step={50} />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">Nilson §11.7–11.10:</p>
          <p className="text-blue-600 mt-0.5">N_dec = Pe → N_cr = Pe + f_ct·A_tr → N_n = Aps·fpu + As·fy. Kekakuan turun drastis saat retak.</p>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 space-y-2 min-w-0">
        {/* Load-stage bar */}
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Tahapan Beban Aksial (kN)</p>
          <div className="relative h-9 bg-gradient-to-r from-blue-100 via-amber-100 to-red-100 rounded border border-gray-200">
            {[
              { n: res.N_dec, label: "N_dec", color: "#2563eb" },
              { n: res.N_cr, label: "N_cr", color: "#d97706" },
              { n: res.N_n, label: "N_n", color: "#dc2626" },
              { n: inp.N_service, label: "N_svc", color: "#16a34a" },
            ].map(m => (
              <div key={m.label} className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: `${scale(m.n)}%`, transform: "translateX(-50%)" }}>
                <div className="w-0.5 h-5" style={{ background: m.color }} />
                <span className="text-[8px] font-bold" style={{ color: m.color }}>{m.label}</span>
                <span className="text-[7px] text-gray-500">{f(m.n, 0)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <table className="flex-1"><tbody>
            <Row label="Pe = fse·Aps" value={f(res.Pe, 0)} unit="kN" />
            <Row label="f_ct (tarik langsung)" value={f(res.f_ct, 2)} unit="MPa" />
            <Row label="N_dec dekompresi" value={f(res.N_dec, 0)} unit="kN" />
            <Row label="N_cr retak" value={f(res.N_cr, 0)} unit="kN" />
            <Row label="N_n nominal" value={f(res.N_n, 0)} unit="kN" />
            <Row label="φN_n (φ=0.90)" value={f(res.phiN_n, 0)} unit="kN" />
          </tbody></table>
          <table className="flex-1"><tbody>
            <Row label="n_p = Ep/Ec" value={f(res.n_p, 2)} />
            <Row label="AE tak-retak" value={(res.AE_uncracked / 1e6).toFixed(0)} unit="×10⁶ N" />
            <Row label="AE retak" value={(res.AE_cracked / 1e6).toFixed(0)} unit="×10⁶ N" />
            <Row label="Δ layan (elongasi)" value={f(res.elongation_service, 2)} unit="mm" />
            <Row label="fp layan" value={f(res.fp_service, 0)} unit="MPa" />
            <Row label="Status layan" value={res.isUncrackedService ? "Tak-retak" : "Retak"} />
          </tbody></table>
        </div>

        <div className="space-y-0.5">
          <Chk label="Layan tak-retak (N_svc ≤ N_cr)"
            value={`${f(inp.N_service, 0)} ${res.isUncrackedService ? "≤" : ">"} ${f(res.N_cr, 0)} kN`}
            ok={res.isUncrackedService} />
          <Chk label="Kekuatan (φN_n ≥ N_u)"
            value={`${f(res.phiN_n, 0)} ${res.isStrengthOk ? "≥" : "<"} ${f(inp.N_ultimate, 0)} kN`}
            ok={res.isStrengthOk} />
        </div>
      </div>
    </div>
  );
}
