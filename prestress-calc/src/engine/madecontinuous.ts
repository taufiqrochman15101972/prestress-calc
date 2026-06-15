/**
 * Made-Continuous Precast Prestressed Girders — Restraint-Moment Engine
 * ====================================================================
 * NCHRP Report 322 "Design of Precast Prestressed Bridge Girders Made
 * Continuous" (book 147/148) + Freyermuth / PCA "Design of Continuous
 * Highway Bridges with Precast Prestressed Concrete Girders" + PCI Bridge
 * Design Manual §11.1.
 *
 * ── The mechanism (DISTINCT from continuous.ts) ─────────────────────
 * continuous.ts treats a member that is continuous and post-tensioned
 * FROM THE START (TY-Lin equivalent-load secondary moments). HERE the
 * girders are erected as SIMPLE SPANS, then a cast-in-place deck +
 * continuity diaphragm over the pier ties them together. Continuity is
 * established AFTER prestress and girder self-weight are already locked
 * into the simple spans. Time-dependent creep then tries to change the
 * simple-span deformations, but the new continuous connection RESTRAINS
 * them → a "restraint moment" M_r develops at the interior support:
 *
 *   • Prestress wants to camber the girder UP  → held down at the new
 *     support → POSITIVE (sagging) restraint moment → tension at the
 *     BOTTOM of the diaphragm → needs a positive-moment connection.
 *   • Girder + deck self-weight → NEGATIVE (hogging) restraint moment.
 *   • Differential shrinkage (young deck shrinks more than old girder)
 *     → relieves the positive moment.
 *
 * Loads locked in BEFORE continuity develop their restraint only through
 * creep: factor (1 − e^−φ). Differential shrinkage develops gradually and
 * is creep-relieved: factor (1 − e^−φ)/φ  (same kernel as diffshrinkage.ts).
 *
 * ── Rotation method (two / three equal spans) ───────────────────────
 * Simple-span end rotation at the interior support:
 *   under UDL w       θ = w·L³ / (24·E·I)
 *   under uniform M_a θ = M_a·L / (2·E·I)
 * Two equal spans, three-moment equation, symmetric:
 *   M_support = −3·E·I·θ / L         (continuity moment if continuous from t=0)
 * The prestress equivalent upward UDL: w_p = 8·P·e_drape / L².
 *
 * CONVENTIONS: mm, MPa, kN, kN·m. Positive moment = sagging (tension at
 * bottom) — same as the rest of the suite. Numeric procedure per the cited
 * sources; never any single PDF's worked-example figures.
 */

import { Ec as EcOf } from "@/engine/substructure";

export interface MadeContinuousInputs {
  /** Number of equal spans made continuous (2 or 3). */
  nSpans: 2 | 3;
  /** Span length (mm). */
  L: number;
  /** f'c of girder concrete (MPa) — for E_c if E not given. */
  fc: number;
  /** Composite moment of inertia about its own centroid (mm⁴). */
  Ic: number;
  /** Effective prestress force at the section (kN). */
  Pe: number;
  /** Tendon drape e_mid − e_end (mm, positive = parabolic sag toward midspan). */
  eDrape: number;
  /** Girder + deck self-weight carried by the SIMPLE span before continuity (kN/m). */
  wSelf: number;
  /** Creep coefficient φ of the girder at the age continuity is established → ∞. */
  phi: number;
  /** Differential-shrinkage primary (restraint) moment magnitude (kN·m). 0 = ignore. */
  Msh?: number;
  /** Deck f'c for the positive-moment connection cracking stress (MPa). */
  fcDeck: number;
  /** Section modulus at the connection (diaphragm bottom), Z = I/y (mm³). */
  Zconn: number;
  /** Steel yield for the positive-moment connection bars (MPa). */
  fy: number;
  /** Lever arm jd of the connection (mm). */
  jd: number;
}

