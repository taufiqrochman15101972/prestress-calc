"use client";

import React, { useState, useMemo } from "react";
import { computeStrutTie, computePierCapTruss, NODE_FACTORS } from "@/engine/strutandtie";
import type { StrutTieInputs, NodeType, PierCapTrussInputs } from "@/engine/strutandtie";

// PCI BDM §8.12.5 pier-cap geometry scale (SI)
const DEFAULT: StrutTieInputs = {
  fc: 35,
  PuStrut: 2500, Acs: 180000, alphaS: 26.5, epsS: 0.002, Ass: 0,
  PuTie: 2230, Ast: 6000, fy: 420, Aps: 0, fpe: 0,
  PuNode: 2230, An: 240000, nodeType: "CCT",
  bw: 1000, sBar: 250, AbarCrack: 199, nFaces: 2,
};

const DEFAULT_TRUSS: PierCapTrussInputs = { Pu: 2230, aOuter: 1630, aInner: 840, z: 1230 };

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

export function StrutTieCalculator() {
  const [inp, setInp] = useState<StrutTieInputs>(DEFAULT);
  const [truss, setTruss] = useState<PierCapTrussInputs>(DEFAULT_TRUSS);
  const set = (k: keyof StrutTieInputs, v: number | NodeType) =>
    setInp(prev => ({ ...prev, [k]: v }));
  const setT = (k: keyof PierCapTrussInputs, v: number) =>
    setTruss(prev => ({ ...prev, [k]: v }));
  const r = useMemo(() => computeStrutTie(inp), [inp]);
  const t = useMemo(() => computePierCapTruss(truss), [truss]);
  const f = (v: number, d = 1) => v.toFixed(d);

  return (
    <div className="flex gap-4 text-[11px]">
      {/* ── Inputs ─────────────────────────────────────── */}
      <div className="w-60 flex-none space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Strut Tekan (LRFD 5.6.3.3)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="f'c" unit="MPa" value={inp.fc} onChange={v => set("fc", v)} step={5} />
            <Nf label="P_u strut" unit="kN" value={inp.PuStrut} onChange={v => set("PuStrut", v)} step={50} />
            <Nf label="A_cs efektif" unit="mm²" value={inp.Acs} onChange={v => set("Acs", v)} step={5000} />
            <Nf label="α_s strut–tie" unit="°" value={inp.alphaS} onChange={v => set("alphaS", v)} step={0.5} />
            <Nf label="ε_s regangan tie" value={inp.epsS} onChange={v => set("epsS", v)} step={0.0005} />
            <Nf label="A_ss tul. strut" unit="mm²" value={inp.Ass} onChange={v => set("Ass", v)} step={100} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Tie Tarik (LRFD 5.6.3.4)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="P_u tie" unit="kN" value={inp.PuTie} onChange={v => set("PuTie", v)} step={50} />
            <Nf label="A_st baja lunak" unit="mm²" value={inp.Ast} onChange={v => set("Ast", v)} step={100} />
            <Nf label="f_y" unit="MPa" value={inp.fy} onChange={v => set("fy", v)} step={20} />
            <Nf label="A_ps strand" unit="mm²" value={inp.Aps} onChange={v => set("Aps", v)} step={100} />
            <Nf label="f_pe efektif" unit="MPa" value={inp.fpe} onChange={v => set("fpe", v)} step={25} />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Zona Nodal & Kontrol Retak</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Nf label="P_u node" unit="kN" value={inp.PuNode} onChange={v => set("PuNode", v)} step={50} />
            <Nf label="A_n muka node" unit="mm²" value={inp.An} onChange={v => set("An", v)} step={5000} />
            <Nf label="b_w badan" unit="mm" value={inp.bw} onChange={v => set("bw", v)} step={50} />
            <Nf label="s jarak tul." unit="mm" value={inp.sBar} onChange={v => set("sBar", v)} step={25} />
            <Nf label="A 1 batang mesh" unit="mm²" value={inp.AbarCrack} onChange={v => set("AbarCrack", v)} step={1} />
            <Nf label="Jumlah muka" value={inp.nFaces} onChange={v => set("nFaces", v)} step={1} />
          </div>
          <div className="flex gap-1 mt-1.5">
            {(Object.keys(NODE_FACTORS) as NodeType[]).map(nt => (
              <button key={nt} onClick={() => set("nodeType", nt)}
                className={`px-2 py-0.5 rounded text-[10px] border ${inp.nodeType === nt ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300"}`}>
                {nt} ({NODE_FACTORS[nt].m})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[9px] font-bold uppercase text-gray-400">
          Kapasitas Strut — f_cu = f&apos;c/(0,8 + 170·ε₁) ≤ 0,85·f&apos;c · ε₁ = (ε_s + 0,002)·cot²α_s
        </p>
        <table className="w-full max-w-md">
          <tbody>
            <Row label="ε₁ regangan tarik utama" value={f(r.eps1, 5)} />
            <Row label={`f_cu ${r.fcuCapped ? "(dibatasi 0,85f'c)" : ""}`} value={f(r.fcu, 2)} unit="MPa" hi />
            <Row label="P_n strut = f_cu·A_cs + f_y·A_ss" value={f(r.PnStrut, 0)} unit="kN" />
            <Row label="P_r = φ·P_n (φ = 0,70)" value={f(r.PrStrut, 0)} unit="kN" hi />
            <Row label="P_n tie = f_y·A_st + A_ps(f_pe + f_y)" value={f(r.PnTie, 0)} unit="kN" />
            <Row label="P_r tie = φ·P_n (φ = 0,90)" value={f(r.PrTie, 0)} unit="kN" hi />
            <Row label={`Batas node ${inp.nodeType} = m·φ·f'c`} value={f(r.nodeLimit, 2)} unit="MPa" />
            <Row label="σ node = P_u/A_n" value={f(r.sigmaNode, 2)} unit="MPa" />
            <Row label="ρ mesh tersedia" value={f(r.rhoProvided * 100, 3)} unit="%" />
          </tbody>
        </table>
        <Chk label="Strut" detail={`P_r ${f(r.PrStrut, 0)} ≥ P_u ${f(inp.PuStrut, 0)} kN`} ok={r.strutOk} />
        <Chk label="Tie" detail={`P_r ${f(r.PrTie, 0)} ≥ P_u ${f(inp.PuTie, 0)} kN`} ok={r.tieOk} />
        <Chk label={`Node ${inp.nodeType}`} detail={`${f(r.sigmaNode, 2)} ≤ ${f(r.nodeLimit, 2)} MPa`} ok={r.nodeOk} />
        <Chk label="Mesh kontrol retak (≥0,3% & s≤300)" detail={`ρ ${f(r.rhoProvided * 100, 2)}% · s ${inp.sBar} mm`} ok={r.crackOk} />

        <p className="text-[9px] font-bold uppercase text-gray-400 pt-2">
          Bantu Geometri — Truss Pier Cap 2 Panel Simetris (PCI §8.12.5)
        </p>
        <div className="grid grid-cols-4 gap-1.5 max-w-md">
          <Nf label="P_u per perletakan" unit="kN" value={truss.Pu} onChange={v => setT("Pu", v)} step={50} />
          <Nf label="a beban luar" unit="mm" value={truss.aOuter} onChange={v => setT("aOuter", v)} step={50} />
          <Nf label="a beban dalam" unit="mm" value={truss.aInner} onChange={v => setT("aInner", v)} step={50} />
          <Nf label="z lengan dalam" unit="mm" value={truss.z} onChange={v => setT("z", v)} step={50} />
        </div>
        <table className="w-full max-w-md">
          <tbody>
            <Row label="θ₁ diagonal luar" value={f(t.theta1, 1)} unit="°" />
            <Row label="θ₂ diagonal dalam" value={f(t.theta2, 1)} unit="°" />
            <Row label="F tie atas = P_u/tanθ₁ (tarik)" value={f(t.F_topTie, 0)} unit="kN" hi />
            <Row label="F diagonal luar = P_u/sinθ₁ (tekan)" value={f(t.F_diag1, 0)} unit="kN" />
            <Row label="F diagonal dalam = P_u/sinθ₂ (tekan)" value={f(t.F_diag2, 0)} unit="kN" />
            <Row label="F chord bawah maks (tekan)" value={f(t.F_chord, 0)} unit="kN" />
          </tbody>
        </table>
        <p className="text-[9px] text-gray-400 leading-snug">
          Pakai STM bila jarak beban–tumpuan &lt; 2× tinggi efektif (D-region): pier cap, deep beam,
          dapped-end (🪚), korbel (📐), zona angkur PT (blok angkur). θ strut–tie ≥ 25° disarankan.
          Langkah: tumpuan → geometri truss → tul. tie → penyaluran → strut → mesh retak → detailing.
        </p>
      </div>
    </div>
  );
}
