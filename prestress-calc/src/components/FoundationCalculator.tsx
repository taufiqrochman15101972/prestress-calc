"use client";

import React, { useState, useMemo } from "react";
import {
  computePileAxialCapacity, computePileGroupCapacity, computePileSettlement,
  computeLateralPileBroms, computePileDriving,
  type PileAxialInputs, type PileGroupCapInputs, type PileSettlementInputs,
  type LateralPileInputs, type PileDrivingInputs,
} from "@/engine/pilefoundation";
import {
  computeBearingCapacity, computeMachineFoundation, computeSSI,
  type BearingInputs, type MachineFoundationInputs, type SSIInputs,
} from "@/engine/foundationdynamics";

// ── shared field/row/check helpers ──────────────────────────────
function Nf({ label, unit, value, onChange, step = 1 }: {
  label: string; unit?: string; value: number; onChange: (v: number) => void; step?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-gray-500 leading-tight">{label}</span>
      <div className="relative flex items-center">
        <input type="number" value={value} step={step}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          className={`w-full rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ${unit ? "pr-10" : ""}`} />
        {unit && <span className="absolute right-1.5 text-[9px] text-gray-400 pointer-events-none">{unit}</span>}
      </div>
    </div>
  );
}
function Sel<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: [T, string][]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-gray-500 leading-tight">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value as T)}
        className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-400">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
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
      <span>{label}</span><span className="font-mono">{detail}</span>
      <span className="font-bold">{ok ? "✓ OK" : "✗ NG"}</span>
    </div>
  );
}
const f = (v: number, d = 1) => (isFinite(v) ? v.toFixed(d) : "—");

// ── Pile-in-soil SVG (static load path) ─────────────────────────
function PileDiagram({ install }: { install: string }) {
  return (
    <svg viewBox="0 0 200 230" className="w-44 h-52 border border-gray-200 rounded bg-slate-50">
      {/* soil layers */}
      <rect x="0" y="40" width="200" height="60" fill="#fef3c7" />
      <rect x="0" y="100" width="200" height="120" fill="#d6d3d1" />
      <line x1="0" y1="40" x2="200" y2="40" stroke="#a16207" strokeWidth="1" />
      <text x="6" y="70" fontSize="8" fill="#92400e">pasir / lempung atas</text>
      <text x="6" y="160" fontSize="8" fill="#57534e">lapisan pendukung</text>
      {/* water table */}
      <line x1="0" y1="62" x2="200" y2="62" stroke="#3b82f6" strokeDasharray="3 2" strokeWidth="1" />
      <text x="150" y="59" fontSize="7" fill="#2563eb">M.A.T ▽</text>
      {/* pile cap */}
      <rect x="70" y="28" width="60" height="14" fill="#94a3b8" stroke="#475569" />
      {/* pile */}
      <rect x="92" y="42" width="16" height="170" fill={install === "BORED" ? "#cbd5e1" : "#64748b"} stroke="#334155" />
      {/* load arrow */}
      <line x1="100" y1="6" x2="100" y2="26" stroke="#dc2626" strokeWidth="2" markerEnd="url(#ar)" />
      <text x="104" y="16" fontSize="8" fill="#dc2626">P</text>
      {/* skin friction arrows */}
      {[70, 110, 150, 185].map(y => (
        <g key={y}>
          <line x1="88" y1={y} x2="84" y2={y - 6} stroke="#2563eb" strokeWidth="1" />
          <line x1="112" y1={y} x2="116" y2={y - 6} stroke="#2563eb" strokeWidth="1" />
        </g>
      ))}
      <text x="118" y="120" fontSize="7" fill="#2563eb">Q_s</text>
      {/* end bearing */}
      <line x1="100" y1="222" x2="100" y2="212" stroke="#16a34a" strokeWidth="2" markerEnd="url(#ar2)" />
      <text x="104" y="222" fontSize="7" fill="#16a34a">Q_p</text>
      <defs>
        <marker id="ar" markerWidth="6" markerHeight="6" refX="3" refY="5" orient="auto"><path d="M0,0 L3,6 L6,0" fill="#dc2626" /></marker>
        <marker id="ar2" markerWidth="6" markerHeight="6" refX="3" refY="1" orient="auto"><path d="M0,6 L3,0 L6,6" fill="#16a34a" /></marker>
      </defs>
    </svg>
  );
}

