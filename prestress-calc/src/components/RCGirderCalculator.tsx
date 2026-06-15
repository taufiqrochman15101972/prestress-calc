"use client";

import React, { useState, useMemo } from "react";
import { computeRCGirder } from "@/engine/rcgirder";
import type { RCGirderInputs } from "@/engine/rcgirder";

const DEFAULT: RCGirderInputs = {
  L: 20, S: 1.75, hf: 200, bw: 400, H: 1300, d: 1210,
  fc: 30, fy: 420, tAsphalt: 50, wSdl: 1.0, gammaC: 24,
  As: 6433, Asp: 0, dp: 60, gLL: 0.85,
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

/** Simple scaled T-section sketch with flange/web, stress block, and steel. */
function TSection({ inp, a, beff }: { inp: RCGirderInputs; a: number; beff: number }) {
  const W = 220, Hpx = 170, pad = 20;
  const sx = (W - 2 * pad) / beff;
  const sy = (Hpx - 2 * pad) / inp.H;
  const s = Math.min(sx, sy);
  const cx = W / 2;
  const flW = beff * s, webW = inp.bw * s, flH = inp.hf * s, totH = inp.H * s;
  const top = pad;
  const aPx = a * s;
  return (
    <svg viewBox={`0 0 ${W} ${Hpx}`} className="w-full max-w-[240px] border border-gray-200 rounded bg-slate-50">
      {/* flange */}
      <rect x={cx - flW / 2} y={top} width={flW} height={flH} fill="#bfdbfe" stroke="#1d4ed8" strokeWidth={0.8} />
      {/* web */}
      <rect x={cx - webW / 2} y={top + flH} width={webW} height={totH - flH} fill="#dbeafe" stroke="#1d4ed8" strokeWidth={0.8} />
      {/* compression stress block (Whitney) */}
      <rect x={cx - (Math.min(a, inp.hf) >= a ? flW : webW) / 2} y={top}
        width={Math.min(a, inp.hf) >= a ? flW : webW} height={Math.min(aPx, flH)}
        fill="#93c5fd" opacity={0.7} />
      {a > inp.hf && (
        <rect x={cx - webW / 2} y={top + flH} width={webW} height={aPx - flH} fill="#93c5fd" opacity={0.7} />
      )}
      {/* tension steel */}
      <line x1={cx - webW / 2 + 4} y1={top + inp.d * s} x2={cx + webW / 2 - 4} y2={top + inp.d * s}
        stroke="#dc2626" strokeWidth={2} strokeDasharray="3 2" />
      <circle cx={cx - webW / 4} cy={top + inp.d * s} r={2.4} fill="#dc2626" />
      <circle cx={cx} cy={top + inp.d * s} r={2.4} fill="#dc2626" />
      <circle cx={cx + webW / 4} cy={top + inp.d * s} r={2.4} fill="#dc2626" />
      {/* labels */}
      <text x={cx} y={top - 6} fontSize={7} textAnchor="middle" fill="#1e40af">b_eff = {beff.toFixed(0)}</text>
      <text x={cx} y={top + flH / 2 + 2.5} fontSize={6.5} textAnchor="middle" fill="#1e3a8a">h_f={inp.hf}</text>
      <text x={cx + webW / 2 + 4} y={top + totH - 6} fontSize={6.5} fill="#64748b">b_w={inp.bw}</text>
      <text x={cx - webW / 4} y={top + inp.d * s + 10} fontSize={6.5} textAnchor="middle" fill="#b91c1c">A_s</text>
      <text x={cx} y={top + aPx + 8} fontSize={6} textAnchor="middle" fill="#1d4ed8">a={a.toFixed(0)}</text>
    </svg>
  );
}

export function RCGirderCalculator() {
  const [inp, setInp] = useState<RCGirderInputs>(DEFAULT);
  const set = (k: keyof RCGirderInputs, v: number) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const r = useMemo(() => computeRCGirder(inp), [inp]);
  const f = (v: number, d = 2) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-60 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Geometri Balok-T</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="L bentang" unit="m" value={inp.L} onChange={v => set("L", v)} step={1} />
            <Nf label="S jarak gelagar" unit="m" value={inp.S} onChange={v => set("S", v)} step={0.05} />
            <Nf label="h_f tebal pelat" unit="mm" value={inp.hf} onChange={v => set("hf", v)} step={10} />
            <Nf label="b_w lebar badan" unit="mm" value={inp.bw} onChange={v => set("bw", v)} step={25} />
            <Nf label="H tinggi total" unit="mm" value={inp.H} onChange={v => set("H", v)} step={25} />
            <Nf label="d efektif" unit="mm" value={inp.d} onChange={v => set("d", v)} step={10} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Material & Tulangan</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} step={5} />
            <Nf label="f_y" unit="MPa" value={inp.fy} onChange={v => set("fy", v)} step={20} />
            <Nf label="A_s terpasang" unit="mm²" value={inp.As} onChange={v => set("As", v)} step={100} />
            <Nf label="A_s' tekan" unit="mm²" value={inp.Asp ?? 0} onChange={v => set("Asp", v)} step={100} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Beban</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="t aspal" unit="mm" value={inp.tAsphalt} onChange={v => set("tAsphalt", v)} step={5} />
            <Nf label="SDL parapet dll" unit="kN/m" value={inp.wSdl} onChange={v => set("wSdl", v)} step={0.25} />
            <Nf label="γ beton" unit="kN/m³" value={inp.gammaC} onChange={v => set("gammaC", v)} step={0.5} />
            <Nf label="g distribusi LL" value={inp.gLL ?? 1} onChange={v => set("gLL", v)} step={0.05} />
          </div>
        </div>
        <TSection inp={inp} a={r.a} beff={r.beff} />
        <p className="text-[9px] text-gray-400 leading-snug">
          Gelagar beton bertulang biasa (bukan prategang) untuk bentang pendek–menengah 5–25 m
          (standar Bina Marga Balok-T). Pelat dek = sayap tekan T; badan menahan tulangan tarik &
          sengkang. Beban "D" SNI 1725; kontrol regangan ε_t → φ identik substruktur.
        </p>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">
          1–2. Lebar sayap efektif & beban (per gelagar)
        </p>
        <table className="w-full max-w-md">
          <tbody>
            <Row label="b_eff = min(L/4, S, b_w+16h_f)" value={f(r.beff, 0)} unit="mm" hi />
            <Row label="w sendiri badan" value={f(r.wSelf)} unit="kN/m" />
            <Row label="w dek tributari" value={f(r.wDeck)} unit="kN/m" />
            <Row label="w aspal (DW)" value={f(r.wAsphalt)} unit="kN/m" />
            <Row label="ΣDC mati" value={f(r.wDC)} unit="kN/m" />
            <Row label="M_live 'D' per gelagar" value={f(r.Mlive, 1)} unit="kN·m" />
            <Row label="M_u = 1,25DC+1,5DW+1,8LL" value={f(r.Mu, 1)} unit="kN·m" hi />
            <Row label="V_u" value={f(r.Vu, 1)} unit="kN" hi />
          </tbody>
        </table>

        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">
          3. Lentur penampang-T {r.isTrueT ? "(perilaku T-sejati, a > h_f)" : "(blok di sayap, persegi)"}
        </p>
        <table className="w-full max-w-md">
          <tbody>
            <Row label="a tinggi blok tegangan" value={f(r.a, 1)} unit="mm" />
            <Row label="c garis netral" value={f(r.cNA, 1)} unit="mm" />
            <Row label="ε_t regangan tarik bersih" value={f(r.epsT, 4)} />
            <Row label={`φ (${r.classification})`} value={f(r.phi, 3)} />
            <Row label="M_n nominal" value={f(r.Mn, 1)} unit="kN·m" />
            <Row label="φM_n desain" value={f(r.phiMn, 1)} unit="kN·m" hi />
            <Row label="A_s,min" value={f(r.AsMin, 0)} unit="mm²" />
            <Row label="A_s perlu untuk M_u" value={f(r.AsReq, 0)} unit="mm²" />
          </tbody>
        </table>
        <Chk label="Lentur φM_n ≥ M_u" detail={`${f(r.phiMn, 0)} ≥ ${f(r.Mu, 0)} kN·m`} ok={r.flexureOk} />
        <Chk label="Tulangan minimum A_s ≥ A_s,min" detail={`${f(inp.As, 0)} ≥ ${f(r.AsMin, 0)}`} ok={r.minSteelOk} />

        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">
          4. Geser satu-arah (SNI 2847 §22.5)
        </p>
        <table className="w-full max-w-md">
          <tbody>
            <Row label="V_c = 0,17√f'c·b_w·d" value={f(r.Vc, 1)} unit="kN" />
            <Row label="φV_c" value={f(r.phiVc, 1)} unit="kN" />
            <Row label="V_s = V_u/φ − V_c" value={f(r.Vs, 1)} unit="kN" />
            <Row label="A_v/s perlu" value={f(r.AvS, 3)} unit="mm²/mm" hi />
            <Row label="s_maks sengkang" value={f(r.sMax, 0)} unit="mm" />
          </tbody>
        </table>
        <Chk label={r.needStirrups ? "Perlu sengkang (V_u > ½φV_c)" : "Sengkang minimum cukup"}
          detail={`V_u=${f(r.Vu, 0)} kN`} ok={true} />
        <Chk label="Penampang geser cukup (V_s ≤ 0,66√f'c·b_w·d)" detail={`V_s=${f(r.Vs, 0)} kN`} ok={r.shearOk} />
      </div>
    </div>
  );
}
