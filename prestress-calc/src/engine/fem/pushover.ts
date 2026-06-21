/**
 * fem/pushover.ts — Nonlinear-static PUSHOVER analysis (MIDAS/Robot style).
 * Event-to-event plastic-hinge method on a 2D frame: a reference lateral load
 * pattern is scaled; at each step the member-end nearest its plastic moment M_p
 * forms a concentrated hinge (moment release via static condensation), and the
 * analysis continues with the softened structure → the CAPACITY CURVE (base
 * shear vs control displacement) and the hinge-formation sequence, up to the
 * collapse mechanism (stiffness singular). Elastic–perfectly-plastic hinges.
 *
 * Reuses frameLocalK + core/backend. Units SI (N, mm, N·mm).
 */
import { frameLocalK, type FrameModel } from "./frame";
import { scatter, matMul, matVec, transpose } from "./core";
import { solve } from "./backend";

export interface PushoverInputs {
  model: FrameModel;
  refLoads: { node: number; fx?: number; fy?: number }[];  // lateral pattern (unit reference)
  Mp: number;                 // plastic moment (uniform), N·mm
  controlNode: number;        // displacement-control node
  maxSteps?: number;
}
export interface CapacityPoint { disp: number; baseShear: number; hinges: number; }
export interface PushoverResult {
  readonly curve: ReadonlyArray<CapacityPoint>;
  readonly Vmax: number;       // peak base shear, N
  readonly dispMax: number;    // control disp at last step, mm
  readonly nHinges: number;
  readonly mechanism: boolean;
}

const ROT = [2, 5];   // local rotational DOFs (end1, end2)

function frameT(c: number, s: number): number[][] {
  const T = Array.from({ length: 6 }, () => new Array(6).fill(0));
  const r = [[c, s, 0], [-s, c, 0], [0, 0, 1]];
  for (let b = 0; b < 2; b++) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) T[b * 3 + i][b * 3 + j] = r[i][j];
  return T;
}
/** static condensation of released local DOFs → modified 6×6 (released rows/cols 0). */
function condense(k0: number[][], released: number[]): number[][] {
  let k = k0.map(r => r.slice());
  for (const r of released) {
    const krr = k[r][r];
    if (Math.abs(krr) < 1e-12) continue;
    const kn = k.map(row => row.slice());
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) kn[i][j] = k[i][j] - (k[i][r] * k[r][j]) / krr;
    for (let i = 0; i < 6; i++) { kn[r][i] = 0; kn[i][r] = 0; }
    k = kn;
  }
  return k;
}

export function computePushover(inp: PushoverInputs): PushoverResult {
  const { model, refLoads, Mp, controlNode } = inp;
  const { nodes, members, supports } = model;
  const idx = new Map<number, number>(); nodes.forEach((n, i) => idx.set(n.id, i));
  const ndof = nodes.length * 3;

  const geom = members.map(m => {
    const a = nodes[idx.get(m.n1)!], b = nodes[idx.get(m.n2)!];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    const ia = idx.get(m.n1)! * 3, ib = idx.get(m.n2)! * 3;
    return { kl: frameLocalK(m.E, m.A, m.I, L, m.G ?? 0, m.As ?? 0), T: frameT(dx / L, dy / L), map: [ia, ia + 1, ia + 2, ib, ib + 1, ib + 2], L };
  });

  const Fref = new Float64Array(ndof);
  let totalLateral = 0;
  for (const ld of refLoads) { const b = (idx.get(ld.node) ?? 0) * 3; Fref[b] += ld.fx ?? 0; Fref[b + 1] += ld.fy ?? 0; totalLateral += ld.fx ?? 0; }

  const fixed = new Set<number>();
  for (const sp of supports) { const b = (idx.get(sp.node) ?? 0) * 3; if (sp.ux) fixed.add(b); if (sp.uy) fixed.add(b + 1); if (sp.rz) fixed.add(b + 2); }

  const hinged = members.map(() => [false, false]);   // [end1, end2]
  const Mcur = members.map(() => [0, 0]);              // accumulated end moments
  const cDof = (idx.get(controlNode) ?? 0) * 3;        // control = ux
  let lambda = 0, disp = 0;
  const curve: CapacityPoint[] = [{ disp: 0, baseShear: 0, hinges: 0 }];
  let mechanism = false;
  const maxSteps = inp.maxSteps ?? (members.length * 2 + 4);

  for (let step = 0; step < maxSteps; step++) {
    // assemble with current hinges
    const K = new Float64Array(ndof * ndof);
    geom.forEach((g, i) => {
      const rel = ROT.filter((_, e) => hinged[i][e]);
      const kl = rel.length ? condense(g.kl, rel) : g.kl;
      const kg = matMul(matMul(transpose(g.T), kl), g.T);
      scatter(K, ndof, kg, g.map);
    });
    const Fs = Fref.slice();
    for (const dof of fixed) { K[dof * ndof + dof] += 1e30; Fs[dof] = 0; }
    let d: Float64Array;
    try { d = solve(K, ndof, Fs); } catch { mechanism = true; break; }
    const dCtrlRef = d[cDof];
    if (!isFinite(dCtrlRef) || Math.abs(dCtrlRef) > 1e9) { mechanism = true; break; }

    // member-end moments per unit reference load (with condensation recovery)
    const endM: { mem: number; end: number; m: number }[] = [];
    geom.forEach((g, i) => {
      const dl = matVec(g.T, g.map.map(gi => d[gi]));
      // recover released rotations so f at released end = 0
      for (const e of [0, 1]) if (hinged[i][e]) {
        const r = ROT[e], krr = g.kl[r][r];
        let s = 0; for (let j = 0; j < 6; j++) if (j !== r) s += g.kl[r][j] * dl[j];
        dl[r] = -s / krr;
      }
      const fl = matVec(g.kl, dl);
      if (!hinged[i][0]) endM.push({ mem: i, end: 0, m: fl[2] });
      if (!hinged[i][1]) endM.push({ mem: i, end: 1, m: fl[5] });
    });
    if (!endM.length) { mechanism = true; break; }

    // smallest Δλ that brings some end to ±Mp
    let dLam = Infinity, gov = endM[0];
    for (const em of endM) {
      const rate = em.m;                     // moment per unit λ
      if (Math.abs(rate) < 1e-9) continue;
      const cur = Mcur[em.mem][em.end];
      const cap = rate > 0 ? Mp - cur : -Mp - cur;
      const dl = cap / rate;
      if (dl > 1e-9 && dl < dLam) { dLam = dl; gov = em; }
    }
    if (!isFinite(dLam)) { mechanism = true; break; }

    lambda += dLam; disp += dLam * dCtrlRef;
    for (const em of endM) Mcur[em.mem][em.end] += dLam * em.m;
    hinged[gov.mem][gov.end] = true;
    const baseShear = lambda * totalLateral;
    curve.push({ disp: Math.abs(disp), baseShear, hinges: hinged.flat().filter(Boolean).length });
  }

  const Vmax = Math.max(...curve.map(p => p.baseShear));
  return Object.freeze({
    curve: Object.freeze(curve), Vmax, dispMax: curve[curve.length - 1].disp,
    nHinges: hinged.flat().filter(Boolean).length, mechanism,
  });
}
