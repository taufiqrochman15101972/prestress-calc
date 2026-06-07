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
