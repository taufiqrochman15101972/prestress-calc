"use client";

import React, { useState, useMemo } from "react";
import {
  yieldLineRect, beamCollapse, effectivenessFactor, boundCharacter,
  type BeamRestraint, type BeamLoad,
} from "@/engine/limitanalysis";

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
const f = (v: number, d = 2) => (isFinite(v) ? v.toFixed(d) : "—");

export function LimitAnalysisCalculator() {
  // ── Yield-line slab ──
  const [s, setS] = useState({ Lx: 5, Ly: 7, m: 20, i: 0.5 });
  const sS = (k: keyof typeof s, v: number) => setS(p => ({ ...p, [k]: v }));
  const yl = useMemo(() => yieldLineRect(s), [s]);

  // ── Plastic beam collapse ──
  const [b, setB] = useState({ Mp: 150, L: 8, MpSupport: 150 });
  const [restraint, setRestraint] = useState<BeamRestraint>("FIXED");
  const [load, setLoad] = useState<BeamLoad>("UDL");
  const sB = (k: keyof typeof b, v: number) => setB(p => ({ ...p, [k]: v }));
  const bc = useMemo(
    () => beamCollapse({ ...b, restraint, load }),
    [b, restraint, load]);

  // ── Effectiveness factor ──
  const [e, setE] = useState({ fc: 35, bw: 300, z: 500, theta: 45 });
  const sE = (k: keyof typeof e, v: number) => setE(p => ({ ...p, [k]: v }));
  const ef = useMemo(() => effectivenessFactor(e), [e]);

  // yield-line pattern sketch (SVG): rectangle with corner fans + central ridge
  const W = 260, H = 190, pad = 24;
  const aw = W - 2 * pad, ah = H - 2 * pad;
  const rr = s.Lx / s.Ly;
  // draw with Lx vertical (short), Ly horizontal (long) — scale to box
  const longHoriz = s.Ly >= s.Lx;
  const boxW = longHoriz ? aw : aw * rr;
  const boxH = longHoriz ? aw * rr : aw;
  const x0 = pad + (aw - boxW) / 2, y0 = pad + (ah - boxH) / 2;
  // projection p ≈ (short/2)·tan; ridge along long dir
  const proj = Math.min(0.5, rr / 2) * (longHoriz ? boxW : boxH);
  const cx1 = x0 + (longHoriz ? proj : boxW / 2);
  const cx2 = x0 + (longHoriz ? boxW - proj : boxW / 2);
  const cy1 = y0 + (longHoriz ? boxH / 2 : proj);
  const cy2 = y0 + (longHoriz ? boxH / 2 : boxH - proj);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* Left: inputs */}
      <div className="w-60 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Garis-leleh pelat persegi (Johansen)</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="L_x bentang pendek" unit="m" value={s.Lx} step={0.5} onChange={v => sS("Lx", v)} />
          <Nf label="L_y bentang panjang" unit="m" value={s.Ly} step={0.5} onChange={v => sS("Ly", v)} />
          <Nf label="m (momen bawah)" unit="kNm/m" value={s.m} step={1} onChange={v => sS("m", v)} />
          <Nf label="i = m'/m (tepi menerus)" value={s.i} step={0.25} onChange={v => sS("i", v)} />
        </div>

        <p className="text-[9px] font-bold text-gray-500 uppercase pt-1">Runtuh plastis balok</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="M_p bentang" unit="kNm" value={b.Mp} step={10} onChange={v => sB("Mp", v)} />
          <Nf label="M_p tumpuan" unit="kNm" value={b.MpSupport} step={10} onChange={v => sB("MpSupport", v)} />
          <Nf label="L bentang" unit="m" value={b.L} step={0.5} onChange={v => sB("L", v)} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-medium text-gray-500">Perletakan</span>
            <select value={restraint} onChange={ev => setRestraint(ev.target.value as BeamRestraint)}
              className="w-full rounded border border-gray-300 bg-white px-1 py-1 text-[10px]">
              <option value="SS">Tumpuan sederhana</option>
              <option value="PROPPED">Kantilever-prop (1 jepit)</option>
              <option value="FIXED">Jepit-jepit</option>
            </select>
          </div>
          <div className="flex flex-col gap-0.5 col-span-2">
            <span className="text-[9px] font-medium text-gray-500">Beban</span>
            <select value={load} onChange={ev => setLoad(ev.target.value as BeamLoad)}
              className="w-full rounded border border-gray-300 bg-white px-1 py-1 text-[10px]">
              <option value="UDL">Merata (UDL) → w_c kN/m</option>
              <option value="POINT_MID">Titik tengah → P_c kN</option>
            </select>
          </div>
        </div>

        <p className="text-[9px] font-bold text-gray-500 uppercase pt-1">Faktor efektivitas beton (Nielsen)</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="f'c" unit="MPa" value={e.fc} step={5} onChange={v => sE("fc", v)} />
          <Nf label="θ strat" unit="°" value={e.theta} step={5} onChange={v => sE("theta", v)} />
          <Nf label="b_w" unit="mm" value={e.bw} step={25} onChange={v => sE("bw", v)} />
          <Nf label="z lengan" unit="mm" value={e.z} step={25} onChange={v => sE("z", v)} />
        </div>
      </div>

      {/* Right: results */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase text-gray-400">Pola garis-leleh (batas-atas)</p>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[260px] border border-gray-200 rounded bg-slate-50">
              <rect x={x0} y={y0} width={boxW} height={boxH} fill="#dbeafe" stroke="#1e40af" strokeWidth="1.2" />
              {/* corner fan yield lines to ridge endpoints */}
              <line x1={x0} y1={y0} x2={cx1} y2={cy1} stroke="#dc2626" strokeWidth="1" />
              <line x1={x0 + boxW} y1={y0} x2={cx2} y2={cy1} stroke="#dc2626" strokeWidth="1" />
              <line x1={x0} y1={y0 + boxH} x2={cx1} y2={cy2} stroke="#dc2626" strokeWidth="1" />
              <line x1={x0 + boxW} y1={y0 + boxH} x2={cx2} y2={cy2} stroke="#dc2626" strokeWidth="1" />
              {/* central ridge yield line */}
              <line x1={cx1} y1={cy1} x2={cx2} y2={cy2} stroke="#dc2626" strokeWidth="1.4" />
              <text x={x0 + 3} y={y0 - 3} fontSize="7" fill="#64748b">L_x={f(s.Lx, 1)} × L_y={f(s.Ly, 1)} m</text>
            </svg>
            <table className="w-full mt-1"><tbody>
              <Row label="rasio L_x/L_y" value={f(yl.ratio, 3)} />
              <Row label="κ aspek" value={f(yl.kappa, 3)} />
              <Row label="w_u runtuh" value={f(yl.wu, 2)} unit="kN/m²" hi />
              <Row label="m perlu @ w_u" value={f(yl.mRequired(yl.wu), 1)} unit="kNm/m" />
            </tbody></table>
            <p className="text-[8px] text-gray-400 mt-0.5 leading-snug">w_u=(24m/L_x²)(1+i)/[√(3+r²)−r]² — batas-ATAS (kinematik), TAK aman; pakai m perlu untuk desain.</p>
          </div>

          <div>
            <p className="text-[9px] font-bold uppercase text-gray-400">Beban runtuh mekanisme plastis</p>
            <table className="w-full mt-1"><tbody>
              <Row label="jumlah sendi" value={`${bc.hinges}`} />
              <Row label="koef. mekanisme" value={f(bc.coefficient, 3)} />
              <Row label={load === "UDL" ? "w_c runtuh" : "P_c runtuh"} value={f(bc.Pc, 2)} unit={load === "UDL" ? "kN/m" : "kN"} hi />
            </tbody></table>
            <p className="text-[8px] text-gray-500 mt-0.5">{bc.mode}</p>

            <p className="text-[9px] font-bold uppercase text-gray-400 pt-2">Efektivitas & geser plastis</p>
            <table className="w-full mt-1"><tbody>
              <Row label="ν = 0,7 − f'c/200" value={f(ef.nu, 3)} hi />
              <Row label="f'c efektif ν·f'c" value={f(ef.fcEff, 1)} unit="MPa" />
              <Row label="τ plastis ½ν·f'c" value={f(ef.tauPlastic, 2)} unit="MPa" />
              <Row label="V_plastis (web crush)" value={f(ef.Vplastic, 0)} unit="kN" hi />
            </tbody></table>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-2 grid grid-cols-2 gap-3">
          <div className="rounded bg-green-50 border border-green-200 p-2">
            <p className="text-[9px] font-bold text-green-800">Batas-bawah (statis) — AMAN</p>
            <p className="text-[8px] text-green-700 leading-snug">{boundCharacter("STATIC_LOWER").note}</p>
          </div>
          <div className="rounded bg-amber-50 border border-amber-200 p-2">
            <p className="text-[9px] font-bold text-amber-800">Batas-atas (kinematik) — TAK AMAN</p>
            <p className="text-[8px] text-amber-700 leading-snug">{boundCharacter("KINEMATIC_UPPER").note}</p>
          </div>
        </div>

        <p className="text-[8px] text-gray-400 leading-snug border-t border-gray-100 pt-1">
          Analisis batas (teori plastisitas): garis-leleh Johansen (batas-atas/kinematik) untuk pelat beton bertulang dua-arah + runtuh plastis balok (mekanisme sendi) + faktor efektivitas beton ν & geser plastis Nielsen (web-crushing). Melengkapi strut-and-tie ▽ (batas-bawah/statis). Prosedur dari pustaka ASM (Nielsen & Hoang "Limit Analysis and Concrete Plasticity", Johansen, teori plastik struktur, ASM 1–92) — angka contoh PDF bukan acuan, hanya rumus/prosedur.
        </p>
      </div>
    </div>
  );
}
