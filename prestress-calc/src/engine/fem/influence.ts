/**
 * fem/influence.ts — Influence-line & MOVING-LOAD analysis (MIDAS-style, MD(1)).
 * A unit load traverses the beam; for each position the FEM model is solved and
 * a target response (left reaction, mid-span moment, mid-span shear) is read →
 * the influence line. A moving vehicle (axle loads + spacings) is then slid
 * across and the response envelope (max/min + critical position) is extracted —
 * the MIDAS/Robot moving-load post-processing, built on our own FEM solver.
 *
 * Units SI: L mm, EI via E·I, loads N, response: reaction N, moment N·mm.
 */
import { solveFrame, type FrameModel } from "./frame";

export interface InfluenceInputs {
  spans: 1 | 2;          // single or two equal continuous spans
  L: number;             // each span length, mm
  E: number; A: number; I: number;
  perSpan?: number;      // elements per span (default 10)
  axles?: { P: number; dx: number }[];   // moving vehicle (P at offset dx from lead), N & mm
}
export interface InfluencePoint { x: number; R0: number; Mmid: number; Vmid: number; }
export interface InfluenceResult {
  readonly line: ReadonlyArray<InfluencePoint>;   // ordinates per unit downward load
  readonly Ltot: number; readonly midX: number;
  readonly env: {                                  // moving-vehicle envelope
    readonly MmidMax: number; readonly MmidMin: number; readonly MmidAtMm: number;
    readonly R0Max: number; readonly VmidMax: number; readonly VmidMin: number;
  };
}

export function computeInfluenceLine(i: InfluenceInputs): InfluenceResult {
  const nSpan = i.spans, per = i.perSpan ?? 10, L = i.L;
  const Ltot = nSpan * L;
  const nNode = nSpan * per + 1;
  const nodes = Array.from({ length: nNode }, (_, k) => ({ id: k + 1, x: (Ltot * k) / (nNode - 1), y: 0 }));
  const members = Array.from({ length: nNode - 1 }, (_, k) => ({ id: k + 1, n1: k + 1, n2: k + 2, E: i.E, A: i.A, I: i.I }));
  // supports at span boundaries (roller), left also pinned
  const supNodesX = Array.from({ length: nSpan + 1 }, (_, s) => s * L);
  const supports = nodes.filter(n => supNodesX.some(sx => Math.abs(n.x - sx) < 1e-6)).map((n, idx) => ({
    node: n.id, ux: idx === 0, uy: true, rz: false,
  }));
  const midNode = nodes.reduce((best, n) => Math.abs(n.x - L / 2) < Math.abs(best.x - L / 2) ? n : best, nodes[0]);
  const leftSup = supports[0].node;
  const midMemberLeft = members.find(m => m.n2 === midNode.id)!;   // moment at mid = its M2

  const line: InfluencePoint[] = [];
  for (const nd of nodes) {
    const model: FrameModel = {
      nodes, members, supports,
      nodalLoads: [{ node: nd.id, fy: -1 }], memberLoads: [],
    };
    const r = solveFrame(model);
    const R0 = r.reactions.find(x => x.node === leftSup)?.fy ?? 0;
    const mf = r.members.find(m => m.id === midMemberLeft.id)!;
    line.push({ x: nd.x, R0, Mmid: mf.M2, Vmid: mf.V2 });
  }

  // moving vehicle envelope: slide axle group, response = Σ P·IL(x_axle)
  const axles = i.axles && i.axles.length ? i.axles : [{ P: 1, dx: 0 }];
  const il = (x: number, key: "R0" | "Mmid" | "Vmid") => {
    if (x < 0 || x > Ltot) return 0;
    let lo = line[0], hi = line[line.length - 1];
    for (let k = 1; k < line.length; k++) if (line[k].x >= x) { hi = line[k]; lo = line[k - 1]; break; }
    const t = (x - lo.x) / Math.max(hi.x - lo.x, 1e-9);
    return lo[key] + (hi[key] - lo[key]) * t;
  };
  let MmidMax = -Infinity, MmidMin = Infinity, MmidAtMm = 0, R0Max = -Infinity, VmidMax = -Infinity, VmidMin = Infinity;
  const step = Ltot / 200;
  for (let lead = 0; lead <= Ltot; lead += step) {
    let M = 0, R = 0, V = 0;
    for (const ax of axles) { const xp = lead - ax.dx; M += ax.P * il(xp, "Mmid"); R += ax.P * il(xp, "R0"); V += ax.P * il(xp, "Vmid"); }
    if (M > MmidMax) { MmidMax = M; MmidAtMm = lead; }
    if (M < MmidMin) MmidMin = M;
    R0Max = Math.max(R0Max, R); VmidMax = Math.max(VmidMax, V); VmidMin = Math.min(VmidMin, V);
  }

  return Object.freeze({
    line: Object.freeze(line), Ltot, midX: midNode.x,
    env: { MmidMax, MmidMin, MmidAtMm, R0Max, VmidMax, VmidMin },
  });
}
