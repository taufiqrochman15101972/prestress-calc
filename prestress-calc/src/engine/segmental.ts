/**
 * Construction-Stage / Segmental Bridge Engine
 * Nigel R. Hewson, "Prestressed Concrete Bridges: Design and Construction"
 * Ch.12–15 + PTI "Post-Tensioning Manual" 6th Ed. §2.7 (Staged Construction).
 *
 * Covers the erection-method-driven analysis that the simply-supported design
 * flow did not have — the deck experiences load states during construction
 * that differ from (and often govern over) the in-service state:
 *
 *  BALANCED CANTILEVER (Hewson §13) — segments erected symmetrically from a
 *    pier; the free cantilever carries self weight + form-traveller + erection
 *    live load → large HOGGING moment at the pier root; out-of-balance moment
 *    when one arm is a segment ahead; top "cantilever" tendons anchored at each
 *    joint.
 *  INCREMENTAL LAUNCHING (Hewson §15) — deck cast behind the abutment and
 *    pushed out; every section sees ALTERNATING hogging (over a pier) and
 *    sagging (mid-span) as it travels → concentric ("central") prestress keeps
 *    the section in compression under the reversing moment; a steel launching
 *    nose reduces the leading cantilever moment.
 *  CREEP REDISTRIBUTION (Menn §4.7 / Hewson §8) — when the statical system
 *    changes after erection (cantilever → continuous), creep shifts the dead-
 *    load moment toward the moment of the as-monolithic system:
 *        M_final = M_built + (M_mono − M_built)·(1 − e^(−φ))
 *
 * Stress convention: + tension, − compression. Internal SI: N, mm, MPa.
 * NOTE: procedure/structure from Hewson/PTI; limits & factors per the project's
 * adopted code, never the book's worked numbers.
 */

export type ErectionMethod = "BALANCED_CANTILEVER" | "INCREMENTAL_LAUNCH";

export interface SegmentalInputs {
  method: ErectionMethod;

  // ── Section properties at the critical section (pier or mid) ──
  /** Cross-sectional area A (mm²) */
  A: number;
  /** Top section modulus Z_top (mm³) */
  Ztop: number;
  /** Bottom section modulus Z_bot (mm³) */
  Zbot: number;
  /** f'c at the construction stage (MPa) */
  fc: number;
  /** f'ci at early-age erection (MPa) */
  fci: number;

  // ── Loads ───────────────────────────────────────────────────
  /** Deck self-weight UDL w (kN/m) */
  w: number;

  // ── Balanced-cantilever parameters ──────────────────────────
  /** Cantilever length, one arm from the pier (m) */
  Lcant: number;
  /** Segment length (m) */
  Lseg: number;
  /** Form-traveller weight at the tip (kN) */
  Ptrav: number;
  /** Erection live load UDL (kN/m) */
  qConstr: number;
  /** Eccentricity of the top cantilever tendons (mm, + above centroid) */
  eCant: number;
  /** Effective prestress force of the cantilever tendons (kN) */
  Pcant: number;

  // ── Incremental-launching parameters ────────────────────────
  /** Typical launching span between piers (m) */
  Lspan: number;
  /** Launching-nose length (m) */
  Lnose: number;
  /** Nose efficiency: fraction of the no-nose cantilever moment removed (0–1) */
  noseEff: number;
  /** Concentric ("central") launching prestress force (kN) */
  Pcentral: number;

  // ── Creep redistribution ────────────────────────────────────
  /** Creep coefficient φ for the system-change redistribution */
  phiCreep: number;
  /** Dead-load moment in the as-built (erection) system at the section (kN·m) */
  Mbuilt: number;
  /** Dead-load moment if the deck were cast monolithic/continuous (kN·m) */
  Mmono: number;
}

