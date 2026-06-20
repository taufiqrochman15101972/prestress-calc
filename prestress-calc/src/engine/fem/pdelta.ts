/**
 * fem/pdelta.ts — Geometric NONLINEAR (second-order / P-Δ) frame analysis,
 * MIDAS "P-Delta" / Robot "2nd-order" style. Iterative: solve → recover member
 * axial force → add the geometric stiffness K_g(P) → re-solve, until the
 * displacement converges. Compression softens (amplifies), tension stiffens;
 * near the elastic critical load K_e+K_g approaches singular (buckling).
 *
 * Consistent geometric stiffness for the 2-node frame (axial P, tension +).
 * Reuses frame.ts (elastic local K) + core/backend. Units SI.
 */
import { frameLocalK, type FrameModel } from "./frame";
import { scatter, matMul, matVec, transpose } from "./core";
import { solve } from "./backend";

function frameT(c: number, s: number): number[][] {
  const T = Array.from({ length: 6 }, () => new Array(6).fill(0));
  const r = [[c, s, 0], [-s, c, 0], [0, 0, 1]];
  for (let b = 0; b < 2; b++) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) T[b * 3 + i][b * 3 + j] = r[i][j];
  return T;
}
/** consistent geometric stiffness (local), axial force P tension-positive. */
function geomK(P: number, L: number): number[][] {
  const g = P / L, k = Array.from({ length: 6 }, () => new Array(6).fill(0));
  const a = 6 / 5 * g, b = g * L / 10, c = 2 * g * L * L / 15, d = g * L * L / 30;
  k[1][1] = a; k[1][2] = b; k[1][4] = -a; k[1][5] = b;
  k[2][1] = b; k[2][2] = c; k[2][4] = -b; k[2][5] = -d;
  k[4][1] = -a; k[4][2] = -b; k[4][4] = a; k[4][5] = -b;
  k[5][1] = b; k[5][2] = -d; k[5][4] = -b; k[5][5] = c;
  return k;
}

export interface PDeltaResult {
  readonly firstOrderMax: number;   // mm
  readonly secondOrderMax: number;  // mm
  readonly amplification: number;   // 2nd / 1st
  readonly iterations: number;
  readonly converged: boolean;
  readonly diverged: boolean;       // likely buckling (P near Pcr)
}

export function solveFramePDelta(model: FrameModel, maxIter = 30, tol = 1e-4): PDeltaResult {
  const { nodes, members, supports, nodalLoads, memberLoads } = model;
  const idx = new Map<number, number>(); nodes.forEach((n, i) => idx.set(n.id, i));
  const ndof = nodes.length * 3;

  // load vector (nodal + member UDL equivalent) — constant
  const F = new Float64Array(ndof);
  for (const ld of nodalLoads) { const b = (idx.get(ld.node) ?? 0) * 3; F[b] += ld.fx ?? 0; F[b + 1] += ld.fy ?? 0; F[b + 2] += ld.mz ?? 0; }
  const wByMem = new Map<number, number>(); for (const ml of memberLoads) wByMem.set(ml.member, (wByMem.get(ml.member) ?? 0) + ml.w);

  type C = { kl: number[][]; T: number[][]; map: number[]; L: number; c: number; s: number };
  const cache: C[] = members.map(m => {
    const a = nodes[idx.get(m.n1)!], b = nodes[idx.get(m.n2)!];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), c = dx / L, s = dy / L;
    const ia = idx.get(m.n1)! * 3, ib = idx.get(m.n2)! * 3;
    return { kl: frameLocalK(m.E, m.A, m.I, L, m.G ?? 0, m.As ?? 0), T: frameT(c, s), map: [ia, ia + 1, ia + 2, ib, ib + 1, ib + 2], L, c, s };
  });
  for (const [mid, w] of wByMem) {
    const ch = cache[members.findIndex(m => m.id === mid)];
    const fe = [0, w * ch.L / 2, w * ch.L * ch.L / 12, 0, w * ch.L / 2, -w * ch.L * ch.L / 12];
    const feG = matVec(transpose(ch.T), fe); for (let i = 0; i < 6; i++) F[ch.map[i]] += feG[i];
  }

  const fixed = new Set<number>();
  for (const sp of supports) { const b = (idx.get(sp.node) ?? 0) * 3; if (sp.ux) fixed.add(b); if (sp.uy) fixed.add(b + 1); if (sp.rz) fixed.add(b + 2); }

  const assembleSolve = (P: number[]) => {
    const K = new Float64Array(ndof * ndof);
    cache.forEach((ch, i) => {
      const kt = ch.kl.map((row, r) => row.slice());
      if (P[i] !== 0) { const kg = geomK(P[i], ch.L); for (let r = 0; r < 6; r++) for (let cc = 0; cc < 6; cc++) kt[r][cc] += kg[r][cc]; }
      const kg2 = matMul(matMul(transpose(ch.T), kt), ch.T);
      scatter(K, ndof, kg2, ch.map);
    });
    const Fs = F.slice();
    for (const dof of fixed) { K[dof * ndof + dof] += 1e30; Fs[dof] = 0; }
    return solve(K, ndof, Fs);
  };
  const axialOf = (d: Float64Array) => cache.map(ch => {
    const dg = ch.map.map(g => d[g]); const fl = matVec(ch.kl, matVec(ch.T, dg)); return fl[3]; // tension +
  });
  const maxDispOf = (d: Float64Array) => { let m = 0; for (let i = 0; i < nodes.length; i++) m = Math.max(m, Math.hypot(d[i * 3], d[i * 3 + 1])); return m; };

  // first order
  let P = members.map(() => 0);
  const d0 = assembleSolve(P);
  const firstOrderMax = maxDispOf(d0);
  P = axialOf(d0);

  let prev = firstOrderMax, secondOrderMax = firstOrderMax, iterations = 0, converged = false, diverged = false;
  for (let it = 1; it <= maxIter; it++) {
    iterations = it;
    let d: Float64Array;
    try { d = assembleSolve(P); } catch { diverged = true; break; }
    secondOrderMax = maxDispOf(d);
    if (!isFinite(secondOrderMax) || secondOrderMax > 1e6 * firstOrderMax + 1e6) { diverged = true; break; }
    if (Math.abs(secondOrderMax - prev) <= tol * Math.abs(secondOrderMax)) { converged = true; break; }
    prev = secondOrderMax; P = axialOf(d);
  }
  return Object.freeze({
    firstOrderMax, secondOrderMax,
    amplification: firstOrderMax > 0 ? secondOrderMax / firstOrderMax : 1,
    iterations, converged, diverged,
  });
}
