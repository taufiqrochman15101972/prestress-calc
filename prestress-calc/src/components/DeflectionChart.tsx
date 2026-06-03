"use client";

/**
 * DeflectionChart — SVG diagram of camber/deflection profile along span.
 * Shows: prestress camber (↑), self-weight (↓), deck load (↓), live load (↓), net total.
 * Includes L/360 and L/300 limit lines.
 */

import React from "react";
import type { DeflectionResult, MomentResults, LoadConfig } from "@/types";

interface Props {
  deflection: DeflectionResult;
  moments: MomentResults;
  loads: LoadConfig;
}

const W = 500;
const H = 200;
const PAD = { top: 28, bot: 36, left: 52, right: 20 };
const NX = 50; // number of sample points along span

const COLORS = {
  camber:  "#3B82F6", // blue
  sw:      "#6B7280", // gray
  deck:    "#8B5CF6", // violet
  live:    "#F59E0B", // amber
  total:   "#EF4444", // red
  limit360:"#10B981", // green dashed
  limit300:"#F97316", // orange dashed
};

// Parabolic distribution: max at midspan, 0 at ends
function parabolicProfile(maxVal: number, nx: number): number[] {
  return Array.from({ length: nx }, (_, i) => {
    const t = i / (nx - 1); // 0 → 1
    return maxVal * 4 * t * (1 - t);
  });
}

