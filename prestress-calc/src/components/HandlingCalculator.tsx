"use client";

import React, { useState, useMemo } from "react";
import { computeHandling } from "@/engine/handling";
import type { HandlingInputs } from "@/engine/handling";
import { checkDebondLimits } from "@/engine/development";

const DEFAULT: HandlingInputs = {
  L: 30, w: 13.4, A: 5.35e5, Ztop: 2.016e8, Zbot: 2.305e8, fci: 35,
  Pi: 3900, e: 620, liftRatio: 0.207,
  impStrip: 1.2, impTransport: 1.5, impErection: 1.2,
  camberPi: 55, deflWi: 28, deflSdl: 9, deflTopping: 12, composite: true,
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

export function HandlingCalculator() {
  const [inp, setInp] = useState<HandlingInputs>(DEFAULT);
  const set = (k: keyof HandlingInputs, v: number | boolean) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const res = useMemo(() => computeHandling(inp), [inp]);
  const f = (v: number, d = 1) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-56 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Komponen & Pengangkatan</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="L" unit="m" value={inp.L} onChange={v => set("L", v)} step={1} />
            <Nf label="w sw" unit="kN/m" value={inp.w} onChange={v => set("w", v)} step={0.5} />
            <Nf label="A" unit="mm²" value={inp.A} onChange={v => set("A", v)} step={1e4} />
            <Nf label="P_i" unit="kN" value={inp.Pi} onChange={v => set("Pi", v)} step={100} />
            <Nf label="Z_top" unit="mm³" value={inp.Ztop} onChange={v => set("Ztop", v)} step={1e7} />
            <Nf label="Z_bot" unit="mm³" value={inp.Zbot} onChange={v => set("Zbot", v)} step={1e7} />
            <Nf label="e" unit="mm" value={inp.e} onChange={v => set("e", v)} step={25} />
            <Nf label="f'ci" unit="MPa" value={inp.fci} onChange={v => set("fci", v)} />
            <Nf label="rasio titik angkat" value={inp.liftRatio} onChange={v => set("liftRatio", v)} step={0.01} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Faktor Impak per Tahap</p>
          <div className="grid grid-cols-3 gap-1.5">
            <Nf label="stripping" value={inp.impStrip} onChange={v => set("impStrip", v)} step={0.1} />
            <Nf label="transport" value={inp.impTransport} onChange={v => set("impTransport", v)} step={0.1} />
            <Nf label="ereksi" value={inp.impErection} onChange={v => set("impErection", v)} step={0.1} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Camber Jangka Panjang (PCI)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="camber prategang ↑" unit="mm" value={inp.camberPi} onChange={v => set("camberPi", v)} step={5} />
            <Nf label="lendut sw ↓" unit="mm" value={inp.deflWi} onChange={v => set("deflWi", v)} step={2} />
            <Nf label="lendut SDL ↓" unit="mm" value={inp.deflSdl} onChange={v => set("deflSdl", v)} step={1} />
            <Nf label="lendut topping ↓" unit="mm" value={inp.deflTopping} onChange={v => set("deflTopping", v)} step={1} />
          </div>
          <label className="flex items-center gap-1.5 mt-1.5 text-[10px] text-gray-600">
            <input type="checkbox" checked={inp.composite} onChange={e => set("composite", e.target.checked)} />
            Ada topping komposit
          </label>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">PCI Handbook Ch.8 + multipliers:</p>
          <p className="text-blue-600 mt-0.5">2 titik angkat di a=ratio·L; M_sup=−w·a²/2, M_mid=w·L1²/8−w·a²/2. Camber: erection 1.80/1.85; final 2.45/2.70/3.00 (atau +topping 2.20/2.40/2.30).</p>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 space-y-2 min-w-0">
        {/* Lifting sketch */}
        <div className="flex gap-3">
          <svg width="210" height="76" viewBox="0 0 210 76" className="flex-none border border-gray-200 rounded bg-gray-50">
            {/* member */}
            <rect x="12" y="30" width="186" height="10" fill="#bfdbfe" stroke="#1d4ed8" />
            {/* lift points */}
            {(() => { const lx = 12 + 186 * inp.liftRatio; const rx = 12 + 186 * (1 - inp.liftRatio); return (
              <>
                <line x1={lx} y1="14" x2={lx} y2="30" stroke="#16a34a" strokeWidth="2" />
                <line x1={rx} y1="14" x2={rx} y2="30" stroke="#16a34a" strokeWidth="2" />
                <circle cx={lx} cy="14" r="3" fill="#16a34a" /><circle cx={rx} cy="14" r="3" fill="#16a34a" />
                <text x={lx - 6} y="11" fontSize="6" fill="#16a34a">angkat</text>
              </>
            ); })()}
            {/* camber curve (upward) */}
            <path d="M12,40 Q105,52 198,40" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3 2" />
            <text x="70" y="64" fontSize="7" fill="#dc2626">camber ↑</text>
            <text x="20" y="58" fontSize="7" fill="#475569">a = {f(res.a, 2)} m</text>
          </svg>
          <table className="flex-1"><tbody>
            <Row label="a overhang" value={f(res.a, 2)} unit="m" />
            <Row label="L1 antar-angkat" value={f(res.L1, 2)} unit="m" />
            <Row label="impak menentukan" value={f(res.impact, 2)} hi />
            <Row label="M_support (hogging)" value={f(res.Msupport, 1)} unit="kN·m" />
            <Row label="M_mid (sagging)" value={f(res.Mmid, 1)} unit="kN·m" />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Tegangan Serat saat Handling</p>
          <table className="w-full"><tbody>
            <Row label="σ_top mid / σ_bot mid" value={`${f(res.sigmaTopMid, 2)} / ${f(res.sigmaBotMid, 2)}`} unit="MPa" />
            <Row label="σ_top sup / σ_bot sup" value={`${f(res.sigmaTopSup, 2)} / ${f(res.sigmaBotSup, 2)}`} unit="MPa" />
            <Row label="batas tarik / tekan" value={`${f(res.limTens, 2)} / ${f(res.limComp, 2)}`} unit="MPa" />
          </tbody></table>
        </div>

        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-0.5">Camber Jangka Panjang (PCI Multipliers)</p>
          <table className="w-full"><tbody>
            <Row label="Camber saat ereksi" value={f(res.camberErection, 1)} unit="mm ↑" hi />
            <Row label={res.camberFinal >= 0 ? "Camber final" : "Lendutan final"}
              value={`${f(Math.abs(res.camberFinal), 1)} ${res.camberFinal >= 0 ? "↑" : "↓"}`} unit="mm" hi />
            <Row label="set multiplier" value="" />
          </tbody></table>
          <p className="text-[9px] text-gray-400 mt-0.5">{res.multiplierSet}</p>
        </div>

        <Chk label="Tegangan handling dalam batas (semua tahap)"
          value={`σ ∈ [${f(res.limComp, 1)}, ${f(res.limTens, 1)}] MPa`} ok={res.handlingOk} />

        <DebondBlock />
      </div>
    </div>
  );
}

