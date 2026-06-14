/**
 * Lateral Stability / Lateral-Torsional Buckling Engine
 * P.W. Abeles & B.K. Bardhan-Roy, "Prestressed Concrete Designer's Handbook"
 * 3rd Ed., §13.3 Stability problems (§7.9 torsional properties) — after
 * Timoshenko, "Theory of Elastic Stability".
 *
 * For long, slender, narrow prestressed beams (deep webs, thin compression
 * flanges) the member can fail by LATERAL-TORSIONAL BUCKLING before reaching
 * its flexural capacity — critical during handling, transport, erection and
 * for laterally-unsupported spans.
 *
 * Procedure (§13.3.3):
 *  1. Slenderness screen (CP 115): if span/breadth of compression flange > 30,
 *     lateral stability MUST be investigated.
 *  2. Torsional + weak-axis properties:
 *        I_y = Σ(h_i·b_i³/12)                     (weak/Y-Y second moment)
 *        J   = Σ(⅓·d_i·t_i³)                       (St. Venant, open built-up)
 *        B₁  = E_c·I_y                             (flexural rigidity, Y-Y)
 *        C   = G·J,  G = E_c/(2(1+ν))              (torsional rigidity)
 *  3. Critical total buckling load (Timoshenko eq. 13.3):
 *        W_cr = (K / L²)·√(B₁·C)
 *     K depends on support & load type (cantilever/SS/fixed; point/UDL/position).
 *  4. Factor of safety  FS = W_cr / W_applied ≥ 3  (Abeles: not less than 3,
 *     because E, G of concrete are uncertain; reduce E by creep for sustained).
 *  5. Load-height effect: load above the centroid reduces W_cr (destabilising);
 *     below the centroid increases it.
 *
 * NOTE: K constants and the FS≥3 rule are from Abeles/Timoshenko structure;
 * material values follow the project's adopted code, not the book's arithmetic.
 * Internal SI: N, mm, MPa.
 */

export type SupportLoadCase =
  | "CANT_POINT" | "CANT_UDL"
  | "SS_POINT_MID" | "SS_POINT_03L" | "SS_POINT_025L" | "SS_UDL"
  | "FIXED_POINT_MID";

/** Timoshenko K constants (Abeles §13.3.3, rectangular sections). */
export const K_FACTORS: Record<SupportLoadCase, { K: number; label: string }> = {
  CANT_POINT:      { K: 4.013, label: "Kantilever — beban titik di ujung" },
  CANT_UDL:        { K: 12.85, label: "Kantilever — beban merata" },
  SS_POINT_MID:    { K: 16.93, label: "Sederhana — beban titik di tengah" },
  SS_POINT_03L:    { K: 19.04, label: "Sederhana — beban titik di 0.3L" },
  SS_POINT_025L:   { K: 24.10, label: "Sederhana — beban titik di 0.25L" },
  SS_UDL:          { K: 28.3,  label: "Sederhana — beban merata" },
  FIXED_POINT_MID: { K: 26.6,  label: "Jepit-jepit — beban titik di tengah" },
};

export type LoadHeight = "ABOVE" | "CENTROID" | "BELOW";

export interface LateralStabilityInputs {
  // ── Section (3 rectangles, symmetric about vertical axis) ───
  /** Top (compression) flange width / thickness (mm) */
  b1: number; h1: number;
  /** Web thickness / height (mm) */
  b2: number; h2: number;
  /** Bottom flange width / thickness (mm) */
  b3: number; h3: number;

  /** Laterally-unsupported span (mm) */
  L: number;
  /** Concrete strength f'c (MPa) — for E_c if Ec=0 */
  fc: number;
  /** E_c (MPa); if 0, computed 4700√f'c */
  Ec: number;
  /** Poisson's ratio */
  nu: number;
  /** Creep coefficient φ to soften E for sustained load (E_eff = E/(1+φ)); 0 = none */
  phiCreep: number;

  /** Support & load configuration → K */
  loadCase: SupportLoadCase;
  /** Applied TOTAL load on the span (kN) — self weight + superimposed */
  Wapplied: number;
  /** Position of the load relative to the centroid */
  loadHeight: LoadHeight;
}

