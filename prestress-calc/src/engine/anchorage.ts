/**
 * Post-Tensioned Anchorage Zone Design Engine
 * NCHRP Report 356 (Breen, Burdet, Roberts, Sanders, Wollmann, 1994) —
 * basis of AASHTO LRFD §5.8.4 (formerly §5.10.9) / ACI 318-19 §25.9.
 *
 * The anchorage zone is split into two nested regions:
 *
 *  ┌─ LOCAL ZONE  — concrete immediately surrounding the anchor device;
 *  │  governed by bearing pressure and confinement (spiral / grid).
 *  │     f_b = P / A_plate         (bearing stress)
 *  │     f_b,allow = 0.7·f'ci·√(A/A_g) ≤ 2.25·f'ci   (confined bearing)
 *  │     P_r = φ · f_b,allow · A_plate ≥ P
 *  │
 *  └─ GENERAL ZONE — larger region where the concentrated tendon force
 *     spreads to the linear stress distribution; designed by a strut-and-tie
 *     model (tension tie = bursting reinforcement). Approximate equations
 *     (applicable to rectangular sections, single/concentric multiple
 *     anchors, no discontinuities):
 *        T_burst = 0.25·ΣP·(1 − a/h) + 0.5·|ΣP·sinα|
 *        d_burst = 0.5·(h − 2e) + 5·e·sinα
 *        T_spall = 0.02·ΣP                      (transverse edge / spalling)
 *        T_edge  = P·e/(2h)                      (longitudinal edge tension)
 *     plus a compressive-stress check ahead of the anchorage.
 *
 * Sign convention follows the project: forces kN, stresses MPa, lengths mm.
 * Per the source: only the procedure/structure is taken — not its numbers.
 */

export interface AnchorageZoneInputs {
  /** Transfer prestress force at the anchorage (kN) */
  Pi: number;
  /** Girder total height (mm) */
  hTotal: number;
  /** Eccentricity at the girder end (positive = below NA, mm) */
  eEnd: number;
  /** Anchor plate dimension parallel to girder height (mm) — a = plate height */
  anchorPlateHeight: number;
  /** Mild steel yield for end-zone ties (MPa) */
  fy: number;
  // ── NEW (optional — backward compatible) ──────────────────────
  /** Anchor plate dimension ⊥ to height (mm). Default = square plate (= a). */
  anchorPlateWidth?: number;
  /** Section width at the anchorage (mm) — web/end-block width. */
  sectionWidth?: number;
  /** Concrete strength at stressing f'ci (MPa) — for bearing & comp-stress. */
  fci?: number;
  /** Tendon inclination at the anchorage α (degrees). Default 0. */
  tendonInclination?: number;
  /** Number of anchorage devices on the end face. Default 1. */
  nAnchors?: number;
}

export interface AnchorageZoneResult {
  // ── General zone — bursting (strut-and-tie tie force) ────────
  /** Bursting force incl. inclined-tendon term (kN) */
  readonly T_burst: number;
  /** Bursting zone centroid depth from loaded face (mm) */
  readonly d_burst: number;
  /** Required bursting reinforcement area (mm²) */
  readonly Ast_burst: number;
  // ── General zone — spalling & edge tension ──────────────────
  /** Spalling force per AASHTO C5.8.4.2 (kN) */
  readonly T_spall: number;
  /** Required spalling reinforcement area (mm²) */
  readonly Ast_spall: number;
  /** Longitudinal edge tension force (kN) — eccentric anchor */
  readonly T_edge: number;
  /** Required edge tension reinforcement (mm²) */
  readonly Ast_edge: number;
  // ── Local zone — bearing & confinement ──────────────────────
  /** Tendon inclination used (deg) */
  readonly alphaDeg: number;
  /** Force carried by one anchorage device P/n (kN) */
  readonly Pdev: number;
  /** Bearing stress under the plate f_b = P/A_plate (MPa) */
  readonly bearingStress: number;
  /** Confinement ratio √(A/A_g), capped (—) */
  readonly confinementRatio: number;
  /** Allowable confined bearing stress (MPa) */
  readonly bearingAllow: number;
  /** Factored local-zone bearing resistance φ·f_b,allow·A_plate (kN) */
  readonly bearingResistance: number;
  /** Local-zone bearing check P ≤ P_r */
  readonly bearingOk: boolean;
  // ── General zone — compressive stress ahead of anchorage ────
  /** Compressive stress at the end of the general zone (MPa) */
  readonly compStressAhead: number;
  /** Compressive limit 0.6·f'ci at stressing (MPa) */
  readonly compLimit: number;
  readonly compOk: boolean;
  // ── Applicability of the approximate (STM) equations ────────
  readonly approxMethodApplicable: boolean;
}

