/**
 * fem/sparsebackend.ts — Iterative solver BACKEND (#1, the bridge to native).
 *
 * Preconditioned Conjugate Gradient (Jacobi preconditioner) over the assembled
 * stiffness — the same SPD iterative algorithm a native Julia/Zig backend would
 * run on a CSR sparse matrix + GPU. Registered through the SAME SolverBackend
 * seam (fem/backend.ts), so element/assembly/UI code is untouched: this proves
 * the swap mechanism and scales O(n·nnz) per iteration instead of O(n³) dense LU.
 *
 * (Operates on the dense Float64Array K here; a true native backend keeps K in a
 * Zig-allocated CSR buffer and shares the pointer zero-copy — same `solve` API.)
 */
import type { SolverBackend } from "./backend";

function cgSolve(K: Float64Array, n: number, F: Float64Array, tol = 1e-10, maxIt = 5000): Float64Array {
  const x = new Float64Array(n);
  const r = F.slice();                 // r = F − K·x (x0 = 0)
  const Minv = new Float64Array(n);    // Jacobi preconditioner
  for (let i = 0; i < n; i++) { const d = K[i * n + i]; Minv[i] = d !== 0 ? 1 / d : 1; }
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) z[i] = Minv[i] * r[i];
  const p = z.slice();
  let rz = 0; for (let i = 0; i < n; i++) rz += r[i] * z[i];
  const Kp = new Float64Array(n);
  let bnorm = 0; for (let i = 0; i < n; i++) bnorm += F[i] * F[i]; bnorm = Math.sqrt(bnorm) || 1;

  for (let it = 0; it < maxIt; it++) {
    // Kp = K·p
    for (let i = 0; i < n; i++) { let s = 0; const row = i * n; for (let j = 0; j < n; j++) s += K[row + j] * p[j]; Kp[i] = s; }
    let pKp = 0; for (let i = 0; i < n; i++) pKp += p[i] * Kp[i];
    if (Math.abs(pKp) < 1e-300) break;
    const alpha = rz / pKp;
    for (let i = 0; i < n; i++) { x[i] += alpha * p[i]; r[i] -= alpha * Kp[i]; }
    let rnorm = 0; for (let i = 0; i < n; i++) rnorm += r[i] * r[i];
    if (Math.sqrt(rnorm) / bnorm < tol) break;
    for (let i = 0; i < n; i++) z[i] = Minv[i] * r[i];
    let rzNew = 0; for (let i = 0; i < n; i++) rzNew += r[i] * z[i];
    const beta = rzNew / rz; rz = rzNew;
    for (let i = 0; i < n; i++) p[i] = z[i] + beta * p[i];
  }
  return x;
}

export const cgBackend: SolverBackend = Object.freeze({
  name: "TS preconditioned CG (Jacobi) — native-ready seam",
  zeroCopy: true,
  solve: (K: Float64Array, n: number, F: Float64Array) => cgSolve(K, n, F),
});