type Tab = "axial" | "group" | "settle" | "lateral" | "driving" | "shallow" | "dynamic";
const TABS: [Tab, string][] = [
  ["axial", "Kapasitas Aksial Tiang"], ["group", "Grup Tiang"],
  ["settle", "Penurunan (Vesic)"], ["lateral", "Lateral (Broms)"],
  ["driving", "Pemancangan Dinamik"], ["shallow", "Daya Dukung Dangkal"],
  ["dynamic", "Fondasi Mesin / Dinamik + SSI"],
];

export function FoundationCalculator() {
  const [tab, setTab] = useState<Tab>("axial");

  // ── default inputs (filled from typical bridge-pile values) ──
  const [ax, setAx] = useState<PileAxialInputs>({
    install: "BORED", shape: "CIRCULAR", size: 0.8, length: 20, soil: "SAND",
    gamma: 18, waterDepth: 3, cu: 75, phi: 30, FS: 2.5,
  });
  const axR = useMemo(() => computePileAxialCapacity(ax), [ax]);
  const sAx = (k: keyof PileAxialInputs, v: number | string) => setAx(p => ({ ...p, [k]: v }));

  const [grp, setGrp] = useState<PileGroupCapInputs>({
    rows: 3, cols: 3, spacing: 2.4, size: 0.8, length: 20,
    QultSingle: 0, soil: "SAND", cu: 75, FS: 2.5,
  });
  const grpR = useMemo(() => computePileGroupCapacity({ ...grp, QultSingle: axR.Qult }), [grp, axR.Qult]);
  const sGrp = (k: keyof PileGroupCapInputs, v: number | string) => setGrp(p => ({ ...p, [k]: v }));

  const [set2, setSet2] = useState<PileSettlementInputs>({
    Qp: 800, Qs: 1500, length: 20, size: 0.8, tipArea: 0.503, perimeter: 2.513,
    Ep: 30000, Es: 40, mu: 0.3,
  });
  const setR = useMemo(() => computePileSettlement({
    ...set2, tipArea: axR.tipArea, perimeter: axR.perimeter, size: ax.size, length: ax.length,
  }), [set2, axR, ax.size, ax.length]);
  const sSet = (k: keyof PileSettlementInputs, v: number) => setSet2(p => ({ ...p, [k]: v }));

  const [lat, setLat] = useState<LateralPileInputs>({
    soil: "SAND", size: 0.8, length: 20, e: 1.0, cu: 75, phi: 30, gamma: 18,
    Myield: 900, headFixed: true,
  });
  const latR = useMemo(() => computeLateralPileBroms(lat), [lat]);
  const sLat = (k: keyof LateralPileInputs, v: number | string | boolean) => setLat(p => ({ ...p, [k]: v }));

  const [drv, setDrv] = useState<PileDrivingInputs>({
    formula: "HILEY", Eh: 50, eff: 0.8, set: 5, Wr: 35, Wp: 60, nRest: 0.5,
    cElastic: 12, length: 20, Ap: 0.503, Ep: 30000, FS: 3,
  });
  const drvR = useMemo(() => computePileDriving(drv), [drv]);
  const sDrv = (k: keyof PileDrivingInputs, v: number | string) => setDrv(p => ({ ...p, [k]: v }));

  const [brg, setBrg] = useState<BearingInputs>({
    B: 3, L: 4, Df: 2, gamma: 18, c: 10, phi: 30, P: 4000, FS: 3,
  });
  const brgR = useMemo(() => computeBearingCapacity(brg), [brg]);
  const sBrg = (k: keyof BearingInputs, v: number) => setBrg(p => ({ ...p, [k]: v }));

  const [mac, setMac] = useState<MachineFoundationInputs>({
    B: 3, L: 4, height: 1.5, weight: 800, G: 60, mu: 0.33, rhoSoil: 1900,
    rpm: 600, meE: 0.5, ampAllow: 0.2, mode: "VERTICAL",
  });
  const macR = useMemo(() => computeMachineFoundation(mac), [mac]);
  const sMac = (k: keyof MachineFoundationInputs, v: number | string) => setMac(p => ({ ...p, [k]: v }));

  const [ssi, setSsi] = useState<SSIInputs>({
    Tfixed: 0.8, kStruct: 50000, height: 8, G: 60, mu: 0.33, r0: 1.95,
  });
  const ssiR = useMemo(() => computeSSI(ssi), [ssi]);
  const sSsi = (k: keyof SSIInputs, v: number) => setSsi(p => ({ ...p, [k]: v }));

  return (
    <div className="text-[11px]">
      <div className="flex flex-wrap gap-1 mb-3">
        {TABS.map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-2 py-1 rounded text-[10px] border ${tab === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>{l}</button>
        ))}
      </div>

      <div className="flex gap-4">
        {/* INPUTS */}
        <div className="w-60 flex-none space-y-2">
          {tab === "axial" && (<>
            <p className="text-[9px] font-bold text-gray-500 uppercase">Tiang Tunggal — Statik</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Sel label="Pemasangan" value={ax.install} onChange={v => sAx("install", v)} options={[["DRIVEN", "Pancang (driven)"], ["BORED", "Bor (bored/shaft)"]]} />
              <Sel label="Penampang" value={ax.shape} onChange={v => sAx("shape", v)} options={[["CIRCULAR", "Bulat"], ["SQUARE", "Bujur sangkar"]]} />
              <Nf label="D / sisi" unit="m" value={ax.size} step={0.1} onChange={v => sAx("size", v)} />
              <Nf label="Panjang L" unit="m" value={ax.length} step={1} onChange={v => sAx("length", v)} />
              <Sel label="Tanah" value={ax.soil} onChange={v => sAx("soil", v)} options={[["CLAY", "Lempung (cu)"], ["SAND", "Pasir (φ)"]]} />
              <Nf label="γ tanah" unit="kN/m³" value={ax.gamma} step={0.5} onChange={v => sAx("gamma", v)} />
              <Nf label="M.A.T" unit="m" value={ax.waterDepth} step={0.5} onChange={v => sAx("waterDepth", v)} />
              {ax.soil === "CLAY" ? <Nf label="c_u" unit="kPa" value={ax.cu} step={5} onChange={v => sAx("cu", v)} />
                : <Nf label="φ'" unit="°" value={ax.phi} step={1} onChange={v => sAx("phi", v)} />}
              <Nf label="FS" value={ax.FS} step={0.5} onChange={v => sAx("FS", v)} />
            </div>
            <PileDiagram install={ax.install} />
          </>)}
          {tab === "group" && (<>
            <p className="text-[9px] font-bold text-gray-500 uppercase">Grup Tiang (Converse-Labarre + blok)</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Nf label="baris m" value={grp.rows} step={1} onChange={v => sGrp("rows", v)} />
              <Nf label="kolom n" value={grp.cols} step={1} onChange={v => sGrp("cols", v)} />
              <Nf label="spasi s" unit="m" value={grp.spacing} step={0.1} onChange={v => sGrp("spacing", v)} />
              <Nf label="FS" value={grp.FS} step={0.5} onChange={v => sGrp("FS", v)} />
            </div>
            <p className="text-[9px] text-gray-400">Q_ult tiang tunggal diambil dari tab Aksial = {f(axR.Qult, 0)} kN.</p>
          </>)}
          {tab === "settle" && (<>
            <p className="text-[9px] font-bold text-gray-500 uppercase">Penurunan Tiang (Vesic)</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Nf label="Q_p kerja" unit="kN" value={set2.Qp} step={50} onChange={v => sSet("Qp", v)} />
              <Nf label="Q_s kerja" unit="kN" value={set2.Qs} step={50} onChange={v => sSet("Qs", v)} />
              <Nf label="E_p tiang" unit="MPa" value={set2.Ep} step={1000} onChange={v => sSet("Ep", v)} />
              <Nf label="E_s tanah" unit="MPa" value={set2.Es} step={5} onChange={v => sSet("Es", v)} />
              <Nf label="μ tanah" value={set2.mu} step={0.05} onChange={v => sSet("mu", v)} />
            </div>
          </>)}
          {tab === "lateral" && (<>
            <p className="text-[9px] font-bold text-gray-500 uppercase">Lateral — Broms</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Sel label="Tanah" value={lat.soil} onChange={v => sLat("soil", v)} options={[["CLAY", "Lempung"], ["SAND", "Pasir"]]} />
              <Sel label="Kepala" value={lat.headFixed ? "F" : "P"} onChange={v => sLat("headFixed", v === "F")} options={[["F", "Terjepit"], ["P", "Bebas"]]} />
              <Nf label="D" unit="m" value={lat.size} step={0.1} onChange={v => sLat("size", v)} />
              <Nf label="L" unit="m" value={lat.length} step={1} onChange={v => sLat("length", v)} />
              <Nf label="e (lengan)" unit="m" value={lat.e} step={0.25} onChange={v => sLat("e", v)} />
              <Nf label="M_yield" unit="kN·m" value={lat.Myield} step={50} onChange={v => sLat("Myield", v)} />
              {lat.soil === "CLAY" ? <Nf label="c_u" unit="kPa" value={lat.cu} step={5} onChange={v => sLat("cu", v)} />
                : <><Nf label="φ'" unit="°" value={lat.phi} step={1} onChange={v => sLat("phi", v)} /><Nf label="γ" unit="kN/m³" value={lat.gamma} step={0.5} onChange={v => sLat("gamma", v)} /></>}
            </div>
          </>)}
          {tab === "driving" && (<>
            <p className="text-[9px] font-bold text-gray-500 uppercase">Pemancangan Dinamik (set/blow)</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Sel label="Rumus" value={drv.formula} onChange={v => sDrv("formula", v)} options={[["ENR", "ENR"], ["MODIFIED_ENR", "Modified ENR"], ["HILEY", "Hiley"], ["JANBU", "Janbu"]]} />
              <Nf label="E_h energi" unit="kN·m" value={drv.Eh} step={5} onChange={v => sDrv("Eh", v)} />
              <Nf label="η_h efisiensi" value={drv.eff} step={0.05} onChange={v => sDrv("eff", v)} />
              <Nf label="set/blow" unit="mm" value={drv.set} step={1} onChange={v => sDrv("set", v)} />
              <Nf label="W_ram" unit="kN" value={drv.Wr} step={5} onChange={v => sDrv("Wr", v)} />
              <Nf label="W_pile" unit="kN" value={drv.Wp} step={5} onChange={v => sDrv("Wp", v)} />
              <Nf label="n restitusi" value={drv.nRest} step={0.05} onChange={v => sDrv("nRest", v)} />
              <Nf label="c elastik" unit="mm" value={drv.cElastic} step={1} onChange={v => sDrv("cElastic", v)} />
              <Nf label="FS" value={drv.FS} step={0.5} onChange={v => sDrv("FS", v)} />
            </div>
          </>)}
          {tab === "shallow" && (<>
            <p className="text-[9px] font-bold text-gray-500 uppercase">Daya Dukung Dangkal (Vesic)</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Nf label="B" unit="m" value={brg.B} step={0.5} onChange={v => sBrg("B", v)} />
              <Nf label="L" unit="m" value={brg.L} step={0.5} onChange={v => sBrg("L", v)} />
              <Nf label="D_f" unit="m" value={brg.Df} step={0.5} onChange={v => sBrg("Df", v)} />
              <Nf label="γ" unit="kN/m³" value={brg.gamma} step={0.5} onChange={v => sBrg("gamma", v)} />
              <Nf label="c" unit="kPa" value={brg.c} step={5} onChange={v => sBrg("c", v)} />
              <Nf label="φ" unit="°" value={brg.phi} step={1} onChange={v => sBrg("phi", v)} />
              <Nf label="P layan" unit="kN" value={brg.P} step={100} onChange={v => sBrg("P", v)} />
              <Nf label="FS" value={brg.FS} step={0.5} onChange={v => sBrg("FS", v)} />
            </div>
          </>)}
          {tab === "dynamic" && (<>
            <p className="text-[9px] font-bold text-gray-500 uppercase">Fondasi Mesin (half-space)</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Sel label="Mode" value={mac.mode} onChange={v => sMac("mode", v)} options={[["VERTICAL", "Vertikal"], ["HORIZONTAL", "Horizontal"], ["ROCKING", "Rocking"], ["TORSION", "Torsi"]]} />
              <Nf label="B" unit="m" value={mac.B} step={0.5} onChange={v => sMac("B", v)} />
              <Nf label="L" unit="m" value={mac.L} step={0.5} onChange={v => sMac("L", v)} />
              <Nf label="tinggi blok" unit="m" value={mac.height} step={0.25} onChange={v => sMac("height", v)} />
              <Nf label="berat total" unit="kN" value={mac.weight} step={50} onChange={v => sMac("weight", v)} />
              <Nf label="G tanah" unit="MPa" value={mac.G} step={5} onChange={v => sMac("G", v)} />
              <Nf label="μ tanah" value={mac.mu} step={0.02} onChange={v => sMac("mu", v)} />
              <Nf label="ρ tanah" unit="kg/m³" value={mac.rhoSoil} step={50} onChange={v => sMac("rhoSoil", v)} />
              <Nf label="rpm mesin" value={mac.rpm} step={50} onChange={v => sMac("rpm", v)} />
              <Nf label="m_e·e" unit="kg·m" value={mac.meE} step={0.1} onChange={v => sMac("meE", v)} />
              <Nf label="amplitudo izin" unit="mm" value={mac.ampAllow} step={0.05} onChange={v => sMac("ampAllow", v)} />
            </div>
            <p className="text-[9px] font-bold text-gray-500 uppercase pt-1">Interaksi Tanah-Struktur (SSI)</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Nf label="T jepit" unit="s" value={ssi.Tfixed} step={0.05} onChange={v => sSsi("Tfixed", v)} />
              <Nf label="k struktur" unit="kN/m" value={ssi.kStruct} step={5000} onChange={v => sSsi("kStruct", v)} />
              <Nf label="tinggi c.g." unit="m" value={ssi.height} step={0.5} onChange={v => sSsi("height", v)} />
              <Nf label="r0 fondasi" unit="m" value={ssi.r0} step={0.1} onChange={v => sSsi("r0", v)} />
            </div>
          </>)}
        </div>

        {/* RESULTS */}
        <div className="flex-1 min-w-0 space-y-2">
          {tab === "axial" && (<>
            <p className="text-[9px] font-bold uppercase text-gray-400">Q_ult = Q_s + Q_p (Bowles / Budhu / TM 5-818-1)</p>
            <table className="w-full max-w-md"><tbody>
              <Row label="Keliling tiang" value={f(axR.perimeter, 3)} unit="m" />
              <Row label="Luas ujung A_p" value={f(axR.tipArea, 3)} unit="m²" />
              {ax.soil === "CLAY"
                ? <Row label="α adhesi (α-method)" value={f(axR.alpha, 2)} />
                : <><Row label="β = K·tanδ" value={f(axR.beta, 3)} /><Row label="N_q ujung" value={f(axR.Nq, 1)} /></>}
              <Row label="f_s rata-rata selimut" value={f(axR.fsAvg, 1)} unit="kPa" />
              <Row label="q_p ujung" value={f(axR.qp, 1)} unit="kPa" />
              <Row label="Q_s (selimut)" value={f(axR.Qs, 0)} unit="kN" />
              <Row label="Q_p (ujung)" value={f(axR.Qp, 0)} unit="kN" />
              <Row label="Q_ult" value={f(axR.Qult, 0)} unit="kN" hi />
              <Row label={`Q_all = Q_ult/${ax.FS}`} value={f(axR.Qall, 0)} unit="kN" hi />
            </tbody></table>
            <p className="text-[9px] text-gray-500 leading-snug">Selimut α-method (lempung f_s=α·c_u) atau β-method (pasir f_s=K·σ′_v·tanδ); ujung 9·c_u (lempung) atau σ′_v·N_q (pasir). Tiang bor direduksi (α×0.7, N_q×0.6). Demand per tiang dari grup-cap → tab Substructure 🏛️.</p>
          </>)}
          {tab === "group" && (<>
            <table className="w-full max-w-md"><tbody>
              <Row label="Jumlah tiang n" value={`${grpR.nPiles}`} />
              <Row label="Efisiensi η (Converse-Labarre)" value={f(grpR.efficiency, 3)} hi />
              <Row label="Q_grup individu = η·n·Q_ult" value={f(grpR.QgroupIndiv, 0)} unit="kN" />
              <Row label="Q_blok (lempung)" value={isFinite(grpR.Qblock) ? f(grpR.Qblock, 0) : "n/a (pasir)"} unit="kN" />
              <Row label="B_grup × L_grup" value={`${f(grpR.Bg, 2)} × ${f(grpR.Lg, 2)}`} unit="m" />
              <Row label="Q_grup governing" value={f(grpR.Qgroup, 0)} unit="kN" hi />
              <Row label={`Q_grup,all = /${grp.FS}`} value={f(grpR.QgroupAll, 0)} unit="kN" hi />
            </tbody></table>
          </>)}
          {tab === "settle" && (<>
            <table className="w-full max-w-md"><tbody>
              <Row label="s₁ kompresi elastik tiang" value={f(setR.s1, 3)} unit="mm" />
              <Row label="s₂ beban ujung (Vesic)" value={f(setR.s2, 3)} unit="mm" />
              <Row label="s₃ beban selimut" value={f(setR.s3, 3)} unit="mm" />
              <Row label="s total" value={f(setR.total, 2)} unit="mm" hi />
              <Row label="s izin" value={f(setR.allowable, 1)} unit="mm" />
            </tbody></table>
            <Chk label="Penurunan ≤ izin" detail={`${f(setR.total, 1)} ≤ ${f(setR.allowable, 1)} mm`} ok={setR.ok} />
          </>)}
          {tab === "lateral" && (<>
            <table className="w-full max-w-md"><tbody>
              {lat.soil === "SAND" && <Row label="K_p = tan²(45+φ/2)" value={f(latR.Kp, 2)} />}
              <Row label="H_u tiang pendek" value={f(latR.HuShort, 1)} unit="kN" />
              <Row label="H_u tiang panjang (leleh)" value={f(latR.HuLong, 1)} unit="kN" />
              <Row label="H_u governing" value={f(latR.Hu, 1)} unit="kN" hi />
            </tbody></table>
            <p className="text-[9px] text-gray-500">Mode kegagalan: <b>{latR.mode}</b>. Broms — kepala {lat.headFixed ? "terjepit" : "bebas"}.</p>
          </>)}
          {tab === "driving" && (<>
            <table className="w-full max-w-md"><tbody>
              <Row label="Rumus" value={drv.formula} />
              <Row label="R_u kapasitas ultimit" value={f(drvR.Ru, 0)} unit="kN" hi />
              <Row label={`R_a = R_u/${drv.FS}`} value={f(drvR.Ra, 0)} unit="kN" hi />
            </tbody></table>
            <p className="text-[9px] text-gray-500 leading-snug">{drvR.note} Wave-equation (GRLWEAP / bearing graph, Vulcanhammer) memberi prediksi lebih teliti — rumus dinamik ini untuk kontrol lapangan set/blow.</p>
          </>)}
          {tab === "shallow" && (<>
            <p className="text-[9px] font-bold uppercase text-gray-400">q_ult = c·N_c·s_c·d_c + q·N_q·s_q·d_q + ½γB·N_γ·s_γ·d_γ</p>
            <table className="w-full max-w-md"><tbody>
              <Row label="N_c / N_q / N_γ" value={`${f(brgR.Nc, 1)} / ${f(brgR.Nq, 1)} / ${f(brgR.Ngamma, 1)}`} />
              <Row label="s_c / s_q / s_γ" value={`${f(brgR.sc, 2)} / ${f(brgR.sq, 2)} / ${f(brgR.sgamma, 2)}`} />
              <Row label="d_c / d_q / d_γ" value={`${f(brgR.dc, 2)} / ${f(brgR.dq, 2)} / ${f(brgR.dgamma, 2)}`} />
              <Row label="q_ult" value={f(brgR.qult, 0)} unit="kPa" hi />
              <Row label={`q_all = q_ult/${brg.FS}`} value={f(brgR.qall, 0)} unit="kPa" hi />
              <Row label="q_terjadi = P/(B·L)" value={f(brgR.qApplied, 0)} unit="kPa" />
            </tbody></table>
            <Chk label="q_terjadi ≤ q_all" detail={`${f(brgR.qApplied, 0)} ≤ ${f(brgR.qall, 0)} kPa`} ok={brgR.ok} />
          </>)}
          {tab === "dynamic" && (<>
            <p className="text-[9px] font-bold uppercase text-gray-400">Fondasi Mesin — half-space (Das / Richart) · mode {mac.mode}</p>
            <table className="w-full max-w-md"><tbody>
              <Row label="r0 jari-jari ekuivalen" value={f(macR.r0, 3)} unit="m" />
              <Row label="k kekakuan dinamik" value={f(macR.k, 0)} unit="kN/m" />
              <Row label="rasio massa B" value={f(macR.Bmass, 3)} />
              <Row label="rasio redaman D" value={f(macR.D, 3)} />
              <Row label="f_n frekuensi natural" value={f(macR.fn, 2)} unit="Hz" hi />
              <Row label="f_op operasi" value={f(macR.fop, 2)} unit="Hz" />
              <Row label="rasio f_op/f_n" value={f(macR.freqRatio, 2)} hi />
              <Row label="amplitudo" value={f(macR.amplitude, 4)} unit="mm" hi />
            </tbody></table>
            <Chk label="Jauh dari resonansi (±20%)" detail={`r = ${f(macR.freqRatio, 2)}`} ok={macR.resonanceOk} />
            <Chk label="Amplitudo ≤ izin" detail={`${f(macR.amplitude, 4)} ≤ ${mac.ampAllow} mm`} ok={macR.amplitudeOk} />
            <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">SSI — perpanjangan perioda (Veletsos)</p>
            <table className="w-full max-w-md"><tbody>
              <Row label="K_x sway" value={f(ssiR.Kx, 0)} unit="kN/m" />
              <Row label="K_φ rocking" value={f(ssiR.Kphi, 0)} unit="kN·m/rad" />
              <Row label="T̃ perioda fleksibel" value={f(ssiR.Tssi, 3)} unit="s" hi />
              <Row label="T̃/T" value={f(ssiR.ratio, 3)} hi />
            </tbody></table>
          </>)}
        </div>
      </div>
    </div>
  );
}
