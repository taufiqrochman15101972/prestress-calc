/**
 * fem/plate.ts — Plate/shell MESHING + SOLVE (uses the shear-locking-free
 * Mindlin-SRI Q4 plate element from fem/shell.ts). Rectangular plate auto-meshed
 * nx×ny, uniform pressure, simply-supported or clamped edges → solves for the
 * deflection field w(x,y) and validates against thin-plate theory.
 *
 * Units SI: a,b,t mm; E MPa; q N/mm² (pressure); w mm.
 */
import { plateK } from "./shell";
import { solveLinear, scatter } from "./core";

export interface PlateInputs {
  a: number; b: number;       // plan dimensions, mm
  nx: number; ny: number;     // mesh divisions
  t: number;                  // thickness, mm
  E: number; nu: number;
  q: number;                  // uniform pressure, N/mm²
  edge: "SS" | "CLAMPED";
}
export interface PlateNode { i: number; j: number; x: number; y: number; w: number; }
export interface PlateResult {
  readonly nodes: ReadonlyArray<PlateNode>;
  readonly nnx: number; readonly nny: number;
  readonly maxW: number;        // max |w|, mm
  readonly centerW: number;     // central deflection, mm
  readonly analytic: number;    // thin-plate theory central deflection, mm
  readonly ratio: number;       // FEM / theory
  readonly D: number;           // flexural rigidity
  readonly dof: number;
}

export function solvePlate(p: PlateInputs): PlateResult {
  const nnx = p.nx + 1, nny = p.ny + 1, nNode = nnx * nny, ndof = 3 * nNode;
  const dx = p.a / p.nx, dy = p.b / p.ny, Ae = dx * dy;
  const K = new Float64Array(ndof * ndof);
  const F = new Float64Array(ndof);
  const nodeId = (i: number, j: number) => j * nnx + i;

  for (let j = 0; j < p.ny; j++) for (let i = 0; i < p.nx; i++) {
    const ids = [nodeId(i, j), nodeId(i + 1, j), nodeId(i + 1, j + 1), nodeId(i, j + 1)];
    const xs = [i * dx, (i + 1) * dx, (i + 1) * dx, i * dx];
    const ys = [j * dy, j * dy, (j + 1) * dy, (j + 1) * dy];
    const ke = plateK(xs, ys, p.E, p.nu, p.t);
    const map: number[] = [];
    for (const nd of ids) map.push(3 * nd, 3 * nd + 1, 3 * nd + 2);
    scatter(K, ndof, ke, map);
    for (const nd of ids) F[3 * nd] += -(p.q * Ae) / 4;  // downward pressure → −w (down)
  }

  // boundary conditions
  const BIG = 1e30;
  for (let j = 0; j < nny; j++) for (let i = 0; i < nnx; i++) {
    const onEdge = i === 0 || i === p.nx || j === 0 || j === p.ny;
    if (!onEdge) continue;
    const nd = nodeId(i, j);
    K[(3 * nd) * ndof + 3 * nd] += BIG; F[3 * nd] = 0;                 // w = 0
    if (p.edge === "CLAMPED") {
      K[(3 * nd + 1) * ndof + 3 * nd + 1] += BIG; F[3 * nd + 1] = 0;  // θx = 0
      K[(3 * nd + 2) * ndof + 3 * nd + 2] += BIG; F[3 * nd + 2] = 0;  // θy = 0
    }
  }

  const d = solveLinear(K, ndof, F);

  const nodes: PlateNode[] = [];
  let maxW = 0;
  for (let j = 0; j < nny; j++) for (let i = 0; i < nnx; i++) {
    const nd = nodeId(i, j), w = d[3 * nd];
    nodes.push({ i, j, x: i * dx, y: j * dy, w });
    if (Math.abs(w) > Math.abs(maxW)) maxW = w;
  }
  const centerNode = nodes.find(n => n.i === Math.round(p.nx / 2) && n.j === Math.round(p.ny / 2));
  const centerW = centerNode ? centerNode.w : maxW;

  const D = (p.E * p.t ** 3) / (12 * (1 - p.nu * p.nu));
  // square-plate uniform-load central deflection coefficient (ν≈0.3)
  const alpha = p.edge === "SS" ? 0.00406 : 0.00126;
  const aMin = Math.min(p.a, p.b);
  const analytic = -(alpha * p.q * aMin ** 4) / D;     // downward (−)
  return Object.freeze({
    nodes: Object.freeze(nodes), nnx, nny, maxW, centerW, analytic,
    ratio: analytic !== 0 ? centerW / analytic : 0, D, dof: ndof,
  });
}
