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
