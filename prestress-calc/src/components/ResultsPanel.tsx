"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { SectionDiagram } from "@/components/SectionDiagram";
import { StressDistributionChart } from "@/components/StressDistributionChart";
import { MomentDiagram } from "@/components/MomentDiagram";
import { TendonProfileChart } from "@/components/TendonProfileChart";
import { useDesignStore, resolveTendon } from "@/store/useDesignStore";
import { fmt, fmtStress } from "@/lib/utils";
import { checkDuctility, checkMinSteel, checkFatigue, PCI_MULTIPLIERS } from "@/engine/uls";
import { DeflectionChart } from "@/components/DeflectionChart";
import { MagnelDiagram } from "@/components/MagnelDiagram";
import { TendonZoneChart } from "@/components/TendonZoneChart";
import type { FiberStressResult, DesignResults } from "@/types";

// ─── Small helpers ────────────────────────────────────────────

function ResultRow({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-1 pr-3 text-gray-500 text-[10px]">{label}</td>
      <td className="py-1 font-mono text-right text-[10px] font-semibold text-gray-800">{value}</td>
      {unit && <td className="py-1 pl-1 text-gray-400 text-[10px]">{unit}</td>}
    </tr>
  );
}

function FiberRow({ result }: { result: FiberStressResult }) {
  const over = !result.isSafe;
  return (
    <tr className={`border-b border-gray-100 ${over ? "bg-red-50" : ""}`}>
      <td className="py-1 pr-2 text-[10px] text-gray-600">{result.fiber}</td>
      <td className={`py-1 font-mono text-[10px] text-right font-semibold ${over ? "text-red-600" : "text-gray-800"}`}>
        {fmtStress(result.stressMpa)}
      </td>
      <td className="py-1 text-[10px] text-right text-gray-400">−{result.limitCompMpa.toFixed(1)}</td>
      <td className="py-1 text-[10px] text-right text-gray-400">+{result.limitTensMpa.toFixed(2)}</td>
      <td className="py-1 text-right pl-1">
        <Badge variant={result.isSafe ? "success" : "danger"} className="text-[9px] px-1.5 py-0">
          {result.verdict}
        </Badge>
      </td>
    </tr>
  );
}

// ─── Tab contents ─────────────────────────────────────────────

function SectionTab({ r }: { r: DesignResults }) {
  const g = r.gross; const c = r.composite;
  return (
    <div className="space-y-3">
      <p className="text-[9px] font-bold uppercase text-gray-400">Non-Komposit</p>
      <table className="w-full"><tbody>
        <ResultRow label="A_g" value={fmt(g.areaAg)} unit="mm²" />
        <ResultRow label="y_b" value={fmt(g.yb)} unit="mm" />
        <ResultRow label="y_t" value={fmt(g.yt)} unit="mm" />
        <ResultRow label="I_g" value={`${(g.momentOfInertiaIg/1e11).toFixed(4)}×10¹¹`} unit="mm⁴" />
        <ResultRow label="Z_tg" value={`${(g.Ztg/1e6).toFixed(3)}×10⁶`} unit="mm³" />
        <ResultRow label="Z_bg" value={`${(g.Zbg/1e6).toFixed(3)}×10⁶`} unit="mm³" />
      </tbody></table>
      <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Efisiensi & Kern (Nilson §4.3)</p>
      <table className="w-full"><tbody>
        <ResultRow label="r² = I_g/A_g" value={fmt(g.r2)} unit="mm²" />
        <ResultRow label="k_t (kern atas = r²/y_b)" value={fmt(g.kt)} unit="mm" />
        <ResultRow label="k_b (kern bawah = r²/y_t)" value={fmt(g.kb)} unit="mm" />
        <ResultRow label="ρ efisiensi = r²/(y_t·y_b)" value={g.efficiency.toFixed(3)} />
      </tbody></table>
      <div className="text-[9px] text-gray-400 pl-1 -mt-1">
        ρ→1 ideal; ρ≈0.33 persegi. Gaya prategang dalam zona kern (−k_b…k_t) ⇒ seluruh penampang tertekan.
      </div>
      <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Komposit</p>
      <table className="w-full"><tbody>
        <ResultRow label="n_c" value={c.modularRatioNc.toFixed(4)} />
        <ResultRow label="A_c" value={fmt(c.compositeAreaAc)} unit="mm²" />
        <ResultRow label="y_bc" value={fmt(c.ybc)} unit="mm" />
        <ResultRow label="y_tgc" value={fmt(c.ytgc)} unit="mm" />
        <ResultRow label="I_c" value={`${(c.momentOfInertiaIc/1e11).toFixed(4)}×10¹¹`} unit="mm⁴" />
        <ResultRow label="Z_bc" value={`${(c.Zbc/1e6).toFixed(3)}×10⁶`} unit="mm³" />
        <ResultRow label="Z_tgc" value={`${(c.Ztgc/1e6).toFixed(3)}×10⁶`} unit="mm³" />
        <ResultRow label="Z_ttc" value={`${(c.Zttc/1e6).toFixed(3)}×10⁶`} unit="mm³" />
      </tbody></table>
    </div>
  );
}

function MomentsTab({ r }: { r: DesignResults }) {
  const m = r.moments; const p = r.prestress;
  return (
    <div className="space-y-3">
      <p className="text-[9px] font-bold uppercase text-gray-400">Momen Lentur</p>
      <table className="w-full"><tbody>
        <ResultRow label="w_self" value={fmt(m.wSelf,3)} unit="kN/m" />
        <ResultRow label="M_g" value={fmt(m.Mg)} unit="kN·m" />
        <ResultRow label="M_sdl" value={fmt(m.Msdl)} unit="kN·m" />
        <ResultRow label="M_live" value={fmt(m.Mlive)} unit="kN·m" />
        <ResultRow label="M_service" value={fmt(m.Mservice)} unit="kN·m" />
        <ResultRow label="M_u (1.25DL+1.75LL)" value={fmt(m.Mu)} unit="kN·m" />
      </tbody></table>
      <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Gaya Prategang</p>
      <table className="w-full"><tbody>
        <ResultRow label="f_jack" value={fmt(p.jackingStressMpa)} unit="MPa" />
        <ResultRow label="P_j" value={fmt(p.Pj)} unit="kN" />
        <ResultRow label="P_i" value={fmt(p.Pi)} unit="kN" />
        <ResultRow label="P_e efektif" value={fmt(p.Pe)} unit="kN" />
      </tbody></table>
    </div>
  );
}

