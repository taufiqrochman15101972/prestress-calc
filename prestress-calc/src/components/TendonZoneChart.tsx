"use client";

/**
 * Tendon Zone Diagram — permissible eccentricity zone along the span.
 *
 * At each section x, the 8 SLS conditions (4 Transfer + 4 Service) bound e(x):
 *
 *   Transfer Top    compression: e ≥ e_min_T1   [L1, solid red]
 *   Transfer Top    tension    : e ≤ e_max_T2   [L2, solid orange]
 *   Transfer Bottom compression: e ≤ e_max_T3   [L3, solid blue]
 *   Transfer Bottom tension    : e ≥ e_min_T4   [L4, solid green]
 *   Service  Top    compression: e ≥ e_min_S1   [L5, dashed red]
 *   Service  Top    tension    : e ≤ e_max_S2   [L6, dashed orange]
 *   Service  Bottom compression: e ≤ e_max_S3   [L7, dashed blue]
 *   Service  Bottom tension    : e ≥ e_min_S4   [L8, dashed green]
 *
 * Feasible zone: e ∈ [max(lower bounds), min(upper bounds)]
 *
 * Display: y from bottom fiber (mm) = y_b − e
 * All internal units: N and mm (stresses in MPa = N/mm²).
 */

import React from "react";
import type {
  GrossSectionProps,
  CompositeSectionProps,
  PrestressForces,
  MomentResults,
  TendonConfig,
  LoadConfig,
  MaterialProps,
} from "@/types";

interface Props {
  gross: GrossSectionProps;
  comp: CompositeSectionProps;
  prestress: PrestressForces;
  tendon: TendonConfig;
  loads: LoadConfig;
  material: MaterialProps;
  eccentricityMidspan: number;
}

