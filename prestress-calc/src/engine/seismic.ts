/**
 * Seismic Design — Uniform Load Method (single-mode)
 * PCI Bridge Design Manual Ch.15 — AASHTO STD Div. I-A / LRFD §4.7.4
 *
 * Precast girder superstructures are normally FORCE-PROTECTED in a quake;
 * the columns/connections resist. The single-mode "uniform load" check:
 *
 *  1. Equivalent stiffness K:
 *       transverse — apply p_o = 1 kN/m, K = p_o·L/v_s,max
 *       (or column 3·E·I/h³ single-curvature);
 *       longitudinal — column 12·E·I/H³ (double curvature, rigid deck)
 *  2. Period:  T = 2π·√(W/(g·K))
 *  3. Elastic seismic response coefficient [STD Div. I-A Eq. 3-1]:
 *       C_s = 1.2·A·S / T^(2/3)  ≤  2.5·A
 *  4. Equivalent static load p_e = C_s·W/L → member elastic forces;
 *     design force = elastic/R (R = response modification factor)
 *  5. Connection force (SPC A): F = 0.20 × dead-load reaction
 *  6. Minimum support (seat) length:
 *       STD Div. I-A:  N = (8 + 0.02·L_ft + 0.08·H_ft)(1 + 0.000125·S_k²) in
 *       LRFD 4.7.4.4:  N = (200 + 0.0017·L + 0.0067·H)(1 + 0.000125·S_k²) mm
 *       (× 1.0 / 1.5 by seismic zone percentage)
 *
 * SPC from acceleration coefficient A: ≤0.09 A · ≤0.19 B · ≤0.29 C · >0.29 D.
 * Internal SI: kN, m, mm, MPa; g = 9.81 m/s².
 */

export type SPC = "A" | "B" | "C" | "D";

export function seismicCategory(A: number): SPC {
  if (A <= 0.09) return "A";
  if (A <= 0.19) return "B";
  if (A <= 0.29) return "C";
  return "D";
}

export interface SeismicInputs {
  /** Contributory weight W (kN) — superstructure + tributary column */
  W: number;
  /** Acceleration coefficient A (g) — hazard map */
  A: number;
  /** Site coefficient S (1.0–2.0 by soil profile) */
  S: number;
  /** Response modification factor R (column: 3–5; connection: 0.8–1.0) */
  R: number;
  /** Equivalent stiffness K (kN/m); 0 → use column EI, h below */
  K: number;
  /** Column E·I (kN·m²) — used if K = 0 */
  EIcol: number;
  /** Column height h (m) */
  hCol: number;
  /** Double curvature (longitudinal, 12EI/h³)? else 3EI/h³ */
  doubleCurvature: boolean;
  /** Span/segment length for seat width & p_e (m) */
  L: number;
  /** Seat support height H for N (m) — column/abutment height */
  Hsup: number;
  /** Skew angle (deg) */
  skew: number;
  /** Dead-load reaction at the bearing (kN) — connection check */
  DLreaction: number;
}

export interface SeismicResult {
  readonly SPC: SPC;
  readonly K: number;          // kN/m used
  readonly T: number;          // s
  readonly Cs: number;         // governing coefficient
  readonly CsCapped: boolean;  // 2.5A governs
  readonly Velastic: number;   // C_s·W (kN)
  readonly Vdesign: number;    // /R (kN)
  readonly pe: number;         // equivalent static load (kN/m)
  readonly Fconn: number;      // min connection force 0.20·DL (kN)
  readonly N_std_mm: number;   // STD Div. I-A seat (mm)
  readonly N_lrfd_mm: number;  // LRFD 4.7.4.4 seat (mm)
}

const G = 9.81;

export function computeSeismic(inp: SeismicInputs): SeismicResult {
  const { W, A, S, R, EIcol, hCol, doubleCurvature, L, Hsup, skew, DLreaction } = inp;

  const K = inp.K > 0
    ? inp.K
    : ((doubleCurvature ? 12 : 3) * EIcol) / hCol ** 3;

  const T = 2 * Math.PI * Math.sqrt(W / (G * K));
  const CsRaw = (1.2 * A * S) / Math.pow(T, 2 / 3);
  const CsCap = 2.5 * A;
  const Cs = Math.min(CsRaw, CsCap);

  const Velastic = Cs * W;
  const Vdesign = Velastic / R;
  const pe = L > 0 ? Velastic / L : 0;
  const Fconn = 0.20 * DLreaction;

  // seat lengths
  const skewTerm = 1 + 0.000125 * skew ** 2;
  const L_ft = L / 0.3048;
  const H_ft = Hsup / 0.3048;
  const N_std_in = (8 + 0.02 * L_ft + 0.08 * H_ft) * skewTerm;
  const N_std_mm = N_std_in * 25.4;
  const N_lrfd_mm = (200 + 0.0017 * L * 1000 + 0.0067 * Hsup * 1000) * skewTerm;

  return Object.freeze({
    SPC: seismicCategory(A),
    K, T, Cs, CsCapped: CsCap < CsRaw,
    Velastic, Vdesign, pe, Fconn,
    N_std_mm, N_lrfd_mm,
  });
}
