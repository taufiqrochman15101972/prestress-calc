"use client";

import React, { useMemo, useState } from "react";
import { designShellReinf, type ShellForces } from "@/engine/shellreinf";

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
const f = (v: number, d = 0) => (isFinite(v) ? v.toFixed(d) : "—");

export function ShellReinfCalculator() {
  const [s, setS] = useState<ShellForces>({ nx: 300, ny: 150, nxy: 120, mx: 8e5, my: 4e5, mxy: 2e5, t: 250, cover: 35, fy: 420 });
  const set = (k: keyof ShellForces, v: number) => setS(p => ({ ...p, [k]: v }));
  const r = useMemo(() => designShellReinf(s), [s]);

  return (
    <div className="flex gap-4 text-[11px]">
      <div className="w-56 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Resultan tegangan shell (8)</p>
        <div className="grid grid-cols-3 gap-1.5">
          <Nf label="n_x" unit="N/mm" value={s.nx} step={50} onChange={v => set("nx", v)} />
          <Nf label="n_y" unit="N/mm" value={s.ny} step={50} onChange={v => set("ny", v)} />
          <Nf label="n_xy" unit="N/mm" value={s.nxy} step={50} onChange={v => set("nxy", v)} />
          <Nf label="m_x" unit="N·mm/mm" value={s.mx} step={1e5} onChange={v => set("mx", v)} />
          <Nf label="m_y" unit="N·mm/mm" value={s.my} step={1e5} onChange={v => set("my", v)} />
          <Nf label="m_xy" unit="N·mm/mm" value={s.mxy} step={1e5} onChange={v => set("mxy", v)} />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Nf label="t" unit="mm" value={s.t} step={10} onChange={v => set("t", v)} />
          <Nf label="cover" unit="mm" value={s.cover} step={5} onChange={v => set("cover", v)} />
          <Nf label="f_y" unit="MPa" value={s.fy} step={20} onChange={v => set("fy", v)} />
        </div>
        <p className="text-[9px] text-gray-400 leading-snug">Metode sandwich (IASS Medwadowski-Samartin + Baumann/CEB): shell diganti 2 lapis baja di lengan z=t−2c; tiap muka didesain untuk triad membran (n ± m/z) dgn aturan As·fy=n+|n_xy| (tekan dipangkas).</p>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">Tulangan perlu (mm²/m) — z = {f(r.z, 0)} mm</p>
        <table className="w-full max-w-md"><tbody>
          <Row label="Muka BAWAH — As_x" value={f(r.bottom.Asx)} unit="mm²/m" hi />
          <Row label="Muka BAWAH — As_y" value={f(r.bottom.Asy)} unit="mm²/m" hi />
          <Row label="Muka ATAS — As_x" value={f(r.top.Asx)} unit="mm²/m" hi />
          <Row label="Muka ATAS — As_y" value={f(r.top.Asy)} unit="mm²/m" hi />
          <Row label="Total As_x (2 muka)" value={f(r.AsxTotal)} unit="mm²/m" />
          <Row label="Total As_y (2 muka)" value={f(r.AsyTotal)} unit="mm²/m" />
        </tbody></table>
        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Gaya membran per muka (N/mm)</p>
        <table className="w-full max-w-md"><tbody>
          <Row label="Bawah n_x / n_y / n_xy" value={`${f(r.bottom.nx)} / ${f(r.bottom.ny)} / ${f(r.bottom.nxy)}`} />
          <Row label="Atas n_x / n_y / n_xy" value={`${f(r.top.nx)} / ${f(r.top.ny)} / ${f(r.top.nxy)}`} />
        </tbody></table>
        <p className="text-[9px] text-gray-500 leading-snug">Resultan diambil dari solver shell (tab ▣) per elemen. Hasil mm²/m → pilih Ø &amp; spasi (mis. D16-150 = 1340 mm²/m).</p>
      </div>
    </div>
  );
}
