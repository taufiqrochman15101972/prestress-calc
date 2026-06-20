/**
 * fem/frame.ts — 2D beam-column (frame) finite element (Element Library).
 *
 * 2-node element, 3 DOF/node (u, v, θz): AXIAL (EA/L), FLEXURAL BENDING, and
 * SHEAR via the Timoshenko shear-flexibility parameter Φ = 12EI/(G·A_s·L²) — so
 * the element is shear-flexible yet free of shear locking (the bending+shear
 * stiffness uses the exact 2-node interpolation; set A_s = 0 for the slender
 * Euler-Bernoulli limit Φ→0). Member UDL via consistent fixed-end forces.
 *
 * Pairs with fem/core.ts (solver) and fem/model.ts (pre-processor).
 * Units SI: E,G MPa; A mm²; I mm⁴; L mm; w N/mm; forces N, moments N·mm.
 */
import { solveLinear, scatter, matVec, matMul, transpose } from "./core";

export interface FemNode { id: number; x: number; y: number; }
export interface FemMember {
  id: number; n1: number; n2: number;
  E: number; A: number; I: number;
  G?: number; As?: number;          // shear modulus & shear area (Timoshenko); As=0 ⇒ Euler
}
export interface FemSupport { node: number; ux: boolean; uy: boolean; rz: boolean; }
export interface FemNodalLoad { node: number; fx?: number; fy?: number; mz?: number; }
export interface FemMemberLoad { member: number; w: number; }   // transverse UDL (local y), N/mm

export interface FrameModel {
  nodes: FemNode[]; members: FemMember[];
  supports: FemSupport[]; nodalLoads: FemNodalLoad[]; memberLoads: FemMemberLoad[];
}

export interface MemberForce {
  id: number; N1: number; V1: number; M1: number; N2: number; V2: number; M2: number;
  L: number;
  /** sampled diagrams along member: x(mm), N, V, M */
  samples: { x: number; N: number; V: number; M: number; dT: number }[];
}
export interface FrameResult {
  readonly disp: ReadonlyArray<{ node: number; ux: number; uy: number; rz: number }>;
  readonly reactions: ReadonlyArray<{ node: number; fx: number; fy: number; mz: number }>;
  readonly members: ReadonlyArray<MemberForce>;
  readonly maxDisp: number;
  readonly dofCount: number;
}

/** local 6×6 stiffness (Timoshenko shear-flexible, locking-free). */
export function frameLocalK(E: number, A: number, I: number, L: number, G = 0, As = 0): number[][] {
  const ea = (E * A) / L;
  const phi = G > 0 && As > 0 ? (12 * E * I) / (G * As * L * L) : 0;   // shear param
  const c = (E * I) / (L * L * L * (1 + phi));
  const k = Array.from({ length: 6 }, () => new Array(6).fill(0));
  // axial (DOF 0,3)
  k[0][0] = ea; k[0][3] = -ea; k[3][0] = -ea; k[3][3] = ea;
  // bending+shear (DOF 1,2,4,5) — Timoshenko consistent
  const k11 = 12 * c, k12 = 6 * L * c, k22 = (4 + phi) * L * L * c, k25 = (2 - phi) * L * L * c;
  k[1][1] = k11; k[1][2] = k12; k[1][4] = -k11; k[1][5] = k12;
  k[2][1] = k12; k[2][2] = k22; k[2][4] = -k12; k[2][5] = k25;
  k[4][1] = -k11; k[4][2] = -k12; k[4][4] = k11; k[4][5] = -k12;
  k[5][1] = k12; k[5][2] = k25; k[5][4] = -k12; k[5][5] = k22;
  return k;
}

/** transformation 6×6 for member at angle (cosθ,sinθ). */
function frameT(c: number, s: number): number[][] {
  const T = Array.from({ length: 6 }, () => new Array(6).fill(0));
  const r = [[c, s, 0], [-s, c, 0], [0, 0, 1]];
  for (let b = 0; b < 2; b++) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) T[b * 3 + i][b * 3 + j] = r[i][j];
  return T;
}

/** consistent fixed-end forces (local) for a transverse UDL w on span L. */
function fixedEndUDL(w: number, L: number): number[] {
  // [Fx1,Fy1,Mz1, Fx2,Fy2,Mz2]
  return [0, (w * L) / 2, (w * L * L) / 12, 0, (w * L) / 2, -(w * L * L) / 12];
}

