/**
 * Component Handling, Erection & Long-Term Camber Engine
 * PCI Design Handbook 7th Ed. — Ch.8 (Component Handling and Erection Bracing)
 * + Ch.5 long-term camber/deflection MULTIPLIERS (Martin / PCI).
 *
 * A precast/prestressed member is loaded several times before service:
 *  STRIPPING (release + form suction) · STORAGE · TRANSPORT (road impact +
 *  lateral roll) · ERECTION — each with its own dynamic/impact factor and a
 *  different support (lifting-point) geometry, often governing over the final
 *  in-service stresses.  Long-term camber is then estimated with the classic
 *  PCI multipliers.
 *
 *  Two-point symmetric pickup at a = ratio·L from each end:
 *    overhang  a = ratio·L,   interior  L1 = L − 2a
 *    M_support (hogging, over a lift point) = −w·a²/2
 *    M_mid     (sagging, between lifts)     =  w·L1²/8 − w·a²/2
 *  Each handling stage scales w by an impact factor (stripping, transport,
 *  erection); fibre stresses are checked against the early-age limits.
 *
 *  PCI long-term multipliers (apply to the instantaneous values):
 *    erection (no topping):  camberₚ ×1.80,  deflw ×1.85
 *    final  (no topping):    camberₚ ×2.45,  deflw ×2.70,  defl_sdl ×3.00
 *    final  (with topping):  camberₚ ×2.20,  deflw ×2.40,  defl_sdl ×3.00,
 *                            defl_topping ×2.30
 *
 * Stress convention: + tension, − compression. Internal SI: N, mm, MPa.
 * NOTE: PCI multipliers & impact factors are the published procedure; concrete
 * limits follow the project's adopted code, not the book's numbers.
 */

export interface HandlingInputs {
  /** Member length (m) */
  L: number;
  /** Self-weight UDL w (kN/m) */
  w: number;
  /** Cross-sectional area A (mm²) */
  A: number;
  /** Top section modulus Z_top (mm³) */
  Ztop: number;
  /** Bottom section modulus Z_bot (mm³) */
  Zbot: number;
  /** f'ci at release/handling (MPa) */
  fci: number;
  /** Initial prestress force Pi (kN) */
  Pi: number;
  /** Prestress eccentricity at the handling section (mm, + below centroid) */
  e: number;
  /** Lift/support point location ratio a/L from each end (≈0.207 optimum) */
  liftRatio: number;
  /** Impact factor for stripping (form suction), e.g. 1.2–1.5 */
  impStrip: number;
  /** Impact factor for transport (road), e.g. 1.5 */
  impTransport: number;
  /** Impact factor for erection, e.g. 1.2 */
  impErection: number;

  // ── Long-term camber (PCI multipliers) ──────────────────────
  /** Instantaneous camber from prestress at release (mm, upward +) */
  camberPi: number;
  /** Instantaneous deflection from member self weight at release (mm, down +) */
  deflWi: number;
  /** Deflection from superimposed dead load (mm, down +) */
  deflSdl: number;
  /** Deflection from composite topping (mm, down +) */
  deflTopping: number;
  /** Member has composite topping? selects the multiplier set */
  composite: boolean;
}

export interface HandlingResult {
  // Geometry of the lift
  readonly a: number;            // overhang (m)
  readonly L1: number;           // interior span between lifts (m)
  // Governing handling stage (max impact)
  readonly impact: number;       // governing impact factor
  readonly Msupport: number;     // hogging over a lift point (kN·m)
  readonly Mmid: number;         // sagging between lifts (kN·m)
  // Fibre stresses at the critical (mid) section under Pi + handling moment
  readonly sigmaTopMid: number;  // MPa
  readonly sigmaBotMid: number;  // MPa
  readonly sigmaTopSup: number;  // MPa at support section
  readonly sigmaBotSup: number;
  readonly limTens: number;      // +0.5√f'ci
  readonly limComp: number;      // −0.6f'ci
  readonly handlingOk: boolean;
  // PCI long-term camber
  readonly camberErection: number;  // net camber at erection (mm, + up)
  readonly camberFinal: number;     // net camber/deflection final (mm, + up)
  readonly multiplierSet: string;   // which PCI set applied
}

export function computeHandling(inp: HandlingInputs): HandlingResult {
  const {
    L, w, A, Ztop, Zbot, fci, Pi, e, liftRatio,
    impStrip, impTransport, impErection,
    camberPi, deflWi, deflSdl, deflTopping, composite,
  } = inp;

  // ── Lift geometry & moments (per unit impact, base self weight) ──
  const a = liftRatio * L;
  const L1 = L - 2 * a;
  const impact = Math.max(impStrip, impTransport, impErection);
  const wEff = w * impact;                       // governing handling stage
  const Msupport = -(wEff * a ** 2) / 2;         // hogging
  const Mmid = (wEff * L1 ** 2) / 8 - (wEff * a ** 2) / 2;  // sagging

  // ── Fibre stresses (Pi at e, + tension) ─────────────────────
  const Pi_N = Pi * 1000;
  const Mmid_Nmm = Mmid * 1e6;
  const Msup_Nmm = Msupport * 1e6;
  // σ_top = −P/A + P·e/Ztop − M/Ztop ; σ_bot = −P/A − P·e/Zbot + M/Zbot
  const sigmaTopMid = -Pi_N / A + (Pi_N * e) / Ztop - Mmid_Nmm / Ztop;
  const sigmaBotMid = -Pi_N / A - (Pi_N * e) / Zbot + Mmid_Nmm / Zbot;
  const sigmaTopSup = -Pi_N / A + (Pi_N * e) / Ztop - Msup_Nmm / Ztop;
  const sigmaBotSup = -Pi_N / A - (Pi_N * e) / Zbot + Msup_Nmm / Zbot;

  const limTens = 0.5 * Math.sqrt(fci);
  const limComp = -0.6 * fci;
  const within = (s: number) => s <= limTens + 1e-9 && s >= limComp - 1e-9;
  const handlingOk =
    within(sigmaTopMid) && within(sigmaBotMid) &&
    within(sigmaTopSup) && within(sigmaBotSup);

  // ── PCI long-term camber multipliers ────────────────────────
  // erection (no topping): camber 1.80, defl 1.85
  const camberErection = 1.80 * camberPi - 1.85 * deflWi;
  let camberFinal: number;
  let multiplierSet: string;
  if (composite) {
    camberFinal = 2.20 * camberPi - 2.40 * deflWi - 3.00 * deflSdl - 2.30 * deflTopping;
    multiplierSet = "Final dengan topping komposit (2.20/2.40/3.00/2.30)";
  } else {
    camberFinal = 2.45 * camberPi - 2.70 * deflWi - 3.00 * deflSdl;
    multiplierSet = "Final tanpa topping (2.45/2.70/3.00)";
  }

  return Object.freeze({
    a, L1, impact, Msupport, Mmid,
    sigmaTopMid, sigmaBotMid, sigmaTopSup, sigmaBotSup,
    limTens, limComp, handlingOk,
    camberErection, camberFinal, multiplierSet,
  });
}
