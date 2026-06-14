"use client";

import React, { useState, useMemo } from "react";
import {
  computeLoadCombos, computePierColumn, computeBentCap, computeSpreadFooting,
  computePileGroup, computeAbutment, computeGroundAnchor,
} from "@/engine/substructure";
import type {
  LoadComboInputs, PierColumnInputs, BentCapInputs, SpreadFootingInputs,
  PileGroupInputs, AbutmentInputs, GroundAnchorInputs,
} from "@/engine/substructure";

/* ── shared little widgets (match DeckSlabCalculator idiom) ───────── */
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
    <div className={`flex justify-between items-center gap-2 px-2 py-1 rounded text-[10px] my-0.5 border ${ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
      <span>{label}</span>
      <span className="font-mono text-right flex-1">{detail}</span>
      <span className="font-bold">{ok ? "✓ OK" : "✗ NG"}</span>
    </div>
  );
}
const f = (v: number, d = 2) => (isFinite(v) ? v.toFixed(d) : "—");

/* ════════════════════════════════════════════════════════════════ */
type Sub = "load" | "col" | "cap" | "ftg" | "pile" | "abut" | "anchor";
const SUBS: { k: Sub; t: string }[] = [
  { k: "load", t: "① Kombinasi Beban" },
  { k: "col", t: "② Kolom Pier (RC P-M)" },
  { k: "cap", t: "③ Bent/Pier Cap" },
  { k: "ftg", t: "④ Telapak (Spread)" },
  { k: "pile", t: "⑤ Pile Cap / Grup" },
  { k: "abut", t: "⑥ Abutmen" },
  { k: "anchor", t: "⑦ Angkur Tanah/Batuan" },
];

export function SubstructureCalculator() {
  const [sub, setSub] = useState<Sub>("load");
  return (
    <div className="text-[11px]">
      <div className="flex flex-wrap gap-1 mb-3 border-b border-gray-200 pb-2">
        {SUBS.map(s => (
          <button key={s.k} onClick={() => setSub(s.k)}
            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
              sub === s.k ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {s.t}
          </button>
        ))}
      </div>
      {sub === "load" && <LoadPane />}
      {sub === "col" && <ColPane />}
      {sub === "cap" && <CapPane />}
      {sub === "ftg" && <FtgPane />}
      {sub === "pile" && <PilePane />}
      {sub === "abut" && <AbutPane />}
      {sub === "anchor" && <AnchorPane />}
    </div>
  );
}

/* ── ① Load combinations ─────────────────────────────────────────── */
function LoadPane() {
  const [i, setI] = useState<LoadComboInputs>({
    DC: { P: 1800, M: 120, H: 0 }, DW: { P: 250, M: 30, H: 0 },
    LL: { P: 900, M: 350, H: 80 }, WS: { P: 0, M: 180, H: 60 },
    WL: { P: 0, M: 60, H: 20 }, EH: { P: 0, M: 0, H: 0 },
    EV: { P: 0, M: 0, H: 0 }, ES: { P: 0, M: 0, H: 0 },
    EQ: { P: 0, M: 500, H: 250 },
  });
  const r = useMemo(() => computeLoadCombos(i), [i]);
  const setSrc = (k: keyof LoadComboInputs, f2: "P" | "M" | "H", v: number) =>
    setI(p => ({ ...p, [k]: { ...(p[k] as { P: number; M: number; H: number }), [f2]: v } }));
  const sources: (keyof LoadComboInputs)[] = ["DC", "DW", "LL", "WS", "WL", "EH", "EV", "ES", "EQ"];
  return (
    <div className="flex gap-4">
      <div className="w-72 flex-none">
        <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Beban tak-terfaktor di dasar kolom</p>
        <table className="w-full">
          <thead><tr className="text-[9px] text-gray-400"><th></th><th>P (kN)</th><th>M (kN·m)</th><th>H (kN)</th></tr></thead>
          <tbody>
            {sources.map(s => (
              <tr key={s}>
                <td className="text-[10px] font-semibold text-gray-600 pr-1">{s}</td>
                {(["P", "M", "H"] as const).map(c => (
                  <td key={c} className="px-0.5">
                    <input type="number" value={(i[s] as { P: number; M: number; H: number })[c]}
                      onChange={e => setSrc(s, c, parseFloat(e.target.value) || 0)}
                      className="w-16 rounded border border-gray-300 px-1 py-0.5 text-[10px] font-mono" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[9px] text-gray-400 mt-2 leading-snug">
          DC dead struktur · DW aspal/utilitas · LL (sudah +IM+BR) · WS angin struktur · WL angin pada LL ·
          EH/EV/ES tekanan tanah · EQ gempa (Extreme I). Faktor γ menurut AASHTO LRFD Tabel 3.4.1-1.
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">Kombinasi terfaktor</p>
        <table className="w-full">
          <thead><tr className="text-[9px] text-gray-400 border-b"><th className="text-left">Kombinasi</th><th>Pu</th><th>Mu</th><th>Hu</th></tr></thead>
          <tbody>
            {r.combos.map(c => (
              <tr key={c.name} className="border-b border-gray-100">
                <td className="py-0.5 text-[10px] text-gray-600" title={c.factors}>{c.name}</td>
                <td className="py-0.5 font-mono text-right text-[10px]">{f(c.Pu, 0)}</td>
                <td className="py-0.5 font-mono text-right text-[10px]">{f(c.Mu, 0)}</td>
                <td className="py-0.5 font-mono text-right text-[10px]">{f(c.Hu, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 space-y-1">
          <div className="px-2 py-1 rounded bg-blue-50 border border-blue-200 text-[10px] text-blue-800">
            Governing aksial: <b>{r.govAxial.name}</b> → Pu = {f(r.govAxial.Pu, 0)} kN
          </div>
          <div className="px-2 py-1 rounded bg-blue-50 border border-blue-200 text-[10px] text-blue-800">
            Governing momen: <b>{r.govMoment.name}</b> → Mu = {f(r.govMoment.Mu, 0)} kN·m
          </div>
          <div className="px-2 py-1 rounded bg-blue-50 border border-blue-200 text-[10px] text-blue-800">
            Governing geser: <b>{r.govShear.name}</b> → Hu = {f(r.govShear.Hu, 0)} kN
          </div>
        </div>
        <p className="text-[9px] text-gray-400 mt-2 leading-snug">
          γ_p maks: DC 1.25 · DW 1.50 · EH 1.50 · EV 1.35 · ES 1.50. Untuk cek stabilitas/uplift gunakan
          γ_p min (DC 0.90, DW 0.65). Demand ini menjadi masukan kolom/telapak/pile-cap di sub-tab berikut.
        </p>
      </div>
    </div>
  );
}

/* ── ② RC Pier column P-M ────────────────────────────────────────── */
function ColPane() {
  const [i, setI] = useState<PierColumnInputs>({
    b: 800, h: 1000, fc: 30, fy: 420, spiral: false,
    layers: [{ d: 70, As: 5 * 804 }, { d: 500, As: 2 * 804 }, { d: 930, As: 5 * 804 }],
    Pu: 4500, Mu: 1200, k: 1.2, Lu: 6000, betaDns: 0.6, M1: 600, M2: 1200, sway: false,
  });
  const r = useMemo(() => computePierColumn(i), [i]);
  const set = (k: keyof PierColumnInputs, v: number | boolean) => setI(p => ({ ...p, [k]: v }));
  // simple P-M plot
  const pts = r.curve.filter(p => p.phiPn >= -200);
  const maxM = Math.max(...pts.map(p => p.phiMn), r.Mu) * 1.1;
  const maxP = Math.max(...pts.map(p => p.phiPn), r.Pu) * 1.1;
  const W = 240, Hh = 220, pad = 28;
  const sx = (m: number) => pad + m / maxM * (W - 2 * pad);
  const sy = (p: number) => Hh - pad - p / maxP * (Hh - 2 * pad);
  const path = pts.map((p, k) => `${k ? "L" : "M"}${sx(p.phiMn).toFixed(1)},${sy(p.phiPn).toFixed(1)}`).join(" ");
  return (
    <div className="flex gap-4">
      <div className="w-56 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Penampang kolom RC</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="b lebar" unit="mm" value={i.b} onChange={v => set("b", v)} step={50} />
          <Nf label="h tinggi" unit="mm" value={i.h} onChange={v => set("h", v)} step={50} />
          <Nf label="f'c" unit="MPa" value={i.fc} onChange={v => set("fc", v)} step={5} />
          <Nf label="f_y" unit="MPa" value={i.fy} onChange={v => set("fy", v)} step={20} />
        </div>
        <label className="flex items-center gap-1 text-[10px] text-gray-600">
          <input type="checkbox" checked={i.spiral} onChange={e => set("spiral", e.target.checked)} />
          Sengkang spiral (φ 0.75)
        </label>
        <p className="text-[9px] font-bold text-gray-500 uppercase pt-1">Demand terfaktor</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="Pu" unit="kN" value={i.Pu} onChange={v => set("Pu", v)} step={100} />
          <Nf label="Mu" unit="kN·m" value={i.Mu} onChange={v => set("Mu", v)} step={50} />
          <Nf label="k·Lu (k)" value={i.k ?? 1.2} onChange={v => set("k", v)} step={0.1} />
          <Nf label="Lu" unit="mm" value={i.Lu ?? 6000} onChange={v => set("Lu", v)} step={250} />
        </div>
        <p className="text-[9px] text-gray-400 leading-snug">
          Tulangan default 3 lapis simetris (luas total {f(r.Ast, 0)} mm²). Edit lapis di kode bila perlu.
        </p>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <svg width={W} height={Hh} className="border border-gray-200 rounded bg-white">
          <line x1={pad} y1={pad} x2={pad} y2={Hh - pad} stroke="#9ca3af" />
          <line x1={pad} y1={Hh - pad} x2={W - pad} y2={Hh - pad} stroke="#9ca3af" />
          <path d={path} fill="rgba(37,99,235,0.08)" stroke="#2563eb" strokeWidth={1.5} />
          <circle cx={sx(r.Mu)} cy={sy(r.Pu)} r={4} fill={r.isAdequate ? "#16a34a" : "#dc2626"} />
          <text x={W / 2} y={Hh - 6} textAnchor="middle" className="fill-gray-500" fontSize={8}>φMn (kN·m)</text>
          <text x={8} y={pad - 6} className="fill-gray-500" fontSize={8}>φPn (kN)</text>
        </svg>
        <table className="w-full max-w-md"><tbody>
          <Row label="A_g" value={f(r.Ag, 0)} unit="mm²" />
          <Row label="ρ = A_st/A_g" value={f(r.rho * 100, 2)} unit="%" hi />
          <Row label="P₀ tekan murni" value={f(r.Pn0, 0)} unit="kN" />
          <Row label="φPn,maks (cap)" value={f(r.phiPnMax, 0)} unit="kN" hi />
          <Row label="Titik imbang φPn / φMn" value={`${f(r.balanced.phiPn, 0)} / ${f(r.balanced.phiMn, 0)}`} unit="kN, kN·m" />
          <Row label="Lentur murni φMn (εt)" value={`${f(r.pureFlex.phiMn, 0)} (εt=${f(r.pureFlex.epsT, 4)})`} unit="kN·m" />
          <Row label="Rasio demand/kapasitas" value={f(r.demandRatio, 3)} hi />
          {r.slender && <>
            <Row label="kLu/r (slenderness)" value={f(r.slender.ratio, 1)} />
            <Row label="δ pembesar momen" value={f(r.slender.delta, 3)} />
            <Row label="Mc = δ·M2" value={f(r.slender.Mc, 0)} unit="kN·m" hi />
          </>}
        </tbody></table>
        <Chk label="Rasio tulangan 1%–8%" ok={r.rhoOk} detail={`ρ = ${f(r.rho * 100, 2)}%`} />
        <Chk label="Demand di dalam envelope P-M" ok={r.isAdequate} detail={`ratio ${f(r.demandRatio, 3)} ≤ 1.0`} />
        <p className="text-[9px] text-gray-400 leading-snug">
          Kontrol regangan: φ = 0.90 bila εt ≥ 0.005 (tarik), 0.65/0.75 bila tekan; transisi linier.
          Slenderness ACI §6.6.4: δ = Cm/(1−Pu/0.75Pc) ≥ 1.0.
        </p>
      </div>
    </div>
  );
}

/* ── ③ Bent cap ──────────────────────────────────────────────────── */
function CapPane() {
  const [i, setI] = useState<BentCapInputs>({
    b: 1200, h: 1200, d: 1120, fc: 30, fy: 420, Mu: 2800, Vu: 1800, Av: 2 * 129, s: 150,
  });
  const r = useMemo(() => computeBentCap(i), [i]);
  const set = (k: keyof BentCapInputs, v: number) => setI(p => ({ ...p, [k]: v }));
  return (
    <div className="flex gap-4">
      <div className="w-56 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Penampang cap (RC)</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="b lebar" unit="mm" value={i.b} onChange={v => set("b", v)} step={50} />
          <Nf label="h tinggi" unit="mm" value={i.h} onChange={v => set("h", v)} step={50} />
          <Nf label="d efektif" unit="mm" value={i.d} onChange={v => set("d", v)} step={20} />
          <Nf label="f'c" unit="MPa" value={i.fc} onChange={v => set("fc", v)} step={5} />
          <Nf label="f_y" unit="MPa" value={i.fy} onChange={v => set("fy", v)} step={20} />
          <Nf label="Av sengkang" unit="mm²" value={i.Av} onChange={v => set("Av", v)} step={10} />
          <Nf label="s spasi" unit="mm" value={i.s} onChange={v => set("s", v)} step={25} />
        </div>
        <p className="text-[9px] font-bold text-gray-500 uppercase pt-1">Demand</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="Mu" unit="kN·m" value={i.Mu} onChange={v => set("Mu", v)} step={100} />
          <Nf label="Vu" unit="kN" value={i.Vu} onChange={v => set("Vu", v)} step={100} />
        </div>
        <p className="text-[9px] text-gray-400 leading-snug">
          Cap dalam (a/d &lt; ~2) → gunakan sub-tab Strut-and-Tie ▽ untuk model D-region.
        </p>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">Lentur</p>
        <table className="w-full max-w-md"><tbody>
          <Row label="A_s perlu" value={f(r.AsReq, 0)} unit="mm²" hi />
          <Row label="A_s,min = max(0.25√f'c/fy, 1.4/fy)·bd" value={f(r.AsMin, 0)} unit="mm²" />
          <Row label="a blok tekan" value={f(r.a, 1)} unit="mm" />
          <Row label="c garis netral" value={f(r.c, 1)} unit="mm" />
          <Row label="εt (kontrol regangan)" value={f(r.epsT, 4)} hi />
          <Row label="φ lentur" value={f(r.phiF, 3)} />
          <Row label="φMn" value={f(r.phiMn, 0)} unit="kN·m" hi />
        </tbody></table>
        <Chk label="Lentur φMn ≥ Mu" ok={r.flexOk} detail={`${f(r.phiMn, 0)} ≥ ${f(i.Mu, 0)}`} />
        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Geser satu-arah</p>
        <table className="w-full max-w-md"><tbody>
          <Row label="Vc = 0.166√f'c·b·d" value={f(r.Vc, 0)} unit="kN" />
          <Row label="Vs = Av·fy·d/s" value={f(r.Vs, 0)} unit="kN" />
          <Row label="φVn = 0.9(Vc+Vs)" value={f(r.phiVn, 0)} unit="kN" hi />
          <Row label="s_maks" value={f(r.sMax, 0)} unit="mm" />
        </tbody></table>
        <Chk label="Geser φVn ≥ Vu" ok={r.shearOk} detail={`${f(r.phiVn, 0)} ≥ ${f(i.Vu, 0)}`} />
      </div>
    </div>
  );
}

/* ── ④ Spread footing ────────────────────────────────────────────── */
function FtgPane() {
  const [i, setI] = useState<SpreadFootingInputs>({
    B: 3500, L: 4000, t: 900, d: 800, cx: 800, cy: 1000,
    fc: 25, fy: 420, P: 3000, M: 600, Pu: 4500, Mu: 900, qAllow: 350, gammaC: 24,
  });
  const r = useMemo(() => computeSpreadFooting(i), [i]);
  const set = (k: keyof SpreadFootingInputs, v: number) => setI(p => ({ ...p, [k]: v }));
  // plan diagram
  const sc = 110 / Math.max(i.B, i.L);
  const bw = i.B * sc, lw = i.L * sc, cxw = i.cx * sc, cyw = i.cy * sc;
  return (
    <div className="flex gap-4">
      <div className="w-56 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Geometri telapak</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="B" unit="mm" value={i.B} onChange={v => set("B", v)} step={100} />
          <Nf label="L" unit="mm" value={i.L} onChange={v => set("L", v)} step={100} />
          <Nf label="t tebal" unit="mm" value={i.t} onChange={v => set("t", v)} step={50} />
          <Nf label="d efektif" unit="mm" value={i.d} onChange={v => set("d", v)} step={25} />
          <Nf label="kolom cx" unit="mm" value={i.cx} onChange={v => set("cx", v)} step={50} />
          <Nf label="kolom cy" unit="mm" value={i.cy} onChange={v => set("cy", v)} step={50} />
        </div>
        <p className="text-[9px] font-bold text-gray-500 uppercase pt-1">Beban & tanah</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="P layan" unit="kN" value={i.P} onChange={v => set("P", v)} step={100} />
          <Nf label="M layan" unit="kN·m" value={i.M} onChange={v => set("M", v)} step={50} />
          <Nf label="Pu" unit="kN" value={i.Pu} onChange={v => set("Pu", v)} step={100} />
          <Nf label="Mu" unit="kN·m" value={i.Mu} onChange={v => set("Mu", v)} step={50} />
          <Nf label="q_izin" unit="kPa" value={i.qAllow} onChange={v => set("qAllow", v)} step={25} />
          <Nf label="f'c" unit="MPa" value={i.fc} onChange={v => set("fc", v)} step={5} />
        </div>
        <svg width={130} height={130} className="border border-gray-200 rounded bg-white mt-1">
          <rect x={(130 - bw) / 2} y={(130 - lw) / 2} width={bw} height={lw} fill="#eff6ff" stroke="#2563eb" />
          <rect x={(130 - cxw) / 2} y={(130 - cyw) / 2} width={cxw} height={cyw} fill="#bfdbfe" stroke="#1d4ed8" />
          <text x={65} y={12} textAnchor="middle" fontSize={8} className="fill-gray-500">Denah telapak</text>
        </svg>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">Daya dukung tanah</p>
        <table className="w-full max-w-md"><tbody>
          <Row label="e = M/P" value={f(r.e, 0)} unit="mm" />
          <Row label="kern L/6" value={f(r.ekern, 0)} unit="mm" />
          <Row label="mode tekanan" value={r.bearingMode === "full" ? "trapesium penuh" : "segitiga parsial"} />
          <Row label="q_maks" value={f(r.qMax, 0)} unit="kPa" hi />
          <Row label="q_min" value={f(r.qMin, 0)} unit="kPa" />
        </tbody></table>
        <Chk label="q_maks ≤ q_izin" ok={r.bearingOk} detail={`${f(r.qMax, 0)} ≤ ${f(i.qAllow, 0)}`} />
        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Geser pons (dua-arah) & satu-arah</p>
        <table className="w-full max-w-md"><tbody>
          <Row label="b₀ keliling kritis (d/2)" value={f(r.b0, 0)} unit="mm" />
          <Row label="Vu pons" value={f(r.vu2, 0)} unit="kN" />
          <Row label="φVc pons" value={f(r.phiVc2, 0)} unit="kN" hi />
          <Row label="Vu satu-arah" value={f(r.vu1, 0)} unit="kN" />
          <Row label="φVc satu-arah" value={f(r.phiVc1, 0)} unit="kN" />
        </tbody></table>
        <Chk label="Geser pons φVc ≥ Vu" ok={r.punchOk} detail={`${f(r.phiVc2, 0)} ≥ ${f(r.vu2, 0)}`} />
        <Chk label="Geser satu-arah φVc ≥ Vu" ok={r.onewayOk} detail={`${f(r.phiVc1, 0)} ≥ ${f(r.vu1, 0)}`} />
        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Lentur muka kolom</p>
        <table className="w-full max-w-md"><tbody>
          <Row label="Mu muka kolom" value={f(r.Mu_face, 0)} unit="kN·m" />
          <Row label="A_s perlu" value={f(r.AsReq, 0)} unit="mm²" hi />
          <Row label="A_s,min 0.0018·B·t" value={f(r.AsMin, 0)} unit="mm²" />
          <Row label="εt / φMn" value={`${f(r.epsT, 4)} / ${f(r.phiMn, 0)}`} unit="kN·m" />
        </tbody></table>
        <Chk label="Lentur φMn ≥ Mu" ok={r.flexOk} detail={`${f(r.phiMn, 0)} ≥ ${f(r.Mu_face, 0)}`} />
      </div>
    </div>
  );
}

/* ── ⑤ Pile group ────────────────────────────────────────────────── */
function PilePane() {
  const [g, setG] = useState({ rows: 2, cols: 3, sp: 1200, dia: 400, P: 6000, Mx: 1500, Pu: 9000, Mux: 2250, cap: 1800 });
  const piles = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    const ox = (g.cols - 1) / 2, oy = (g.rows - 1) / 2;
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++)
      out.push({ x: (c - ox) * g.sp, y: (r - oy) * g.sp });
    return out;
  }, [g.rows, g.cols, g.sp]);
  const inp: PileGroupInputs = {
    piles, P: g.P, Mx: g.Mx, Pu: g.Pu, Mux: g.Mux, pileCap: g.cap,
    rows: g.rows, cols: g.cols, spacing: g.sp, diameter: g.dia,
  };
  const r = useMemo(() => computePileGroup(inp), [inp]);
  const set = (k: keyof typeof g, v: number) => setG(p => ({ ...p, [k]: v }));
  const span = (Math.max(g.rows, g.cols) - 1) * g.sp || 1;
  const sc = 100 / (span + g.sp);
  return (
    <div className="flex gap-4">
      <div className="w-56 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Susunan tiang</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="baris (m)" value={g.rows} onChange={v => set("rows", Math.max(1, Math.round(v)))} />
          <Nf label="kolom (n)" value={g.cols} onChange={v => set("cols", Math.max(1, Math.round(v)))} />
          <Nf label="spasi s" unit="mm" value={g.sp} onChange={v => set("sp", v)} step={100} />
          <Nf label="Ø tiang" unit="mm" value={g.dia} onChange={v => set("dia", v)} step={50} />
        </div>
        <p className="text-[9px] font-bold text-gray-500 uppercase pt-1">Beban & kapasitas</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="P layan" unit="kN" value={g.P} onChange={v => set("P", v)} step={200} />
          <Nf label="Mx layan" unit="kN·m" value={g.Mx} onChange={v => set("Mx", v)} step={100} />
          <Nf label="Pu" unit="kN" value={g.Pu} onChange={v => set("Pu", v)} step={200} />
          <Nf label="Mux" unit="kN·m" value={g.Mux} onChange={v => set("Mux", v)} step={100} />
          <Nf label="Q_izin 1 tiang" unit="kN" value={g.cap} onChange={v => set("cap", v)} step={100} />
        </div>
        <svg width={120} height={120} className="border border-gray-200 rounded bg-white mt-1">
          {piles.map((p, k) => {
            const R = r.reactions[k];
            const ratio = Math.max(0, Math.min(1, R.R / g.cap));
            return <circle key={k} cx={60 + p.x * sc} cy={60 + p.y * sc} r={6}
              fill={`rgba(${Math.round(60 + ratio * 195)},${Math.round(130 - ratio * 90)},235,0.7)`} stroke="#1d4ed8" />;
          })}
          <text x={60} y={12} textAnchor="middle" fontSize={8} className="fill-gray-500">Denah grup ({r.n} tiang)</text>
        </svg>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <table className="w-full max-w-md"><tbody>
          <Row label="Jumlah tiang n" value={f(r.n, 0)} hi />
          <Row label="Σx² (rigid cap)" value={f(r.Sxx / 1e6, 1)} unit="×10⁶ mm²" />
          <Row label="R_maks (layan)" value={f(r.Rmax, 0)} unit="kN" hi />
          <Row label="R_min (layan)" value={f(r.Rmin, 0)} unit="kN" />
          {r.efficiency !== undefined && <>
            <Row label="Efisiensi grup (Converse-Labarre)" value={f(r.efficiency, 3)} />
            <Row label="Kapasitas grup" value={f(r.groupCapacity ?? 0, 0)} unit="kN" />
          </>}
        </tbody></table>
        <Chk label="R_maks ≤ Q_izin" ok={r.capacityOk} detail={`${f(r.Rmax, 0)} ≤ ${f(g.cap, 0)}`} />
        <Chk label="Tidak ada tiang tarik (uplift)" ok={!r.tension} detail={`R_min = ${f(r.Rmin, 0)} kN`} />
        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Reaksi per tiang (R layan / Ru faktor)</p>
        <table className="w-full max-w-md"><tbody>
          {r.reactions.map((R, k) => (
            <Row key={k} label={`Tiang (${f(R.x, 0)}, ${f(R.y, 0)})`} value={`${f(R.R, 0)} / ${f(R.Ru, 0)}`} unit="kN" />
          ))}
        </tbody></table>
        <p className="text-[9px] text-gray-400 leading-snug">
          Cap rigid: R_i = P/n ± M·x_i/Σx². Punching tiang & lentur cap pakai Ru. Spasi ≥ 3Ø (efisiensi grup).
        </p>
      </div>
    </div>
  );
}

/* ── ⑥ Abutment ──────────────────────────────────────────────────── */
function AbutPane() {
  const [i, setI] = useState<AbutmentInputs>({
    H: 6000, stemT: 700, baseB: 4500, toe: 1200, heel: 2600, baseT: 800,
    gammaSoil: 18, phiSoil: 30, gammaC: 24, surcharge: 12, Vbearing: 600,
    muBase: 0.5, qAllow: 350, fc: 25, fy: 420, dStem: 620,
  });
  const r = useMemo(() => computeAbutment(i), [i]);
  const set = (k: keyof AbutmentInputs, v: number) => setI(p => ({ ...p, [k]: v }));
  // elevation sketch
  const sc = 90 / (i.H / 1000);
  const Hpx = (i.H / 1000) * sc, baseBpx = (i.baseB / 1000) * sc;
  const toePx = (i.toe / 1000) * sc, stemTpx = (i.stemT / 1000) * sc, baseTpx = (i.baseT / 1000) * sc;
  const ox = 15, oy = 110;
  return (
    <div className="flex gap-4">
      <div className="w-56 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Geometri abutmen (kantilever)</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="H total" unit="mm" value={i.H} onChange={v => set("H", v)} step={250} />
          <Nf label="stem t" unit="mm" value={i.stemT} onChange={v => set("stemT", v)} step={50} />
          <Nf label="base B" unit="mm" value={i.baseB} onChange={v => set("baseB", v)} step={100} />
          <Nf label="toe" unit="mm" value={i.toe} onChange={v => set("toe", v)} step={100} />
          <Nf label="heel" unit="mm" value={i.heel} onChange={v => set("heel", v)} step={100} />
          <Nf label="base t" unit="mm" value={i.baseT} onChange={v => set("baseT", v)} step={50} />
          <Nf label="d stem" unit="mm" value={i.dStem} onChange={v => set("dStem", v)} step={20} />
        </div>
        <p className="text-[9px] font-bold text-gray-500 uppercase pt-1">Tanah & beban</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="γ tanah" unit="kN/m³" value={i.gammaSoil} onChange={v => set("gammaSoil", v)} step={1} />
          <Nf label="φ tanah" unit="°" value={i.phiSoil} onChange={v => set("phiSoil", v)} step={1} />
          <Nf label="surcharge" unit="kPa" value={i.surcharge} onChange={v => set("surcharge", v)} step={2} />
          <Nf label="V super" unit="kN/m" value={i.Vbearing} onChange={v => set("Vbearing", v)} step={50} />
          <Nf label="μ dasar" value={i.muBase} onChange={v => set("muBase", v)} step={0.05} />
          <Nf label="q_izin" unit="kPa" value={i.qAllow} onChange={v => set("qAllow", v)} step={25} />
        </div>
        <svg width={130} height={120} className="border border-gray-200 rounded bg-white mt-1">
          {/* base */}
          <rect x={ox} y={oy - baseTpx} width={baseBpx} height={baseTpx} fill="#dbeafe" stroke="#1d4ed8" />
          {/* stem */}
          <rect x={ox + toePx} y={oy - baseTpx - (Hpx - baseTpx)} width={stemTpx} height={Hpx - baseTpx} fill="#bfdbfe" stroke="#1d4ed8" />
          {/* backfill hatch */}
          <line x1={ox + toePx + stemTpx} y1={oy - baseTpx} x2={ox + baseBpx} y2={oy - baseTpx} stroke="#9ca3af" />
          <line x1={ox + toePx + stemTpx} y1={oy - Hpx} x2={ox + baseBpx} y2={oy - Hpx} stroke="#d1d5db" strokeDasharray="2 2" />
          {/* earth pressure arrow */}
          <line x1={ox + baseBpx + 6} y1={oy - baseTpx} x2={ox + toePx + stemTpx} y2={oy - baseTpx} stroke="#dc2626" strokeWidth={1.2} markerEnd="url(#ah)" />
          <defs><marker id="ah" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#dc2626" /></marker></defs>
          <text x={65} y={118} textAnchor="middle" fontSize={7} className="fill-gray-500">Potongan abutmen</text>
        </svg>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">Stabilitas (Rankine, per meter)</p>
        <table className="w-full max-w-md"><tbody>
          <Row label="Ka = tan²(45−φ/2)" value={f(r.Ka, 3)} />
          <Row label="Pa = ½Ka·γ·H²" value={f(r.Pa, 1)} unit="kN/m" />
          <Row label="P surcharge = Ka·q·H" value={f(r.Psur, 1)} unit="kN/m" />
          <Row label="ΣW vertikal" value={f(r.W, 1)} unit="kN/m" />
          <Row label="Mr / Mo" value={`${f(r.Mr, 0)} / ${f(r.Mo, 0)}`} unit="kN·m/m" />
          <Row label="FS guling = Mr/Mo" value={f(r.FSot, 2)} hi />
          <Row label="FS geser = μΣW/ΣH" value={f(r.FSsl, 2)} hi />
          <Row label="e dasar" value={f(r.eBase, 0)} unit="mm" />
          <Row label="q_maks / q_min" value={`${f(r.qMax, 0)} / ${f(r.qMin, 0)}`} unit="kPa" />
        </tbody></table>
        <Chk label="FS guling ≥ 2.0" ok={r.otOk} detail={`${f(r.FSot, 2)} ≥ 2.0`} />
        <Chk label="FS geser ≥ 1.5" ok={r.slOk} detail={`${f(r.FSsl, 2)} ≥ 1.5`} />
        <Chk label="q_maks ≤ q_izin" ok={r.bearingOk} detail={`${f(r.qMax, 0)} ≤ ${f(i.qAllow, 0)}`} />
        <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Stem RC di dasar (per meter)</p>
        <table className="w-full max-w-md"><tbody>
          <Row label="Mu stem (1.5 EH+ES)" value={f(r.MuStem, 0)} unit="kN·m/m" />
          <Row label="A_s stem" value={f(r.AsStem, 0)} unit="mm²/m" hi />
          <Row label="εt / φMn" value={`${f(r.epsT, 4)} / ${f(r.phiMn, 0)}`} unit="kN·m/m" />
        </tbody></table>
        <Chk label="Stem φMn ≥ Mu" ok={r.stemOk} detail={`${f(r.phiMn, 0)} ≥ ${f(r.MuStem, 0)}`} />
      </div>
    </div>
  );
}

/* ── ⑦ Ground anchor ─────────────────────────────────────────────── */
function AnchorPane() {
  const [i, setI] = useState<GroundAnchorInputs>({
    Tdesign: 900, nStrand: 7, Aps: 140, fpu: 1860, dHole: 150, Lbond: 8000,
    tauUlt: 600, Lfree: 6000, inclination: 20, FSbond: 2.0,
  });
  const r = useMemo(() => computeGroundAnchor(i), [i]);
  const set = (k: keyof GroundAnchorInputs, v: number) => setI(p => ({ ...p, [k]: v }));
  return (
    <div className="flex gap-4">
      <div className="w-56 flex-none space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase">Angkur tanah/batuan (SUSPA/VSL)</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Nf label="T desain" unit="kN" value={i.Tdesign} onChange={v => set("Tdesign", v)} step={50} />
          <Nf label="n strand" value={i.nStrand} onChange={v => set("nStrand", Math.round(v))} />
          <Nf label="A strand" unit="mm²" value={i.Aps} onChange={v => set("Aps", v)} step={10} />
          <Nf label="f_pu" unit="MPa" value={i.fpu} onChange={v => set("fpu", v)} step={30} />
          <Nf label="Ø lubang" unit="mm" value={i.dHole} onChange={v => set("dHole", v)} step={10} />
          <Nf label="L bond" unit="mm" value={i.Lbond} onChange={v => set("Lbond", v)} step={500} />
          <Nf label="τ_ult bond" unit="kPa" value={i.tauUlt} onChange={v => set("tauUlt", v)} step={50} />
          <Nf label="L free" unit="mm" value={i.Lfree} onChange={v => set("Lfree", v)} step={500} />
          <Nf label="inklinasi" unit="°" value={i.inclination} onChange={v => set("inclination", v)} step={5} />
          <Nf label="FS bond" value={i.FSbond ?? 2} onChange={v => set("FSbond", v)} step={0.1} />
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <table className="w-full max-w-md"><tbody>
          <Row label="T_steel = 0.6·f_pu·A_ps" value={f(r.Tsteel, 0)} unit="kN" hi />
          <Row label="T_bond = π·d·L_b·τ/FS" value={f(r.Tbond, 0)} unit="kN" hi />
          <Row label="L_bond perlu" value={f(r.LbondReq, 0)} unit="mm" />
          <Row label="T lock-off (0.7T)" value={f(r.Tlockoff, 0)} unit="kN" />
          <Row label="Perpanjangan elastis L_free" value={f(r.Telong, 1)} unit="mm" />
          <Row label="Komponen H / V" value={`${f(r.Hcomp, 0)} / ${f(r.Vcomp, 0)}`} unit="kN" />
        </tbody></table>
        <Chk label="Kapasitas baja T_steel ≥ T" ok={r.steelOk} detail={`${f(r.Tsteel, 0)} ≥ ${f(i.Tdesign, 0)}`} />
        <Chk label="Kapasitas bond T_bond ≥ T" ok={r.bondOk} detail={`${f(r.Tbond, 0)} ≥ ${f(i.Tdesign, 0)}`} />
        <p className="text-[9px] text-gray-400 leading-snug">
          Angkur permanen FS_bond ≥ 2.0 (sementara ≥ 1.5). Lock-off ≤ 0.7 f_pu (jangka panjang).
          Free length menjaga tendon elastis untuk re-stressing & proof test 1.33×T_desain.
        </p>
      </div>
    </div>
  );
}
