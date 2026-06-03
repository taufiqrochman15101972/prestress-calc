"use client";

/**
 * Magnel Diagram — e (mm) vs 1/P_i (×10⁻³ kN⁻¹)
 *
 * All internal calculations in N and mm (σ in N/mm² = MPa).
 * x_display = (1/P_i_kN) × 10³  [dimensionless scale on axis]
 *
 * Four boundary lines from SLS Transfer stress limits:
 *   L1: Transfer Top  — σ ≥ −0.60f'ci   → e ≥ L1  (lower bound, e above line)
 *   L2: Transfer Top  — σ ≤ +0.50√f'ci  → e ≤ L2  (upper bound)
 *   L3: Transfer Bot  — σ ≥ −0.60f'ci   → e ≤ L3  (upper bound)
 *   L4: Transfer Bot  — σ ≤ +0.50√f'ci  → e ≥ L4  (lower bound)
 *
 * Line equation: e = M·x + B
 *   where x = 1/P_i_N (N⁻¹), M in N·mm, B in mm.
 */

import React from "react";
import type { GrossSectionProps, CompositeSectionProps, PrestressForces, MomentResults } from "@/types";

interface Props {
  gross: GrossSectionProps;
  comp: CompositeSectionProps;
  prestress: PrestressForces;
  moments: MomentResults;
  fci: number;
  fc: number;
  eccentricityMidspan: number;
}

