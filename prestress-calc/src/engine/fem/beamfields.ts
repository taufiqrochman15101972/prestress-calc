/**
 * fem/beamfields.ts — Post-processor bridge: drive the 📊 internal-force /
 * stress / deflection diagrams from the actual FEM SOLVER (engine/fem/frame.ts)
 * instead of closed-form. The single-span girder is discretised into beam-column
 * elements, the gravity UDL + prestress balancing load are applied, the model is
 * solved, and the member N/V/M + nodal deflections are sampled back into the
 * SAME `BeamFieldResult` shape the UI already uses — so the visualization becomes
 * a true FEM post-processor (identical results to closed-form for this case,
 * confirming the solver, and ready for arbitrary models later).
 */
import type { BeamFieldInputs, BeamFieldResult, BeamFieldPoint, FieldKind } from "../internalforces";
import { solveFrame, type FrameModel } from "./frame";

const NEL = 40;

function buildAndSolve(L: number, E: number, A: number, I: number, w: number, Pmid: number) {
  const nodes = Array.from({ length: NEL + 1 }, (_, k) => ({ id: k + 1, x: (L * k) / NEL, y: 0 }));
  const members = Array.from({ length: NEL }, (_, k) => ({ id: k + 1, n1: k + 1, n2: k + 2, E, A, I }));
  const model: FrameModel = {
    nodes, members,
    supports: [{ node: 1, ux: true, uy: true, rz: false }, { node: NEL + 1, ux: false, uy: true, rz: false }],
    nodalLoads: Pmid ? [{ node: Math.floor(NEL / 2) + 1, fy: -Pmid }] : [],
    memberLoads: w ? members.map(m => ({ member: m.id, w })) : [],
  };
  return solveFrame(model);
}

/** cubic-Hermite transverse deflection inside a member at local x. */
function hermiteV(uy1: number, rz1: number, uy2: number, rz2: number, Le: number, xl: number): number {
  const xi = xl / Le;
  const N1 = 1 - 3 * xi * xi + 2 * xi ** 3, N2 = (xi - 2 * xi * xi + xi ** 3) * Le;
  const N3 = 3 * xi * xi - 2 * xi ** 3, N4 = (-xi * xi + xi ** 3) * Le;
  return N1 * uy1 + N2 * rz1 + N3 * uy2 + N4 * rz2;
}

export function computeBeamFieldsFEM(i: BeamFieldInputs): BeamFieldResult {
  const L = i.L;
  const E = i.Ig > 0 ? i.EI / i.Ig : 1;
  // Gravity solve drives M_z/V_y and its deflection (prestress is added in the
  // stress query as a separate P·e term, matching the closed-form convention →
  // no double counting). A second solve gives the prestress camber deflection.
  const major = buildAndSolve(L, E, i.A, i.Ig, -i.wUDL, i.Pmid);   // gravity (down)
  const camber = i.wBal !== 0 ? buildAndSolve(L, E, i.A, i.Ig, i.wBal, 0) : null; // camber (up)
  // lateral axis (wind): EI_lat with I=1 ⇒ E=EIlat
  const lateral = i.wLat > 0 && i.EIlat > 0
    ? buildAndSolve(L, i.EIlat, i.A, 1, -i.wLat, 0) : null;

  const dispBy = new Map(major.disp.map(d => [d.node, d]));
  const camberBy = camber ? new Map(camber.disp.map(d => [d.node, d])) : null;
  const latDispBy = lateral ? new Map(lateral.disp.map(d => [d.node, d])) : null;

  const pts: BeamFieldPoint[] = [];
  for (let e = 0; e < NEL; e++) {
    const mf = major.members[e];
    const xStart = (L * e) / NEL;
    const dL = dispBy.get(e + 1)!, dR = dispBy.get(e + 2)!;
    const cL = camberBy?.get(e + 1), cR = camberBy?.get(e + 2);
    const latMf = lateral ? lateral.members[e] : null;
    const lL = latDispBy?.get(e + 1), lR = latDispBy?.get(e + 2);
    const ns = e === NEL - 1 ? mf.samples.length : mf.samples.length - 1;  // avoid dup nodes
    for (let s = 0; s < ns; s++) {
      const sp = mf.samples[s];
      const xg = xStart + sp.x;
      const dzGrav = hermiteV(dL.uy, dL.rz, dR.uy, dR.rz, mf.L, sp.x);
      const dzCamber = camber && cL && cR ? hermiteV(cL.uy, cL.rz, cR.uy, cR.rz, mf.L, sp.x) : 0;
      const dz = dzGrav + dzCamber;
      const My = latMf ? latMf.samples[s].M : 0;
      const Vx = latMf ? latMf.samples[s].V : 0;
      const dy = lateral && lL && lR ? hermiteV(lL.uy, lL.rz, lR.uy, lR.rz, latMf!.L, sp.x) : 0;
      pts.push({
        x: xg, Mz: sp.M, My, Vy: sp.V, Vx,
        N: -i.Plong + i.Naxial, T: i.Tu, dz, dy,
      });
    }
  }

  const kinds: FieldKind[] = ["Mz", "My", "Vy", "Vx", "N", "T", "dz", "dy"];
  const max = {} as Record<FieldKind, number>, min = {} as Record<FieldKind, number>;
  for (const kd of kinds) { const v = pts.map(p => p[kd]); max[kd] = Math.max(...v); min[kd] = Math.min(...v); }
  return Object.freeze({
    L, pts: Object.freeze(pts), max: Object.freeze(max), min: Object.freeze(min),
    h: i.yt + i.yb, yb: i.yb, yt: i.yt,
  });
}