export function DeflectionChart({ deflection, loads }: Props) {
  const { deltaCamber, deltaSW, deltaDeck, deltaLive,
          deltaTotal, limitLive, limitTotal, liveOk, totalOk } = deflection;

  // Build profiles (sign: + = upward, - = downward)
  const camberProfile = parabolicProfile(+deltaCamber, NX);
  const swProfile     = parabolicProfile(-deltaSW,     NX);
  const deckProfile   = parabolicProfile(-deltaDeck,   NX);
  const liveProfile   = parabolicProfile(-deltaLive,   NX);
  const totalProfile  = camberProfile.map((c, i) =>
    c + swProfile[i] + deckProfile[i] + liveProfile[i]
  );

  // Scale: find max absolute value across all profiles + limits
  const allVals = [
    ...camberProfile, ...swProfile, ...deckProfile,
    ...liveProfile, ...totalProfile,
    limitLive, limitTotal, -limitLive, -limitTotal,
  ];
  const maxAbs = Math.max(Math.abs(Math.min(...allVals)), Math.abs(Math.max(...allVals)), 1);
  const scale = (H - PAD.top - PAD.bot) / 2 / (maxAbs * 1.1);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bot;
  const yZero = PAD.top + innerH / 2;

  function valToY(v: number) { return yZero - v * scale; }
  function xAtIdx(i: number) { return PAD.left + (i / (NX - 1)) * innerW; }

  function polyline(profile: number[], color: string, dash?: string) {
    const pts = profile.map((v, i) => `${xAtIdx(i)},${valToY(v)}`).join(" ");
    return (
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray={dash}
        strokeLinejoin="round"
      />
    );
  }

  function hline(val: number, color: string, label: string, dash = "4,3") {
    const y = valToY(val);
    if (y < PAD.top || y > H - PAD.bot) return null;
    return (
      <g key={label}>
        <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
          stroke={color} strokeWidth={1} strokeDasharray={dash} />
        <text x={W - PAD.right + 2} y={y + 3} fontSize={7} fill={color}>{label}</text>
      </g>
    );
  }

  // Y-axis ticks
  const tickInterval = maxAbs > 80 ? 40 : maxAbs > 40 ? 20 : maxAbs > 20 ? 10 : maxAbs > 10 ? 5 : 2;
  const ticks: number[] = [];
  for (let v = -Math.ceil(maxAbs / tickInterval) * tickInterval;
       v <= Math.ceil(maxAbs / tickInterval) * tickInterval;
       v += tickInterval) {
    ticks.push(v);
  }

  const spanM = (loads.spanLength / 1000).toFixed(1);

  return (
    <div className="w-full">
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">
        DIAGRAM LENDUTAN &amp; CAMBER SEPANJANG BENTANG
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>

        {/* Grid + zero line */}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} y1={valToY(v)} x2={W - PAD.right} y2={valToY(v)}
              stroke={v === 0 ? "#374151" : "#E5E7EB"}
              strokeWidth={v === 0 ? 1.5 : 0.5} />
            <text x={PAD.left - 3} y={valToY(v) + 3} textAnchor="end"
              fontSize={7} fill="#9CA3AF">{v}</text>
          </g>
        ))}

        {/* L/360 and L/300 lines (downward limits) */}
        {hline(-limitLive,  COLORS.limit360, `L/360`, "4,3")}
        {hline(-limitTotal, COLORS.limit300, `L/300`, "6,3")}

        {/* Component profiles */}
        {polyline(swProfile,     COLORS.sw,    "5,3")}
        {polyline(deckProfile,   COLORS.deck,  "5,3")}
        {polyline(liveProfile,   COLORS.live,  "5,3")}
        {polyline(camberProfile, COLORS.camber,"5,3")}

        {/* Total net — solid, thicker */}
        {polyline(totalProfile, COLORS.total)}
        <polyline
          points={totalProfile.map((v, i) => `${xAtIdx(i)},${valToY(v)}`).join(" ")}
          fill="none" stroke={COLORS.total} strokeWidth={2.5} strokeLinejoin="round"
        />

        {/* Axis labels */}
        <text x={PAD.left} y={H - 4} fontSize={8} fill="#6B7280">0</text>
        <text x={W - PAD.right} y={H - 4} fontSize={8} fill="#6B7280" textAnchor="end">
          L={spanM}m
        </text>
        <text x={PAD.left - 8} y={yZero} fontSize={7} fill="#374151"
          textAnchor="middle" transform={`rotate(-90, ${PAD.left - 14}, ${yZero})`}>
          δ (mm)
        </text>
        <text x={PAD.left + innerW / 2} y={H - 4} fontSize={7} fill="#374151" textAnchor="middle">
          ← atas (+) / bawah (−) →
        </text>

        {/* Midspan labels */}
        {[
          { val: totalProfile[Math.floor(NX/2)], color: COLORS.total,
            label: `Total: ${deltaTotal >= 0 ? "+" : ""}${deltaTotal.toFixed(1)}` },
          { val: camberProfile[Math.floor(NX/2)], color: COLORS.camber,
            label: `Camber: +${deltaCamber.toFixed(1)}` },
          { val: swProfile[Math.floor(NX/2)], color: COLORS.sw,
            label: `Berat sendiri: −${deltaSW.toFixed(1)}` },
          { val: deckProfile[Math.floor(NX/2)], color: COLORS.deck,
            label: `Pelat: −${deltaDeck.toFixed(1)}` },
          { val: liveProfile[Math.floor(NX/2)], color: COLORS.live,
            label: `Live: −${deltaLive.toFixed(1)}` },
        ].map(({ val, color, label }, k) => (
          <text key={k}
            x={xAtIdx(Math.floor(NX/2))} y={valToY(val) - 4}
            fontSize={7} fill={color} textAnchor="middle"
          >{label}</text>
        ))}

        {/* Status badges */}
        <g>
          <rect x={PAD.left} y={3} width={90} height={11} rx={3}
            fill={liveOk ? "#D1FAE5" : "#FEE2E2"} />
          <text x={PAD.left + 45} y={11} fontSize={7} textAnchor="middle"
            fill={liveOk ? "#065F46" : "#991B1B"}>
            {liveOk ? "✓" : "✗"} Live {deltaLive.toFixed(1)} ≤ L/360={limitLive.toFixed(1)}mm
          </text>
        </g>
        <g>
          <rect x={PAD.left + 96} y={3} width={90} height={11} rx={3}
            fill={totalOk ? "#D1FAE5" : "#FEE2E2"} />
          <text x={PAD.left + 141} y={11} fontSize={7} textAnchor="middle"
            fill={totalOk ? "#065F46" : "#991B1B"}>
            {totalOk ? "✓" : "✗"} |Total| {Math.abs(deltaTotal).toFixed(1)} ≤ L/300={limitTotal.toFixed(1)}mm
          </text>
        </g>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
        {[
          { color: COLORS.camber, label: "Camber (prategang ↑)", dash: true },
          { color: COLORS.sw,     label: "Berat sendiri ↓",     dash: true },
          { color: COLORS.deck,   label: "Pelat ↓",             dash: true },
          { color: COLORS.live,   label: "Beban hidup ↓",       dash: true },
          { color: COLORS.total,  label: "Total net",           dash: false },
          { color: COLORS.limit360, label: "L/360 limit",       dash: true },
          { color: COLORS.limit300, label: "L/300 limit",       dash: true },
        ].map(({ color, label, dash }) => (
          <div key={label} className="flex items-center gap-1">
            <svg width="18" height="6">
              <line x1="0" y1="3" x2="18" y2="3"
                stroke={color} strokeWidth={dash ? 1.5 : 2.5}
                strokeDasharray={dash ? "4,2" : "none"} />
            </svg>
            <span className="text-[8px] text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
