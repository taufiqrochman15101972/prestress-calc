"use client";
import React from "react";
import type { SLSCheckResults, GrossSectionProps } from "@/types";

interface Props { sls: SLSCheckResults; gross: GrossSectionProps; }

// ── Layout ───────────────────────────────────────────────────
const W = 580, H_SVG = 480;
const PL = 62, PR = 14, PT = 54, PB = 46, GAP = 24;
const BW = (W - PL - PR - GAP) / 2;   // block width ≈ 240
const DH = H_SVG - PT - PB;            // draw height ≈ 380

const yTop = PT;
const yBot = PT + DH;

function sy(structY: number, H: number) {
  return PT + DH * (1 - structY / H);
}

// ── Shared-scale stress block ─────────────────────────────────
interface BProps {
  bx: number; sigTop: number; sigBot: number;
  limComp: number; limTens: number;
  H: number; yNA: number; label: string; safe: boolean;
  scale: number;   // shared px/MPa
  xZeroOff: number; // distance from block LEFT to xZero
  h3: number; h3h2: number;
}

function Block({ bx, sigTop, sigBot, limComp, limTens, H, yNA,
  label, safe, scale, xZeroOff, h3, h3h2 }: BProps) {

  const xZ  = bx + xZeroOff;                    // zero axis x
  const xT  = xZ + sigTop * scale;              // top-fiber x
  const xBt = xZ + sigBot * scale;              // bot-fiber x
  const xLC = xZ - limComp * scale;             // compression limit x
  const xLT = xZ + limTens * scale;             // tension limit x
  const br  = bx + BW;                          // block right

  // Clamp limit lines to block bounds
  const clampX = (x: number) => Math.max(bx + 1, Math.min(br - 1, x));
  const xLCc = clampX(xLC);
  const xLTc = clampX(xLT);

  // Zero crossing (between top and bottom fibers)
  let yCross: number | null = null;
  if (Math.sign(sigTop) !== Math.sign(sigBot) && sigTop !== sigBot) {
    const frac = Math.abs(sigTop) / Math.abs(sigTop - sigBot);
    yCross = PT + frac * DH;
  }

  // Build filled regions (compression=blue, tension=red)
  const regions: { pts: string; fill: string }[] = [];
  if (yCross === null) {
    const fill = sigTop <= 0 ? "#bfdbfe" : "#fecaca";
    regions.push({ pts: `${xZ},${yTop} ${xT},${yTop} ${xBt},${yBot} ${xZ},${yBot}`, fill });
  } else {
    if (sigTop !== 0) {
      const f = sigTop <= 0 ? "#bfdbfe" : "#fecaca";
      regions.push({ pts: `${xZ},${yTop} ${xT},${yTop} ${xZ},${yCross}`, fill: f });
    }
    if (sigBot !== 0) {
      const f = sigBot <= 0 ? "#bfdbfe" : "#fecaca";
      regions.push({ pts: `${xZ},${yCross} ${xBt},${yBot} ${xZ},${yBot}`, fill: f });
    }
  }

  const sc = safe ? "#15803d" : "#b91c1c";
  const ySyNA = sy(yNA, H);
  const ySyH3 = sy(h3, H);
  const ySyHw = sy(h3h2, H);

  return (
    <g>
      {/* Background */}
      <rect x={bx} y={yTop} width={BW} height={DH} fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.6" rx="2" />

      {/* Flange grid lines */}
      <line x1={bx+3} y1={ySyH3} x2={br-3} y2={ySyH3} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,2" />
      <line x1={bx+3} y1={ySyHw} x2={br-3} y2={ySyHw} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,2" />

      {/* Filled stress polygons */}
      {regions.map((r, i) => (
        <polygon key={i} points={r.pts} fill={r.fill} fillOpacity="0.88" />
      ))}

      {/* Bold stress profile outline */}
      <polyline points={`${xZ},${yTop} ${xT},${yTop} ${xBt},${yBot} ${xZ},${yBot}`}
        fill="none" stroke={safe ? "#1e40af" : "#dc2626"} strokeWidth="2.5" strokeLinejoin="miter" />
      <line x1={xT} y1={yTop} x2={xBt} y2={yBot}
        stroke={safe ? "#1e3a8a" : "#991b1b"} strokeWidth="2.5" />

      {/* Compression-zone diagonal hatching via pattern clipped to polygon */}
      {regions.filter(r => r.fill === "#bfdbfe").map((r, i) => (
        <polygon key={`h${i}`} points={r.pts}
          fill="url(#compHatch)" fillOpacity="0.35" />
      ))}

      {/* Zero axis — bold vertical line */}
      <line x1={xZ} y1={yTop - 6} x2={xZ} y2={yBot + 6}
        stroke="#1e293b" strokeWidth="2" />
      <text x={xZ} y={yBot + 18} fontSize="8" fill="#475569"
        textAnchor="middle" fontFamily="monospace" fontWeight="bold">0</text>

      {/* NA line */}
      <line x1={bx+2} y1={ySyNA} x2={br-2} y2={ySyNA}
        stroke="#475569" strokeWidth="0.9" strokeDasharray="5,3" opacity="0.7" />

      {/* Zero crossing dot */}
      {yCross !== null && (
        <circle cx={xZ} cy={yCross} r="4" fill="#1e293b" />
      )}

      {/* Allowable limit lines */}
      <line x1={xLCc} y1={yTop+2} x2={xLCc} y2={yBot}
        stroke="#16a34a" strokeWidth="1.3" strokeDasharray="6,3" />
      <text x={xLCc} y={yTop-6} fontSize="8" fill="#15803d"
        textAnchor="middle" fontFamily="monospace" fontWeight="bold">
        -{limComp.toFixed(1)}
      </text>

      <line x1={xLTc} y1={yTop+2} x2={xLTc} y2={yBot}
        stroke="#16a34a" strokeWidth="1.3" strokeDasharray="6,3" />
      <text x={xLTc} y={yTop-6} fontSize="8" fill="#15803d"
        textAnchor="middle" fontFamily="monospace" fontWeight="bold">
        +{limTens.toFixed(2)}
      </text>

      {/* Top-fiber value label (leader line above) */}
      <line x1={xT} y1={yTop} x2={xT} y2={yTop - 16} stroke="#334155" strokeWidth="1" />
      <rect x={xT - 28} y={yTop - 30} width={56} height={14}
        rx="2" fill={sigTop > 0 ? "#fee2e2" : "#dbeafe"} stroke={sigTop > 0 ? "#dc2626" : "#1d4ed8"} strokeWidth="0.7" />
      <text x={xT} y={yTop - 20} fontSize="9.5" textAnchor="middle"
        fill={sigTop > 0 ? "#991b1b" : "#1d4ed8"} fontFamily="monospace" fontWeight="bold">
        {sigTop >= 0 ? "+" : ""}{sigTop.toFixed(2)}
      </text>

      {/* Bottom-fiber value label (leader line below) */}
      <line x1={xBt} y1={yBot} x2={xBt} y2={yBot + 16} stroke="#334155" strokeWidth="1" />
      <rect x={xBt - 28} y={yBot + 16} width={56} height={14}
        rx="2" fill={sigBot > 0 ? "#fee2e2" : "#dbeafe"} stroke={sigBot > 0 ? "#dc2626" : "#1d4ed8"} strokeWidth="0.7" />
      <text x={xBt} y={yBot + 26} fontSize="9.5" textAnchor="middle"
        fill={sigBot > 0 ? "#991b1b" : "#1d4ed8"} fontFamily="monospace" fontWeight="bold">
        {sigBot >= 0 ? "+" : ""}{sigBot.toFixed(2)}
      </text>
      <text x={xBt} y={yBot + 38} fontSize="7.5" fill="#64748b" textAnchor="middle">MPa</text>
      <text x={xT}  y={yTop - 8}  fontSize="7.5" fill="#64748b" textAnchor="middle">MPa</text>

      {/* Stage title */}
      <text x={bx + BW/2} y={yTop - 36} fontSize="11" fontWeight="bold"
        fill="#1e3a8a" textAnchor="middle">{label}</text>
      <rect x={bx + BW/2 - 32} y={yTop - 30} width={64} height={15}
        rx="3" fill={safe ? "#dcfce7" : "#fee2e2"} />
      <text x={bx + BW/2} y={yTop - 19} fontSize="8.5" fontWeight="bold"
        fill={sc} textAnchor="middle">{safe ? "✓ AMAN" : "✗ OVERSTRESS"}</text>
    </g>
  );
}