export function solveFrame(model: FrameModel): FrameResult {
  const { nodes, members, supports, nodalLoads, memberLoads } = model;
  const idx = new Map<number, number>();
  nodes.forEach((nd, i) => idx.set(nd.id, i));
  const ndof = nodes.length * 3;

  const K = new Float64Array(ndof * ndof);
  const F = new Float64Array(ndof);

  // nodal loads
  for (const ld of nodalLoads) {
    const b = (idx.get(ld.node) ?? 0) * 3;
    F[b] += ld.fx ?? 0; F[b + 1] += ld.fy ?? 0; F[b + 2] += ld.mz ?? 0;
  }

  // member assembly
  const memLoadMap = new Map<number, number>();
  for (const ml of memberLoads) memLoadMap.set(ml.member, (memLoadMap.get(ml.member) ?? 0) + ml.w);

  type Cache = { m: FemMember; L: number; c: number; s: number; T: number[][]; kl: number[][]; map: number[]; w: number };
  const cache: Cache[] = [];
  for (const m of members) {
    const a = nodes[idx.get(m.n1)!], b = nodes[idx.get(m.n2)!];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    if (L < 1e-9) throw new Error(`Member ${m.id} panjang nol.`);
    const c = dx / L, s = dy / L;
    const kl = frameLocalK(m.E, m.A, m.I, L, m.G ?? 0, m.As ?? 0);
    const T = frameT(c, s);
    const kg = matMul(matMul(transpose(T), kl), T);     // global element K
    const ia = idx.get(m.n1)! * 3, ib = idx.get(m.n2)! * 3;
    const map = [ia, ia + 1, ia + 2, ib, ib + 1, ib + 2];
    scatter(K, ndof, kg, map);
    const w = memLoadMap.get(m.id) ?? 0;
    if (w !== 0) {
      const feLocal = fixedEndUDL(w, L);
      const feGlobal = matVec(transpose(T), feLocal);   // equivalent nodal loads = +FE moved to RHS
      for (let i = 0; i < 6; i++) F[map[i]] += feGlobal[i];
    }
    cache.push({ m, L, c, s, T, kl, map, w });
  }

  // boundary conditions (penalty on supported DOFs)
  const BIG = 1e30;
  const fixed = new Set<number>();
  for (const sp of supports) {
    const b = (idx.get(sp.node) ?? 0) * 3;
    if (sp.ux) fixed.add(b); if (sp.uy) fixed.add(b + 1); if (sp.rz) fixed.add(b + 2);
  }
  for (const dof of fixed) { K[dof * ndof + dof] += BIG; F[dof] = 0; }

  const d = solveLinear(K, ndof, F);

  // reactions: R = K_orig·d − F_applied (use original K without penalty → recompute)
  // simpler: reaction at fixed dof = penalty·d ≈ K_big·d
  const reactions: { node: number; fx: number; fy: number; mz: number }[] = [];
  for (const sp of supports) {
    const b = (idx.get(sp.node) ?? 0) * 3;
    reactions.push({
      node: sp.node,
      fx: sp.ux ? BIG * d[b] : 0,
      fy: sp.uy ? BIG * d[b + 1] : 0,
      mz: sp.rz ? BIG * d[b + 2] : 0,
    });
  }

  // member end forces (local) + diagrams
  const memberForces: MemberForce[] = [];
  for (const ch of cache) {
    const { m, L, T, kl, map, w } = ch;
    const dg = map.map(g => d[g]);
    const dl = matVec(T, dg);                       // local displacements
    let fl = matVec(kl, dl);                        // local end forces
    if (w !== 0) { const fe = fixedEndUDL(w, L); for (let i = 0; i < 6; i++) fl[i] -= fe[i]; }
    // local sign: N=axial, V=shear(y), M=moment(z)
    const N1 = -fl[0], V1 = fl[1], M1 = fl[2], N2 = fl[3], V2 = fl[4], M2 = fl[5];
    const samples: MemberForce["samples"] = [];
    const nS = 21;
    for (let i = 0; i < nS; i++) {
      const x = (L * i) / (nS - 1);
      const V = V1 - w * x;                          // shear from left end + UDL
      const M = -M1 + V1 * x - (w * x * x) / 2;      // moment (sagging +)
      const N = N1;
      samples.push({ x, N, V, M, dT: 0 });
    }
    memberForces.push({ id: m.id, N1, V1, M1, N2, V2, M2, L, samples });
  }

  const disp = nodes.map((nd, i) => ({ node: nd.id, ux: d[i * 3], uy: d[i * 3 + 1], rz: d[i * 3 + 2] }));
  const maxDisp = Math.max(...disp.map(p => Math.hypot(p.ux, p.uy)), 0);

  return Object.freeze({
    disp, reactions, members: memberForces, maxDisp, dofCount: ndof,
  });
}
