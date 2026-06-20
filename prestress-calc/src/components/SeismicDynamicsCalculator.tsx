"use client";

import React, { useState, useMemo } from "react";
import {
  computeSDOF, computeModal2, computeCapacityDesign, computeLiquefaction,
  type SDOFInputs, type Modal2Inputs, type CapacityDesignInputs, type LiquefactionInputs,
} from "@/engine/seismicdynamics";

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
const f = (v: number, d = 2) => (isFinite(v) ? v.toFixed(d) : "—");

type Tab = "sdof" | "modal" | "capacity" | "liquefaction";
const TABS: [Tab, string][] = [
  ["sdof", "Respons SDOF"], ["modal", "Modal 2-DOF (SRSS)"],
  ["capacity", "Desain Kapasitas (Sendi Plastis)"], ["liquefaction", "Likuifaksi"],
];

export function SeismicDynamicsCalculator() {
  const [tab, setTab] = useState<Tab>("capacity");

  const [sd, setSd] = useState<SDOFInputs>({ W: 5000, K: 40000, zeta: 0.05, Sa: 0.6 });
  const sdR = useMemo(() => computeSDOF(sd), [sd]);
  const sSd = (k: keyof SDOFInputs, v: number) => setSd(p => ({ ...p, [k]: v }));

  const [md, setMd] = useState<Modal2Inputs>({ m1: 300, m2: 200, k1: 80000, k2: 50000, Sa1: 0.6, Sa2: 0.5 });
  const mdR = useMemo(() => computeModal2(md), [md]);
  const sMd = (k: keyof Modal2Inputs, v: number) => setMd(p => ({ ...p, [k]: v }));

  const [cd, setCd] = useState<CapacityDesignInputs>({
    Mp: 4500, H: 8, fixity: "CANTILEVER", lambdaO: 1.2, D: 1.2,
    phiY: 0.0045, phiU: 0.035, fye: 420, dbl: 25, Pdl: 6000, deltaD: 0.12,
  });
  const cdR = useMemo(() => computeCapacityDesign(cd), [cd]);
  const sCd = (k: keyof CapacityDesignInputs, v: number | string) => setCd(p => ({ ...p, [k]: v }));

  const [lq, setLq] = useState<LiquefactionInputs>({
    z: 6, gamma: 18, waterDepth: 2, amax: 0.35, N160: 12, fines: 15, Mw: 7.0,
  });
  const lqR = useMemo(() => computeLiquefaction(lq), [lq]);
  const sLq = (k: keyof LiquefactionInputs, v: number) => setLq(p => ({ ...p, [k]: v }));

  return (
    <div className="text-[11px]">
      <div className="flex flex-wrap gap-1 mb-3">
        {TABS.map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-2 py-1 rounded text-[10px] border ${tab === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>{l}</button>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="w-60 flex-none space-y-2">
          {tab === "sdof" && (<>
            <p className="text-[9px] font-bold text-gray-500 uppercase">Pier sebagai osilator SDOF</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Nf label="W tributari" unit="kN" value={sd.W} step={250} onChange={v => sSd("W", v)} />
              <Nf label="K kekakuan" unit="kN/m" value={sd.K} step={5000} onChange={v => sSd("K", v)} />
              <Nf label="ζ redaman" value={sd.zeta} step={0.01} onChange={v => sSd("zeta", v)} />
              <Nf label="Sa @T" unit="g" value={sd.Sa} step={0.05} onChange={v => sSd("Sa", v)} />
            </div>
            <p className="text-[9px] text-gray-400">Sa diambil dari spektrum SNI 2833 (tab 🌎) pada perioda T.</p>
          </>)}
          {tab === "modal" && (<>
            <p className="text-[9px] font-bold text-gray-500 uppercase">2-DOF (massa dek + kepala pilar)</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Nf label="m₁ bawah" unit="ton" value={md.m1} step={10} onChange={v => sMd("m1", v)} />
              <Nf label="m₂ atas" unit="ton" value={md.m2} step={10} onChange={v => sMd("m2", v)} />
              <Nf label="k₁ bawah" unit="kN/m" value={md.k1} step={5000} onChange={v => sMd("k1", v)} />
              <Nf label="k₂ atas" unit="kN/m" value={md.k2} step={5000} onChange={v => sMd("k2", v)} />
              <Nf label="Sa(T₁)" unit="g" value={md.Sa1} step={0.05} onChange={v => sMd("Sa1", v)} />
              <Nf label="Sa(T₂)" unit="g" value={md.Sa2} step={0.05} onChange={v => sMd("Sa2", v)} />
            </div>
          </>)}
          {tab === "capacity" && (<>
            <p className="text-[9px] font-bold text-gray-500 uppercase">Desain Kapasitas Pilar (AASHTO/Caltrans)</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Nf label="M_p kolom" unit="kN·m" value={cd.Mp} step={250} onChange={v => sCd("Mp", v)} />
              <Nf label="H kolom" unit="m" value={cd.H} step={0.5} onChange={v => sCd("H", v)} />
              <Sel label="kekangan" value={cd.fixity} onChange={v => sCd("fixity", v)} options={[["CANTILEVER", "Kantilever"], ["FIXED", "Jepit-jepit"]]} />
              <Nf label="λ_o overstrength" value={cd.lambdaO} step={0.05} onChange={v => sCd("lambdaO", v)} />
              <Nf label="D kolom" unit="m" value={cd.D} step={0.1} onChange={v => sCd("D", v)} />
              <Nf label="φ_y leleh" unit="1/m" value={cd.phiY} step={0.001} onChange={v => sCd("phiY", v)} />
              <Nf label="φ_u ultimit" unit="1/m" value={cd.phiU} step={0.005} onChange={v => sCd("phiU", v)} />
              <Nf label="f_ye" unit="MPa" value={cd.fye} step={20} onChange={v => sCd("fye", v)} />
              <Nf label="d_bl" unit="mm" value={cd.dbl} step={1} onChange={v => sCd("dbl", v)} />
              <Nf label="P_dl" unit="kN" value={cd.Pdl} step={250} onChange={v => sCd("Pdl", v)} />
              <Nf label="Δ_D demand" unit="m" value={cd.deltaD} step={0.01} onChange={v => sCd("deltaD", v)} />
            </div>
          </>)}
          {tab === "liquefaction" && (<>
            <p className="text-[9px] font-bold text-gray-500 uppercase">Likuifaksi (Seed–Idriss / Youd)</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Nf label="z kedalaman" unit="m" value={lq.z} step={0.5} onChange={v => sLq("z", v)} />
              <Nf label="γ tanah" unit="kN/m³" value={lq.gamma} step={0.5} onChange={v => sLq("gamma", v)} />
              <Nf label="M.A.T" unit="m" value={lq.waterDepth} step={0.5} onChange={v => sLq("waterDepth", v)} />
              <Nf label="a_max" unit="g" value={lq.amax} step={0.05} onChange={v => sLq("amax", v)} />
              <Nf label="(N₁)₆₀" value={lq.N160} step={1} onChange={v => sLq("N160", v)} />
              <Nf label="fines FC" unit="%" value={lq.fines} step={1} onChange={v => sLq("fines", v)} />
              <Nf label="Mw magnitudo" value={lq.Mw} step={0.1} onChange={v => sLq("Mw", v)} />
            </div>
          </>)}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {tab === "sdof" && (<>
            <p className="text-[9px] font-bold uppercase text-gray-400">T=2π√(m/K), V=Sa·B·W, Sd=Sa·g/ω²</p>
            <table className="w-full max-w-md"><tbody>
              <Row label="massa m = W/g" value={f(sdR.mass, 1)} unit="ton" />
              <Row label="ω frekuensi sudut" value={f(sdR.omega, 2)} unit="rad/s" />
              <Row label="T perioda" value={f(sdR.T, 3)} unit="s" hi />
              <Row label="faktor redaman B" value={f(sdR.damping, 3)} />
              <Row label="Sa terkoreksi" value={f(sdR.Sa, 3)} unit="g" />
              <Row label="Sd perpindahan spektral" value={f(sdR.Sd * 1000, 1)} unit="mm" hi />
              <Row label="V_base gaya geser dasar" value={f(sdR.Vbase, 0)} unit="kN" hi />
            </tbody></table>
          </>)}
          {tab === "modal" && (<>
            <p className="text-[9px] font-bold uppercase text-gray-400">Eigen 2-DOF + SRSS (det(K−ω²M)=0)</p>
            <table className="w-full max-w-md"><tbody>
              <Row label="T₁ (mode 1)" value={f(mdR.T1, 3)} unit="s" hi />
              <Row label="T₂ (mode 2)" value={f(mdR.T2, 3)} unit="s" />
              <Row label="mode 1 φ = (1, …)" value={`(${f(mdR.phi1[0], 2)}, ${f(mdR.phi1[1], 2)})`} />
              <Row label="mode 2 φ = (1, …)" value={`(${f(mdR.phi2[0], 2)}, ${f(mdR.phi2[1], 2)})`} />
              <Row label="Γ₁ partisipasi" value={f(mdR.Gamma1, 3)} />
              <Row label="rasio massa efektif mode 1" value={f(mdR.Mratio1 * 100, 1)} unit="%" />
              <Row label="V_base SRSS" value={f(mdR.Vbase, 0)} unit="kN" hi />
            </tbody></table>
          </>)}
          {tab === "capacity" && (<>
            <p className="text-[9px] font-bold uppercase text-gray-400">Sendi plastis, daktilitas perpindahan, P-Δ</p>
            <table className="w-full max-w-md"><tbody>
              <Row label="M_po = λ_o·M_p (overstrength)" value={f(cdR.Mpo, 0)} unit="kN·m" hi />
              <Row label="V_po geser kapasitas" value={f(cdR.Vpo, 0)} unit="kN" hi />
              <Row label="L_p panjang sendi plastis" value={f(cdR.Lp, 3)} unit="m" />
              <Row label="Δ_y leleh" value={f(cdR.deltaY * 1000, 1)} unit="mm" />
              <Row label="θ_p rotasi plastis" value={f(cdR.thetaP, 4)} unit="rad" />
              <Row label="Δ_p plastis" value={f(cdR.deltaP * 1000, 1)} unit="mm" />
              <Row label="Δ_C kapasitas perpindahan" value={f(cdR.deltaC * 1000, 1)} unit="mm" hi />
              <Row label="μ_Δ daktilitas perpindahan" value={f(cdR.muDelta, 2)} hi />
            </tbody></table>
            <Chk label="Δ_D ≤ Δ_C (kapasitas perpindahan)" detail={`${f(cd.deltaD * 1000, 0)} ≤ ${f(cdR.deltaC * 1000, 0)} mm`} ok={cdR.displOk} />
            <Chk label="P-Δ: P_dl·Δ ≤ 0,25·M_p" detail={`rasio ${f(cdR.PdeltaRatio, 3)} ≤ 0,25`} ok={cdR.PdeltaOk} />
            <p className="text-[9px] text-gray-500 leading-snug">Kapasitas-protected: geser kolom, joint, fondasi & pile dirancang untuk V_po (overstrength) agar sendi plastis lentur terbentuk lebih dulu (daktail).</p>
          </>)}
          {tab === "liquefaction" && (<>
            <p className="text-[9px] font-bold uppercase text-gray-400">CSR vs CRR · FS = CRR·MSF/CSR</p>
            <table className="w-full max-w-md"><tbody>
              <Row label="σ_v total" value={f(lqR.sigmaV, 1)} unit="kPa" />
              <Row label="σ'_v efektif" value={f(lqR.sigmaVeff, 1)} unit="kPa" />
              <Row label="r_d reduksi tegangan" value={f(lqR.rd, 3)} />
              <Row label="CSR rasio tegangan siklik" value={f(lqR.CSR, 3)} hi />
              <Row label="(N₁)₆₀cs clean-sand" value={f(lqR.N160cs, 1)} />
              <Row label="CRR₇.₅ resistansi" value={f(lqR.CRR75, 3)} />
              <Row label="MSF skala magnitudo" value={f(lqR.MSF, 3)} />
              <Row label="FS = CRR·MSF/CSR" value={f(lqR.FS, 2)} hi />
            </tbody></table>
            <Chk label="FS ≥ 1,0 (tak terjadi likuifaksi)" detail={`FS = ${f(lqR.FS, 2)}`} ok={!lqR.liquefies} />
            <p className="text-[9px] text-gray-500 leading-snug">Jika likuifaksi terjadi (FS&lt;1), perlu mitigasi (perbaikan tanah / tiang lebih dalam) — kapasitas tiang & p-y tereduksi pada lapisan terlikuifaksi.</p>
          </>)}
        </div>
      </div>
    </div>
  );
}
