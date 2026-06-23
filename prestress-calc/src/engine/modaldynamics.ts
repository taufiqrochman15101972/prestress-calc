/**
 * modaldynamics.ts — GENERAL N-DOF MODAL ANALYSIS & RESPONSE SPECTRUM ANALYSIS.
 *
 * Fills the gap from the DS structural-dynamics / earthquake-engineering library
 * (Craig & Kurdila, Chopra, Paz, Humar, Wilson "3-D Static & Dynamic Analysis",
 * Gupta "Response Spectrum Method"). The project already has a LINEAR Newmark
 * SDOF (timehistory.ts), a hard-coded 2-DOF closed-form modal (seismicdynamics.ts)
 * and ELF (buildingseismic.ts) — but no GENERAL N-DOF eigenanalysis nor multi-mode
 * Response Spectrum Analysis with SRSS / CQC modal combination.
 *
 * Provides:
 *   • generalized symmetric eigensolver (K φ = ω² M φ) via Cholesky reduction +
 *     cyclic Jacobi → natural frequencies ωₙ, periods Tₙ, mass-orthonormal modes
 *   • lumped-mass shear-building assembler (M diagonal, K tridiagonal)
 *   • modal participation factors Γₙ, effective modal masses Mₙ*, mass ratios
 *   • Response Spectrum Analysis: peak modal displacements / story forces / base
 *     shear, combined by SRSS and CQC (Der Kiureghian / Wilson correlation ρᵢⱼ)
 *
 * Units: m [kg] (or consistent ton with kN), k [N/m], Sa as acceleration [m/s²]
 * (pass Sa = Sa_g · 9.81). Lengths/displacements [m], forces [N].
 */

// ── Small dense linear algebra (row-major number[][]) ──────────────────────
function cholesky(M: number[][]): number[][] {
  const n = M.length;
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = M[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) L[i][j] = Math.sqrt(Math.max(s, 1e-300));
      else L[i][j] = s / L[j][j];
    }
  }
  return L;
}
function forwardSolveLower(L: number[][], b: number[]): number[] {
  const n = L.length, x = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= L[i][k] * x[k];
    x[i] = s / L[i][i];
  }
  return x;
}

/** Cyclic Jacobi eigensolver for a real symmetric matrix → {values, vectors}.
 *  vectors are columns; eigenpairs returned ascending by eigenvalue. */
export function jacobiEigen(Ain: number[][]): { values: number[]; vectors: number[][] } {
  const n = Ain.length;
  const A = Ain.map(r => r.slice());
  const V: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
    if (off < 1e-24) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let i = 0; i < n; i++) {
          const aip = A[i][p], aiq = A[i][q];
          A[i][p] = c * aip - s * aiq;
          A[i][q] = s * aip + c * aiq;
        }
        for (let i = 0; i < n; i++) {
          const api = A[p][i], aqi = A[q][i];
          A[p][i] = c * api - s * aqi;
          A[q][i] = s * api + c * aqi;
        }
        for (let i = 0; i < n; i++) {
          const vip = V[i][p], viq = V[i][q];
          V[i][p] = c * vip - s * viq;
          V[i][q] = s * vip + c * viq;
        }
      }
    }
  }
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => A[a][a] - A[b][b]);
  const values = idx.map(i => A[i][i]);
  const vectors = Array.from({ length: n }, (_, r) => idx.map(i => V[r][i]));
  return { values, vectors };
}

// ── Generalized symmetric eigenproblem K φ = ω² M φ ────────────────────────
export interface ModeResult {
  omega: number;     // circular natural frequency (rad/s)
  T: number;         // period (s)
  f: number;         // cyclic frequency (Hz)
  shape: number[];   // mass-orthonormal mode shape (φᵀMφ = 1)
  Gamma: number;     // modal participation factor for lateral excitation
  Meff: number;      // effective modal mass
  massRatio: number; // Meff / total mass
}
export interface ModalResult {
  readonly modes: ReadonlyArray<ModeResult>;
  readonly totalMass: number;
  readonly cumulativeMassRatio: ReadonlyArray<number>;
}

