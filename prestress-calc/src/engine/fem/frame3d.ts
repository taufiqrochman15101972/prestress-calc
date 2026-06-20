/**
 * fem/frame3d.ts — 3D beam-column (space frame) finite element (#3).
 * 2-node element, 6 DOF/node: u,v,w (translations X,Y,Z) + θx,θy,θz (rotations).
 * Carries AXIAL (EA/L), TORSION (GJ/L), and BENDING about both principal axes
 * (EIy, EIz) — classic Euler-Bernoulli 12×12 local stiffness with a full 3D
 * direction-cosine transformation (auto up-vector). Global axes per project
 * convention: X→right, Y→front (depth), Z→up.
 *
 * Reuses fem/core.ts (solveLinear/scatter/matMul/transpose). Units SI.
 */
import { scatter, matVec, matMul, transpose } from "./core";
import { solve as solveLinear } from "./backend";

export interface Node3D { id: number; x: number; y: number; z: number; }
export interface Member3D {
  id: number; n1: number; n2: number;
  E: number; G: number; A: number; Iy: number; Iz: number; J: number;
}
export interface Support3D { node: number; dofs: [boolean, boolean, boolean, boolean, boolean, boolean]; }
export interface Load3D { node: number; fx?: number; fy?: number; fz?: number; mx?: number; my?: number; mz?: number; }
export interface Frame3DModel { nodes: Node3D[]; members: Member3D[]; supports: Support3D[]; loads: Load3D[]; }

export interface Member3DForce {
  id: number;
  N: number; Vy: number; Vz: number; T: number; My: number; Mz: number;   // at end 1 (local)
  L: number;
}
export interface Frame3DResult {
  readonly disp: ReadonlyArray<{ node: number; ux: number; uy: number; uz: number; rx: number; ry: number; rz: number }>;
  readonly members: ReadonlyArray<Member3DForce>;
  readonly maxDisp: number;
  readonly dof: number;
}

/** local 12×12 (Euler-Bernoulli space frame). */
export function frame3dLocalK(E: number, G: number, A: number, Iy: number, Iz: number, J: number, L: number): number[][] {
  const k = Array.from({ length: 12 }, () => new Array(12).fill(0));
  const EA = (E * A) / L, GJ = (G * J) / L;
  const az = 12 * E * Iz / L ** 3, bz = 6 * E * Iz / L ** 2, cz = 4 * E * Iz / L, dz = 2 * E * Iz / L;
  const ay = 12 * E * Iy / L ** 3, by = 6 * E * Iy / L ** 2, cy = 4 * E * Iy / L, dy = 2 * E * Iy / L;
  const s = (i: number, j: number, v: number) => { k[i][j] = v; k[j][i] = v; };
  s(0, 0, EA); s(0, 6, -EA); s(6, 6, EA);
  s(3, 3, GJ); s(3, 9, -GJ); s(9, 9, GJ);
  // bending about z (v–θz): dofs 1,5,7,11
  s(1, 1, az); s(1, 5, bz); s(1, 7, -az); s(1, 11, bz);
  s(5, 5, cz); s(5, 7, -bz); s(5, 11, dz);
  s(7, 7, az); s(7, 11, -bz); s(11, 11, cz);
  // bending about y (w–θy): dofs 2,4,8,10
  s(2, 2, ay); s(2, 4, -by); s(2, 8, -ay); s(2, 10, -by);
  s(4, 4, cy); s(4, 8, by); s(4, 10, dy);
  s(8, 8, ay); s(8, 10, by); s(10, 10, cy);
  return k;
}

/** 3×3 rotation (local axes as rows in global) with auto up-vector. */
function rot3(dx: number, dy: number, dz: number, L: number): number[][] {
  const ex = [dx / L, dy / L, dz / L];
  // up vector: global Z unless member ~vertical, then global Y
  const up = Math.abs(ex[2]) > 0.99 ? [0, 1, 0] : [0, 0, 1];
  // ey = up × ex (normalised), ez = ex × ey
  let ey = [up[1] * ex[2] - up[2] * ex[1], up[2] * ex[0] - up[0] * ex[2], up[0] * ex[1] - up[1] * ex[0]];
  const ny = Math.hypot(...ey); ey = ey.map(c => c / ny);
  const ez = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]];
  return [ex, ey, ez];
}

function T12(R: number[][]): number[][] {
  const T = Array.from({ length: 12 }, () => new Array(12).fill(0));
  for (let b = 0; b < 4; b++) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) T[b * 3 + i][b * 3 + j] = R[i][j];
  return T;
}

export function solveFrame3D(model: Frame3DModel): Frame3DResult {
  const { nodes, members, supports, loads } = model;
  const idx = new Map<number, number>();
  nodes.forEach((n, i) => idx.set(n.id, i));
  const ndof = nodes.length * 6;
  const K = new Float64Array(ndof * ndof);
  const F = new Float64Array(ndof);

  for (const ld of loads) {
    const b = (idx.get(ld.node) ?? 0) * 6;
    F[b] += ld.fx ?? 0; F[b + 1] += ld.fy ?? 0; F[b + 2] += ld.fz ?? 0;
    F[b + 3] += ld.mx ?? 0; F[b + 4] += ld.my ?? 0; F[b + 5] += ld.mz ?? 0;
  }

  type Cache = { m: Member3D; kl: number[][]; T: number[][]; map: number[]; L: number };
  const cache: Cache[] = [];
  for (const m of members) {
    const a = nodes[idx.get(m.n1)!], b = nodes[idx.get(m.n2)!];
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz);
    if (L < 1e-9) throw new Error(`Member 3D ${m.id} panjang nol.`);
    const kl = frame3dLocalK(m.E, m.G, m.A, m.Iy, m.Iz, m.J, L);
    const T = T12(rot3(dx, dy, dz, L));
    const kg = matMul(matMul(transpose(T), kl), T);
    const ia = idx.get(m.n1)! * 6, ib = idx.get(m.n2)! * 6;
    const map = [ia, ia + 1, ia + 2, ia + 3, ia + 4, ia + 5, ib, ib + 1, ib + 2, ib + 3, ib + 4, ib + 5];
    scatter(K, ndof, kg, map);
    cache.push({ m, kl, T, map, L });
  }

  const BIG = 1e30;
  for (const sp of supports) {
    const b = (idx.get(sp.node) ?? 0) * 6;
    for (let d = 0; d < 6; d++) if (sp.dofs[d]) { K[(b + d) * ndof + (b + d)] += BIG; F[b + d] = 0; }
  }

  const d = solveLinear(K, ndof, F);

  const memberForces: Member3DForce[] = cache.map(ch => {
    const dg = ch.map.map(g => d[g]);
    const fl = matVec(ch.kl, matVec(ch.T, dg));   // local end forces
    return { id: ch.m.id, N: -fl[0], Vy: fl[1], Vz: fl[2], T: fl[3], My: fl[4], Mz: fl[5], L: ch.L };
  });

  const disp = nodes.map((n, i) => ({
    node: n.id, ux: d[i * 6], uy: d[i * 6 + 1], uz: d[i * 6 + 2],
    rx: d[i * 6 + 3], ry: d[i * 6 + 4], rz: d[i * 6 + 5],
  }));
  const maxDisp = Math.max(...disp.map(p => Math.hypot(p.ux, p.uy, p.uz)), 0);
  return Object.freeze({ disp, members: memberForces, maxDisp, dof: ndof });
}