export interface SegmentalResult {
  // Balanced cantilever
  readonly Mself: number;       // hogging from self weight (kN·m)
  readonly Mtrav: number;       // hogging from traveller (kN·m)
  readonly Mconstr: number;     // hogging from erection LL (kN·m)
  readonly Mpier: number;       // total cantilever hogging at pier (kN·m)
  readonly Munbal: number;      // out-of-balance moment (one segment ahead) (kN·m)
  // Incremental launch
  readonly McantNoNose: number; // leading cantilever moment without nose (kN·m)
  readonly Mhog: number;        // design hogging during launch, nose-reduced (kN·m)
  readonly Msag: number;        // mid-span sagging during launch (kN·m)
  // Stress check at the critical section
  readonly sigmaTop: number;    // top-fibre stress (MPa)
  readonly sigmaBot: number;    // bottom-fibre stress (MPa)
  readonly limTens: number;     // tensile limit (MPa)
  readonly limComp: number;     // compressive limit (MPa)
  readonly stressOk: boolean;
  // Creep redistribution
  readonly redistFactor: number;// (1 − e^−φ)
  readonly Mfinal: number;      // redistributed dead-load moment (kN·m)
}

// ─────────────────────────────────────────────────────────────────
// Preliminary PT-layout estimator (Montgomery, ASPIRE "Concrete
// Segmental Bridges — Preliminary Determination of Post-Tensioning
// Layouts"): pick the strand count from the governing SLS tension at
// the critical section, using the TENDON-EFFICIENCY concept
// η = 1 − M_secondary/M_primary (η = 1 for statically determinate).
//
//   σ_Design = (M_DC+M_DW+M_CR+M_SH + 0.8·M_LL + 0.5·M_TG)·c/I   (+ tension)
//   σ_PT,1   = P₁/A + η·P₁·e·c/I                                 (one strand)
//   n        = (σ_Design − σ_LIMIT) / σ_PT,1   →  round up
//
// σ_LIMIT per the adopted code (0.5·√f'c Service III tension). Only the
// procedure comes from the article — never its worked numbers.
// ─────────────────────────────────────────────────────────────────

export interface PrelimPTInputs {
  /** Cross-section area at the critical section A (mm²) */
  A: number;
  /** Moment of inertia I (mm⁴) */
  I: number;
  /** Distance NA → governing tension fibre c (mm) */
  c: number;
  /** Tendon eccentricity from NA at the section e (mm, same side as c) */
  e: number;
  /** Tendon efficiency η = 1 − M₂/M₁ (1.0 = no secondary moment) */
  eta: number;
  /** Effective force of ONE strand after all losses P₁ (kN) */
  Pstrand: number;
  /** Moments at the section (kN·m): DC, DW, creep-redistribution, shrinkage, LL+IM, temp-gradient */
  M_DC: number;
  M_DW: number;
  M_CR: number;
  M_SH: number;
  M_LL: number;
  M_TG: number;
  /** f'c at service (MPa) */
  fc: number;
  /** Strands per tendon for the unit suggestion */
  strandsPerTendon: number;
}

export interface PrelimPTResult {
  /** Governing design moment Service III (kN·m) */
  readonly Mdesign: number;
  /** Design fibre stress σ_Design (MPa, + tension) */
  readonly sigmaDesign: number;
  /** Tension limit σ_LIMIT (MPa) */
  readonly sigmaLimit: number;
  /** Compression delivered by ONE strand at the fibre (MPa, >0) */
  readonly sigmaPT1: number;
  /** Required strand count (rounded up) */
  readonly nStrands: number;
  /** Suggested number of tendons at strandsPerTendon each */
  readonly nTendons: number;
  /** Total effective PT force of the suggested layout (kN) */
  readonly Ptotal: number;
  /** Resulting fibre stress with the suggested layout (MPa) */
  readonly sigmaFinal: number;
  readonly ok: boolean;
}

