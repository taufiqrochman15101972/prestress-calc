"use client";

import React, { useMemo, useState } from "react";
import { computeStrainCompatibility, type SteelLayer } from "@/engine/straincompat";

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
const f = (v: number, d = 1) => (isFinite(v) ? v.toFixed(d) : "—");

export function StrainCompatCalculator() {
  const [s, setS] = useState({
    b: 600, h: 1650, fc: 50,
    psA: 3553, psD: 1500, fpu: 1860, fpy: 1674, Eps: 197000, fse: 1150,
    rcA: 0, rcD: 1560, fy: 420, Es: 200000,
  });
  const set = (k: keyof typeof s, v: number) => setS(p => ({ ...p, [k]: v }));
  const r = useMemo(() => {
    const layers: SteelLayer[] = [{ kind: "PS", A: s.psA, d: s.psD, Eps: s.Eps, fpu: s.fpu, fpy: s.fpy, epsPE: s.fse / s.Eps }];
    if (s.rcA > 0) layers.push({ kind: "RC", A: s.rcA, d: s.rcD, Es: s.Es, fy: s.fy });
    return computeStrainCompatibility({ b: s.b, h: s.h, fc: s.fc, layers });
  }, [s]);

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-60 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Penampang & beton</p>
        <div className="grid grid-cols-3 gap-1.5">
          <Nf label="b" unit="mm" value={s.b} step={50} onChange={v => set("b", v)} />
          <Nf label="h" unit="mm" value={s.h} step={50} onChange={v => set("h", v)} />
          <Nf label="f'c" unit="MPa" value={s.fc} step={5} onChange={v => set("fc", v)} />
        </div>
        <p className="text-[9px] font-bold text-gray-500 uppercase">Tendon prategang (PS)</p>
        <div className="grid grid-cols-3 gap-1.5">
          <Nf label="A_ps" unit="mm²" value={s.psA} step={100} onChange={v => set("psA", v)} />
          <Nf label="d_p" unit="mm" value={s.psD} step={25} onChange={v => set("psD", v)} />
          <Nf label="f_se" unit="MPa" value={s.fse} step={25} onChange={v => set("fse", v)} />
          <Nf label="f_pu" unit="MPa" value={s.fpu} step={30} onChange={v => set("fpu", v)} />
          <Nf label="f_py" unit="MPa" value={s.fpy} step={30} onChange={v => set("fpy", v)} />
          <Nf label="E_ps" unit="MPa" value={s.Eps} step={1000} onChange={v => set("Eps", v)} />
        </div>
        <p className="text-[9px] font-bold text-gray-500 uppercase">Baja lunak (parsial, opsional)</p>
        <div className="grid grid-cols-3 gap-1.5">
          <Nf label="A_s" unit="mm²" value={s.rcA} step={100} onChange={v => set("rcA", v)} />
          <Nf label="d_s" unit="mm" value={s.rcD} step={25} onChange={v => set("rcD", v)} />
          <Nf label="f_y" unit="MPa" value={s.fy} step={20} onChange={v => set("fy", v)} />
        </div>
        <p className="text-[9px] text-gray-400 leading-snug">A_s = 0 → prategang penuh; A_s &gt; 0 → prategang sebagian. Regangan total tendon = prategang efektif (f_se/E_ps) + tambahan kompatibilitas ε_cu(d−c)/c.</p>
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">Kompatibilitas regangan (Naaman) — cari garis netral c</p>
        <table className="w-full max-w-md"><tbody>
          <Row label="β₁" value={f(r.beta1, 3)} />
          <Row label="c garis netral" value={f(r.c, 1)} unit="mm" hi />
          <Row label="a = β₁·c (blok Whitney)" value={f(r.a, 1)} unit="mm" />
          <Row label="C_c = 0,85f'c·b·a" value={f(r.Cc / 1e3, 0)} unit="kN" />
          <Row label="ε_t serat tarik ekstrem" value={f(r.epsT, 4)} hi />
          <Row label="M_n" value={f(r.Mn / 1e6, 0)} unit="kN·m" hi />
          <Row label="φ (kontrol regangan)" value={f(r.phi, 3)} />
          <Row label="φM_n" value={f(r.phiMn / 1e6, 0)} unit="kN·m" hi />
        </tbody></table>
        <div className={`px-2 py-1 rounded text-[10px] border ${r.tensionControlled ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          {r.tensionControlled ? "✓ Tension-controlled (ε_t ≥ 0,005, daktail, φ=0,90)" : "Transisi / compression-controlled (ε_t < 0,005)"}
        </div>
        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Tegangan tiap lapis baja (dari regangan riil)</p>
        <table className="w-full max-w-md text-[10px]"><thead><tr className="text-gray-400 border-b border-gray-200"><th className="text-left">lapis</th><th className="text-right">d (mm)</th><th className="text-right">ε</th><th className="text-right">f (MPa)</th><th className="text-right">gaya (kN)</th></tr></thead>
          <tbody className="font-mono">{r.layers.map((L, i) => (
            <tr key={i} className="border-b border-gray-100"><td>{L.kind}</td><td className="text-right">{f(L.d, 0)}</td><td className="text-right">{f(L.strain, 4)}</td><td className="text-right text-blue-700">{f(L.stress, 0)}</td><td className="text-right">{f(L.force / 1e3, 0)}</td></tr>
          ))}</tbody></table>
        <p className="text-[9px] text-gray-500 leading-snug">f_ps di sini dihitung dari kurva tegangan–regangan tendon pada regangan aktual (bukan rumus aproksimasi). Berlaku sama untuk prategang penuh &amp; sebagian — melengkapi/validasi tab ULS utama.</p>
      </div>
    </div>
  );
}