const PHI_TIE = 0.90;   // ACI §21.2.1 tension-controlled ties
const PHI_BRG = 0.65;   // AASHTO §5.5.4.2 bearing in anchorage zones

export function computeAnchorageZone(inp: AnchorageZoneInputs): AnchorageZoneResult {
  const { Pi, hTotal, eEnd, anchorPlateHeight, fy } = inp;

  const a = anchorPlateHeight;
  const h = hTotal;
  const b = inp.anchorPlateWidth ?? a;          // plate width ⊥ height
  const B = inp.sectionWidth ?? Math.max(b * 2, 300); // section width at anchor
  const fci = inp.fci ?? 30;
  const alphaDeg = inp.tendonInclination ?? 0;
  const alpha = (alphaDeg * Math.PI) / 180;
  const n = Math.max(1, inp.nAnchors ?? 1);

  // ── General zone — bursting (incl. inclination term) ────────
  const T_burst   = 0.25 * Pi * (1 - a / h) + 0.5 * Math.abs(Pi * Math.sin(alpha)); // kN
  const d_burst   = 0.5 * (h - 2 * Math.abs(eEnd)) + 5 * Math.abs(eEnd) * Math.sin(alpha); // mm
  const Ast_burst = (T_burst * 1000) / (PHI_TIE * fy); // mm²

  // ── General zone — spalling & longitudinal edge tension ─────
  const T_spall   = 0.02 * Pi;                          // kN (AASHTO C5.8.4.2)
  const Ast_spall = (T_spall * 1000) / (PHI_TIE * fy); // mm²
  const T_edge    = Math.abs(eEnd) > 0 ? (Pi * Math.abs(eEnd)) / (2 * h) : 0; // kN
  const Ast_edge  = (T_edge * 1000) / (PHI_TIE * fy);  // mm²

  // ── Local zone — bearing & confinement ──────────────────────
  // Each device carries P/n. Plate area A1 = a·b. Largest concentric
  // geometrically-similar supporting area A2 limited by the section: scale
  // t = min(B/b, h/a); A2/A1 = t² ⇒ √(A2/A1) = t (capped per AASHTO ≤ ~2).
  const P_dev = (Pi / n) * 1000;                 // N per device
  const A1 = a * b;                              // mm²
  const t = Math.min(B / b, h / a);
  const confinementRatio = Math.min(t, 2.0);
  const bearingStress = A1 > 0 ? P_dev / A1 : 0; // MPa
  const bearingAllow  = Math.min(0.7 * fci * confinementRatio, 2.25 * fci); // MPa
  const bearingResistance = (PHI_BRG * bearingAllow * A1) / 1000;           // kN
  const bearingOk = (Pi / n) <= bearingResistance;

  // ── General zone — compressive stress ahead of anchorage ────
  // Approx: force spreads over plate width × girder height at the end of the
  // general zone (≈ h ahead). Conservative smeared stress vs 0.6·f'ci limit.
  const compStressAhead = (Pi * 1000) / (B * h); // MPa
  const compLimit = 0.6 * fci;                   // MPa (at stressing)
  const compOk = compStressAhead <= compLimit;

  // ── Applicability of approximate STM equations ──────────────
  // Valid for rectangular sections with anchors not too close to edges and
  // section depth not extreme relative to plate. (NCHRP 356 / AASHTO 5.8.4.5)
  const approxMethodApplicable = a / h <= 0.5 && Math.abs(eEnd) <= h / 2;

  return Object.freeze({
    T_burst,
    d_burst,
    Ast_burst,
    T_spall,
    Ast_spall,
    T_edge,
    Ast_edge,
    alphaDeg,
    Pdev: Pi / n,
    bearingStress,
    confinementRatio,
    bearingAllow,
    bearingResistance,
    bearingOk,
    compStressAhead,
    compLimit,
    compOk,
    approxMethodApplicable,
  });
}
