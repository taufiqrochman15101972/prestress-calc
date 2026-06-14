/**
 * Transverse Design of Adjacent Box Beam Bridges
 * PCI Bridge Design Manual §8.9 (El-Remaily et al. 1996; Oregon DOT practice)
 *
 * Adjacent precast box beams (no CIP deck) need a TRANSVERSE connection so
 * wheel loads distribute across the bridge without longitudinal joint
 * cracking/leakage. Two parallel methods:
 *
 * 1) RATIONAL — post-tensioned transverse diaphragms (El-Remaily / PCI):
 *    • span ≤ ~18 m (60 ft): 3 diaphragms (ends + midspan);
 *      span >  18 m: 5 diaphragms (ends + ¼ points)
 *    • required effective PT per unit span length P (chart Fig. 8.9.3-2,
 *      f(beam depth, bridge width), digitized) — unbonded: ×1.30
 *    • per-diaphragm force F = P·s  (s = diaphragm spacing)
 *    • A_pt = F/(0.55·f_pu) → n bars; F_pe = 0.55·f_pu·A_pt,prov
 *    • grout-pocket stresses σ = F/(b·h) ± F·e/(b·h²/6):
 *      no tension allowed; ≥ 1.72 MPa (0.250 ksi) mean compression so the
 *      beams qualify as "rigidly connected" for live-load distribution
 *      (LRFD §4.6.2.2.1)
 *
 * 2) EMPIRICAL — Oregon tie-rod system:
 *    • rods at mid-depth; count/spacing by span (Table 8.9.2.1-1):
 *        ≤ 6 m: 1 @ midspan · ≤ 12 m: 1 @ ⅓ points · ≤ 21 m: 2 @ ⅓ points ·
 *        ≤ 30 m: 2 per set @ ≤ 7.3 m, first set 2.4 m from end
 *    • each Ø22 ASTM A449 rod tensioned to 175 kN (39.25 kip)
 *    • total transverse force ≥ weight of one beam
 *
 * NOTE: chart values digitized from Fig. 8.9.3-2 (±0.5 k/ft); procedure and
 * limits are the code values, not the book's worked arithmetic.
 * Internal SI: kN, m, mm, MPa.
 */

/** Digitized Fig. 8.9.3-2 — required effective transverse PT (kip/ft of span)
 *  per beam depth (in) vs bridge width (ft). Source: El-Remaily 1996. */
const CHART_WIDTHS_FT = [28, 40, 50, 60, 70, 80, 90];
const CHART_P_KIPFT: Record<number, number[]> = {
  27: [5.0, 7.3, 8.9, 10.3, 11.6, 12.6, 13.4],
  33: [4.3, 6.3, 7.7, 9.0, 10.1, 10.9, 11.6],
  39: [4.0, 5.7, 7.0, 8.2, 9.2, 9.9, 10.5],
  42: [3.7, 5.4, 6.6, 7.8, 8.7, 9.5, 10.2],
};
const CHART_DEPTHS_IN = [27, 33, 39, 42];

function interp1(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return ys[i - 1] + t * (ys[i] - ys[i - 1]);
    }
  }
  return ys[ys.length - 1];
}

/** Required effective transverse PT force per unit span length (kN/m).
 *  H mm (box depth), W m (bridge width). Clamped to the chart range. */
export function requiredTransversePT(H: number, W: number): number {
  const dIn = H / 25.4;
  const wFt = W / 0.3048;
  const perDepth = CHART_DEPTHS_IN.map((d) => interp1(CHART_WIDTHS_FT, CHART_P_KIPFT[d], wFt));
  const pKipFt = interp1(CHART_DEPTHS_IN, perDepth, dIn);
  return pKipFt * 14.5939; // kip/ft → kN/m
}

export interface TransversePTInputs {
  /** Span L (m) */
  L: number;
  /** Bridge width W (m) */
  W: number;
  /** Box beam depth H (mm) */
  H: number;
  /** PT bar ultimate strength f_pu (MPa), e.g. 1035 (150 ksi) / 1103 (160 ksi) */
  fpuBar: number;
  /** Effective prestress ratio (≈ 0.55·f_pu after all losses) */
  effRatio: number;
  /** Area of ONE PT bar (mm²) */
  AbarOne: number;
  /** Bars per diaphragm (PCI: 2, symmetric about mid-depth) */
  nBars: number;
  /** Grout pocket width b (mm) ≈ 200 */
  bGrout: number;
  /** Grout pocket depth h (mm) ≈ H − 125 */
  hGrout: number;
  /** Eccentricity of the PT resultant from pocket centroid (mm) */
  eBar: number;
  /** Bonded transverse tendons? (unbonded → force × 1.30) */
  bonded: boolean;
  /** Weight of one beam (kN) — empirical tie check */
  beamWeight: number;
}