export interface MadeContinuousResult {
  readonly Ec: number;          // girder modulus (MPa)
  readonly wp: number;          // prestress equivalent upward UDL (kN/m)
  readonly thetaP: number;      // simple-span rotation from prestress (rad)
  readonly thetaG: number;      // simple-span rotation from self-weight (rad)
  readonly MpCont: number;      // prestress continuity moment if cont. from t=0 (kN·m, +sag)
  readonly MgCont: number;      // self-weight continuity moment (kN·m, −hog)
  readonly creepFactor: number; // (1 − e^−φ)
  readonly shFactor: number;    // (1 − e^−φ)/φ
  readonly MrCreep: number;     // restraint from prestress+self-weight creep (kN·m)
  readonly MrShrink: number;    // restraint from differential shrinkage (kN·m)
  readonly Mr: number;          // NET restraint moment at interior support (kN·m)
  readonly MrPosGov: number;    // governing POSITIVE restraint (no shrink relief) (kN·m)
  readonly isPositive: boolean; // net restraint sagging → needs positive connection
  readonly Mcr: number;         // cracking moment of connection = 0.5√f'c·Z (kN·m)
  readonly MconnReq: number;    // connection design moment = max(1.2 Mcr, MrPosGov) (kN·m)
  readonly AsConn: number;      // required positive-moment connection steel (mm²)
  readonly connectionOk: boolean;
  readonly note: string;
}

/** Restraint-moment analysis of a made-continuous precast girder line. */
export function computeMadeContinuous(i: MadeContinuousInputs): MadeContinuousResult {
  const Ec = EcOf(i.fc);                       // MPa
  const L = i.L;                               // mm
  const EI = Ec * i.Ic;                        // N·mm²  (MPa·mm⁴ = N·mm²)

  // Prestress equivalent upward UDL: w_p = 8·P·e / L²  (P in N, e & L in mm → N/mm)
  const P_N = i.Pe * 1000;
  const wp_Nmm = (8 * P_N * i.eDrape) / (L * L); // N/mm
  const wp = wp_Nmm;                              // (kept in N/mm for rotation)
  const wSelf_Nmm = i.wSelf;                      // kN/m = N/mm numerically

  // Simple-span end rotations at the interior support  θ = w·L³/(24 EI)
  const thetaP = (wp_Nmm * L ** 3) / (24 * EI);     // prestress (camber-up)
  const thetaG = (wSelf_Nmm * L ** 3) / (24 * EI);  // self-weight (sag)

  // Continuity moment if the beam were continuous from t=0:  M = ±3 EI θ / L
  // (sign: prestress → +sagging at support; self-weight → −hogging)
  const MpCont = (3 * EI * thetaP) / L / 1e6;       // kN·m (+)
  const MgCont = -(3 * EI * thetaG) / L / 1e6;      // kN·m (−)

  // Time-dependent kernels
  const creepFactor = 1 - Math.exp(-i.phi);
  const shFactor = i.phi > 0 ? (1 - Math.exp(-i.phi)) / i.phi : 0;

  // Restraint from loads locked in before continuity (develops via creep)
  const MrCreep = (MpCont + MgCont) * creepFactor;
  // Differential shrinkage relieves the positive restraint (negative contribution)
  const MrShrink = -(i.Msh ?? 0) * shFactor;

  const Mr = MrCreep + MrShrink;

  // Governing POSITIVE restraint for the connection (early age, before shrinkage relief)
  const MrPosGov = Math.max(0, MpCont * creepFactor + MgCont * creepFactor);

  // Positive-moment connection design (AASHTO LRFD §5.12.3.3)
  const Mcr = (0.5 * Math.sqrt(i.fcDeck) * i.Zconn) / 1e6;   // kN·m
  const MconnReq = Math.max(1.2 * Mcr, MrPosGov);
  const isPositive = Mr > 0;
  // A_s = M / (φ·f_y·jd) ; φ = 0.9
  const AsConn = (MconnReq * 1e6) / (0.9 * i.fy * i.jd);
  const phiMn = (0.9 * i.fy * AsConn * i.jd) / 1e6;
  const connectionOk = phiMn >= MconnReq * 0.999;

  const note = isPositive
    ? "Restraint NET positif (sagging) → wajib sambungan momen-positif di dasar diafragma."
    : "Restraint NET negatif (hogging) → tulangan negatif dek menerus; sambungan positif tetap dipasang min.";

  return Object.freeze({
    Ec, wp, thetaP, thetaG, MpCont, MgCont, creepFactor, shFactor,
    MrCreep, MrShrink, Mr, MrPosGov, isPositive, Mcr, MconnReq, AsConn,
    connectionOk, note,
  });
}
