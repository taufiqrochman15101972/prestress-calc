/**
 * forcemethod.ts — MATRIX FORCE (FLEXIBILITY) METHOD & THREE-MOMENT EQUATION.
 *
 * Fills the classical Matrix-Structural-Analysis gap from the MTH library
 * (Przemieniecki "Theory of Matrix Structural Analysis", Azar, Mario Paz
 * "Integrated Matrix Analysis", Weaver & Gere): the FORCE (flexibility) method —
 * the dual of the stiffness/displacement method that already powers the FEM
 * ecosystem (fem/frame, frame3d, plate, shell + modal eigen). Provides:
 *   • Clapeyron three-moment equation for continuous beams (N spans, UDL) →
 *     support moments (tridiagonal solve) + reactions + midspan moments
 *   • generic force-method core: [f]{X} = −{Δ0} → redundant forces
 *   • classic closed-form indeterminate cases (propped cantilever, fixed-fixed)
 *
 * Sign: sagging bending moment positive; reactions upward positive.
 * Units: load w [kN/m], span L [m] → M [kN·m], R [kN].
 */

// ── Generic dense linear solver (Gaussian elimination, partial pivot) ──────
export function solveLinear(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c] || 1e-300;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / piv;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / M[i][i]);
}

/** Force (flexibility) method core: solve [f]{X} = −{Δ0} for the redundants X. */
export function flexibilityRedundants(flex: number[][], d0: number[]): number[] {
  return solveLinear(flex, d0.map(v => -v));
}

// ── Three-moment equation (Clapeyron) — continuous beam, UDL per span ──────
export interface Span { L: number; w: number; }   // length (m), UDL (kN/m)
export interface ContinuousBeamResult {
  readonly supportMoments: ReadonlyArray<number>;  // M at each support (sagging +), kN·m
  readonly reactions: ReadonlyArray<number>;       // R at each support, kN
  readonly midspanMoments: ReadonlyArray<number>;  // mid-span sagging moment per span, kN·m
}
/**
 * Simply-supported end supports (M0 = MN = 0). Interior support moments from
 *   M_{i−1}·Lᵢ + 2·Mᵢ·(Lᵢ+Lᵢ₊₁) + M_{i+1}·Lᵢ₊₁ = −¼(wᵢ·Lᵢ³ + wᵢ₊₁·Lᵢ₊₁³)
 */
export function threeMomentContinuous(spans: ReadonlyArray<Span>): ContinuousBeamResult {
  const ns = spans.length;            // spans
  const nsup = ns + 1;                // supports
  const M = new Array(nsup).fill(0);  // support moments, ends stay 0
  const nInt = ns - 1;                // interior supports (unknowns)
  if (nInt > 0) {
    const A = Array.from({ length: nInt }, () => new Array(nInt).fill(0));
    const rhs = new Array(nInt).fill(0);
    for (let k = 0; k < nInt; k++) {
      const i = k + 1;                 // support index (1..ns-1)
      const Ll = spans[i - 1].L, wl = spans[i - 1].w;
      const Lr = spans[i].L, wr = spans[i].w;
      if (k - 1 >= 0) A[k][k - 1] = Ll;
      A[k][k] = 2 * (Ll + Lr);
      if (k + 1 < nInt) A[k][k + 1] = Lr;
      rhs[k] = -0.25 * (wl * Ll * Ll * Ll + wr * Lr * Lr * Lr);
    }
    const Mi = solveLinear(A, rhs);
    for (let k = 0; k < nInt; k++) M[k + 1] = Mi[k];
  }
  // Reactions: left-end of span = wL/2 + (M_right − M_left)/L; right-end = wL/2 + (M_left − M_right)/L
  const R = new Array(nsup).fill(0);
  const mid = new Array(ns).fill(0);
  for (let s = 0; s < ns; s++) {
    const { L, w } = spans[s];
    const Ml = M[s], Mr = M[s + 1];
    R[s] += w * L / 2 + (Mr - Ml) / L;
    R[s + 1] += w * L / 2 + (Ml - Mr) / L;
    mid[s] = w * L * L / 8 + (Ml + Mr) / 2;
  }
  return Object.freeze({
    supportMoments: Object.freeze(M),
    reactions: Object.freeze(R),
    midspanMoments: Object.freeze(mid),
  });
}

// ── Classic indeterminate closed forms (force method) ──────────────────────
export interface ProppedResult { RB: number; RA: number; Mfix: number; Mspan: number; }
/** Propped cantilever (fixed A, propped B), UDL: redundant R_B = 3wL/8. */
export function proppedCantileverUDL(w: number, L: number): ProppedResult {
  const RB = 3 * w * L / 8;
  const RA = 5 * w * L / 8;
  const Mfix = -w * L * L / 8;            // hogging at fixed end
  const Mspan = 9 * w * L * L / 128;      // max sagging at x = 5L/8
  return Object.freeze({ RB, RA, Mfix, Mspan });
}
export interface FixedFixedResult { Mend: number; Mmid: number; R: number; }
/** Fixed-fixed beam, UDL: end moments wL²/12, mid wL²/24. */
export function fixedFixedUDL(w: number, L: number): FixedFixedResult {
  return Object.freeze({ Mend: -w * L * L / 12, Mmid: w * L * L / 24, R: w * L / 2 });
}