/** Solve K φ = ω² M φ (M SPD) → ascending modes, mass-normalized, with
 *  participation factors for the influence vector r (default all-ones). */
export function solveModal(K: number[][], M: number[][], r?: number[]): ModalResult {
  const n = K.length;
  const infl = r ?? new Array(n).fill(1);
  // Reduce to standard: Ã = L⁻¹ K L⁻ᵀ with M = L Lᵀ
  const L = cholesky(M);
  // B = L⁻¹ K (solve L B = K column-wise), then Ã = B L⁻ᵀ ⇒ Ã = L⁻¹ K L⁻ᵀ
  const B: number[][] = [];
  for (let c = 0; c < n; c++) B.push(forwardSolveLower(L, K.map(row => row[c])));
  // B is columns of L⁻¹K stored as B[c] = column c. Build Atil = L⁻¹ K L⁻ᵀ:
  // Atil[i][j] = (L⁻¹ K L⁻ᵀ)[i][j]; compute (L⁻¹K) first as matrix G then G L⁻ᵀ.
  const G: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let c = 0; c < n; c++) for (let i = 0; i < n; i++) G[i][c] = B[c][i]; // G = L⁻¹K
  // Atil = G L⁻ᵀ ⇒ solve from the right: Atil[i] row = forwardSolveLower(L, G[i])
  const Atil: number[][] = G.map(rowi => forwardSolveLower(L, rowi));
  // symmetrize (guards rounding)
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const v = 0.5 * (Atil[i][j] + Atil[j][i]); Atil[i][j] = v; Atil[j][i] = v;
  }
  const { values, vectors } = jacobiEigen(Atil);
  // recover φ = L⁻ᵀ ψ  (back-substitution with Lᵀ)
  const backSolveUpperT = (psi: number[]): number[] => {
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = psi[i];
      for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k];
      x[i] = s / L[i][i];
    }
    return x;
  };
  let totalMass = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) totalMass += infl[i] * M[i][j] * infl[j];

  const modes: ModeResult[] = [];
  for (let m = 0; m < n; m++) {
    const psi = vectors.map(row => row[m]);
    const phi = backSolveUpperT(psi); // already mass-orthonormal (ψ orthonormal)
    const lam = Math.max(values[m], 0);
    const omega = Math.sqrt(lam);
    // Lₙ = φᵀ M r ; Mₙ = φᵀ M φ (=1) ; Γ = Lₙ ; Meff = Lₙ²
    let Ln = 0, Mn = 0;
    for (let i = 0; i < n; i++) {
      let Mphi = 0, Mr = 0;
      for (let j = 0; j < n; j++) { Mphi += M[i][j] * phi[j]; Mr += M[i][j] * infl[j]; }
      Ln += phi[i] * Mr; Mn += phi[i] * Mphi;
    }
    const Gamma = Ln / Mn;
    const Meff = (Ln * Ln) / Mn;
    modes.push({
      omega, T: omega > 0 ? (2 * Math.PI) / omega : Infinity, f: omega / (2 * Math.PI),
      shape: phi, Gamma, Meff, massRatio: Meff / totalMass,
    });
  }
  let cum = 0;
  const cumulativeMassRatio = modes.map(md => (cum += md.massRatio));
  return Object.freeze({ modes: Object.freeze(modes), totalMass, cumulativeMassRatio: Object.freeze(cumulativeMassRatio) });
}

// ── Lumped-mass shear building (M diagonal, K tridiagonal) ─────────────────
export function shearBuilding(masses: number[], storyStiff: number[]): { M: number[][]; K: number[][] } {
  const n = masses.length;
  const M = Array.from({ length: n }, (_, i) => masses.map((_, j) => (i === j ? masses[i] : 0)));
  const K = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    const kBelow = storyStiff[i];                 // story i (between i-1 and i)
    const kAbove = i + 1 < n ? storyStiff[i + 1] : 0;
    K[i][i] = kBelow + kAbove;
    if (i + 1 < n) { K[i][i + 1] = -kAbove; K[i + 1][i] = -kAbove; }
  }
  return { M, K };
}

