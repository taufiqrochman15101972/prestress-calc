/**
 * Layer 1 — Section & Geometry Engine
 * Gross I-girder section (with optional trapezoidal fillets) + composite
 * transformed-section properties. All dimensions in mm, results in mm², mm³, mm⁴.
 * Reference axis: y = 0 at bottom fiber of the precast girder.
 */

import { concreteModulus } from "@/lib/utils";
import type {
  IGirderGeometry,
  DeckGeometry,
  GrossSectionProps,
  CompositeSectionProps,
} from "@/types";

// ─── Trapezoid primitive ─────────────────────────────────────

interface Trapezoid {
  bottomWidth: number;  // width at y = bottomEdge
  topWidth: number;     // width at y = bottomEdge + height
  height: number;
  bottomEdge: number;   // y-coordinate of bottom of this element
}

function trapArea(t: Trapezoid): number {
  return ((t.bottomWidth + t.topWidth) / 2) * t.height;
}

/** Centroid of a trapezoid measured from y = 0 (absolute) */
function trapCentroid(t: Trapezoid): number {
  const { bottomWidth: b, topWidth: a, height: h, bottomEdge: y0 } = t;
  // From bottom of trapezoid: ȳ_local = h·(2a + b)/(3·(a + b))
  const local = (h * (2 * a + b)) / (3 * (a + b));
  return y0 + local;
}

/** Second moment of area of a trapezoid about its own centroid */
function trapLocalInertia(t: Trapezoid): number {
  const { bottomWidth: b, topWidth: a, height: h } = t;
  // I_trap = h³·(a² + 4ab + b²) / (36·(a + b))
  return (h ** 3 * (a ** 2 + 4 * a * b + b ** 2)) / (36 * (a + b));
}

// ─── Discretize I-girder into trapezoids ─────────────────────

/**
 * Build ordered list of trapezoids from bottom to top.
 * Rectangles = trapezoids with equal top/bottom widths.
 * h4 = bottom fillet height, h5 = top fillet height (both optional / 0).
 */
export function discretizeSection(g: IGirderGeometry): Trapezoid[] {
  const h4 = g.h4 ?? 0;
  const h5 = g.h5 ?? 0;
  const traps: Trapezoid[] = [];

  let y = 0;

  // 1. Bottom flange (rectangle)
  traps.push({ bottomWidth: g.b3, topWidth: g.b3, height: g.h3, bottomEdge: y });
  y += g.h3;

  // 2. Bottom fillet (trapezoid: b3 → b2), skip if h4 = 0
  if (h4 > 0) {
    traps.push({ bottomWidth: g.b3, topWidth: g.b2, height: h4, bottomEdge: y });
    y += h4;
  }

  // 3. Web (rectangle)
  traps.push({ bottomWidth: g.b2, topWidth: g.b2, height: g.h2, bottomEdge: y });
  y += g.h2;

  // 4. Top fillet (trapezoid: b2 → b1), skip if h5 = 0
  if (h5 > 0) {
    traps.push({ bottomWidth: g.b2, topWidth: g.b1, height: h5, bottomEdge: y });
    y += h5;
  }

  // 5. Top flange (rectangle)
  traps.push({ bottomWidth: g.b1, topWidth: g.b1, height: g.h1, bottomEdge: y });

  return traps;
}

/** Total girder height including fillets */
export function girderHeight(g: IGirderGeometry): number {
  return g.h1 + (g.h5 ?? 0) + g.h2 + (g.h4 ?? 0) + g.h3;
}

/**
 * Section width b(y) at height y from the bottom fiber (mm).
 * Linearly interpolates across trapezoidal fillets. Used by strip-integration
 * routines (e.g. thermal gradient self-equilibrating stresses).
 */
export function widthAt(g: IGirderGeometry, y: number): number {
  const traps = discretizeSection(g);
  for (const t of traps) {
    const yTop = t.bottomEdge + t.height;
    if (y >= t.bottomEdge && y <= yTop) {
      const f = t.height > 0 ? (y - t.bottomEdge) / t.height : 0;
      return t.bottomWidth + (t.topWidth - t.bottomWidth) * f;
    }
  }
  return 0;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Calculate gross section properties for the I-girder.
 * Supports rectangular (h4=h5=0) and trapezoidal-fillet profiles.
 */
export function calculateGrossProperties(g: IGirderGeometry): GrossSectionProps {
  const traps  = discretizeSection(g);
  const hTotal = girderHeight(g);

  const areas     = traps.map(trapArea);
  const centroids = traps.map(trapCentroid);
  const localI    = traps.map(trapLocalInertia);

  const areaAg = areas.reduce((s, a) => s + a, 0);
  const yb     = areas.reduce((s, a, i) => s + a * centroids[i], 0) / areaAg;
  const yt     = hTotal - yb;

  const momentOfInertiaIg = traps.reduce((sum, _, i) => {
    const d = centroids[i] - yb;
    return sum + localI[i] + areas[i] * d * d;
  }, 0);

  const r2 = momentOfInertiaIg / areaAg;
  // ── Kern points & flexural efficiency (Nilson §4.3) ──────────
  // Upper kern kt = r²/yb : prestress applied here → zero stress at bottom fiber
  // Lower kern kb = r²/yt : prestress applied here → zero stress at top fiber
  // Efficiency ρ = r²/(yt·yb) = kt·kb/(yt·yb)... actually ρ = r²/(yt·yb).
  //   ρ→1 for ideal I; ρ≈0.33 rectangle; higher ρ = material used efficiently.
  const kt = r2 / yb;
  const kb = r2 / yt;
  const efficiency = r2 / (yt * yb);

  return Object.freeze({
    areaAg,
    yb,
    yt,
    momentOfInertiaIg,
    Ztg: momentOfInertiaIg / yt,
    Zbg: momentOfInertiaIg / yb,
    hTotal,
    r2,
    kt,
    kb,
    efficiency,
  });
}

/**
 * Calculate composite transformed section (girder + deck slab).
 * Deck transformed by modular ratio n_c = E_c_deck / E_c_girder.
 */
export function calculateCompositeProperties(
  g: IGirderGeometry,
  deck: DeckGeometry
): CompositeSectionProps {
  const gross   = calculateGrossProperties(g);
  const hGirder = gross.hTotal;

  const EcDeck   = concreteModulus(deck.fcDeck);
  const EcGirder = concreteModulus(deck.fcGirder);
  const modularRatioNc = EcDeck / EcGirder;

  const deckTransformedArea = modularRatioNc * deck.widthBeff * deck.thicknessTd;
  const yDeck  = hGirder + deck.thicknessTd / 2;

  const totalArea = gross.areaAg + deckTransformedArea;
  const ybc = (gross.areaAg * gross.yb + deckTransformedArea * yDeck) / totalArea;

  const ytgc = hGirder - ybc;
  const yttc = hGirder + deck.thicknessTd - ybc;

  const deckLocalInertia = (modularRatioNc * deck.widthBeff * deck.thicknessTd ** 3) / 12;
  const momentOfInertiaIc =
    gross.momentOfInertiaIg +
    gross.areaAg * (gross.yb - ybc) ** 2 +
    deckLocalInertia +
    deckTransformedArea * (yDeck - ybc) ** 2;

  return Object.freeze({
    modularRatioNc,
    deckTransformedArea,
    compositeAreaAc: totalArea,
    ybc,
    ytgc,
    yttc,
    momentOfInertiaIc,
    Zbc:  momentOfInertiaIc / ybc,
    Ztgc: momentOfInertiaIc / ytgc,
    Zttc: momentOfInertiaIc / (modularRatioNc * yttc),
  });
}