const N_PTS = 81;
const W = 420, H = 270;
const PAD = { top: 12, right: 14, bottom: 36, left: 46 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

function lerp(v: number, lo: number, hi: number, pLo: number, pHi: number) {
  return pLo + ((v - lo) / (hi - lo)) * (pHi - pLo);
}

/** e bounds at position x from all 8 SLS conditions. Returns {eMin, eMax} */
function boundsAt(
  x_mm: number, L: number,
  Pi_N: number, Pe_N: number,
  wSelf: number, wSDL: number, wLive: number,
  Ag: number, Ztg: number, Zbg: number, Ztgc: number, Zbc: number,
  sigCT: number, sigTT: number, sigCS: number, sigTS: number,
) {
  // Parabolic moments (w in kN/m = N/mm, x in mm)
  const Mg    = wSelf * x_mm * (L - x_mm) / 2;   // N·mm
  const Msdl  = wSDL  * x_mm * (L - x_mm) / 2;
  const Ml    = wLive * x_mm * (L - x_mm) / 2;

  // ── Transfer ──────────────────────────────────────────────────
  // Top compression (σ_top ≥ sigCT): e ≥
  const eMin_T1 = sigCT * Ztg / Pi_N + Ztg / Ag + Mg / Pi_N;
  // Top tension (σ_top ≤ sigTT): e ≤
  const eMax_T2 = sigTT * Ztg / Pi_N + Ztg / Ag + Mg / Pi_N;
  // Bottom compression (σ_bot ≥ sigCT): e ≤
  const eMax_T3 = -sigCT * Zbg / Pi_N - Zbg / Ag + Mg / Pi_N;
  // Bottom tension (σ_bot ≤ sigTT): e ≥
  const eMin_T4 = -sigTT * Zbg / Pi_N - Zbg / Ag + Mg / Pi_N;

  // ── Service (composite) ───────────────────────────────────────
  // Top compression: e ≥
  const eMin_S1 = sigCS * Ztg / Pe_N + Ztg / Ag
    + (Mg + Msdl) / Pe_N
    + Ml * Ztg / (Pe_N * Ztgc);
  // Top tension: e ≤
  const eMax_S2 = sigTS * Ztg / Pe_N + Ztg / Ag
    + (Mg + Msdl) / Pe_N
    + Ml * Ztg / (Pe_N * Ztgc);
  // Bottom compression: e ≤
  const eMax_S3 = -sigCS * Zbg / Pe_N - Zbg / Ag
    + (Mg + Msdl) / Pe_N
    + Ml * Zbg / (Pe_N * Zbc);
  // Bottom tension: e ≥
  const eMin_S4 = -sigTS * Zbg / Pe_N - Zbg / Ag
    + (Mg + Msdl) / Pe_N
    + Ml * Zbg / (Pe_N * Zbc);

  const eMin = Math.max(eMin_T1, eMin_T4, eMin_S1, eMin_S4);
  const eMax = Math.min(eMax_T2, eMax_T3, eMax_S2, eMax_S3);

  return { eMin, eMax, eMin_T1, eMax_T2, eMax_T3, eMin_T4, eMin_S1, eMax_S2, eMax_S3, eMin_S4 };
}

export function TendonZoneChart({ gross, comp, prestress, tendon, loads, material, eccentricityMidspan }: Props) {
  const { areaAg: Ag, Ztg, Zbg, yb, hTotal } = gross;
  const { Ztgc, Zbc } = comp;
  const L = loads.spanLength; // mm
  const Pi_N = prestress.Pi * 1000;
  const Pe_N = prestress.Pe * 1000;

  const sigCT = -0.60 * material.fci;
  const sigTT = +0.50 * Math.sqrt(material.fci);
  const sigCS = -0.45 * material.fc;
  const sigTS = +0.50 * Math.sqrt(material.fc);

  // Self-weight from store moments (kN/m = N/mm)
  const wSelf = loads.gammaConc * gross.areaAg * 1e-6; // kN/m

  // Tendon profile: e(x) for each point
  const eSupport = tendon.eccentricitySupport;
  const eMid     = eccentricityMidspan;

  function tendonE(x_mm: number): number {
    const t = x_mm / L;
    if (tendon.profileType === "STRAIGHT") return eMid;
    if (tendon.profileType === "HARPED") {
      const xg = (tendon.holdDownRatio || 0.5) * L;
      if (x_mm <= xg) return eSupport + (eMid - eSupport) * (x_mm / xg);
      return eMid + (eSupport - eMid) * ((x_mm - xg) / (L - xg));
    }
    // PARABOLIC
    return eSupport + (eMid - eSupport) * 4 * t * (1 - t);
  }

  // Compute zone at N_PTS evenly spaced positions
  const xs = Array.from({ length: N_PTS }, (_, i) => (i / (N_PTS - 1)) * L);

  const zoneData = xs.map((x_mm) => {
    const b = boundsAt(
      x_mm, L, Pi_N, Pe_N,
      wSelf, loads.wSDL, loads.wLive,
      Ag, Ztg, Zbg, Ztgc, Zbc,
      sigCT, sigTT, sigCS, sigTS,
    );
    const eTendon = tendonE(x_mm);
    // Convert e → y from bottom: y = yb − e
    return {
      x_m: x_mm / 1000,
      yZoneMin: yb - b.eMax,   // max e → min y (tendon closer to bottom)
      yZoneMax: yb - b.eMin,   // min e → max y (tendon closer to top)
      yTendon:  yb - eTendon,
      feasible: b.eMax >= b.eMin,
    };
  });

  // Axis ranges
  const allY = zoneData.flatMap(d => [d.yZoneMin, d.yZoneMax, d.yTendon]);
  const yPad = 60;
  const yLo  = Math.max(0, Math.min(...allY) - yPad);
  const yHi  = Math.min(hTotal, Math.max(...allY) + yPad);
  const xLo  = 0, xHi = L / 1000;

  const cx = (x: number) => lerp(x, xLo, xHi, PAD.left, PAD.left + CW);
  const cy = (y: number) => lerp(y, yLo, yHi, PAD.top + CH, PAD.top);

  // Build SVG polygon/polyline paths
  function pts(arr: { x: number; y: number }[]): string {
    return arr.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  }

  const zoneTopPts    = zoneData.map(d => ({ x: cx(d.x_m), y: cy(d.yZoneMax) }));
  const zoneBotPts    = zoneData.map(d => ({ x: cx(d.x_m), y: cy(d.yZoneMin) }));
  const tendonPts     = zoneData.map(d => ({ x: cx(d.x_m), y: cy(d.yTendon)  }));

  // Filled zone polygon (top edge forward + bottom edge reversed)
  const zoneFillPts = [...zoneTopPts, ...[...zoneBotPts].reverse()];

  // Y-axis ticks
  const yStep = hTotal > 1200 ? 200 : 100;
  const yTicks: number[] = [];
  for (let y = Math.ceil(yLo / yStep) * yStep; y <= yHi; y += yStep) yTicks.push(y);

  // X-axis ticks (every 5m)
  const xStep = xHi > 20 ? 5 : xHi > 10 ? 2 : 1;
  const xTicks: number[] = [];
  for (let x = 0; x <= xHi; x += xStep) xTicks.push(parseFloat(x.toFixed(1)));

  // Check if design is inside zone at midspan
  const midData = zoneData[Math.floor(N_PTS / 2)];
  const insideZone = midData.yTendon >= midData.yZoneMin && midData.yTendon <= midData.yZoneMax;

  return (
    <div>
      <p className="text-[9px] font-bold uppercase text-gray-400 mb-1 px-1">
        Zona Tendon — Batas Kelayakan Sepanjang Bentang
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 270 }}>

        {/* Grid */}
        {yTicks.map(y => (
          <line key={y} x1={PAD.left} y1={cy(y)} x2={PAD.left+CW} y2={cy(y)}
            stroke="#f1f5f9" strokeWidth={1} />
        ))}
        {xTicks.map(x => (
          <line key={x} x1={cx(x)} y1={PAD.top} x2={cx(x)} y2={PAD.top+CH}
            stroke="#f1f5f9" strokeWidth={1} />
        ))}

        {/* Feasible zone fill */}
        <polygon points={pts(zoneFillPts)} fill="#22c55e" fillOpacity={0.10} />

        {/* Zone boundary lines */}
        <polyline points={pts(zoneTopPts)} fill="none" stroke="#6366f1" strokeWidth={1.5}
          strokeDasharray="5 3" />
        <polyline points={pts(zoneBotPts)} fill="none" stroke="#f97316" strokeWidth={1.5}
          strokeDasharray="5 3" />

        {/* Girder NA reference */}
        <line x1={PAD.left} y1={cy(yb)} x2={PAD.left+CW} y2={cy(yb)}
          stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="4 3" />
        <text x={PAD.left+2} y={cy(yb)-3} fontSize={6.5} fill="#94a3b8">y_b={yb.toFixed(0)}</text>

        {/* Actual tendon profile */}
        <polyline points={pts(tendonPts)} fill="none" stroke="#dc2626" strokeWidth={2} />

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top+CH}
          stroke="#374151" strokeWidth={1.5} />
        <line x1={PAD.left} y1={PAD.top+CH} x2={PAD.left+CW} y2={PAD.top+CH}
          stroke="#374151" strokeWidth={1.5} />

        {/* X ticks */}
        {xTicks.map(x => (
          <g key={x}>
            <line x1={cx(x)} y1={PAD.top+CH} x2={cx(x)} y2={PAD.top+CH+4}
              stroke="#374151" strokeWidth={1} />
            <text x={cx(x)} y={PAD.top+CH+12} fontSize={6.5} textAnchor="middle" fill="#6b7280">
              {x.toFixed(0)}
            </text>
          </g>
        ))}
        <text x={PAD.left+CW/2} y={H-3} fontSize={7.5} textAnchor="middle" fill="#374151">
          Posisi x (m)
        </text>

        {/* Y ticks */}
        {yTicks.map(y => (
          <g key={y}>
            <line x1={PAD.left-4} y1={cy(y)} x2={PAD.left} y2={cy(y)}
              stroke="#374151" strokeWidth={1} />
            <text x={PAD.left-6} y={cy(y)+3} fontSize={6.5} textAnchor="end" fill="#6b7280">{y}</text>
          </g>
        ))}
        <text x={10} y={PAD.top+CH/2} fontSize={7.5} textAnchor="middle" fill="#374151"
          transform={`rotate(-90 10 ${PAD.top+CH/2})`}>y dari bawah (mm)</text>

        {/* Legend */}
        <g transform={`translate(${PAD.left+4}, ${PAD.top+4})`}>
          <line x1={0} y1={5} x2={14} y2={5} stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 2"/>
          <text x={17} y={8} fontSize={6.5} fill="#374151">Batas atas zona</text>
          <line x1={90} y1={5} x2={104} y2={5} stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 2"/>
          <text x={107} y={8} fontSize={6.5} fill="#374151">Batas bawah zona</text>
          <rect x={196} y={0} width={14} height={10} fill="#22c55e" fillOpacity={0.25}/>
          <text x={213} y={8} fontSize={6.5} fill="#374151">Zona kelayakan</text>
          <line x1={285} y1={5} x2={299} y2={5} stroke="#dc2626" strokeWidth={2}/>
          <text x={302} y={8} fontSize={6.5} fill="#374151">Profil tendon</text>
        </g>

      </svg>

      {/* Status */}
      <div className="px-1 mt-0.5 flex gap-3 text-[9px]">
        <span className={insideZone ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>
          {insideZone ? "✓ Profil tendon dalam zona kelayakan" : "✗ Profil tendon di luar zona"}
        </span>
        <span className="text-gray-400">
          e_mid = {eccentricityMidspan.toFixed(0)} mm &nbsp;·&nbsp;
          e_sup = {tendon.eccentricitySupport.toFixed(0)} mm &nbsp;·&nbsp;
          {tendon.profileType}
        </span>
      </div>
    </div>
  );
}