// Horizontal bar for loss visualization
function LossBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex-1 bg-gray-100 rounded-sm h-2 overflow-hidden">
      <div className="h-full rounded-sm" style={{ width: `${Math.min(pct,100)}%`, backgroundColor: color }} />
    </div>
  );
}

function LossesTab({ r }: { r: DesignResults }) {
  const p = r.prestress; const td = r.tdLosses;
  const fjack = p.jackingStressMpa;

  const losses = [
    { label: "FR  Gesek (midspan)",  val: p.deltaFR,      color: "#EF4444", category: "Seketika" },
    { label: "AS  Slip Angkur",      val: p.deltaAS,      color: "#F97316", category: "Seketika" },
    { label: "ES  Perpend. Elastis", val: p.deltaES,      color: "#F59E0B", category: "Seketika" },
    { label: "CR  Rangkak",          val: td.deltaFpCR,   color: "#8B5CF6", category: "Jangka Panjang" },
    { label: "SH  Susut",            val: td.deltaFpSR,   color: "#3B82F6", category: "Jangka Panjang" },
    { label: "RE  Relaksasi",        val: td.deltaFpR2,   color: "#10B981", category: "Jangka Panjang" },
  ];
  const totalLoss = losses.reduce((s, l) => s + l.val, 0);
  const pctTotal  = totalLoss / fjack * 100;
  const Pe_check  = fjack - totalLoss;

  return (
    <div className="space-y-3">
      <div className="flex gap-3 bg-blue-50 rounded p-2 text-[10px]">
        <div>
          <span className="text-gray-400">f_jack = </span>
          <span className="font-bold text-gray-700">{fjack.toFixed(1)} MPa</span>
        </div>
        <div>
          <span className="text-gray-400">Total = </span>
          <span className="font-bold text-red-600">−{totalLoss.toFixed(1)} MPa ({pctTotal.toFixed(1)}%)</span>
        </div>
        <div>
          <span className="text-gray-400">f_pe = </span>
          <span className="font-bold text-green-700">{Pe_check.toFixed(1)} MPa</span>
        </div>
      </div>

      {/* Group headers */}
      {(["Seketika", "Jangka Panjang"] as const).map((cat) => (
        <div key={cat}>
          <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">{cat}</p>
          <div className="space-y-1.5">
            {losses.filter((l) => l.category === cat).map((l) => {
              const pct = (l.val / fjack) * 100;
              return (
                <div key={l.label} className="flex items-center gap-2">
                  <span className="text-[9px] text-gray-600 w-44 shrink-0">{l.label}</span>
                  <LossBar pct={pct} color={l.color} />
                  <span className="text-[9px] font-mono font-semibold text-gray-700 w-20 text-right shrink-0">
                    {l.val.toFixed(2)} MPa
                  </span>
                  <span className="text-[9px] text-gray-400 w-10 text-right shrink-0">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Summary flow */}
      <div className="mt-2 bg-gray-50 rounded p-2 text-[9px] space-y-0.5 font-mono">
        <div className="flex justify-between">
          <span className="text-gray-500">P_j (dongkrak)</span>
          <span className="font-bold">{p.Pj.toFixed(1)} kN</span>
        </div>
        <div className="flex justify-between text-orange-600">
          <span>− FR + AS + ES (seketika)</span>
          <span>−{((p.deltaFR + p.deltaAS + p.deltaES) * (p.Pj * 1000 / p.jackingStressMpa) / 1e6).toFixed(1)} kN</span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-0.5">
          <span className="text-gray-500">P_i (transfer)</span>
          <span className="font-bold">{p.Pi.toFixed(1)} kN</span>
        </div>
        <div className="flex justify-between text-purple-600">
          <span>− CR + SH + RE (jk. panjang)</span>
          <span>−{(td.deltaFpLT * (p.Pj * 1000 / p.jackingStressMpa) / 1e6).toFixed(1)} kN</span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-0.5">
          <span className="text-green-700">P_e (efektif akhir)</span>
          <span className="font-bold text-green-700">{p.Pe.toFixed(1)} kN</span>
        </div>
      </div>
    </div>
  );
}

function SLSTab({ r, formulaVariant }: { r: DesignResults; formulaVariant: import("@/types").FormulaVariant }) {
  const { transfer, service, isOverallSafe, beamClass } = r.sls;
  const g = r.gross;
  const isKernel = formulaVariant === "KERNEL";

  function fiberDetail(f: import("@/types").FiberStressResult) {
    if (!isKernel) return null;
    const { axial, eccentricity, moment } = f.terms;
    return (
      <tr className="bg-gray-50">
        <td colSpan={5} className="px-2 py-0.5 text-[8.5px] font-mono text-indigo-700">
          −P/A={axial.toFixed(2)} ±Pe/Z={eccentricity.toFixed(2)} ∓M/Z={moment.toFixed(2)} MPa
          <span className="text-gray-400 ml-2">
            | kernel: r²=Ig/Ag={g.r2.toFixed(0)} mm²
          </span>
        </td>
      </tr>
    );
  }

  const classLabel: Record<string, string> = {
    U: "Class U (penuh, 0.50√f'c)",
    T: "Class T (transisi, 1.00√f'c)",
    C: "Class C (retak, 1.00√f'c)",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={isOverallSafe ? "success" : "danger"} className="text-xs px-2 py-0.5">
          {isOverallSafe ? "✓ SEMUA AMAN" : "✗ OVERSTRESS"}
        </Badge>
        <span className="text-[9px] text-indigo-600 font-semibold">{classLabel[beamClass]}</span>
        {isKernel && (
          <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 rounded font-mono">
            Kernel (TY Lin): f = −P/A·(1±ey/r²) ∓ M/Z
          </span>
        )}
        {!isKernel && (
          <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 rounded font-mono">
            Standard: f = −P/A ± Pe/Z ∓ M/Z
          </span>
        )}
      </div>
      <p className="text-[9px] font-bold uppercase text-gray-400">Transfer (P_i + M_g)</p>
      <table className="w-full">
        <thead><tr className="border-b border-gray-200 text-[9px] text-gray-400">
          <th className="text-left py-0.5">Serat</th>
          <th className="text-right">σ (MPa)</th>
          <th className="text-right">Batas−</th>
          <th className="text-right">Batas+</th>
          <th className="text-right">Status</th>
        </tr></thead>
        <tbody>
          <FiberRow result={transfer.topFiber} />
          {fiberDetail(transfer.topFiber)}
          <FiberRow result={transfer.botFiber} />
          {fiberDetail(transfer.botFiber)}
        </tbody>
      </table>
      <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Servis (P_e + M_total)</p>
      <table className="w-full">
        <thead><tr className="border-b border-gray-200 text-[9px] text-gray-400">
          <th className="text-left py-0.5">Serat</th>
          <th className="text-right">σ (MPa)</th>
          <th className="text-right">Batas−</th>
          <th className="text-right">Batas+</th>
          <th className="text-right">Status</th>
        </tr></thead>
        <tbody>
          <FiberRow result={service.topFiber} />
          {fiberDetail(service.topFiber)}
          <FiberRow result={service.botFiber} />
          {fiberDetail(service.botFiber)}
          <FiberRow result={service.deckFiber} />
        </tbody>
      </table>
    </div>
  );
}

function CheckRow({ label, value, limit, ok, unit }: {
  label: string; value: string; limit: string; ok: boolean; unit?: string;
}) {
  return (
    <tr className={`border-b border-gray-100 ${ok ? "" : "bg-red-50"}`}>
      <td className="py-1 pr-2 text-gray-500 text-[10px]">{label}</td>
      <td className={`py-1 font-mono text-right text-[10px] font-semibold ${ok ? "text-gray-800" : "text-red-600"}`}>{value}</td>
      <td className="py-1 text-[10px] text-right text-gray-400">≤ {limit}</td>
      {unit && <td className="py-1 pl-1 text-gray-400 text-[10px]">{unit}</td>}
      <td className="py-1 pl-1">
        <Badge variant={ok ? "success" : "danger"} className="text-[9px] px-1.5 py-0">
          {ok ? "OK" : "NG"}
        </Badge>
      </td>
    </tr>
  );
}

// Stirrup diameter → 2-leg area (mm²)
const STIRRUP_SIZES = [
  { d: 8,  Av: 2 * Math.PI * 64  / 4 },
  { d: 10, Av: 2 * Math.PI * 100 / 4 },
  { d: 12, Av: 2 * Math.PI * 144 / 4 },
  { d: 13, Av: 2 * Math.PI * 169 / 4 },
  { d: 16, Av: 2 * Math.PI * 256 / 4 },
];

function ULSTab({ r, inputs }: { r: DesignResults; inputs: import("@/types").ProjectInputs }) {
  const uls = r.ulsFlexure; const defl = r.deflection; const sh = r.ulsShear; const ish = r.interfaceShear;
  const g = r.gross; const c = r.composite; const p = r.prestress; const m = r.moments;
  const { material, tendon, loads, deck } = inputs;
  const hComp = g.hTotal + deck.thicknessTd;

  // Eccentricity at midspan (derived same as store)
  const totalStrands = tendon.rows.reduce((s, row) => s + row.strandCount, 0);
  const yResultant   = totalStrands > 0
    ? tendon.rows.reduce((s, row) => s + row.strandCount * row.yFromBottom, 0) / totalStrands
    : g.yb - 100;
  const e = g.yb - yResultant;

  // 1.2Mcr per ACI 18.8.2
  const fr      = 0.62 * Math.sqrt(material.fc);           // modulus of rupture [MPa]
  const fpe_bot = (p.Pe * 1000) / g.areaAg + (p.Pe * 1000 * e) / g.Zbg; // prestress at bottom [MPa]
  const fd_bot  = ((m.Mg + m.Msdl) * 1e6) / g.Zbg;        // dead load at bottom [MPa]
  const Mcr_flex = (c.Zbc * (fr + fpe_bot - fd_bot)) / 1e6; // kN·m
  const minMn   = 1.2 * Mcr_flex;
  const minOk   = uls.phiMn >= minMn;

  // Stirrup spacing
  const sMax    = Math.min(0.75 * sh.dv, 600); // mm, ACI max spacing
  const AvMinS  = Math.max(                     // ACI 9.6.3.3 minimum Av/s
    0.062 * Math.sqrt(material.fc) * sh.bw / material.fys,
    0.35 * sh.bw / material.fys
  );
  const AvSReq  = Math.max(sh.AvPerS, AvMinS);  // governing Av/s requirement

  return (
    <div className="space-y-3">
      {/* Flexure */}
      <p className="text-[9px] font-bold uppercase text-gray-400">Lentur ULS (φ=0.90)</p>
      <table className="w-full"><tbody>
        <ResultRow label="f_ps" value={fmt(uls.fps)} unit="MPa" />
        <ResultRow label="a (blok tekan)" value={fmt(uls.a)} unit="mm" />
        <ResultRow label="c (garis netral)" value={fmt(uls.c)} unit="mm" />
        <ResultRow label="c/d_p ratio" value={(uls.c / (uls.a / 0.85 * 0.85)).toFixed(3)} />
        <ResultRow label="M_n nominal" value={fmt(uls.Mn)} unit="kN·m" />
        <ResultRow label="φM_n kapasitas" value={fmt(uls.phiMn)} unit="kN·m" />
        <ResultRow label="M_u terfaktor" value={fmt(uls.Mu)} unit="kN·m" />
      </tbody></table>
      <table className="w-full"><tbody>
        <CheckRow label="φM_n ≥ M_u" value={fmt(uls.phiMn)} limit={fmt(uls.Mu)} ok={uls.isAdequate} unit="kN·m" />
        <CheckRow label="φM_n ≥ 1.2Mcr (ACI 18.8.2)" value={fmt(uls.phiMn)} limit={fmt(minMn)} ok={minOk} unit="kN·m" />
      </tbody></table>
      <div className="text-[9px] text-gray-400 pl-1">
        Mcr = {fmt(Mcr_flex)} kN·m  (fr={fmt(fr,3)} · fpe_bot={fmt(fpe_bot,3)} · fd={fmt(fd_bot,3)} MPa)
      </div>

      {/* Flexural Load Stages — Changes in Prestress Force (Nilson §1.7/§3.6) */}
      {r.flexuralStages && (
        <>
          <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">
            Tahapan Lentur & Perubahan Gaya Prategang (Nilson §1.7/§3.6)
          </p>
          <table className="w-full"><tbody>
            <ResultRow label="M_dekompresi (serat bawah → 0)" value={fmt(r.flexuralStages.M_dec)} unit="kN·m" />
            <ResultRow label="M_cr retak (serat bawah → +fr)" value={fmt(r.flexuralStages.M_cr)} unit="kN·m" />
            <ResultRow label="f_se efektif" value={fmt(r.flexuralStages.fse)} unit="MPa" />
            <ResultRow label="f_p saat dekompresi beton" value={fmt(r.flexuralStages.fp_dec)} unit="MPa" />
            <ResultRow label="f_ps ultimit" value={fmt(r.flexuralStages.fps)} unit="MPa" />
            <ResultRow label="Δf_p total = f_ps − f_se" value={fmt(r.flexuralStages.delta_fp_total)} unit="MPa" />
            <ResultRow label="Rasio kenaikan = Δf_p/f_ps" value={(r.flexuralStages.stress_rise_ratio*100).toFixed(1)} unit="%" />
          </tbody></table>
          <div className="text-[9px] text-gray-400 pl-1 -mt-1">
            Tegangan strand naik perlahan hingga retak, lalu cepat — kenaikan kecil ⇒ penampang efisien.
          </div>
        </>
      )}

      {/* Ductility & Minimum Steel */}
      {(() => {
        const ductility = checkDuctility(uls.c, hComp - (g.yb - e));
        const minSt = checkMinSteel(Mcr_flex, uls.Mu, uls.phiMn);
        const fatigue = checkFatigue(m.Mlive, totalStrands * inputs.tendon.singleStrandArea, hComp - (g.yb - e));
        return (
          <>
            <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Daktilitas (ACI §21.2)</p>
            <table className="w-full"><tbody>
              <ResultRow label="c/dp ratio" value={fmt(ductility.c_dp_ratio, 3)} />
              <ResultRow label="εt (net tension strain)" value={ductility.epsilon_t.toFixed(4)} />
              <ResultRow label="Klasifikasi" value={ductility.strainClass} />
              <ResultRow label="φ (applied)" value={fmt(ductility.phi, 2)} />
            </tbody></table>
            <table className="w-full"><tbody>
              <CheckRow label="εt ≥ 0.004 (daktail)" value={fmt(ductility.epsilon_t,4)}
                limit="0.004" ok={ductility.isDuctile} />
            </tbody></table>

            <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Tulangan Minimum (ACI §9.6.2)</p>
            <table className="w-full"><tbody>
              <CheckRow label="φMn ≥ 1.2Mcr" value={fmt(uls.phiMn)} limit={fmt(minSt.Mn_12Mcr_req)} ok={minSt.is_12Mcr_Ok} unit="kN·m" />
              <CheckRow label="φMn ≥ 1.33Mu" value={fmt(uls.phiMn)} limit={fmt(minSt.Mn_133Mu_req)} ok={minSt.is_133Mu_Ok} unit="kN·m" />
            </tbody></table>
            <div className="text-[9px] text-gray-400 pl-1">ACI §9.6.2: cukup jika memenuhi salah satu (a) atau (b)</div>

            <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Fatigue (ACI §26.12, TY Lin Ch.13)</p>
            <table className="w-full"><tbody>
              <ResultRow label="Δfps (range tegangan strand)" value={fmt(fatigue.delta_fps)} unit="MPa" />
              <ResultRow label="Batas low-relax strand" value={`${fatigue.limit}`} unit="MPa" />
            </tbody></table>
            <table className="w-full"><tbody>
              <CheckRow label="Δfps ≤ 125 MPa" value={fmt(fatigue.delta_fps)} limit={`${fatigue.limit}`} ok={fatigue.isOk} unit="MPa" />
            </tbody></table>
          </>
        );
      })()}

      {/* Shear */}
      <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Geser ULS (φ=0.75)</p>
      <table className="w-full"><tbody>
        <ResultRow label="d_v efektif" value={fmt(sh.dv,0)} unit="mm" />
        <ResultRow label="b_w (web)" value={fmt(sh.bw,0)} unit="mm" />
        <ResultRow label="V_p (komponen vertikal)" value={fmt(sh.Vp)} unit="kN" />
        <ResultRow label="M_cr (Vci)" value={fmt(sh.Mcr)} unit="kN·m" />
        <ResultRow label="V_ci (geser-lentur)" value={fmt(sh.Vci)} unit="kN" />
        <ResultRow label="V_cw (geser-web)" value={fmt(sh.Vcw)} unit="kN" />
        <ResultRow label="V_c = min(Vci,Vcw)" value={fmt(sh.Vc)} unit="kN" />
        <ResultRow label="V_u terfaktor" value={fmt(sh.Vu)} unit="kN" />
      </tbody></table>
      <table className="w-full"><tbody>
        <CheckRow label="φ(Vc+Vp) ≥ Vu" value={fmt(0.75*(sh.Vc+sh.Vp))} limit={fmt(sh.Vu)}
          ok={sh.isAdequate} unit="kN" />
      </tbody></table>

      {/* MCFT — Compression Field Theory (Nilson §5.11 / AASHTO general) */}
      {r.mcftShear && (
        <>
          <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">
            Metode Umum / Compression Field Theory (Nilson §5.11)
          </p>
          <table className="w-full"><tbody>
            <ResultRow label="ε_x (regangan longitudinal)" value={(r.mcftShear.epsilon_x*1000).toFixed(3)} unit="×10⁻³" />
            <ResultRow label="β (faktor tarik beton)" value={r.mcftShear.beta.toFixed(2)} />
            <ResultRow label="θ (sudut retak diagonal)" value={r.mcftShear.theta_deg.toFixed(1)} unit="°" />
            <ResultRow label="V_c = 0.083β√f'c·bv·dv" value={fmt(r.mcftShear.Vc)} unit="kN" />
            <ResultRow label="V_s (cot θ)" value={fmt(r.mcftShear.Vs)} unit="kN" />
            <ResultRow label="V_n = Vc+Vs+Vp" value={fmt(r.mcftShear.Vn)} unit="kN" />
            <ResultRow label="A_v/s diperlukan (MCFT)" value={r.mcftShear.AvPerS_req.toFixed(4)} unit="mm²/mm" />
          </tbody></table>
          <table className="w-full"><tbody>
            <CheckRow label="φV_n ≥ V_u (MCFT)" value={fmt(r.mcftShear.phiVn)} limit={fmt(sh.Vu)}
              ok={r.mcftShear.isAdequate} unit="kN" />
            <CheckRow label="V_n ≤ V_n,max (0.25f'c·bv·dv)" value={fmt(r.mcftShear.Vn)} limit={fmt(r.mcftShear.Vn_max)}
              ok={r.mcftShear.Vn <= r.mcftShear.Vn_max} unit="kN" />
          </tbody></table>
          <div className="text-[9px] text-gray-400 pl-1 -mt-1">
            Metode sectional alternatif Vci/Vcw — truss sudut-variabel (f_po=0.70fpu).
          </div>
        </>
      )}

      {/* BS 8110 alternative (Kong & Evans §9.5-9.6) */}
      {r.bsFlexure && r.bsShear && (
        <>
          <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">
            BS 8110 — Metode Inggris (Kong &amp; Evans §9.5–9.6)
          </p>
          <table className="w-full"><tbody>
            <ResultRow label="fpuAps/(fcu·b·d)" value={fmt(r.bsFlexure.ratio,3)} />
            <ResultRow label="fpe/fpu" value={fmt(r.bsFlexure.fpeRatio,3)} />
            <ResultRow label="f_pb (tegangan tendon runtuh)" value={fmt(r.bsFlexure.fpb)} unit="MPa" />
            <ResultRow label="x (garis netral)" value={fmt(r.bsFlexure.x)} unit="mm" />
            <ResultRow label="x/d" value={fmt(r.bsFlexure.x_d,3)} />
            <ResultRow label="M_u = f_pb·Aps·(d−0.45x)" value={fmt(r.bsFlexure.Mu)} unit="kN·m" />
            <ResultRow label={`Tendon: ${r.bsFlexure.bonded ? "bonded (Tabel 9.5-1)" : "unbonded (rumus)"}`} value="" />
          </tbody></table>
          <table className="w-full"><tbody>
            <ResultRow label="f_t = 0.24√fcu" value={fmt(r.bsShear.ft,3)} unit="MPa" />
            <ResultRow label="V_co (tak-retak)" value={fmt(r.bsShear.Vco)} unit="kN" />
            <ResultRow label="M_0 (dekompresi)" value={fmt(r.bsShear.M0)} unit="kN·m" />
            <ResultRow label="V_cr (retak)" value={fmt(r.bsShear.Vcr)} unit="kN" />
            <ResultRow label={`V_c = ${r.bsShear.isUncracked ? "V_co" : "min(Vco,Vcr)"}`} value={fmt(r.bsShear.Vc)} unit="kN" />
          </tbody></table>
          <div className="text-[9px] text-gray-400 pl-1 -mt-1">
            Penampang {r.bsShear.isUncracked ? "TAK-RETAK (M<M₀) → Vco governs" : "RETAK (M≥M₀)"} · fcu≈f'c/0.8.
          </div>
        </>
      )}

      {/* Stirrup table */}
      <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Desain Sengkang (2 kaki)</p>
      <div className="text-[9px] text-gray-400 pl-1 mb-1">
        A_v/s diperlukan: {fmt(AvSReq,4)} mm²/mm &nbsp;·&nbsp; s_max = {fmt(sMax,0)} mm
        &nbsp;·&nbsp; A_v/s_min = {fmt(AvMinS,4)} mm²/mm
      </div>
      <table className="w-full border border-gray-200 rounded text-[9px]">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-1.5 py-1 text-left text-gray-600">Ø (mm)</th>
            <th className="px-1.5 py-1 text-center text-gray-600">A_v 2kaki</th>
            <th className="px-1.5 py-1 text-center text-gray-600">s_req</th>
            <th className="px-1.5 py-1 text-center text-gray-600">s_pakai</th>
            <th className="px-1.5 py-1 text-center text-gray-600">Status</th>
          </tr>
        </thead>
        <tbody>
          {STIRRUP_SIZES.map(({ d, Av }) => {
            const sReq  = AvSReq > 0 ? Av / AvSReq : Infinity;
            const sPakai = Math.min(sReq, sMax);
            const ok    = sPakai >= 50; // impractical if < 50 mm
            return (
              <tr key={d} className={`border-t border-gray-100 ${ok ? "" : "bg-red-50"}`}>
                <td className="px-1.5 py-0.5 font-mono font-semibold">Ø{d}</td>
                <td className="px-1.5 py-0.5 text-center font-mono">{Av.toFixed(1)} mm²</td>
                <td className="px-1.5 py-0.5 text-center font-mono">
                  {isFinite(sReq) ? `${Math.floor(sReq)} mm` : "—"}
                </td>
                <td className="px-1.5 py-0.5 text-center font-mono font-semibold">
                  {isFinite(sReq) ? `${Math.floor(Math.min(sReq, sMax))} mm` : `${Math.floor(sMax)} mm`}
                </td>
                <td className="px-1.5 py-0.5 text-center">
                  {ok
                    ? <span className="text-green-700 font-bold">✓</span>
                    : <span className="text-red-500 text-[8px]">terlalu rapat</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Interface Shear */}
      <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Geser Horizontal Antarmuka (ACI §17.5)</p>
      <div className="text-[9px] text-gray-400 pl-1 mb-1">
        Permukaan: dikasarkan (c={ish.cFactor} MPa, μ={ish.muFactor}) · b_vi={fmt(ish.bvi,0)} mm
      </div>
      <table className="w-full"><tbody>
        <ResultRow label="Aliran geser Vhu" value={fmt(ish.Vhu,3)} unit="N/mm" />
        <ResultRow label="φ·c·bvi (beton saja)" value={fmt(ish.phiVni_conc,3)} unit="N/mm" />
        <ResultRow label="Avf/s diperlukan" value={ish.AvfPerS_req > 0 ? fmt(ish.AvfPerS_req,4) : "—"} unit="mm²/mm" />
        <ResultRow label="s_max pengikatan" value={fmt(ish.sMax,0)} unit="mm" />
      </tbody></table>
      {/* Interface tie table */}
      {ish.AvfPerS_req > 0 ? (
        <table className="w-full border border-gray-200 rounded text-[9px] mt-1">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-1.5 py-1 text-left text-gray-600">Ø (mm)</th>
              <th className="px-1.5 py-1 text-center text-gray-600">Avf 2kaki</th>
              <th className="px-1.5 py-1 text-center text-gray-600">s_req</th>
              <th className="px-1.5 py-1 text-center text-gray-600">s_pakai</th>
            </tr>
          </thead>
          <tbody>
            {STIRRUP_SIZES.map(({ d, Av }) => {
              const sReq  = Av / ish.AvfPerS_req;
              const sPakai = Math.min(sReq, ish.sMax);
              return (
                <tr key={d} className="border-t border-gray-100">
                  <td className="px-1.5 py-0.5 font-mono font-semibold">Ø{d}</td>
                  <td className="px-1.5 py-0.5 text-center font-mono">{Av.toFixed(1)} mm²</td>
                  <td className="px-1.5 py-0.5 text-center font-mono">{Math.floor(sReq)} mm</td>
                  <td className="px-1.5 py-0.5 text-center font-mono font-semibold">{Math.floor(sPakai)} mm</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div className="text-[9px] text-green-700 font-semibold pl-1">
          ✓ Beton saja cukup (φ·c·bvi ≥ Vhu) — tidak perlu tulangan pengikatan
        </div>
      )}
      <table className="w-full mt-1"><tbody>
        <CheckRow label="φVni ≥ Vhu (interface)" value={fmt(ish.phiVni_conc + 0.75*ish.muFactor*ish.AvfPerS_req*material.fy,3)}
          limit={fmt(ish.Vhu,3)} ok={ish.isAdequate} unit="N/mm" />
      </tbody></table>

      {/* Deflection */}
      <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Lendutan &amp; Camber</p>
      <table className="w-full"><tbody>
        <ResultRow label="δ Camber (prategang)" value={`+${fmt(defl.deltaCamber)}`} unit="mm ↑" />
        <ResultRow label="δ Berat Sendiri" value={`−${fmt(defl.deltaSW)}`} unit="mm ↓" />
        <ResultRow label="δ Pelat" value={`−${fmt(defl.deltaDeck)}`} unit="mm ↓" />
        <ResultRow label="δ Live Load" value={`−${fmt(defl.deltaLive)}`} unit="mm ↓" />
        <ResultRow label="δ Total (+ = ke atas)"
          value={`${defl.deltaTotal >= 0 ? "+" : ""}${fmt(defl.deltaTotal)}`} unit="mm" />
      </tbody></table>
      <table className="w-full"><tbody>
        <CheckRow label="δ_live ≤ L/360"
          value={fmt(defl.deltaLive)} limit={fmt(defl.limitLive)}
          ok={defl.liveOk} unit="mm" />
        <CheckRow label="|δ_total| ≤ L/300"
          value={fmt(Math.abs(defl.deltaTotal))} limit={fmt(defl.limitTotal)}
          ok={defl.totalOk} unit="mm" />
      </tbody></table>

      {/* Load Balance */}
      <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Keseimbangan Beban (Load Balancing)</p>
      <table className="w-full"><tbody>
        <ResultRow label="w_bal (beban imbang)" value={fmt(r.loadBalance.w_bal)} unit="kN/m" />
        <ResultRow label="M_bal = Pe·e" value={fmt(r.loadBalance.M_bal)} unit="kN·m" />
        <ResultRow label="% keseimbangan (M_bal/M_servis)" value={fmt(r.loadBalance.percentBalance,1)} unit="%" />
      </tbody></table>
      <div className="text-[9px] text-gray-400 pl-1 mt-0.5">
        TY Lin: w_bal = 8·Pe·Δe/L² — beban prategang mengimbangi {r.loadBalance.percentBalance.toFixed(1)}% beban servis
      </div>

      {/* Transfer & Development Length */}
      <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Panjang Transfer &amp; Pengembangan (ACI §25.8.8)</p>
      <table className="w-full"><tbody>
        <ResultRow label="f_se efektif" value={fmt(r.transferLength.fse)} unit="MPa" />
        <ResultRow label="f_ps ULS" value={fmt(r.transferLength.fps)} unit="MPa" />
        <ResultRow label="l_t (ACI fse×db/3)" value={fmt(r.transferLength.lt_ACI,0)} unit="mm" />
        <ResultRow label="l_t (50·db)" value={fmt(r.transferLength.lt_50db,0)} unit="mm" />
        <ResultRow label="l_t GOVERNING" value={fmt(r.transferLength.lt_mm,0)} unit="mm" />
        <ResultRow label="l_d development" value={fmt(r.transferLength.ld_mm,0)} unit="mm" />
        <ResultRow label="l_t / db" value={r.transferLength.lt_db.toFixed(1)} />
      </tbody></table>

      {/* Anchorage Zone */}
      <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Zona Angkur — Bursting &amp; Spalling</p>
      <div className="text-[9px] text-gray-400 pl-1 mb-1">
        AASHTO §5.10.9.3 / Guts method
      </div>
      <table className="w-full"><tbody>
        <ResultRow label="T_burst (bursting force)" value={fmt(r.anchorageZone.T_burst)} unit="kN" />
        <ResultRow label="d_burst (zona)" value={fmt(r.anchorageZone.d_burst,0)} unit="mm" />
        <ResultRow label="Ast_burst (ties req.)" value={fmt(r.anchorageZone.Ast_burst,0)} unit="mm²" />
        <ResultRow label="T_spall (AASHTO 2%)" value={fmt(r.anchorageZone.T_spall)} unit="kN" />
        <ResultRow label="Ast_spall" value={fmt(r.anchorageZone.Ast_spall,0)} unit="mm²" />
        {r.anchorageZone.T_edge > 0 && (
          <ResultRow label="T_edge (eksentrisitas)" value={fmt(r.anchorageZone.T_edge)} unit="kN" />
        )}
      </tbody></table>

      {/* Crack width (partial prestress only) */}
      {r.crackWidth && (
        <>
          <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Lebar Retak — Prategang Sebagian (ACI 224R)</p>
          <table className="w-full"><tbody>
            <ResultRow label="Lebar retak w_cr" value={fmt(r.crackWidth.w_cr, 3)} unit="mm" />
            <ResultRow label="Batas w_limit" value={fmt(r.crackWidth.w_limit, 3)} unit="mm" />
            <ResultRow label="s_max (ACI 318-19)" value={fmt(r.crackWidth.sMax_ACI318, 0)} unit="mm" />
          </tbody></table>
          <table className="w-full"><tbody>
            <CheckRow label="w_cr ≤ w_limit"
              value={fmt(r.crackWidth.w_cr,3)} limit={fmt(r.crackWidth.w_limit,3)}
              ok={r.crackWidth.isOk} unit="mm" />
          </tbody></table>
        </>
      )}

      {/* PPR */}
      {r.PPR !== undefined && (
        <>
          <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Partial Prestress Ratio (PPR)</p>
          <table className="w-full"><tbody>
            <ResultRow label="PPR = Aps·fps / (Aps·fps + As·fy)"
              value={fmt(r.PPR * 100, 1)} unit="%" />
          </tbody></table>
          <div className="text-[9px] text-gray-400 pl-1">
            PPR = 1.0 = prategang penuh &nbsp;·&nbsp; PPR &lt; 1.0 = sebagian (As berkontribusi)
          </div>
        </>
      )}

      {/* Torsion */}
      {r.torsion && (
        <>
          <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">Torsi (ACI 318-19 §22.7)</p>
          <table className="w-full"><tbody>
            <ResultRow label="T_u terfaktor" value={fmt(inputs.loads.tuTorsion)} unit="kN·m" />
            <ResultRow label="T_th (ambang abaikan)" value={fmt(r.torsion.T_th)} unit="kN·m" />
            <ResultRow label="T_cr (momen retak torsi)" value={fmt(r.torsion.T_cr)} unit="kN·m" />
            <ResultRow label="θ (sudut strut)" value={fmt(r.torsion.theta_deg, 1)} unit="°" />
            <ResultRow label="At/s (tulangan transversal)" value={r.torsion.isNegligible ? "—" : fmt(r.torsion.At_per_s, 4)} unit="mm²/mm" />
            <ResultRow label="Al (tulangan longitudinal)" value={r.torsion.isNegligible ? "—" : fmt(r.torsion.Al_req, 0)} unit="mm²" />
            <ResultRow label="Rasio gabungan V+T" value={fmt(r.torsion.combinedRatio, 3)} />
          </tbody></table>
          {r.torsion.isNegligible ? (
            <div className="text-[9px] text-green-700 font-semibold pl-1">
              ✓ T_u &lt; φ·T_th — torsi dapat diabaikan per ACI §22.7.4
            </div>
          ) : (
            <table className="w-full mt-1"><tbody>
              <CheckRow label="Rasio V+T ≤ 1.0" value={fmt(r.torsion.combinedRatio,3)}
                limit="1.000" ok={r.torsion.isAdequate} />
            </tbody></table>
          )}
        </>
      )}

      {/* Continuous beam secondary moments */}
      {r.continuousBeam && r.continuousBeam.nSpans > 1 && (
        <>
          <p className="text-[9px] font-bold uppercase text-gray-400 pt-1">
            Balok Menerus — Momen Sekunder (TY Lin, Ch. 8)
          </p>
          <table className="w-full"><tbody>
            <ResultRow label="Jumlah bentang" value={`${r.continuousBeam.nSpans}`} />
            <ResultRow label="M₁ primer midspan = Pe·e" value={fmt(r.continuousBeam.M1_midspan)} unit="kN·m" />
            <ResultRow label="M₂ sekunder di tumpuan" value={fmt(r.continuousBeam.M2_support)} unit="kN·m" />
            <ResultRow label="M_total tumpuan (M₁+M₂)" value={fmt(r.continuousBeam.M_total_support)} unit="kN·m" />
            <ResultRow label="e_concordant di tumpuan" value={fmt(r.continuousBeam.e_concordant)} unit="mm" />
            <ResultRow label="C-line shift = M₂/Pe" value={fmt(r.continuousBeam.cLineShift)} unit="mm" />
          </tbody></table>
          <div className="text-[9px] text-gray-400 pl-1 mt-0.5">
            Tendon konkordant (e = {fmt(r.continuousBeam.e_concordant)} mm di tumpuan) tidak menghasilkan momen sekunder.
            Pergeseran C-line = {fmt(r.continuousBeam.cLineShift)} mm ke arah {r.continuousBeam.cLineShift >= 0 ? "bawah" : "atas"}.
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main ResultsPanel ────────────────────────────────────────

type TabKey = "section" | "moments" | "losses" | "sls" | "uls";

export function ResultsPanel() {
  // ── ALL hooks MUST be called before any early return ─────────
  const { results, errors, inputs, settings } = useDesignStore();
  const [tab, setTab] = React.useState<TabKey>("sls");

  // Resolve tendon derived values for diagrams
  const { yResultant, eccentricityMidspan } = React.useMemo(() => {
    if (!results) return { yResultant: 0, eccentricityMidspan: 0 };
    return resolveTendon(inputs.tendon, results.gross.yb);
  }, [inputs.tendon, results]);
  // ─────────────────────────────────────────────────────────────

  const tabs: { key: TabKey; label: string }[] = [
    { key: "section",  label: "Penampang" },
    { key: "moments",  label: "Beban" },
    { key: "losses",   label: "Kehilangan" },
    { key: "sls",      label: "SLS" },
    { key: "uls",      label: "ULS" },
  ];

  // Error state
  if (errors.length > 0) {
    return (
      <div className="flex-1 p-4">
        <div className="rounded border border-red-200 bg-red-50 p-3">
          <p className="font-semibold text-red-700 text-sm mb-1">Input Error</p>
          {errors.map((e, i) => <p key={i} className="text-xs text-red-600">• {e}</p>)}
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Mengubah parameter → kalkulasi otomatis…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">

      {/* ── Status bar ── */}
      {(() => {
        const allOk = results.sls.isOverallSafe && results.ulsFlexure.isAdequate
          && results.ulsShear.isAdequate && results.deflection.liveOk && results.deflection.totalOk;
        return (
          <div className={`flex-none px-3 py-1 text-[10px] font-bold flex items-center gap-2 border-b flex-wrap
            ${allOk ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"}`}>
            <span className={results.sls.isOverallSafe ? "text-green-700" : "text-red-700"}>
              {results.sls.isOverallSafe ? "✓" : "✗"} SLS
            </span>
            <span className="text-gray-300">·</span>
            <span className={results.ulsFlexure.isAdequate ? "text-green-700" : "text-red-700"}>
              {results.ulsFlexure.isAdequate ? "✓" : "✗"} Lentur (φMn={results.ulsFlexure.phiMn.toFixed(0)})
            </span>
            <span className="text-gray-300">·</span>
            <span className={results.ulsShear.isAdequate ? "text-green-700" : "text-red-700"}>
              {results.ulsShear.isAdequate ? "✓" : "✗"} Geser
            </span>
            <span className="text-gray-300">·</span>
            <span className={results.deflection.liveOk && results.deflection.totalOk ? "text-green-700" : "text-red-700"}>
              {results.deflection.liveOk && results.deflection.totalOk ? "✓" : "✗"} Lendutan
            </span>
            <span className="text-gray-300 ml-1">|</span>
            <span className="text-gray-500">
              A_ps={(eccentricityMidspan > 0 && results.prestress.Pj > 0
                ? (results.prestress.Pj * 1000 / (inputs.tendon.jackingRatio * inputs.tendon.fpu)).toFixed(0)
                : "—")} mm²
              &nbsp;e={eccentricityMidspan.toFixed(0)} mm
              &nbsp;η={(((results.prestress.Pj - results.prestress.Pe) / results.prestress.Pj)*100).toFixed(1)}% loss
            </span>
          </div>
        );
      })()}

      {/* ── Main body: left tabs + right diagrams ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── Left: tab content (55%) ── */}
        <div className="flex flex-col overflow-hidden min-w-0" style={{ flex: "0 0 52%" }}>
          <div className="flex-none flex border-b border-gray-200 bg-white">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-2 text-[10px] font-semibold border-b-2 transition-colors
                  ${tab === t.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {tab === "section"  && <SectionTab  r={results} />}
            {tab === "moments"  && <MomentsTab  r={results} />}
            {tab === "losses"   && <LossesTab   r={results} />}
            {tab === "sls"      && <SLSTab      r={results} formulaVariant={settings.formulaVariant} />}
            {tab === "uls"      && <ULSTab      r={results} inputs={inputs} />}
          </div>
        </div>

        {/* ── Right: visual diagrams (48%) ── */}
        <div className="flex flex-col border-l border-gray-200 bg-gray-50 overflow-y-auto"
          style={{ flex: "0 0 48%" }}>

          <div className="flex-none px-3 py-1 bg-white border-b border-gray-200">
            <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Diagram Visual</p>
          </div>

          {/* 1 — Penampang dengan dimensi */}
          <div className="bg-white border-b border-gray-100 p-1">
            <SectionDiagram
              girder={inputs.girder}
              deck={inputs.deck}
              gross={results.gross}
              composite={results.composite}
              tendon={inputs.tendon}
              yResultant={yResultant}
            />
          </div>

          {/* 2 — Distribusi tegangan */}
          <div className="bg-white border-b border-gray-100 p-2">
            <StressDistributionChart sls={results.sls} gross={results.gross} />
          </div>

          {/* 3 — Diagram camber/lendutan */}
          <div className="bg-white border-b border-gray-100 p-2">
            <DeflectionChart
              deflection={results.deflection}
              moments={results.moments}
              loads={inputs.loads}
            />
          </div>

          {/* 4 — Diagram momen */}
          <div className="bg-white border-b border-gray-100 p-2">
            <MomentDiagram moments={results.moments} spanLength={inputs.loads.spanLength} />
          </div>

          {/* 5 — Diagram Magnel */}
          <div className="bg-white border-b border-gray-100 p-2">
            <MagnelDiagram
              gross={results.gross}
              comp={results.composite}
              prestress={results.prestress}
              moments={results.moments}
              fci={inputs.material.fci}
              fc={inputs.material.fc}
              eccentricityMidspan={eccentricityMidspan}
            />
          </div>

          {/* 6 — Zona Tendon */}
          <div className="bg-white border-b border-gray-100 p-2">
            <TendonZoneChart
              gross={results.gross}
              comp={results.composite}
              prestress={results.prestress}
              tendon={inputs.tendon}
              loads={inputs.loads}
              material={inputs.material}
              eccentricityMidspan={eccentricityMidspan}
            />
          </div>

          {/* 7 — Profil tendon */}
          <div className="bg-white p-2">
            <TendonProfileChart
              tendon={inputs.tendon}
              gross={results.gross}
              composite={results.composite}
              spanLength={inputs.loads.spanLength}
              eccentricityMidspan={eccentricityMidspan}
              yResultant={yResultant}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