export interface TransversePTResult {
  // Rational (PT diaphragm) method
  readonly nDiaphragms: number;     // 3 or 5
  readonly spacing: number;         // diaphragm spacing (m)
  readonly P_perM: number;          // required PT (kN/m), incl. unbonded factor
  readonly F_required: number;      // per diaphragm (kN)
  readonly Apt_required: number;    // mm²
  readonly Apt_provided: number;    // mm²
  readonly Fpe_provided: number;    // kN
  readonly sigmaTop: number;        // grout stress (MPa, − compression)
  readonly sigmaBot: number;
  readonly sigmaMean: number;       // mean compression (MPa, +)
  readonly minRigid: number;        // 1.72 MPa (0.250 ksi)
  readonly noTension: boolean;
  readonly rigidOk: boolean;        // mean ≥ 0.25 ksi
  readonly areaOk: boolean;
  readonly ptOk: boolean;
  // Empirical (Oregon tie rod) method
  readonly tieDescription: string;
  readonly nRodsTotal: number;
  readonly rodForce: number;        // 175 kN each
  readonly tieTotalForce: number;   // kN
  readonly tieOk: boolean;          // ≥ beam weight
}

const ROD_FORCE_KN = 175;          // 39.25 kip ASTM A449 Ø22

/** Oregon Table 8.9.2.1-1 — number of tie rods and layout by span. */
export function oregonTieLayout(L: number): { n: number; label: string } {
  if (L <= 6.1) return { n: 1, label: "1 batang di tengah bentang" };
  if (L <= 12.2) return { n: 2, label: "1 batang di tiap titik-⅓ (2 lokasi)" };
  if (L <= 21.3) return { n: 4, label: "2 batang di tiap titik-⅓ (2 lokasi)" };
  // 2 rods per set @ ≤ 7.3 m spacing, first set 2.4 m from each end
  const nSets = Math.max(2, Math.ceil((L - 4.8) / 7.3) + 1);
  return { n: 2 * nSets, label: `2 batang per set, ${nSets} set @ ≤ 7,3 m (set pertama 2,4 m dari ujung)` };
}

export function computeTransversePT(inp: TransversePTInputs): TransversePTResult {
  const { L, W, H, fpuBar, effRatio, AbarOne, nBars, bGrout, hGrout, eBar, bonded, beamWeight } = inp;

  // 1. Diaphragm layout
  const five = L > 18.3;                       // > 60 ft
  const nDiaphragms = five ? 5 : 3;
  const spacing = five ? L / 4 : L / 2;

  // 2. Required PT from the design chart (+30% if unbonded)
  const P_perM = requiredTransversePT(H, W) * (bonded ? 1.0 : 1.3);
  const F_required = P_perM * spacing;

  // 3. Bar selection
  const Apt_required = (F_required * 1000) / (effRatio * fpuBar);
  const Apt_provided = nBars * AbarOne;
  const Fpe_provided = (effRatio * fpuBar * Apt_provided) / 1000;

  // 4. Grout-pocket stresses (working stress, no tension permitted)
  const A = bGrout * hGrout;                   // mm²
  const Zg = (bGrout * hGrout ** 2) / 6;       // mm³
  const F_N = Fpe_provided * 1000;
  const sigmaTop = -(F_N / A) - (F_N * eBar) / Zg;   // − compression
  const sigmaBot = -(F_N / A) + (F_N * eBar) / Zg;
  const sigmaMean = F_N / A;
  const minRigid = 1.72;                       // MPa = 0.250 ksi (LRFD §4.6.2.2.1)
  const noTension = sigmaTop <= 0 && sigmaBot <= 0;
  const rigidOk = sigmaMean >= minRigid;
  const areaOk = Apt_provided >= Apt_required;
  const ptOk = noTension && rigidOk && areaOk;

  // 5. Empirical Oregon tie rods
  const tie = oregonTieLayout(L);
  const tieTotalForce = tie.n * ROD_FORCE_KN;
  const tieOk = tieTotalForce >= beamWeight;

  return Object.freeze({
    nDiaphragms, spacing, P_perM, F_required,
    Apt_required, Apt_provided, Fpe_provided,
    sigmaTop, sigmaBot, sigmaMean, minRigid,
    noTension, rigidOk, areaOk, ptOk,
    tieDescription: tie.label, nRodsTotal: tie.n,
    rodForce: ROD_FORCE_KN, tieTotalForce, tieOk,
  });
}