export interface LateralStabilityResult {
  readonly Iy: number;        // weak-axis second moment (mm⁴)
  readonly J: number;         // St. Venant torsion constant, open (mm⁴)
  readonly Ec_eff: number;    // effective E (creep-modified) (MPa)
  readonly G: number;         // shear modulus (MPa)
  readonly B1: number;        // E·Iy (N·mm²)
  readonly C: number;         // G·J (N·mm²)
  readonly bMin: number;      // min breadth used for slenderness (mm)
  readonly bFlange: number;   // compression-flange breadth (mm)
  readonly slenderness: number;     // L / b_flange
  readonly mustInvestigate: boolean;// slenderness > 30
  readonly K: number;         // Timoshenko constant used
  readonly Wcr: number;       // critical buckling total load (kN)
  readonly heightFactor: number;    // load-height multiplier on Wcr
  readonly WcrAdj: number;    // Wcr adjusted for load height (kN)
  readonly Mcr: number;       // equivalent critical moment (kN·m, for UDL/point ref)
  readonly FS: number;        // W_cr,adj / W_applied
  readonly FSrequired: number;// 3.0
  readonly isStable: boolean; // FS ≥ 3
}

const FS_REQUIRED = 3.0;

/** St. Venant constant of one rectangle (longer × shorter³), open built-up. */
function rectJ(b: number, h: number): number {
  const long = Math.max(b, h);
  const t = Math.min(b, h);
  return (long * t ** 3) / 3;
}

// ════════════════════════════════════════════════════════════════
// Mast roll-equilibrium method — PCI Bridge Design Manual §8.10
// (Mast 1989/1993; Imper & Laszlo 1987)
//
// Different physics from the Timoshenko buckling check above: a beam
// hanging from lifting loops (roll axis ABOVE the c.g.) or sitting on
// flexible supports / truck (roll axis BELOW the c.g.) tilts as a rigid
// body plus lateral bending; safety is the ratio of resisting to applied
// roll moment.
//
//  z̄_o  = w/(12·E·I_y·l)·[0.1·l₁⁵ − a²·l₁³ + 3a⁴·l₁ + 1.2a⁵]   (Eq. 8.10.1.1-1)
//        (a = 0 → z̄_o = w·l⁴/(120·E·I_y))                       (Eq. 8.10.1.1-2)
//  M_lat = (f_r + f_top)·I_y/(b/2) ;  θ_max = M_lat/M_g
//  HANGING:   θ_i = e_i/y_r ;  FS_c = 1/(z̄_o/y_r + θ_i/θ_max)   (Eq. 8.10.1.1-3)
//             FS_f ≈ FS_c ≥ 1.5
//  HAULING:   r = K_θ/W ;  θ̄ = (α·r + e_i)/(r − y − z̄_o)        (Eq. 8.10.1.2-1)
//             FS_c = r(θ_max − α)/(z̄_o·θ_max + e_i + y·θ_max) ≥ 1.0
//             θ'_max = (z_max − h_r·α)/r + α                     (Eq. 8.10.1.2-4)
//             z̄'_o = z̄_o(1 + 2.5·θ'_max)  (I_eff = I_g/(1+2.5θ)) (Eq. 8.10.1.2-6)
//             FS_f = r(θ'_max − α)/(z̄'_o·θ'_max + e_i + y·θ'_max) ≥ 1.5
//
// e_i (initial lateral eccentricity): sweep × offset-factor + placement
// tolerance, offset factor = (l₁/l)² − 1/3 (parabolic arc).
// Internal SI: N, mm, MPa. f_r follows the project code (0.62√f'c).
// ════════════════════════════════════════════════════════════════

/** Offset factor of a parabolic sweep arc between support/lift points. */
export function sweepOffsetFactor(L: number, a: number): number {
  const L1 = L - 2 * a;
  return (L1 / L) ** 2 - 1 / 3;
}

/** Lateral deflection of the c.g. with full weight applied laterally (mm).
 *  w N/mm, E MPa, Iy mm⁴, lengths mm. */
export function lateralZo(w: number, E: number, Iy: number, L: number, a: number): number {
  const L1 = L - 2 * a;
  return (w / (12 * E * Iy * L)) *
    (0.1 * L1 ** 5 - a ** 2 * L1 ** 3 + 3 * a ** 4 * L1 + 1.2 * a ** 5);
}

/** Tilt angle at cracking: M_lat capacity / self-weight moment at the
 *  critical (harp-point) section. fr, fTopComp MPa (+), Iy mm⁴, bTop mm,
 *  Mg N·mm. */
export function tiltAtCracking(fr: number, fTopComp: number, Iy: number, bTop: number, Mg: number): { Mlat: number; thetaMax: number } {
  const Mlat = ((fr + fTopComp) * Iy) / (bTop / 2); // N·mm
  return { Mlat, thetaMax: Mg > 0 ? Mlat / Mg : Infinity };
}

