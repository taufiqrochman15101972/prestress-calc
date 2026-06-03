"use client";

import React from "react";
import type {
  IGirderGeometry,
  DeckGeometry,
  GrossSectionProps,
  CompositeSectionProps,
  TendonConfig,
  TendonRow,
} from "@/types";
import { girderHeight } from "@/engine/section";

interface Props {
  girder: IGirderGeometry;
  deck: DeckGeometry;
  gross: GrossSectionProps;
  composite: CompositeSectionProps;
  tendon: TendonConfig;
  yResultant: number;
}

const W = 380;
const H_SVG = 520;
const ML = 72;
const MR = 72;
const MT = 30;
const MB = 40;
const DW = W - ML - MR;
const DH = H_SVG - MT - MB;

function makeMappers(girderW: number, totalH: number) {
  const scaleX = DW / (girderW * 1.25);
  const scaleY = DH / totalH;
  const scale  = Math.min(scaleX, scaleY);
  const cx = (x: number) => ML + DW / 2 + x * scale;
  const cy = (y: number) => H_SVG - MB - y * scale;
  return { cx, cy, scale };
}

function poly(
  coords: [number, number][],
  cx: (x: number) => number,
  cy: (y: number) => number
): string {
  return coords.map(([x, y]) => `${cx(x).toFixed(1)},${cy(y).toFixed(1)}`).join(" ");
}

function TendonCircles({
  rows, cx, cy, strandDiameter, b2, b3, scale,
}: {
  rows: TendonRow[];
  cx: (x: number) => number;
  cy: (y: number) => number;
  strandDiameter: number;
  b2: number; b3: number;
  scale: number;
}) {
  const rPx = Math.max(2.5, (strandDiameter / 2) * scale * 0.95);
  const availableW = Math.min(b3 * 0.85, b2 * 3);
  const spacing = Math.max(strandDiameter * 1.6, availableW / 10);
  return (
    <g>
      {rows.map((row) => {
        const n = row.strandCount;
        const totalW = (n - 1) * spacing;
        return Array.from({ length: n }, (_, i) => {
          const xOffset = -totalW / 2 + i * spacing;
          return (
            <circle
              key={`${row.id}-${i}`}
              cx={cx(xOffset)} cy={cy(row.yFromBottom)}
              r={rPx} fill="#dc2626" stroke="#7f1d1d"
              strokeWidth="0.8" opacity="0.9"
            />
          );
        });
      })}
    </g>
  );
}

