/**
 * consolidation.ts — Terzaghi one-dimensional primary consolidation.
 *
 * The canonical geotechnical verification case behind the MIDAS GTS / DIANA
 * consolidation analyses (MD 470–522 review): settlement–time of a clay layer
 * under a load increment, draining to a known time-factor relationship. Used
 * BOTH for design (predicted settlement S_c and S(t)) and as a benchmark whose
 * published U–Tv values are absolute targets (Das; Holtz & Kovacs):
 *   U = 50% → Tv = 0.197 ,  U = 90% → Tv = 0.848.
 *
 * SI units: stresses kPa, lengths m, cv m²/yr, t yr. Pure → Object.freeze().
 */

/**
 * Average degree of consolidation U for a given time factor Tv — exact Fourier
 * series  U = 1 − Σ (2/M²)·e^(−M²·Tv),  M = (π/2)(2m+1).  Converges fast.
 */
export function degreeOfConsolidation(Tv: number): number {
  if (Tv <= 0) return 0;
  let s = 0;
  for (let m = 0; m < 200; m++) {
    const M = (Math.PI / 2) * (2 * m + 1);
    const term = (2 / (M * M)) * Math.exp(-M * M * Tv);
    s += term;
    if (term < 1e-12) break;
  }
  return Math.min(1, Math.max(0, 1 - s));
}

/**
 * Time factor Tv for a target average degree of consolidation U (0–1) — the
 * standard closed-form inverse (Terzaghi/Casagrande):
 *   U ≤ 0.60 :  Tv = (π/4)·U²
 *   U > 0.60 :  Tv = 1.781 − 0.933·log10(100·(1−U))
 */
export function timeFactor(U: number): number {
  const u = Math.min(0.9999, Math.max(0, U));
  return u <= 0.6
    ? (Math.PI / 4) * u * u
    : 1.781 - 0.933 * Math.log10(100 * (1 - u));
}

export interface ConsolidationInputs {
  /** layer thickness H (m). */
  readonly H: number;
  /** drainage: "double" → H_dr = H/2, "single" → H_dr = H. */
  readonly drainage: "double" | "single";
  /** coefficient of consolidation cv (m²/yr). */
  readonly cv: number;
  /** compression index Cc and initial void ratio e0 (primary settlement). */
  readonly Cc: number;
  readonly e0: number;
  /** effective stresses (kPa): initial σ'0 and added Δσ'. */
  readonly sigma0: number;
  readonly dSigma: number;
  /** elapsed time t (yr) for the time-dependent settlement S(t). */
  readonly t: number;
}

export interface ConsolidationResult {
  readonly Hdr: number;
  readonly Tv: number;
  readonly U: number;
  /** ultimate primary settlement S_c (m). */
  readonly Sc: number;
  /** settlement at time t, S(t) = U·S_c (m). */
  readonly St: number;
  /** convenience: t for 50% and 90% consolidation (yr). */
  readonly t50: number;
  readonly t90: number;
}

export function computeConsolidation(i: ConsolidationInputs): ConsolidationResult {
  const Hdr = i.drainage === "double" ? i.H / 2 : i.H;
  const Tv = (i.cv * i.t) / (Hdr * Hdr);
  const U = degreeOfConsolidation(Tv);
  const Sc =
    i.sigma0 > 0
      ? (i.Cc / (1 + i.e0)) * i.H * Math.log10((i.sigma0 + i.dSigma) / i.sigma0)
      : 0;
  const St = U * Sc;
  const t50 = (0.197 * Hdr * Hdr) / i.cv;
  const t90 = (0.848 * Hdr * Hdr) / i.cv;
  return Object.freeze({ Hdr, Tv, U, Sc, St, t50, t90 });
}