// ── Response Spectrum Analysis (RSA) with SRSS / CQC ───────────────────────
export interface RSAInputs {
  K: number[][];
  M: number[][];
  /** spectral acceleration Sa(T) in m/s² (e.g. Sa_g·9.81) */
  Sa: (T: number) => number;
  zeta?: number;     // modal damping ratio for CQC (default 0.05)
  numModes?: number; // modes to include (default all)
  r?: number[];      // influence vector
}
export interface RSAResult {
  readonly modal: ModalResult;
  readonly storyDispSRSS: ReadonlyArray<number>;  // peak floor displacements (m)
  readonly storyForceSRSS: ReadonlyArray<number>; // peak equivalent floor forces (N)
  readonly baseShearSRSS: number;
  readonly baseShearCQC: number;
  readonly modalBaseShear: ReadonlyArray<number>;
}
export function responseSpectrumAnalysis(inp: RSAInputs): RSAResult {
  const { K, M, Sa } = inp;
  const zeta = inp.zeta ?? 0.05;
  const modal = solveModal(K, M, inp.r);
  const n = K.length;
  const nm = Math.min(inp.numModes ?? n, n);
  const infl = inp.r ?? new Array(n).fill(1);

  // Per-mode peak modal coordinate & contributions.
  // Modal disp:  uₙ = Γₙ φₙ · Sa(Tₙ)/ωₙ²  (Sd = Sa/ω²)
  // Modal floor force: fₙ = Γₙ M φₙ · Sa(Tₙ)   (since aₙ = Sa)
  const modeDisp: number[][] = [], modeForce: number[][] = [], modeBaseV: number[] = [];
  for (let m = 0; m < nm; m++) {
    const md = modal.modes[m];
    const Sd = md.omega > 0 ? Sa(md.T) / (md.omega * md.omega) : 0;
    const SaT = Sa(md.T);
    const disp = md.shape.map(p => md.Gamma * p * Sd);
    const force = md.shape.map((p, i) => {
      let Mp = 0; for (let j = 0; j < n; j++) Mp += M[i][j] * md.shape[j];
      return md.Gamma * Mp * SaT;
    });
    modeDisp.push(disp); modeForce.push(force);
    modeBaseV.push(force.reduce((s, v) => s + v, 0));
  }

  const srss = (vals: number[]) => Math.sqrt(vals.reduce((s, v) => s + v * v, 0));
  const storyDispSRSS = Array.from({ length: n }, (_, i) => srss(modeDisp.map(d => d[i])));
  const storyForceSRSS = Array.from({ length: n }, (_, i) => srss(modeForce.map(f => f[i])));
  const baseShearSRSS = srss(modeBaseV);

  // CQC: V = √(ΣΣ ρᵢⱼ Vᵢ Vⱼ), ρᵢⱼ = 8ζ²(1+r)r^1.5 / [(1−r²)² + 4ζ²r(1+r)²], r=ωᵢ/ωⱼ
  let cqc = 0;
  for (let i = 0; i < nm; i++) for (let j = 0; j < nm; j++) {
    const wi = modal.modes[i].omega, wj = modal.modes[j].omega;
    const rr = wj > 0 ? wi / wj : 0;
    const rho = (8 * zeta * zeta * (1 + rr) * Math.pow(rr, 1.5)) /
      (Math.pow(1 - rr * rr, 2) + 4 * zeta * zeta * rr * Math.pow(1 + rr, 2));
    cqc += rho * modeBaseV[i] * modeBaseV[j];
  }
  const baseShearCQC = Math.sqrt(Math.max(cqc, 0));

  void infl;
  return Object.freeze({
    modal,
    storyDispSRSS: Object.freeze(storyDispSRSS),
    storyForceSRSS: Object.freeze(storyForceSRSS),
    baseShearSRSS, baseShearCQC,
    modalBaseShear: Object.freeze(modeBaseV),
  });
}
