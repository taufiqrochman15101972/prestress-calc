"use client";

import React, { useState, useMemo } from "react";
import { computeFatigue } from "@/engine/fatigue";
import type { FatigueInputs } from "@/engine/fatigue";

const DEFAULT: Required<FatigueInputs> = {
  Mfat: 850, gammaFat: 1.75,
  Ic: 3.729e11, ybc: 1140.5, Zbc: 327.0e6, ePs: 950,
  sigmaPerm: -3.5, fc: 50, np: 5.9, radiusM: 12,
  dsBot: 60, ns: 6.0, fmin: 20,
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

export function FatigueCalculator() {
  const [inp, setInp] = useState<Required<FatigueInputs>>(DEFAULT);
  const set = (k: keyof FatigueInputs, v: number) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const r = useMemo(() => computeFatigue(inp), [inp]);
  const f = (v: number, d = 2) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-60 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Beban Fatik (Fatigue I)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="M truk fatik (+IM 15%)" unit="kN·m" value={inp.Mfat} onChange={v => set("Mfat", v)} step={25} />
            <Nf label="γ Fatigue I" value={inp.gammaFat} onChange={v => set("gammaFat", v)} step={0.05} />
            <Nf label="σ_bot permanen+P_e" unit="MPa" value={inp.sigmaPerm} onChange={v => set("sigmaPerm", v)} step={0.1} />
            <Nf label="f'c layan" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Penampang Komposit & Strand</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="I_c" unit="mm⁴" value={inp.Ic} onChange={v => set("Ic", v)} step={1e10} />
            <Nf label="y_bc" unit="mm" value={inp.ybc} onChange={v => set("ybc", v)} step={10} />
            <Nf label="Z_bc" unit="mm³" value={inp.Zbc} onChange={v => set("Zbc", v)} step={1e6} />
            <Nf label="e_ps di bawah NA" unit="mm" value={inp.ePs} onChange={v => set("ePs", v)} step={25} />
            <Nf label="n_p = E_p/E_c" value={inp.np} onChange={v => set("np", v)} step={0.1} />
            <Nf label="R kelengkungan tendon" unit="m" value={inp.radiusM} onChange={v => set("radiusM", v)} step={0.5} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Tulangan Non-Prategang (0 = lewati)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="d_s dari bawah" unit="mm" value={inp.dsBot} onChange={v => set("dsBot", v)} step={5} />
            <Nf label="n_s = E_s/E_c" value={inp.ns} onChange={v => set("ns", v)} step={0.1} />
            <Nf label="f_min permanen" unit="MPa" value={inp.fmin} onChange={v => set("fmin", v)} step={5} />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
          <p className="font-semibold text-blue-700">AASHTO §5.5.3 (FHWA NHI step 5.6.6):</p>
          <p className="text-blue-600 mt-0.5">Bila σ_bot Fatigue I ≤ 0.25√f'c (tak retak), cek fatik strand digugurkan. Bila tidak: Δf_p ≤ ΔF_TH (125 MPa R&gt;9m … 70 MPa R≤3.6m). Tulangan: ΔF_TH = 166 − 0.33·f_min.</p>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 space-y-2 min-w-0">
        <p className="text-[9px] font-bold uppercase text-gray-400">1 — Saringan Tak-Retak (serat bawah)</p>
        <table className="w-full"><tbody>
          <Row label="σ_bot = σ_perm + γ·M_fat/Z_bc" value={f(r.sigmaFatBot)} unit="MPa" hi />
          <Row label="ambang 0.25·√f'c" value={f(r.screenLimit)} unit="MPa" />
        </tbody></table>
        <Chk label="Penampang tak retak di bawah Fatigue I"
          detail={`${f(r.sigmaFatBot)} ≤ ${f(r.screenLimit)} MPa`} ok={r.uncracked} />

        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">2 — Rentang Tegangan Strand</p>
        <table className="w-full"><tbody>
          <Row label="Δf_p = n_p·γM_fat·e_ps/I_c" value={f(r.dfStrand, 1)} unit="MPa" hi />
          <Row label={`ΔF_TH strand (R = ${inp.radiusM} m)`} value={f(r.thStrand, 0)} unit="MPa" />
        </tbody></table>
        <Chk label={r.uncracked ? "Strand: cek digugurkan (tak retak) — informatif" : "Strand: Δf_p ≤ ΔF_TH"}
          detail={`${f(r.dfStrand, 1)} / ${f(r.thStrand, 0)} MPa`} ok={r.strandOk} />

        {inp.dsBot > 0 && (
          <>
            <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">3 — Rentang Tegangan Tulangan</p>
            <table className="w-full"><tbody>
              <Row label="Δf_s = n_s·γM_fat·(y_bc−d_s)/I_c" value={f(r.dfRebar, 1)} unit="MPa" hi />
              <Row label="ΔF_TH = 166 − 0.33·f_min" value={f(r.thRebar, 1)} unit="MPa" />
            </tbody></table>
            <Chk label="Tulangan: Δf_s ≤ ΔF_TH" detail={`${f(r.dfRebar, 1)} ≤ ${f(r.thRebar, 1)} MPa`} ok={r.rebarOk} />
          </>
        )}

        <div className={`rounded px-2 py-1.5 text-[10px] border ${r.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
          {r.ok
            ? "Limit state FATIK terpenuhi — rentang tegangan di bawah ambang amplitudo-konstan."
            : "Limit state FATIK TIDAK terpenuhi — perbesar prategang efektif (agar tetap tak retak) atau perbesar penampang/kurangi rentang tegangan."}
        </div>
      </div>
    </div>
  );
}