const W = 420, H = 290;
const PAD = { top: 28, right: 20, bottom: 44, left: 58 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

function px(v: number, vMin: number, vMax: number, pMin: number, pMax: number) {
  return pMin + ((v - vMin) / (vMax - vMin)) * (pMax - pMin);
}

function niceTicks(lo: number, hi: number, n = 5) {
  const step = Math.pow(10, Math.floor(Math.log10((hi - lo) / n)));
  const mult = [1, 2, 5, 10].find(m => (hi - lo) / (step * m) <= n + 1) ?? 10;
  const s = step * mult;
  const start = Math.floor(lo / s) * s;
  const ticks: number[] = [];
  for (let t = start; t <= hi + s * 0.01; t += s) {
    if (t >= lo - s * 0.01 && t <= hi + s * 0.01) ticks.push(parseFloat(t.toFixed(10)));
  }
  return ticks;
}

export function MagnelDiagram({ gross, comp, prestress, moments, fci, fc, eccentricityMidspan }: Props) {
  const { areaAg: Ag, Ztg, Zbg } = gross;
  const { Ztgc, Zbc } = comp;

  // All in N and mm
  const Pi_N    = prestress.Pi * 1000;
  const Pe_N    = prestress.Pe * 1000;
  const eta     = Pe_N / Pi_N;           // loss factor Pe/Pi
  const Mg_Nmm  = moments.Mg * 1e6;
  const Msdl_Nmm = moments.Msdl * 1e6;
  const Ml_Nmm  = moments.Mlive * 1e6;

  const sigCompTr = -0.60 * fci;         // Transfer compression limit [MPa]
  const sigTensTr = +0.50 * Math.sqrt(fci);
  const sigCompSv = -0.45 * fc;          // Service compression limit
  const sigTensSv = +0.50 * Math.sqrt(fc);

  // x = 1/Pi_N (N⁻¹), scale = 1e6 so x_disp = x_N × 1e6 [×10⁻⁶ N⁻¹ = ×10⁻³ kN⁻¹]
  // Transfer lines (using Pi):
  //   e = M·x + B where M in N·mm, B in mm
  // Service lines (using Pe = η·Pi):
  //   Same x axis, but moment contribution includes SDL + Live on composite section.
  //   D_sv_top = sigCompSv_target + (Mg+Msdl)/Ztg + Mlive/Ztgc  [the RHS constant in N/mm²]
  //   e ≥ Ztg*(D_sv_top/η)*x + Ztg/Ag

  const D_sv_top_comp = sigCompSv + (Mg_Nmm + Msdl_Nmm) / Ztg + Ml_Nmm / Ztgc;
  const D_sv_top_tens = sigTensSv + (Mg_Nmm + Msdl_Nmm) / Ztg + Ml_Nmm / Ztgc;
  // Service bot: σ_bot = -Pe/Ag - Pe*e/Zbg + (Mg+Msdl)/Zbg + Mlive/Zbc
  const M_dead_bot = (Mg_Nmm + Msdl_Nmm) / Zbg + Ml_Nmm / Zbc; // constant term [N/mm²]
  const D_sv_bot_comp = sigCompSv + M_dead_bot;  // ≥ σ_comp limit
  const D_sv_bot_tens = sigTensSv + M_dead_bot;

  const lines: { label: string; color: string; dash?: boolean; M: number; B: number; side: "above" | "below" }[] = [
    // ── Transfer (solid) ──
    { label: "L1: Transfer Atas−Tekan", color: "#ef4444",
      M: Ztg * sigCompTr + Mg_Nmm, B: Ztg / Ag, side: "above" },
    { label: "L2: Transfer Atas−Tarik", color: "#f97316",
      M: Ztg * sigTensTr + Mg_Nmm, B: Ztg / Ag, side: "below" },
    { label: "L3: Transfer Bawah−Tekan", color: "#2563eb",
      M: Mg_Nmm - Zbg * sigCompTr, B: -Zbg / Ag, side: "below" },
    { label: "L4: Transfer Bawah−Tarik", color: "#16a34a",
      M: Mg_Nmm - Zbg * sigTensTr, B: -Zbg / Ag, side: "above" },
    // ── Service (dashed) ──
    { label: "L5: Servis Atas−Tekan", color: "#ef4444", dash: true,
      M: Ztg * D_sv_top_comp / eta, B: Ztg / Ag, side: "above" },
    { label: "L6: Servis Bawah−Tekan", color: "#2563eb", dash: true,
      M: -Zbg * D_sv_bot_comp / eta, B: -Zbg / Ag, side: "below" },
  ];

  // Design point in display coords
  const xD_N  = 1 / Pi_N;                       // N⁻¹
  // Display axis: X_disp = x_N * 1000 * 1000  (×10⁻³ kN⁻¹ = ×10⁻⁶ N⁻¹)
  // Note: 1 kN⁻¹ = 10⁻³ N⁻¹, so ×10⁻³ kN⁻¹ = 10⁻⁶ N⁻¹
  // x_disp = x_N / 1e-6 = x_N × 1e6
  const scale = 1e6; // x_N → x_disp
  const xD_disp = xD_N * scale;

  // X range: 0 to 2.8 × design
  const xMax_disp = xD_disp * 2.8;
  const xMin_disp = 0;

  // Evaluate lines at display x endpoints
  const evalE = (ln: typeof lines[0], xd: number) => ln.M * (xd / scale) + ln.B;

  // Clip y-range to the effective feasible region at design point ± generous padding
  // (prevents extreme slopes from dominating the axis when P_i is small)
  const ub_d = Math.min(...lines.filter(l => l.side === "below").map(l => evalE(l, xD_disp)));
  const lb_d = Math.max(...lines.filter(l => l.side === "above").map(l => evalE(l, xD_disp)));
  const yCenter = eccentricityMidspan;
  const ySpan   = Math.max(ub_d - lb_d, 400) * 1.4;
  const yMin = yCenter - ySpan * 0.55;
  const yMax = yCenter + ySpan * 0.55;

  const cx = (xd: number) => px(xd, xMin_disp, xMax_disp, PAD.left, PAD.left + CW);
  const cy = (y:  number) => px(y,  yMin,       yMax,       PAD.top + CH,  PAD.top); // flip

  const xTicks = niceTicks(xMin_disp, xMax_disp, 5);
  const yTicks = niceTicks(yMin, yMax, 5);

  // Kern points
  const kt = Ztg / Ag;
  const kb = -Zbg / Ag;

  // Feasible zone bounds at design x
  const uppers = lines.filter(l => l.side === "below").map(l => evalE(l, xD_disp));
  const lowers = lines.filter(l => l.side === "above").map(l => evalE(l, xD_disp));
  const ub = Math.min(...uppers);
  const lb = Math.max(...lowers);
  const feasible = ub > lb;

  return (
    <div>
      <p className="text-[9px] font-bold uppercase text-gray-400 mb-1 px-1">
        Diagram Magnel — Zona Kelayakan Tendon (Transfer)
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 290 }}>

        {/* Grid */}
        {yTicks.map(y => <line key={y} x1={PAD.left} y1={cy(y)} x2={PAD.left+CW} y2={cy(y)} stroke="#f1f5f9" strokeWidth={1} />)}
        {xTicks.map(x => <line key={x} x1={cx(x)} y1={PAD.top} x2={cx(x)} y2={PAD.top+CH} stroke="#f1f5f9" strokeWidth={1} />)}

        {/* Feasible shading */}
        {feasible && (
          <rect x={cx(xMin_disp)} y={cy(ub)} width={cx(xMax_disp)-cx(xMin_disp)}
            height={Math.abs(cy(lb)-cy(ub))} fill="#22c55e" fillOpacity={0.08} />
        )}

        {/* Kern lines */}
        {[kt, kb].map((k, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={cy(k)} x2={PAD.left+CW} y2={cy(k)}
              stroke="#cbd5e1" strokeWidth={0.8} strokeDasharray="4 3" />
            <text x={PAD.left+2} y={cy(k)+(i===0?-3:9)} fontSize={7} fill="#94a3b8">
              {i===0?`k_t=${k.toFixed(0)}`:`k_b=${k.toFixed(0)}`}
            </text>
          </g>
        ))}

        {/* e=0 reference */}
        {yMin < 0 && yMax > 0 && (
          <line x1={PAD.left} y1={cy(0)} x2={PAD.left+CW} y2={cy(0)}
            stroke="#e2e8f0" strokeWidth={1} strokeDasharray="2 4" />
        )}

        {/* Boundary lines */}
        {lines.map(ln => (
          <line key={ln.label}
            x1={cx(xMin_disp)} y1={cy(evalE(ln, xMin_disp))}
            x2={cx(xMax_disp)} y2={cy(evalE(ln, xMax_disp))}
            stroke={ln.color} strokeWidth={ln.dash ? 1.2 : 1.6}
            strokeDasharray={ln.dash ? "5 3" : undefined}
          />
        ))}

        {/* Vertical at design P_i */}
        <line x1={cx(xD_disp)} y1={PAD.top} x2={cx(xD_disp)} y2={PAD.top+CH}
          stroke="#7c3aed" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />

        {/* Design point */}
        <circle cx={cx(xD_disp)} cy={cy(eccentricityMidspan)} r={5}
          fill="#7c3aed" stroke="white" strokeWidth={1.5} />
        <text x={cx(xD_disp)+7} y={cy(eccentricityMidspan)-7} fontSize={7.5} fill="#7c3aed" fontWeight="700">
          ({xD_disp.toFixed(3)}, {eccentricityMidspan.toFixed(0)})
        </text>

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top+CH} stroke="#374151" strokeWidth={1.5} />
        <line x1={PAD.left} y1={PAD.top+CH} x2={PAD.left+CW} y2={PAD.top+CH} stroke="#374151" strokeWidth={1.5} />

        {/* X axis */}
        {xTicks.map(x => (
          <g key={x}>
            <line x1={cx(x)} y1={PAD.top+CH} x2={cx(x)} y2={PAD.top+CH+4} stroke="#374151" strokeWidth={1}/>
            <text x={cx(x)} y={PAD.top+CH+13} fontSize={6.5} textAnchor="middle" fill="#6b7280">
              {x.toFixed(3)}
            </text>
          </g>
        ))}
        <text x={PAD.left+CW/2} y={H-4} fontSize={7.5} textAnchor="middle" fill="#374151">
          1/P_i  (×10⁻³ kN⁻¹)
        </text>

        {/* Y axis */}
        {yTicks.map(y => (
          <g key={y}>
            <line x1={PAD.left-4} y1={cy(y)} x2={PAD.left} y2={cy(y)} stroke="#374151" strokeWidth={1}/>
            <text x={PAD.left-6} y={cy(y)+3} fontSize={6.5} textAnchor="end" fill="#6b7280">{y.toFixed(0)}</text>
          </g>
        ))}
        <text x={12} y={PAD.top+CH/2} fontSize={7.5} textAnchor="middle" fill="#374151"
          transform={`rotate(-90 12 ${PAD.top+CH/2})`}>e (mm)</text>

        {/* Legend (2 columns × 3 rows) */}
        {lines.map((ln, i) => (
          <g key={ln.label} transform={`translate(${PAD.left + 2 + (i%2)*108}, ${PAD.top - 26 + Math.floor(i/2)*10})`}>
            <line x1={0} y1={5} x2={13} y2={5} stroke={ln.color}
              strokeWidth={ln.dash ? 1.2 : 1.5} strokeDasharray={ln.dash ? "4 2" : undefined}/>
            <text x={16} y={8} fontSize={6.5} fill="#374151">{ln.label}</text>
          </g>
        ))}
        <g transform={`translate(${PAD.left+2}, ${PAD.top - 26 + 30})`}>
          <circle cx={5} cy={5} r={3.5} fill="#7c3aed"/>
          <text x={12} y={8} fontSize={6.5} fill="#374151">Titik desain (Transfer)</text>
        </g>

      </svg>

      {/* Feasibility summary */}
      <div className="px-1 mt-1 flex gap-3 text-[9px]">
        <span className={feasible ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>
          {feasible ? "✓ Titik desain dalam zona aman" : "✗ Di luar zona kelayakan"}
        </span>
        <span className="text-gray-400">
          Zona: {feasible ? `${lb.toFixed(0)} ≤ e ≤ ${ub.toFixed(0)} mm` : "tidak ada"}
        </span>
      </div>
    </div>
  );
}