export function SectionDiagram({ girder, deck, gross, composite, tendon, yResultant }: Props) {
  const { b1, h1, b2, h2, b3, h3 } = girder;
  const h4 = girder.h4 ?? 0;
  const h5 = girder.h5 ?? 0;
  const H   = girderHeight(girder);
  const td  = deck.thicknessTd;
  const tot = H + td;

  const maxW = Math.max(b3, Math.min(deck.widthBeff, b3 * 1.5));
  const { cx, cy, scale } = makeMappers(maxW, tot);

  // ── Girder polygon with trapezoidal fillets ───────────────
  // Counter-clockwise from bottom-left, then close
  // Levels:
  //   y=0          bottom of bottom flange
  //   y=h3         top of bottom flange / bottom of fillet
  //   y=h3+h4      top of fillet / bottom of web
  //   y=h3+h4+h2   top of web / bottom of top fillet
  //   y=h3+h4+h2+h5 top of top fillet / bottom of top flange
  //   y=H          top of top flange

  const yBotFlangeTop  = h3;
  const yWebBot        = h3 + h4;
  const yWebTop        = h3 + h4 + h2;
  const yTopFlangeBot  = h3 + h4 + h2 + h5;

  const girderCoords: [number, number][] = [
    // Start at bottom-left, go clockwise
    [-b3/2, 0],
    [ b3/2, 0],
    // Up right side of bottom flange
    [ b3/2, yBotFlangeTop],
    // Bottom fillet right (if h4 > 0)
    ...(h4 > 0 ? [[b2/2, yWebBot] as [number, number]] : [[ b3/2, yWebBot] as [number, number]]),
    // Web right side (only show if there's a step)
    ...((h4 === 0 && b2 < b3) ? [[ b2/2, yWebBot] as [number, number]] : []),
    [ b2/2, yWebTop],
    // Top fillet right (if h5 > 0)
    ...(h5 > 0 ? [[ b1/2, yTopFlangeBot] as [number, number]] : [[ b2/2, yTopFlangeBot] as [number, number]]),
    // Top flange right + top
    ...((h5 === 0 && b1 > b2) ? [[ b1/2, yTopFlangeBot] as [number, number]] : []),
    [ b1/2, H],
    [-b1/2, H],
    // Mirror left side
    ...(h5 > 0 ? [[-b1/2, yTopFlangeBot] as [number, number]] : [[-b2/2, yTopFlangeBot] as [number, number]]),
    ...((h5 === 0 && b1 > b2) ? [[-b1/2, yTopFlangeBot] as [number, number]] : []),
    [-b2/2, yWebTop],
    // Top-left web top (if b2 < b1 and no fillet, explicitly add)
    [-b2/2, yWebBot],
    // Bottom fillet left
    ...(h4 > 0 ? [[-b2/2, yWebBot] as [number, number]] : [[-b3/2, yWebBot] as [number, number]]),
    ...((h4 === 0 && b2 < b3) ? [[-b2/2, yWebBot] as [number, number]] : []),
    ...(h4 > 0 ? [[-b3/2, yBotFlangeTop] as [number, number]] : []),
    [-b3/2, yBotFlangeTop],
    [-b3/2, 0],
  ];

  // Deduplicate consecutive identical points
  const deduped = girderCoords.filter((pt, i, arr) =>
    i === 0 || !(pt[0] === arr[i-1][0] && pt[1] === arr[i-1][1])
  );

  const girderPts = poly(deduped, cx, cy);

  const deckHalf = Math.min(deck.widthBeff / 2, maxW * 0.6);
  const deckPts = poly([
    [-deckHalf, H], [deckHalf, H],
    [deckHalf, H+td], [-deckHalf, H+td],
  ], cx, cy);

  const yNA  = gross.yb;
  const yNAc = composite.ybc;
  const lineExt = b3 * 0.46;

  const rightEdge = cx(b3/2);
  const dimRight1 = rightEdge + 10;
  const dimRight2 = rightEdge + 30;

  const leftEdge  = cx(-b3/2);
  const dimLeft1  = leftEdge - 10;
  const dimLeft2  = leftEdge - 30;

  const topEdge   = cy(H + td);
  const dimTop    = topEdge - 12;

  return (
    <svg viewBox={`0 0 ${W} ${H_SVG}`} className="w-full h-full overflow-visible">
      <defs>
        <marker id="dimArrow" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
          <path d="M 0 0 L 5 2.5 L 0 5 Z" fill="#374151" />
        </marker>
        <marker id="dimArrowOrange" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
          <path d="M 0 0 L 5 2.5 L 0 5 Z" fill="#d97706" />
        </marker>
        <pattern id="deckHatch" patternUnits="userSpaceOnUse" width="5" height="5">
          <path d="M 0 5 L 5 0" stroke="#9ca3af" strokeWidth="0.5" />
        </pattern>
      </defs>

      <text x={W/2} y={MT-10} fontSize="10" fontWeight="bold" fill="#1e3a5f" textAnchor="middle">
        Penampang I-Girder + Pelat Komposit
      </text>

      {/* Deck */}
      <polygon points={deckPts} fill="url(#deckHatch)" stroke="#6b7280" strokeWidth="1.2" />
      <polygon points={deckPts} fill="#f3f4f6" fillOpacity="0.55" stroke="none" />

      {/* Girder — filled with subtle blue, blue outline */}
      <polygon points={girderPts} fill="#dbeafe" stroke="#1d4ed8" strokeWidth="1.5" />

      {/* Neutral axes */}
      <line x1={cx(-lineExt)} y1={cy(yNA)}  x2={cx(lineExt)} y2={cy(yNA)}
        stroke="#374151" strokeWidth="1.2" strokeDasharray="6,3" />
      <line x1={cx(-lineExt)} y1={cy(yNAc)} x2={cx(lineExt)} y2={cy(yNAc)}
        stroke="#d97706" strokeWidth="1.2" strokeDasharray="6,3" />

      {/* Tendon strands */}
      <TendonCircles
        rows={tendon.rows} cx={cx} cy={cy}
        strandDiameter={tendon.strandDiameter}
        b2={b2} b3={b3} scale={scale}
      />

      {/* Tendon resultant centroid */}
      <circle cx={cx(0)} cy={cy(yResultant)} r="3.5"
        fill="none" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3,2" />

      {/* NA labels */}
      <text x={cx(-lineExt)-3} y={cy(yNA)}  fontSize="8" fill="#374151"
        textAnchor="end" dominantBaseline="middle">NA</text>
      <text x={cx(-lineExt)-3} y={cy(yNAc)} fontSize="8" fill="#d97706"
        textAnchor="end" dominantBaseline="middle">NAc</text>

      {/* ── Right-side dimension lines ── */}
      {/* h3 */}
      <line x1={dimRight1} y1={cy(0)} x2={dimRight1} y2={cy(h3)}
        stroke="#374151" strokeWidth="0.8" markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
      <line x1={rightEdge+1} y1={cy(0)}  x2={dimRight1+2} y2={cy(0)}  stroke="#374151" strokeWidth="0.5" />
      <line x1={rightEdge+1} y1={cy(h3)} x2={dimRight1+2} y2={cy(h3)} stroke="#374151" strokeWidth="0.5" />
      <text x={dimRight1+4} y={(cy(0)+cy(h3))/2} fontSize="8" fill="#374151"
        dominantBaseline="middle" fontFamily="monospace">h₃={h3}</text>

      {/* h4 fillet (if present) */}
      {h4 > 0 && (
        <>
          <line x1={dimRight1} y1={cy(h3)} x2={dimRight1} y2={cy(yWebBot)}
            stroke="#7c3aed" strokeWidth="0.8" markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
          <line x1={rightEdge+1} y1={cy(yWebBot)} x2={dimRight1+2} y2={cy(yWebBot)} stroke="#7c3aed" strokeWidth="0.5" />
          <text x={dimRight1+4} y={(cy(h3)+cy(yWebBot))/2} fontSize="7.5" fill="#7c3aed"
            dominantBaseline="middle" fontFamily="monospace">h₄={h4}</text>
        </>
      )}

      {/* h2 */}
      <line x1={dimRight1} y1={cy(yWebBot)} x2={dimRight1} y2={cy(yWebTop)}
        stroke="#374151" strokeWidth="0.8" markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
      <line x1={rightEdge+1} y1={cy(yWebBot)} x2={dimRight1+2} y2={cy(yWebBot)} stroke="#374151" strokeWidth="0.5" />
      <line x1={rightEdge+1} y1={cy(yWebTop)} x2={dimRight1+2} y2={cy(yWebTop)} stroke="#374151" strokeWidth="0.5" />
      <text x={dimRight1+4} y={(cy(yWebBot)+cy(yWebTop))/2} fontSize="8" fill="#374151"
        dominantBaseline="middle" fontFamily="monospace">h₂={h2}</text>

      {/* h5 fillet (if present) */}
      {h5 > 0 && (
        <>
          <line x1={dimRight1} y1={cy(yWebTop)} x2={dimRight1} y2={cy(yTopFlangeBot)}
            stroke="#7c3aed" strokeWidth="0.8" markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
          <line x1={rightEdge+1} y1={cy(yTopFlangeBot)} x2={dimRight1+2} y2={cy(yTopFlangeBot)} stroke="#7c3aed" strokeWidth="0.5" />
          <text x={dimRight1+4} y={(cy(yWebTop)+cy(yTopFlangeBot))/2} fontSize="7.5" fill="#7c3aed"
            dominantBaseline="middle" fontFamily="monospace">h₅={h5}</text>
        </>
      )}

      {/* h1 */}
      <line x1={dimRight1} y1={cy(yTopFlangeBot)} x2={dimRight1} y2={cy(H)}
        stroke="#374151" strokeWidth="0.8" markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
      <line x1={rightEdge+1} y1={cy(yTopFlangeBot)} x2={dimRight1+2} y2={cy(yTopFlangeBot)} stroke="#374151" strokeWidth="0.5" />
      <line x1={rightEdge+1} y1={cy(H)}            x2={dimRight1+2} y2={cy(H)}            stroke="#374151" strokeWidth="0.5" />
      <text x={dimRight1+4} y={(cy(yTopFlangeBot)+cy(H))/2} fontSize="8" fill="#374151"
        dominantBaseline="middle" fontFamily="monospace">h₁={h1}</text>

      {/* td */}
      <line x1={dimRight1} y1={cy(H)} x2={dimRight1} y2={cy(H+td)}
        stroke="#6b7280" strokeWidth="0.8" markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
      <line x1={cx(deckHalf)+1} y1={cy(H)}    x2={dimRight1+2} y2={cy(H)}    stroke="#6b7280" strokeWidth="0.5" />
      <line x1={cx(deckHalf)+1} y1={cy(H+td)} x2={dimRight1+2} y2={cy(H+td)} stroke="#6b7280" strokeWidth="0.5" />
      <text x={dimRight1+4} y={(cy(H)+cy(H+td))/2} fontSize="8" fill="#6b7280"
        dominantBaseline="middle" fontFamily="monospace">td={td}</text>

      {/* H total */}
      <line x1={dimRight2} y1={cy(0)} x2={dimRight2} y2={cy(H)}
        stroke="#1d4ed8" strokeWidth="0.9" markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
      <line x1={rightEdge+1} y1={cy(0)} x2={dimRight2+1} y2={cy(0)} stroke="#1d4ed8" strokeWidth="0.4" strokeDasharray="2,2" />
      <line x1={rightEdge+1} y1={cy(H)} x2={dimRight2+1} y2={cy(H)} stroke="#1d4ed8" strokeWidth="0.4" strokeDasharray="2,2" />
      <text x={dimRight2+4} y={(cy(0)+cy(H))/2} fontSize="8" fill="#1d4ed8"
        dominantBaseline="middle" fontFamily="monospace" fontWeight="bold">H={H}</text>

      {/* ── Left-side: y_b, y_t, y_bc ── */}
      <line x1={dimLeft1} y1={cy(0)} x2={dimLeft1} y2={cy(yNA)}
        stroke="#374151" strokeWidth="0.8" markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
      <line x1={leftEdge-1} y1={cy(0)}  x2={dimLeft1-2} y2={cy(0)}  stroke="#374151" strokeWidth="0.5" />
      <line x1={leftEdge-1} y1={cy(yNA)} x2={dimLeft1-2} y2={cy(yNA)} stroke="#374151" strokeWidth="0.5" />
      <text x={dimLeft1-4} y={(cy(0)+cy(yNA))/2} fontSize="7.5" fill="#374151"
        textAnchor="end" dominantBaseline="middle" fontFamily="monospace">
        y_b={yNA.toFixed(0)}
      </text>

      <line x1={dimLeft1} y1={cy(yNA)} x2={dimLeft1} y2={cy(H)}
        stroke="#374151" strokeWidth="0.8" markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
      <text x={dimLeft1-4} y={(cy(yNA)+cy(H))/2} fontSize="7.5" fill="#374151"
        textAnchor="end" dominantBaseline="middle" fontFamily="monospace">
        y_t={gross.yt.toFixed(0)}
      </text>

      <line x1={dimLeft2} y1={cy(0)} x2={dimLeft2} y2={cy(yNAc)}
        stroke="#d97706" strokeWidth="0.8" markerStart="url(#dimArrowOrange)" markerEnd="url(#dimArrowOrange)" />
      <line x1={leftEdge-1} y1={cy(0)}   x2={dimLeft2-2} y2={cy(0)}   stroke="#d97706" strokeWidth="0.4" strokeDasharray="2,2" />
      <line x1={leftEdge-1} y1={cy(yNAc)} x2={dimLeft2-2} y2={cy(yNAc)} stroke="#d97706" strokeWidth="0.4" strokeDasharray="2,2" />
      <text x={dimLeft2-4} y={(cy(0)+cy(yNAc))/2} fontSize="7.5" fill="#d97706"
        textAnchor="end" dominantBaseline="middle" fontFamily="monospace">
        y_bc={yNAc.toFixed(0)}
      </text>

      {/* ── Bottom: b1, b2, b3 ── */}
      <line x1={cx(-b3/2)} y1={H_SVG-MB+14} x2={cx(b3/2)} y2={H_SVG-MB+14}
        stroke="#374151" strokeWidth="0.8" markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
      <line x1={cx(-b3/2)} y1={cy(0)+2} x2={cx(-b3/2)} y2={H_SVG-MB+18} stroke="#374151" strokeWidth="0.5" />
      <line x1={cx( b3/2)} y1={cy(0)+2} x2={cx( b3/2)} y2={H_SVG-MB+18} stroke="#374151" strokeWidth="0.5" />
      <text x={(cx(-b3/2)+cx(b3/2))/2} y={H_SVG-MB+26} fontSize="8.5"
        fill="#374151" textAnchor="middle" fontFamily="monospace">b₃={b3}</text>

      <line x1={cx(-b1/2)} y1={H_SVG-MB+28} x2={cx(b1/2)} y2={H_SVG-MB+28}
        stroke="#374151" strokeWidth="0.8" markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
      <line x1={cx(-b1/2)} y1={cy(H)-2} x2={cx(-b1/2)} y2={H_SVG-MB+32} stroke="#374151" strokeWidth="0.5" />
      <line x1={cx( b1/2)} y1={cy(H)-2} x2={cx( b1/2)} y2={H_SVG-MB+32} stroke="#374151" strokeWidth="0.5" />
      <text x={(cx(-b1/2)+cx(b1/2))/2} y={H_SVG-4} fontSize="8.5"
        fill="#374151" textAnchor="middle" fontFamily="monospace">b₁={b1}</text>

      <line x1={cx(-b2/2)} y1={cy(h3+h4+h2/2)} x2={cx(b2/2)} y2={cy(h3+h4+h2/2)}
        stroke="#6b7280" strokeWidth="0.7" markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
      <text x={cx(b2/2)+4} y={cy(h3+h4+h2/2)} fontSize="7.5"
        fill="#6b7280" dominantBaseline="middle" fontFamily="monospace">b₂={b2}</text>

      {/* b_eff deck */}
      <line x1={cx(-deckHalf)} y1={dimTop} x2={cx(deckHalf)} y2={dimTop}
        stroke="#6b7280" strokeWidth="0.8" markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
      <line x1={cx(-deckHalf)} y1={cy(H+td)-2} x2={cx(-deckHalf)} y2={dimTop-4} stroke="#6b7280" strokeWidth="0.5" />
      <line x1={cx( deckHalf)} y1={cy(H+td)-2} x2={cx( deckHalf)} y2={dimTop-4} stroke="#6b7280" strokeWidth="0.5" />
      <text x={(cx(-deckHalf)+cx(deckHalf))/2} y={dimTop-7} fontSize="7.5"
        fill="#6b7280" textAnchor="middle" fontFamily="monospace">
        b_eff={deck.widthBeff}{deck.widthBeff > deckHalf*2 ? " (dipotong)" : ""}
      </text>

      {/* Legend */}
      <g transform={`translate(${ML}, ${H_SVG-14})`}>
        <line x1="0" y1="4" x2="14" y2="4" stroke="#374151" strokeWidth="1" strokeDasharray="4,2" />
        <text x="17" y="7" fontSize="7.5" fill="#374151">NA bruto</text>
        <line x1="60" y1="4" x2="74" y2="4" stroke="#d97706" strokeWidth="1.2" strokeDasharray="5,2" />
        <text x="77" y="7" fontSize="7.5" fill="#d97706">NA komposit</text>
        <circle cx="140" cy="4" r="3.5" fill="#dc2626" />
        <text x="146" y="7" fontSize="7.5" fill="#dc2626">Strand</text>
        <circle cx="185" cy="4" r="3.5" fill="none" stroke="#dc2626" strokeWidth="1.2" />
        <text x="191" y="7" fontSize="7.5" fill="#dc2626">Centroid Tendon</text>
      </g>
    </svg>
  );
}