// ── Debonding (shielding) strand di ujung — batas AASHTO §5.9.4.3.3 ──
// Alternatif pengangkatan/harping untuk menurunkan tegangan transfer di
// ujung: sebagian strand dibungkus (bond-break). Batas: ≤25% dari total
// dan ≤40% per baris (pola "middle break" pada design-flow FDOT LRFD).
function DebondBlock() {
  const [nTotal, setNTotal] = useState(36);
  const [nDeb, setNDeb] = useState(8);
  const [nRow, setNRow] = useState(12);
  const [nDebRow, setNDebRow] = useState(4);
  const r = useMemo(() => checkDebondLimits(nDeb, nTotal, nDebRow, nRow),
    [nDeb, nTotal, nDebRow, nRow]);

  return (
    <div className="border-t border-gray-200 pt-2">
      <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">
        Debonding / Shielding Strand Ujung (AASHTO §5.9.4.3.3 — alternatif harping)
      </p>
      <div className="flex gap-3 items-start">
        <div className="w-44 flex-none grid grid-cols-2 gap-1.5">
          <Nf label="Strand total" value={nTotal} onChange={setNTotal} step={2} />
          <Nf label="Debonded total" value={nDeb} onChange={setNDeb} step={2} />
          <Nf label="Strand baris kritis" value={nRow} onChange={setNRow} step={2} />
          <Nf label="Debonded di baris" value={nDebRow} onChange={setNDebRow} step={2} />
        </div>
        <div className="flex-1">
          <Chk label="Debonded ≤ 25% total" value={`${r.pctTotal.toFixed(1)}%`} ok={r.totalOk} />
          <Chk label="Debonded ≤ 40% per baris" value={`${r.pctRow.toFixed(1)}%`} ok={r.rowOk} />
          <p className="text-[9px] text-gray-400 mt-1 leading-snug">
            Putus-rekat simetris terhadap sumbu, diakhiri bertahap (staggered), tidak boleh
            sampai daerah tengah bentang; ℓ_t dihitung dari titik akhir shielding.
          </p>
        </div>
      </div>
    </div>
  );
}
