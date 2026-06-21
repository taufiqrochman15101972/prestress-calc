/**
 * fem/shellsolver.ts — Full FLAT-SHELL assembly & solve (#2). Meshes a
 * rectangular panel into 4-node flat-shell elements (6 DOF/node: u,v,w,θx,θy,θz)
 * = bilinear membrane + Mindlin-SRI plate (shear-locking-free) + drilling, then
 * assembles the 24×24 element matrices into the global system, applies edge
 * conditions, and solves for BOTH in-plane (membrane) and out-of-plane (bending)
 * response — a complete shell, not just a plate. Panel in the global XY plane
 * (local = global); ready for a 3D transform per panel later.
 *
 * Units SI: a,b,t mm; E MPa; q N/mm² (pressure); N edge tension; disp mm.
 */
import { flatShellK } from "./shell";
import { scatter } from "./core";
import { solve } from "./backend";

export interface ShellInputs {
  a: number; b: number; nx: number; ny: number; t: number; E: number; nu: number;
  qz: number;             // out-of-plane pressure, N/mm² (down −w)
  edgeN: number;          // total in-plane tension at x=a edge, N
  edge: "SS" | "CLAMPED"; // out-of-plane edge condition
}
export interface ShellNode { i: number; j: number; x: number; y: number; u: number; v: number; w: number; }
export interface ShellResult {
  readonly nodes: ReadonlyArray<ShellNode>;
  readonly nnx: number; readonly nny: number;
  readonly centerW: number;   // out-of-plane central deflection, mm
  readonly maxW: number;
  readonly uEnd: number;      // membrane elongation at x=a edge, mm
  readonly dof: number;
}

export function solveShell(p: ShellInputs): ShellResult {
  const nnx = p.nx + 1, nny = p.ny + 1, nNode = nnx * nny, ndof = 6 * nNode;
  const dx = p.a / p.nx, dy = p.b / p.ny, Ae = dx * dy;
  const K = new Float64Array(ndof * ndof);
  const F = new Float64Array(ndof);
  const nid = (i: number, j: number) => j * nnx + i;

  for (let j = 0; j < p.ny; j++) for (let i = 0; i < p.nx; i++) {
    const ids = [nid(i, j), nid(i + 1, j), nid(i + 1, j + 1), nid(i, j + 1)];
    const xs = [i * dx, (i + 1) * dx, (i + 1) * dx, i * dx];
    const ys = [j * dy, j * dy, (j + 1) * dy, (j + 1) * dy];
    const ke = flatShellK(xs, ys, p.E, p.nu, p.t);
    const map: number[] = [];
    for (const nd of ids) for (let d = 0; d < 6; d++) map.push(6 * nd + d);
    scatter(K, ndof, ke, map);
    for (const nd of ids) F[6 * nd + 2] += -(p.qz * Ae) / 4;   // pressure → w (down)
  }
  // in-plane tension on x=a edge (split over edge nodes) → u
  const edgeNodes = Array.from({ length: nny }, (_, j) => nid(p.nx, j));
  for (const nd of edgeNodes) F[6 * nd] += p.edgeN / nny;

  const BIG = 1e30;
  const fix = (dof: number) => { K[dof * ndof + dof] += BIG; F[dof] = 0; };
  for (let j = 0; j < nny; j++) for (let i = 0; i < nnx; i++) {
    const nd = nid(i, j), onEdge = i === 0 || i === p.nx || j === 0 || j === p.ny;
    fix(6 * nd + 5);                       // drilling θz (no real stiffness) — always
    if (i === 0) { fix(6 * nd); fix(6 * nd + 1); }   // membrane anchor at x=0 wall
    if (onEdge) {
      fix(6 * nd + 2);                     // w = 0
      if (p.edge === "CLAMPED") { fix(6 * nd + 3); fix(6 * nd + 4); }
    }
  }

  const d = solve(K, ndof, F);
  const nodes: ShellNode[] = [];
  let maxW = 0;
  for (let j = 0; j < nny; j++) for (let i = 0; i < nnx; i++) {
    const nd = nid(i, j), w = d[6 * nd + 2];
    nodes.push({ i, j, x: i * dx, y: j * dy, u: d[6 * nd], v: d[6 * nd + 1], w });
    if (Math.abs(w) > Math.abs(maxW)) maxW = w;
  }
  const cn = nodes.find(n => n.i === Math.round(p.nx / 2) && n.j === Math.round(p.ny / 2));
  const uEndNode = nodes.find(n => n.i === p.nx && n.j === Math.round(p.ny / 2));
  return Object.freeze({
    nodes: Object.freeze(nodes), nnx, nny,
    centerW: cn ? cn.w : maxW, maxW, uEnd: uEndNode ? uEndNode.u : 0, dof: ndof,
  });
}