// ── Public component ──────────────────────────────────────────
export function StressDistributionChart({ sls, gross }: Props) {
  const H   = gross.hTotal;
  const yNA = gross.yb;
  const { transfer, service } = sls;

  // ── SHARED scale across both stages ──────────────────────
  const allAbs = [
    Math.abs(transfer.sigmaTop), Math.abs(transfer.sigmaBot),
    Math.abs(service.sigmaTop),  Math.abs(service.sigmaBot),
  ];
  const allTens = [
    Math.max(0, transfer.sigmaTop), Math.max(0, transfer.sigmaBot),
    Math.max(0, service.sigmaTop),  Math.max(0, service.sigmaBot),
  ];
  const maxComp = Math.max(...allAbs, 0.5) * 1.45;
  const maxTens = Math.max(...allTens, 0.01) * 1.45;
  const totalRange = maxComp + maxTens;
  const scale = BW / totalRange;           // shared px/MPa
  const xZeroOff = maxComp * scale;        // distance from block left to zero axis

  // Girder flange heights (approximate)
  const h3   = Math.round(H * 0.152);
  const h3h2 = Math.round(H * 0.879);

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 px-1">
        Distribusi Tegangan Serat — Transfer &amp; Servis (Midspan) · Skala Sama
      </p>

      <svg viewBox={`0 0 ${W} ${H_SVG}`} style={{ width: "100%", height: "auto" }}
        className="overflow-visible">

        <defs>
          {/* Diagonal hatching for compression zone */}
          <pattern id="compHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#3b82f6" strokeWidth="1.5" />
          </pattern>
        </defs>

        {/* ── Shared Y-axis (left of first block) ── */}
        <line x1={PL - 6} y1={yTop} x2={PL - 6} y2={yBot} stroke="#94a3b8" strokeWidth="1" />
        {[0, h3, h3h2, Math.round(yNA), H].map((v, i) => {
          const ys = sy(v, H);
          const isNA = v === Math.round(yNA);
          return (
            <g key={i}>
              <line x1={PL - 10} y1={ys} x2={PL - 4} y2={ys}
                stroke={isNA ? "#374151" : "#94a3b8"} strokeWidth={isNA ? 1 : 0.8} />
              <text x={PL - 12} y={ys + 3} fontSize={isNA ? 8 : 7.5}
                fill={isNA ? "#374151" : "#94a3b8"}
                textAnchor="end" fontFamily="monospace"
                fontWeight={isNA ? "bold" : "normal"}>
                {isNA ? `y_b=${v}` : v}
              </text>
            </g>
          );
        })}
        <text x={12} y={PT + DH / 2} fontSize="8" fill="#64748b"
          textAnchor="middle"
          transform={`rotate(-90,12,${PT + DH / 2})`}>
          y (mm dari serat bawah)
        </text>

        {/* ── Fiber labels ── */}
        <text x={PL + 2} y={yTop - 4} fontSize="8" fill="#334155" fontWeight="bold">Serat Atas ↑</text>
        <text x={PL + 2} y={yBot + 12} fontSize="8" fill="#334155" fontWeight="bold">Serat Bawah ↓</text>

        {/* ── Scale bar at bottom ── */}
        <g transform={`translate(${PL}, ${H_SVG - 12})`}>
          {/* Draw a scale ruler showing how many px = 5 MPa */}
          {(() => {
            const markMPa = [5, 10, 15, 20];
            const scaleBarX = xZeroOff;  // zero at same position as blocks
            return (
              <>
                <line x1={scaleBarX - maxComp*scale} y1={-2} x2={scaleBarX + maxTens*scale} y2={-2}
                  stroke="#94a3b8" strokeWidth="0.6" />
                {markMPa.filter(m => m <= maxComp).map(m => (
                  <g key={`c${m}`}>
                    <line x1={scaleBarX - m*scale} y1={-5} x2={scaleBarX - m*scale} y2={1}
                      stroke="#64748b" strokeWidth="0.8" />
                    <text x={scaleBarX - m*scale} y={7} fontSize="7" fill="#64748b"
                      textAnchor="middle">-{m}</text>
                  </g>
                ))}
                {markMPa.filter(m => m <= maxTens && m > 0).map(m => (
                  <g key={`t${m}`}>
                    <line x1={scaleBarX + m*scale} y1={-5} x2={scaleBarX + m*scale} y2={1}
                      stroke="#64748b" strokeWidth="0.8" />
                    <text x={scaleBarX + m*scale} y={7} fontSize="7" fill="#64748b"
                      textAnchor="middle">+{m}</text>
                  </g>
                ))}
                <line x1={scaleBarX} y1={-6} x2={scaleBarX} y2={2}
                  stroke="#1e293b" strokeWidth="1.5" />
                <text x={scaleBarX} y={7} fontSize="7" fill="#1e293b"
                  textAnchor="middle" fontWeight="bold">0</text>
                <text x={BW * 1.5} y={7} fontSize="7" fill="#94a3b8">σ (MPa) →</text>
              </>
            );
          })()}
        </g>

        {/* ── Two stress blocks (shared scale) ── */}
        <Block bx={PL}        sigTop={transfer.sigmaTop} sigBot={transfer.sigmaBot}
          limComp={transfer.topFiber.limitCompMpa} limTens={transfer.topFiber.limitTensMpa}
          H={H} yNA={yNA} label="Tahap Transfer" safe={transfer.isStagesSafe}
          scale={scale} xZeroOff={xZeroOff} h3={h3} h3h2={h3h2} />

        <Block bx={PL+BW+GAP} sigTop={service.sigmaTop} sigBot={service.sigmaBot}
          limComp={service.topFiber.limitCompMpa}    limTens={service.topFiber.limitTensMpa}
          H={H} yNA={yNA} label="Tahap Servis"    safe={service.isStageSafe}
          scale={scale} xZeroOff={xZeroOff} h3={h3} h3h2={h3h2} />

        {/* ── Legend ── */}
        <g transform={`translate(${PL}, ${H_SVG - 32})`}>
          <rect x={0}   y={-7} width={11} height={10} fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="0.5" />
          <rect x={0}   y={-7} width={11} height={10} fill="url(#compHatch)" fillOpacity="0.35" />
          <text x={14}  y={3}  fontSize="8" fill="#334155">Tekan (−)</text>
          <rect x={75}  y={-7} width={11} height={10} fill="#fecaca" stroke="#dc2626" strokeWidth="0.5" />
          <text x={89}  y={3}  fontSize="8" fill="#334155">Tarik (+)</text>
          <line x1={155} y1={-2} x2={168} y2={-2} stroke="#16a34a" strokeWidth="1.3" strokeDasharray="5,2" />
          <text x={172}  y={3}  fontSize="8" fill="#334155">Batas izin</text>
          <line x1={240} y1={-2} x2={253} y2={-2} stroke="#475569" strokeWidth="1"   strokeDasharray="5,2" />
          <text x={257}  y={3}  fontSize="8" fill="#334155">NA bruto</text>
          <line x1={318} y1={-2} x2={331} y2={-2} stroke="#1e293b" strokeWidth="2" />
          <text x={335}  y={3}  fontSize="8" fill="#334155">Sumbu nol</text>
        </g>
      </svg>
    </div>
  );
}
