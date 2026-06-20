/**
 * fem/core.ts — FEM ecosystem shared core (Solver Core layer).
 *
 * Architecture (3-layer ecosystem, single deployable TS implementation):
 *   • Pre-processor  → fem/model.ts (geometry, mesh, the 3 copy methods)
 *   • Solver Core    → fem/core.ts (this) + fem/frame.ts + fem/shell.ts
 *   • Post-processor → fem/postprocess.ts (deflected shape, N/V/M, stress)
 *
 * Zero-copy philosophy: all heavy numeric data lives in flat `Float64Array`
 * buffers (the JS shared-memory primitive) — the global stiffness, load and
 * displacement vectors are passed by reference between layers, never deep-copied.
 * This mirrors the eventual Zig-allocated sparse buffers / Julia solver / Python
 * post-processor target; the seam below (assemble→solve→recover) is identical so
 * the dense TS solver can later be swapped for a native CSR+GPU backend.
 *
 * Units: SI consistent — N, mm, MPa (N/mm²). K in N/mm, displacements mm/rad.
 */

/** Dense symmetric linear solve K·d = F via LU with partial pivoting (in place).
 *  K is row-major n×n Float64Array; returns displacement Float64Array(n).
 *  For the DOF counts a browser model produces (≤ a few thousand) this is exact
 *  and fast; Phase-2 swaps in a sparse CSR / native solver behind this call. */
export function solveLinear(K: Float64Array, n: number, F: Float64Array): Float64Array {
  const A = K.slice();                 // working copy (keep K for force recovery)
  const b = F.slice();
  const piv = new Int32Array(n);
  for (let i = 0; i < n; i++) piv[i] = i;

  for (let col = 0; col < n; col++) {
    // partial pivot
    let max = Math.abs(A[col * n + col]), pr = col;
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(A[r * n + col]);
      if (v > max) { max = v; pr = r; }
    }
    if (max < 1e-14) throw new Error(`Matriks singular pada DOF ${col} (struktur tidak stabil / kurang tumpuan).`);
    if (pr !== col) {
      for (let k = 0; k < n; k++) { const t = A[col * n + k]; A[col * n + k] = A[pr * n + k]; A[pr * n + k] = t; }
      const tb = b[col]; b[col] = b[pr]; b[pr] = tb;
    }
    const dgl = A[col * n + col];
    for (let r = col + 1; r < n; r++) {
      const f = A[r * n + col] / dgl;
      if (f === 0) continue;
      for (let k = col; k < n; k++) A[r * n + k] -= f * A[col * n + k];
      b[r] -= f * b[col];
    }
  }
  // back-substitution
  const d = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let k = i + 1; k < n; k++) s -= A[i * n + k] * d[k];
    d[i] = s / A[i * n + i];
  }
  return d;
}

/** Accumulate a local element matrix ke (m×m) into global K using a DOF map. */
export function scatter(K: Float64Array, n: number, ke: number[][], map: number[]): void {
  const m = map.length;
  for (let i = 0; i < m; i++) {
    const gi = map[i]; if (gi < 0) continue;
    for (let j = 0; j < m; j++) {
      const gj = map[j]; if (gj < 0) continue;
      K[gi * n + gj] += ke[i][j];
    }
  }
}

/** matrix·vector for a local element (ke · v). */
export function matVec(ke: number[][], v: number[]): number[] {
  const m = ke.length; const r = new Array(m).fill(0);
  for (let i = 0; i < m; i++) { let s = 0; for (let j = 0; j < m; j++) s += ke[i][j] * v[j]; r[i] = s; }
  return r;
}

/** C = A·B for small dense matrices. */
export function matMul(A: number[][], B: number[][]): number[][] {
  const r = A.length, c = B[0].length, k = B.length;
  const C = Array.from({ length: r }, () => new Array(c).fill(0));
  for (let i = 0; i < r; i++) for (let p = 0; p < k; p++) { const a = A[i][p]; if (!a) continue; for (let j = 0; j < c; j++) C[i][j] += a * B[p][j]; }
  return C;
}

export function transpose(A: number[][]): number[][] {
  const r = A.length, c = A[0].length;
  const T = Array.from({ length: c }, () => new Array(r).fill(0));
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) T[j][i] = A[i][j];
  return T;
}