export interface MastHangingInputs {
  /** Overall length (m) */
  L: number;
  /** Overhang from end to lift point (m) */
  a: number;
  /** Self weight (kN/m) */
  w: number;
  /** E_ci at lifting (MPa) */
  Ec: number;
  /** Weak-axis I_y (mm⁴) */
  Iy: number;
  /** Height of roll axis (lift point) above c.g. of the CAMBERED arc (mm) */
  yr: number;
  /** Sweep (total lateral bow) of the member (mm) — e_i uses ½·sweep·offset + tol */
  sweep: number;
  /** Lifting-loop placement tolerance (mm), PCI ≈ 6 mm */
  placementTol: number;
  /** Modulus of rupture f_r (MPa) */
  fr: number;
  /** Compressive stress at the top fibre at the harp point (MPa, enter +) */
  fTopComp: number;
  /** Self-weight moment at the harp point (kN·m) */
  Mg: number;
  /** Top-flange width b (mm) */
  bTop: number;
}

export interface MastHangingResult {
  readonly L1: number;          // span between lift points (m)
  readonly offsetFactor: number;
  readonly ei: number;          // initial lateral eccentricity (mm)
  readonly zo: number;          // lateral deflection of c.g. (mm)
  readonly thetaI: number;      // initial roll angle e_i/y_r (rad)
  readonly Mlat: number;        // lateral cracking moment (kN·m)
  readonly thetaMax: number;    // tilt at cracking (rad)
  readonly FSc: number;         // factor of safety vs cracking (= FS_f)
  readonly FSrequired: number;  // 1.5
  readonly ok: boolean;
}

export function computeMastHanging(inp: MastHangingInputs): MastHangingResult {
  const L = inp.L * 1000, a = inp.a * 1000;          // mm
  const w = inp.w;                                    // kN/m = N/mm
  const L1 = L - 2 * a;
  const offsetFactor = sweepOffsetFactor(L, a);
  const ei = 0.5 * inp.sweep * offsetFactor + inp.placementTol;
  const zo = lateralZo(w, inp.Ec, inp.Iy, L, a);
  const thetaI = inp.yr > 0 ? ei / inp.yr : Infinity;
  const { Mlat, thetaMax } = tiltAtCracking(inp.fr, inp.fTopComp, inp.Iy, inp.bTop, inp.Mg * 1e6);
  const FSc = 1 / (zo / inp.yr + thetaI / thetaMax);
  const FSrequired = 1.5;
  return Object.freeze({
    L1: L1 / 1000, offsetFactor, ei, zo, thetaI,
    Mlat: Mlat / 1e6, thetaMax,
    FSc, FSrequired, ok: FSc >= FSrequired,
  });
}

export interface MastHaulingInputs {
  /** Overall length (m) */
  L: number;
  /** Overhang from end to truck support (m) */
  a: number;
  /** Self weight (kN/m) */
  w: number;
  /** E_c at hauling (MPa) */
  Ec: number;
  /** Weak-axis I_y (mm⁴) */
  Iy: number;
  /** Roll stiffness of the hauling rig K_θ (kN·m/rad) */
  Ktheta: number;
  /** Height of beam c.g. above the roadway (mm) */
  hcg: number;
  /** Height of the roll centre above the roadway (mm) */
  hr: number;
  /** Superelevation / cross slope α (rad) */
  alpha: number;
  /** Sweep for shipping (mm) — creep-increased, PCI: full tolerance */
  sweep: number;
  /** Off-centre placement on the truck (mm), PCI ≈ 25 mm */
  placementTol: number;
  /** Transverse distance CL-beam → centre of dual tyres z_max (mm) */
  zmax: number;
  /** Modulus of rupture f_r (MPa) */
  fr: number;
  /** Compressive top-fibre stress at harp point during hauling (MPa, +) */
  fTopComp: number;
  /** Self-weight moment at harp point (kN·m) */
  Mg: number;
  /** Top-flange width b (mm) */
  bTop: number;
}

export interface MastHaulingResult {
  readonly W: number;          // total weight (kN)
  readonly r: number;          // radius of stability K_θ/W (mm)
  readonly y: number;          // c.g. above roll axis, +2% camber allowance (mm)
  readonly ei: number;         // initial eccentricity for shipping (mm)
  readonly zo: number;         // lateral deflection (mm)
  readonly thetaEq: number;    // equilibrium tilt angle (rad)
  readonly Mlat: number;       // lateral moment at θ_eq (kN·m) — add to f_b!
  readonly thetaMax: number;   // tilt at cracking (rad)
  readonly FSc: number;        // FS vs cracking ≥ 1.0
  readonly thetaPrimeMax: number; // tilt at max resisting arm (rad)
  readonly zoPrime: number;    // cracked-section z̄'_o (mm)
  readonly FSf: number;        // FS vs rollover ≥ 1.5
  readonly FScReq: number;     // 1.0
  readonly FSfReq: number;     // 1.5
  readonly okCrack: boolean;
  readonly okRollover: boolean;
}

