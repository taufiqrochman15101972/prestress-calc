/**
 * Curved-Tendon Radial Force Effects (in-duct curvature)
 * Stone & Breen, CTR Research Report 208-3F "Design of Post-Tensioned Girder
 * Anchorage Zones" (1981) — multistrand side-face failure mechanism — and
 * Powell/Breen/Kreger CTR 365-1 (duct radius of curvature), as codified in
 * AASHTO LRFD §5.9.5.4.3 "Effects of Curved Tendons" (in-plane / out-of-plane
 * deviation forces on the concrete cover).
 *
 * A tendon curved inside the member presses on the concrete along its length:
 *
 *   IN-PLANE  radial force  F_in  = P_u / R        (kN/m of tendon)
 *     — the duct tries to break out through the cover at the point of minimum
 *       radius. Resisted by shear on two cover planes; if exceeded, local
 *       confinement ("tieback") reinforcement must carry the full force.
 *
 *   OUT-OF-PLANE wedging    F_out = P_u / (π·R)    (kN/m)
 *     — the multistrand bundle flattens against the duct at the curve
 *       (Stone & Breen "multistrand effect"), splitting thin webs sideways.
 *
 * Cover shear resistance per unit length (two shear planes through the cover,
 * ACI/SNI-style stress 0.33·√f'ci on an effective depth d_eff = d_c + Ø_duct/4):
 *     V_n = 2 · 0.33·√f'ci · d_eff      (N/mm)  ,  V_r = φ·V_n , φ = 0.75
 *
 * Per the project rule: only the PROCEDURE comes from the reports; the
 * resistance expressions follow the adopted ACI/SNI/AASHTO code path.
 * Units: forces kN, lengths mm (R in m), stresses MPa. + tension convention.
 */

export interface CurvedTendonInputs {
  /** Factored tendon force P_u (kN) — typically 1.2 × P_jack */
  Pu: number;
  /** Radius of tendon curvature at the critical point R (m) */
  R: number;
  /** Concrete cover to the duct, side toward break-out d_c (mm) */
  cover: number;
  /** Duct outer diameter Ø_duct (mm) */
  ductOD: number;
  /** Web / member thickness containing the duct (mm) */
  webThickness: number;
  /** Concrete strength at stressing f'ci (MPa) */
  fci: number;
  /** Tie / stirrup yield strength f_y (MPa) */
  fy: number;
  /** Tieback stirrup spacing s (mm) */
  tieSpacing: number;
}

export interface CurvedTendonResult {
  /** In-plane radial force P_u/R (kN/m) */
  readonly Fin: number;
  /** Out-of-plane wedging force P_u/(π·R) (kN/m) */
  readonly Fout: number;
  /** Effective cover shear depth d_eff = d_c + Ø/4 (mm) */
  readonly dEff: number;
  /** Factored cover shear resistance per unit length (kN/m) */
  readonly Vr: number;
  /** In-plane check F_in ≤ V_r (cover alone) */
  readonly inPlaneOk: boolean;
  /** Out-of-plane check F_out ≤ V_r */
  readonly outPlaneOk: boolean;
  /** Required tieback steel per metre when cover fails (mm²/m) */
  readonly AsPerM: number;
  /** Required tieback area per stirrup at spacing s (mm², 0 if not needed) */
  readonly AsPerTie: number;
  /** Local lateral-bending stress in the web slab strip from F_out (MPa) */
  readonly sigmaWebBend: number;
  /** Minimum recommended duct radius — CTR 365-1 / PTI practice (m) */
  readonly Rmin: number;
  readonly radiusOk: boolean;
}

const PHI_SHEAR = 0.75;

export function computeCurvedTendon(inp: CurvedTendonInputs): CurvedTendonResult {
  const { Pu, R, cover, ductOD, webThickness, fci, fy, tieSpacing } = inp;

  // ── Deviation forces per metre of tendon ─────────────────────
  const Fin = Pu / R;                 // kN/m
  const Fout = Pu / (Math.PI * R);    // kN/m

  // ── Cover shear resistance (two planes through d_eff) ────────
  const dEff = cover + ductOD / 4;                     // mm
  const VnPerMm = 2 * 0.33 * Math.sqrt(fci) * dEff;    // N/mm
  const Vr = (PHI_SHEAR * VnPerMm * 1000) / 1000;      // kN/m

  const inPlaneOk = Fin <= Vr;
  const outPlaneOk = Fout <= Vr;

  // ── Tieback reinforcement (carries the FULL radial force when
  //    the cover alone is inadequate — Stone & Breen recommendation) ──
  const needTie = !inPlaneOk;
  const AsPerM = needTie ? (Fin * 1000) / (0.9 * fy) : 0;      // mm²/m
  const AsPerTie = needTie ? (AsPerM * tieSpacing) / 1000 : 0; // mm² per tie

  // ── Web lateral bending from the out-of-plane push ───────────
  // Treat a 1 m web strip as fixed-fixed across the clear web:
  // M ≈ F_out·b_w/8 per metre; Z = 1000·t²/6 with t = web thickness.
  const M_Nmm = (Fout * 1000 * webThickness) / 8;        // N·mm per m strip
  const Z = (1000 * webThickness ** 2) / 6;              // mm³
  const sigmaWebBend = M_Nmm / Z;                        // MPa

  // ── Minimum radius of curvature ──────────────────────────────
  // CTR 365-1 §3.3.3 / PTI practice: R ≥ 6 m for multistrand tendons,
  // tighter curves demand a steel-pipe deviator (handled in external.ts).
  const Rmin = 6.0;
  const radiusOk = R >= Rmin;

  return Object.freeze({
    Fin, Fout, dEff, Vr, inPlaneOk, outPlaneOk,
    AsPerM, AsPerTie, sigmaWebBend, Rmin, radiusOk,
  });
}
