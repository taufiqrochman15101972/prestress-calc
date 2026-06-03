/**
 * Anchorage Zone Design Engine
 * AASHTO LRFD §5.10.9.3 / ACI 318-19 §25.9 / Guts Method (Schlaich)
 *
 * Covers post-tensioned end-zone bursting and spalling checks.
 *
 * ── Strut-and-Tie (Guts) approach ──────────────────────────
 * Bursting force:      T_burst  = 0.25 · ΣP_s · (1 - a/h)        [kN]
 * Bursting zone depth: d_burst  = 0.5 · (h - 2|e|)                [mm]
 * Required stirrups:   A_st_burst = T_burst / (φ · fy)            [mm²]
 *
 * ── Spalling force (AASHTO) ─────────────────────────────────
 * T_spal = 0.02 · ΣP_s   [kN] (AASHTO C5.10.9.3.3)
 *
 * ── Edge tension (for eccentric anchor) ─────────────────────
 * T_edge = Pe · e / (2 · h)   [kN] (approximation)
 */

export interface AnchorageZoneInputs {
  /** Transfer prestress force (kN) */
  Pi: number;
  /** Girder total height (mm) */
  hTotal: number;
  /** Eccentricity at the girder end (positive = below NA, mm) */
  eEnd: number;
  /** Anchor plate dimension parallel to girder height (mm) — a = plate height */
  anchorPlateHeight: number;
  /** Mild steel yield for end-zone ties (MPa) */
  fy: number;
}

export interface AnchorageZoneResult {
  /** Bursting force (kN) */
  readonly T_burst: number;
  /** Bursting zone centre depth from loaded face (mm) */
  readonly d_burst: number;
  /** Required bursting reinforcement area (mm²) */
  readonly Ast_burst: number;
  /** Spalling force per AASHTO (kN) */
  readonly T_spall: number;
  /** Required spalling reinforcement area (mm²) */
  readonly Ast_spall: number;
  /** Edge tension force (kN) — for eccentric anchor */
  readonly T_edge: number;
  /** Required edge tension reinforcement (mm²) */
  readonly Ast_edge: number;
}

const PHI_TIE = 0.90;  // ACI §21.2.1 for tension-controlled ties

export function computeAnchorageZone(inp: AnchorageZoneInputs): AnchorageZoneResult {
  const { Pi, hTotal, eEnd, anchorPlateHeight, fy } = inp;

  const a = anchorPlateHeight;
  const h = hTotal;

  // ── Bursting ────────────────────────────────────────────────
  const T_burst   = 0.25 * Pi * (1 - a / h);           // kN
  const d_burst   = 0.5 * (h - 2 * Math.abs(eEnd));    // mm
  const Ast_burst = (T_burst * 1000) / (PHI_TIE * fy); // mm²

  // ── Spalling (AASHTO C5.10.9.3.3) ───────────────────────────
  const T_spall   = 0.02 * Pi;                          // kN
  const Ast_spall = (T_spall * 1000) / (PHI_TIE * fy); // mm²

  // ── Edge tension (eccentric anchor) ─────────────────────────
  const T_edge   = Math.abs(eEnd) > 0 ? (Pi * Math.abs(eEnd)) / (2 * h) : 0; // kN
  const Ast_edge = (T_edge * 1000) / (PHI_TIE * fy);                         // mm²

  return Object.freeze({
    T_burst,
    d_burst,
    Ast_burst,
    T_spall,
    Ast_spall,
    T_edge,
    Ast_edge,
  });
}
