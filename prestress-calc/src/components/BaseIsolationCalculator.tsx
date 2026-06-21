"use client";

import React, { useMemo, useState } from "react";
import { computeBaseIsolation, type IsolationInputs } from "@/engine/baseisolation";

function Nf({ label, unit, value, onChange, step = 1 }: { label: string; unit?: string; value: number; onChange: (v: number) => void; step?: number; }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-gray-500 leading-tight">{label}</span>
      <div className="relative flex items-center">
        <input type="number" value={value} step={step} onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          className={`w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ${unit ? "pr-9" : ""}`} />
        {unit && <span className="absolute right-1.5 text-[9px] text-gray-400 pointer-events-none">{unit}</span>}
      </div>
    </div>
  );
}
function Row({ label, value, unit, hi }: { label: string; value: string; unit?: string; hi?: boolean }) {
  return <tr className="border-b border-gray-100"><td className="py-0.5 pr-3 text-gray-500 text-[10px]">{label}</td><td className={`py-0.5 font-mono text-right text-[10px] font-semibold ${hi ? "text-blue-700" : "text-gray-800"}`}>{value}</td>{unit && <td className="py-0.5 pl-1 text-gray-400 text-[9px]">{unit}</td>}</tr>;
}
const f = (v: number, d = 2) => (isFinite(v) ? v.toFixed(d) : "—");

export function BaseIsolationCalculator() {
  const [i, setI] = useState<IsolationInputs>({ W: 5000, Kiso: 8000, zetaIso: 0.15, Tfixed: 0.5, SDS: 0.8, SD1: 0.4 });
  const set = (k: keyof IsolationInputs, v: number) => setI(p => ({ ...p, [k]: v }));
  const r = useMemo(() => computeBaseIsolation(i), [i]);

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-56 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Isolasi Dasar & Damper (AASHTO/SNI)</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="W berat seismik" unit="kN" value={i.W} step={250} onChange={v => set("W", v)} />
          <Nf label="K_iso sistem" unit="kN/m" value={i.Kiso} step={500} onChange={v => set("Kiso", v)} />
          <Nf label="ζ_iso redaman" value={i.zetaIso} step={0.05} onChange={v => set("zetaIso", v)} />
          <Nf label="T jepit (fixed)" unit="s" value={i.Tfixed} step={0.05} onChange={v => set("Tfixed", v)} />
          <Nf label="S_DS" unit="g" value={i.SDS} step={0.05} onChange={v => set("SDS", v)} />
          <Nf label="S_D1" unit="g" value={i.SD1} step={0.05} onChange={v => set("SD1", v)} />
        </div>
        <p className="text-[9px] text-gray-400 leading-snug">Lapisan isolasi memperpanjang perioda → menjauh dari resonansi gempa → gaya geser dasar turun, ditebus perpindahan isolator besar. Faktor redaman B=(ζ/0,05)^0,3.</p>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">Hasil isolasi</p>
        <table className="w-full max-w-md"><tbody>
          <Row label="T_iso perioda terisolasi" value={f(r.Tiso, 3)} unit="s" hi />
          <Row label="B faktor redaman" value={f(r.B, 3)} />
          <Row label="Sa jepit (fixed-base)" value={f(r.SaFixed, 3)} unit="g" />
          <Row label="Sa terisolasi (÷B)" value={f(r.SaIso, 3)} unit="g" hi />
          <Row label="V jepit (fixed-base)" value={f(r.Vfixed, 0)} unit="kN" />
          <Row label="V terisolasi" value={f(r.Viso, 0)} unit="kN" hi />
          <Row label="reduksi geser dasar" value={f(r.reductionPct, 1)} unit="%" hi />
          <Row label="d_iso perpindahan isolator" value={f(r.dIso, 1)} unit="mm" hi />
        </tbody></table>
        <div className={`px-2 py-1 rounded text-[10px] border ${r.reductionPct > 0 ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          {r.reductionPct > 0 ? `✓ Isolasi mengurangi geser dasar ${f(r.reductionPct, 0)}% (T: ${f(i.Tfixed, 2)}→${f(r.Tiso, 2)} s)` : "Isolasi belum efektif — perlu K_iso lebih kecil (perioda lebih panjang)"}
        </div>
        <p className="text-[9px] text-gray-500 leading-snug">Setara desain isolator/damper MIDAS/Robot. Perpindahan isolator d_iso menjadi dasar pemilihan LRB/HDRB/FPS dan celah (gap) bangunan.</p>
      </div>
    </div>
  );
}
