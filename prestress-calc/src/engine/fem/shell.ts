/**
 * fem/shell.ts — Flat-shell finite element (Element Library), SHEAR-LOCKING-FREE.
 *
 * 4-node quadrilateral flat shell = bilinear MEMBRANE (axial/in-plane, 2 DOF/node
 * u,v) + Mindlin–Reissner PLATE BENDING (w,θx,θy) with **Selective Reduced
 * Integration (SRI)**: the BENDING stiffness is fully integrated (2×2 Gauss) while
 * the transverse-SHEAR stiffness is under-integrated (1-point Gauss). Reduced
 * shear integration removes the spurious shear energy that causes SHEAR LOCKING
 * in thin plates, so the element stays accurate as t→0 (the classic Hughes/
 * Zienkiewicz SRI Q4). Combined → 6 DOF/node (u,v,w,θx,θy,θz) with a small
 * drilling (θz) stiffness for assembly with frame elements.
 *
 * Units SI: E MPa, t mm, coords mm → K in N/mm. Pure functions.
 */

type V = number[];

const GAUSS2 = [-1 / Math.sqrt(3), 1 / Math.sqrt(3)];

function shapeQ4(xi: number, et: number) {
  const N = [0.25 * (1 - xi) * (1 - et), 0.25 * (1 + xi) * (1 - et), 0.25 * (1 + xi) * (1 + et), 0.25 * (1 - xi) * (1 + et)];
  const dNxi = [-0.25 * (1 - et), 0.25 * (1 - et), 0.25 * (1 + et), -0.25 * (1 + et)];
  const dNet = [-0.25 * (1 - xi), -0.25 * (1 + xi), 0.25 * (1 + xi), 0.25 * (1 - xi)];
  return { N, dNxi, dNet };
}

/** jacobian → dN/dx, dN/dy and detJ at (xi,et). */
function jac(x: V, y: V, xi: number, et: number) {
  const { N, dNxi, dNet } = shapeQ4(xi, et);
  let J11 = 0, J12 = 0, J21 = 0, J22 = 0;
  for (let i = 0; i < 4; i++) { J11 += dNxi[i] * x[i]; J12 += dNxi[i] * y[i]; J21 += dNet[i] * x[i]; J22 += dNet[i] * y[i]; }
  const det = J11 * J22 - J12 * J21;
  const iJ11 = J22 / det, iJ12 = -J12 / det, iJ21 = -J21 / det, iJ22 = J11 / det;
  const dNx: V = [], dNy: V = [];
  for (let i = 0; i < 4; i++) { dNx[i] = iJ11 * dNxi[i] + iJ12 * dNet[i]; dNy[i] = iJ21 * dNxi[i] + iJ22 * dNet[i]; }
  return { N, dNx, dNy, det };
}

function zeros(n: number, m: number): number[][] { return Array.from({ length: n }, () => new Array(m).fill(0)); }

/** Bilinear membrane stiffness, 8×8 (DOF order u1,v1,…,u4,v4). */
export function membraneK(x: V, y: V, E: number, nu: number, t: number): number[][] {
  const k = zeros(8, 8);
  const c = E / (1 - nu * nu);
  const D = [[c, c * nu, 0], [c * nu, c, 0], [0, 0, c * (1 - nu) / 2]];
  for (const gx of GAUSS2) for (const gy of GAUSS2) {
    const { dNx, dNy, det } = jac(x, y, gx, gy);
    const B = zeros(3, 8);
    for (let i = 0; i < 4; i++) {
      B[0][2 * i] = dNx[i]; B[1][2 * i + 1] = dNy[i];
      B[2][2 * i] = dNy[i]; B[2][2 * i + 1] = dNx[i];
    }
    addBtDB(k, B, D, det * t);
  }
  return k;
}

/** Mindlin plate, 12×12 (DOF order w,θx,θy per node), SRI (bending 2×2, shear 1×1). */
export function plateK(x: V, y: V, E: number, nu: number, t: number, kappa = 5 / 6): number[][] {
  const k = zeros(12, 12);
  const Db0 = (E * t ** 3) / (12 * (1 - nu * nu));
  const Db = [[Db0, Db0 * nu, 0], [Db0 * nu, Db0, 0], [0, 0, Db0 * (1 - nu) / 2]];
  const Gs = kappa * (E / (2 * (1 + nu))) * t;
  const Ds = [[Gs, 0], [0, Gs]];

  // bending — full 2×2 integration
  for (const gx of GAUSS2) for (const gy of GAUSS2) {
    const { dNx, dNy, det } = jac(x, y, gx, gy);
    const Bb = zeros(3, 12);
    for (let i = 0; i < 4; i++) {
      // κ = [θx,x ; θy,y ; θx,y+θy,x]; node dof (w,θx,θy) at 3i,3i+1,3i+2
      Bb[0][3 * i + 1] = dNx[i];
      Bb[1][3 * i + 2] = dNy[i];
      Bb[2][3 * i + 1] = dNy[i]; Bb[2][3 * i + 2] = dNx[i];
    }
    addBtDB(k, Bb, Db, det);
  }
  // shear — reduced 1-point integration (centre) → locking-free
  {
    const { N, dNx, dNy, det } = jac(x, y, 0, 0);
    const Bs = zeros(2, 12);
    for (let i = 0; i < 4; i++) {
      // γ = [w,x − θx ; w,y − θy]
      Bs[0][3 * i] = dNx[i]; Bs[0][3 * i + 1] = -N[i];
      Bs[1][3 * i] = dNy[i]; Bs[1][3 * i + 2] = -N[i];
    }
    addBtDB(k, Bs, Ds, det * 4);   // weight 4 = full domain at 1 point (2×2)
  }
  return k;
}

function addBtDB(k: number[][], B: number[][], D: number[][], scale: number): void {
  const nrow = B.length, ncol = B[0].length;
  // DB = D·B (nrow×ncol)
  const DB = zeros(nrow, ncol);
  for (let i = 0; i < nrow; i++) for (let j = 0; j < ncol; j++) { let s = 0; for (let p = 0; p < nrow; p++) s += D[i][p] * B[p][j]; DB[i][j] = s; }
  for (let i = 0; i < ncol; i++) for (let j = 0; j < ncol; j++) { let s = 0; for (let p = 0; p < nrow; p++) s += B[p][i] * DB[p][j]; k[i][j] += s * scale; }
}

/** Flat-shell local stiffness 24×24, DOF order per node u,v,w,θx,θy,θz. */
export function flatShellK(x: V, y: V, E: number, nu: number, t: number): number[][] {
  const km = membraneK(x, y, E, nu, t);
  const kp = plateK(x, y, E, nu, t);
  const K = zeros(24, 24);
  const mDof = [0, 1, 6, 7, 12, 13, 18, 19];                 // u,v of nodes 1..4
  const pDof = [2, 3, 4, 8, 9, 10, 14, 15, 16, 20, 21, 22];  // w,θx,θy of nodes 1..4
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) K[mDof[i]][mDof[j]] += km[i][j];
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) K[pDof[i]][pDof[j]] += kp[i][j];
  // small drilling (θz) stiffness to avoid singularity (≈ 1e-3 of bending diag)
  const drill = 1e-3 * Math.max(...pDof.map(d => K[d][d]), 1);
  for (const dz of [5, 11, 17, 23]) K[dz][dz] += drill;
  return K;
}