export function computeMastHauling(inp: MastHaulingInputs): MastHaulingResult {
  const L = inp.L * 1000, a = inp.a * 1000;
  const w = inp.w;                                  // N/mm
  const W = inp.w * inp.L;                          // kN
  const r = (inp.Ktheta / W) * 1000;                // m → mm
  const y = (inp.hcg - inp.hr) * 1.02;              // +2% camber allowance (PCI)
  const offsetFactor = sweepOffsetFactor(L, a);
  const ei = inp.sweep * offsetFactor + inp.placementTol;
  const zo = lateralZo(w, inp.Ec, inp.Iy, L, a);
  const thetaEq = (inp.alpha * r + ei) / (r - y - zo);
  const { Mlat: MlatCap, thetaMax } = tiltAtCracking(inp.fr, inp.fTopComp, inp.Iy, inp.bTop, inp.Mg * 1e6);
  const Mlat = thetaEq * inp.Mg;                    // kN·m acting at θ_eq
  const FSc = (r * (thetaMax - inp.alpha)) / (zo * thetaMax + ei + y * thetaMax);
  const thetaPrimeMax = (inp.zmax - inp.hr * inp.alpha) / r + inp.alpha;
  const zoPrime = zo * (1 + 2.5 * thetaPrimeMax);
  const FSf = (r * (thetaPrimeMax - inp.alpha)) / (zoPrime * thetaPrimeMax + ei + y * thetaPrimeMax);
  void MlatCap;
  return Object.freeze({
    W, r, y, ei, zo, thetaEq, Mlat, thetaMax,
    FSc, thetaPrimeMax, zoPrime, FSf,
    FScReq: 1.0, FSfReq: 1.5,
    okCrack: FSc >= 1.0, okRollover: FSf >= 1.5,
  });
}

export function computeLateralStability(inp: LateralStabilityInputs): LateralStabilityResult {
  const { b1, h1, b2, h2, b3, h3, L, fc, nu, phiCreep, loadCase, Wapplied, loadHeight } = inp;

  const Ec = inp.Ec > 0 ? inp.Ec : 4700 * Math.sqrt(fc);
  const Ec_eff = phiCreep > 0 ? Ec / (1 + phiCreep) : Ec;
  const G = Ec_eff / (2 * (1 + nu));

  // Weak-axis second moment (symmetric → centroidal vertical axis through web)
  const Iy = (h1 * b1 ** 3) / 12 + (h2 * b2 ** 3) / 12 + (h3 * b3 ** 3) / 12;

  // St. Venant torsion constant — open built-up (sum of rectangles)
  const J = rectJ(b1, h1) + rectJ(b2, h2) + rectJ(b3, h3);

  const B1 = Ec_eff * Iy;   // N·mm²
  const C = G * J;          // N·mm²

  const bFlange = b1;       // compression flange breadth
  const bMin = Math.min(b1, b2, b3);
  const slenderness = L / bFlange;
  const mustInvestigate = slenderness > 30;

  const K = K_FACTORS[loadCase].K;
  // Timoshenko eq.13.3: W_cr = (K/L²)·√(B₁·C)  → N, then kN
  const Wcr_N = (K / L ** 2) * Math.sqrt(B1 * C);
  const Wcr = Wcr_N / 1000;

  // Load-height effect on stability (qualitative factor):
  // above centroid destabilising, below stabilising. Use a modest ±15% proxy.
  const heightFactor = loadHeight === "ABOVE" ? 0.85 : loadHeight === "BELOW" ? 1.15 : 1.0;
  const WcrAdj = Wcr * heightFactor;

  // Equivalent critical moment (UDL: M = W·L/8; point mid: W·L/4) for reference.
  const isUDL = loadCase === "SS_UDL" || loadCase === "CANT_UDL";
  const Mcr = isUDL ? (WcrAdj * (L / 1000)) / 8 : (WcrAdj * (L / 1000)) / 4;

  const FS = Wapplied > 0 ? WcrAdj / Wapplied : Infinity;

  return Object.freeze({
    Iy, J, Ec_eff, G, B1, C,
    bMin, bFlange, slenderness, mustInvestigate,
    K, Wcr, heightFactor, WcrAdj, Mcr,
    FS, FSrequired: FS_REQUIRED,
    isStable: FS >= FS_REQUIRED,
  });
}