export function computePrelimPT(inp: PrelimPTInputs): PrelimPTResult {
  const { A, I, c, e, eta, Pstrand, M_DC, M_DW, M_CR, M_SH, M_LL, M_TG, fc, strandsPerTendon } = inp;

  // Service III combination (segmental: 0.8·LL, 0.5·TG)
  const Mdesign = M_DC + M_DW + M_CR + M_SH + 0.8 * M_LL + 0.5 * M_TG; // kN·m
  const sigmaDesign = (Mdesign * 1e6 * c) / I;                          // MPa (+ tension)
  const sigmaLimit = 0.5 * Math.sqrt(fc);                               // MPa

  // One-strand compression at the governing fibre (axial + η × primary moment)
  const P1 = Pstrand * 1000; // N
  const sigmaPT1 = P1 / A + (eta * P1 * e * c) / I; // MPa, compression magnitude

  const nReq = sigmaPT1 > 0 ? (sigmaDesign - sigmaLimit) / sigmaPT1 : 0;
  const nStrands = Math.max(0, Math.ceil(nReq));
  const nTendons = strandsPerTendon > 0 ? Math.ceil(nStrands / strandsPerTendon) : 0;
  const nProvided = nTendons * strandsPerTendon;

  const Ptotal = (nProvided * P1) / 1000; // kN
  const sigmaFinal = sigmaDesign - nProvided * sigmaPT1; // MPa at the fibre
  const ok = sigmaFinal <= sigmaLimit;

  return Object.freeze({
    Mdesign, sigmaDesign, sigmaLimit, sigmaPT1,
    nStrands, nTendons, Ptotal, sigmaFinal, ok,
  });
}

export function computeSegmental(inp: SegmentalInputs): SegmentalResult {
  const {
    method, A, Ztop, Zbot, fci, w,
    Lcant, Lseg, Ptrav, qConstr, eCant, Pcant,
    Lspan, Lnose, noseEff, Pcentral,
    phiCreep, Mbuilt, Mmono,
  } = inp;

  // ── Balanced cantilever (hogging at the pier root, one arm) ──
  const Mself = (w * Lcant ** 2) / 2;
  const Mtrav = Ptrav * Lcant;
  const Mconstr = (qConstr * Lcant ** 2) / 2;
  const Mpier = Mself + Mtrav + Mconstr;
  // Out-of-balance: one extra segment + traveller on the leading arm
  const Munbal = w * Lseg * (Lcant - Lseg / 2) + Ptrav * Lcant;

  // ── Incremental launching ───────────────────────────────────
  const McantNoNose = (w * Lspan ** 2) / 2;          // full cantilever, no nose
  const Mhog = McantNoNose * (1 - noseEff);          // nose lands early → reduced
  const Msag = (w * Lspan ** 2) / 8;                 // mid-span when fully spanning

  // ── Critical-section stress check ───────────────────────────
  // Choose governing moment + prestress per method.
  let M_Nmm: number, P_N: number, e_mm: number;
  if (method === "BALANCED_CANTILEVER") {
    M_Nmm = Mpier * 1e6;          // hogging
    P_N = Pcant * 1000;
    e_mm = eCant;                 // top tendons (+ above centroid)
  } else {
    // launching: governing is the larger |moment|, concentric prestress
    M_Nmm = Math.max(Mhog, Msag) * 1e6;
    P_N = Pcentral * 1000;
    e_mm = 0;                     // concentric
  }

  // Hogging convention: top fibre tension positive.
  // σ_top = −P/A − P·e/Ztop + M/Ztop ;  σ_bot = −P/A + P·e/Zbot − M/Zbot
  const sigmaTop = -P_N / A - (P_N * e_mm) / Ztop + M_Nmm / Ztop;
  const sigmaBot = -P_N / A + (P_N * e_mm) / Zbot - M_Nmm / Zbot;

  // Early-age strength governs both erection methods.
  const limTens = 0.5 * Math.sqrt(fci);
  const limComp = -0.6 * fci;
  const stressOk =
    sigmaTop <= limTens && sigmaTop >= limComp &&
    sigmaBot <= limTens && sigmaBot >= limComp;

  // ── Creep redistribution on system change ───────────────────
  const redistFactor = 1 - Math.exp(-phiCreep);
  const Mfinal = Mbuilt + (Mmono - Mbuilt) * redistFactor;

  return Object.freeze({
    Mself, Mtrav, Mconstr, Mpier, Munbal,
    McantNoNose, Mhog, Msag,
    sigmaTop, sigmaBot, limTens, limComp, stressOk,
    redistFactor, Mfinal,
  });
}
