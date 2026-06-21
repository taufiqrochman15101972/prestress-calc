/**
 * benchmark.test.ts — FEM solver VERIFICATION against classical structural-theory
 * benchmarks (the standard "verification manual" cases any FE program must pass).
 * Each asserts the solver result equals the closed-form theory value.
 */
import { describe, test, expect } from "vitest";
import { solveFrame, type FrameModel } from "@/engine/fem/frame";
import { solveFramePDelta } from "@/engine/fem/pdelta";
import { computeModal2 } from "@/engine/seismicdynamics";

const E = 200000, A = 200000, I = 1e9;   // generic steel section

function beam(nNode: number, Ltot: number, supports: FrameModel["supports"], w: number): FrameModel {
  const nodes = Array.from({ length: nNode }, (_, k) => ({ id: k + 1, x: (Ltot * k) / (nNode - 1), y: 0 }));
  const members = nodes.slice(1).map((_, i) => ({ id: i + 1, n1: i + 1, n2: i + 2, E, A, I }));
  return { nodes, members, supports, nodalLoads: [], memberLoads: members.map(m => ({ member: m.id, w })) };
}

describe("Benchmark verification — FEM vs classical theory", () => {
  test("fixed-fixed beam UDL: δ_mid = wL⁴/384EI, M_end = wL²/12", () => {
    const L = 8000, w = -40;   // N/mm down
    const m = beam(9, L, [
      { node: 1, ux: true, uy: true, rz: true },
      { node: 9, ux: true, uy: true, rz: true },
    ], w);
    const r = solveFrame(m);
    const mid = r.disp.find(d => Math.abs((d.node - 1) * (L / 8) - L / 2) < 1)!;
    expect(Math.abs(mid.uy)).toBeCloseTo((Math.abs(w) * L ** 4) / (384 * E * I), 1);
    const Mend = Math.abs(r.members[0].M1);
    expect(Mend / 1e6).toBeCloseTo((Math.abs(w) * L * L / 12) / 1e6, 0);
  });

  test("propped cantilever UDL: prop reaction = 3wL/8", () => {
    const L = 6000, w = -30;
    const m = beam(9, L, [
      { node: 1, ux: true, uy: true, rz: true },
      { node: 9, ux: false, uy: true, rz: false },
    ], w);
    const r = solveFrame(m);
    const prop = r.reactions.find(x => x.node === 9)!.fy;
    expect(prop).toBeCloseTo((3 * Math.abs(w) * L) / 8, -1);
  });

  test("two-span continuous beam UDL: middle reaction = 1.25wL", () => {
    const L = 5000, w = -24;
    const nodes = Array.from({ length: 11 }, (_, k) => ({ id: k + 1, x: (2 * L * k) / 10, y: 0 }));
    const members = nodes.slice(1).map((_, i) => ({ id: i + 1, n1: i + 1, n2: i + 2, E, A, I }));
    const model: FrameModel = {
      nodes, members,
      supports: [
        { node: 1, ux: true, uy: true, rz: false },
        { node: 6, ux: false, uy: true, rz: false },
        { node: 11, ux: false, uy: true, rz: false },
      ],
      nodalLoads: [], memberLoads: members.map(m => ({ member: m.id, w })),
    };
    const r = solveFrame(model);
    const mid = r.reactions.find(x => x.node === 6)!.fy;
    expect(mid).toBeCloseTo(1.25 * Math.abs(w) * L, -1);
  });

  test("Euler buckling: P-Δ amplification ≈ 1/(1−P/Pcr) at P=0.5Pcr", () => {
    const L = 6000, NEL = 8;
    const Pcr = (Math.PI ** 2 * E * I) / (L * L);
    const xs = Array.from({ length: NEL + 1 }, (_, k) => (L * k) / NEL);
    const model: FrameModel = {
      nodes: xs.map((x, i) => ({ id: i + 1, x, y: 0 })),
      members: xs.slice(1).map((_, i) => ({ id: i + 1, n1: i + 1, n2: i + 2, E, A, I })),
      supports: [{ node: 1, ux: true, uy: true, rz: false }, { node: NEL + 1, ux: false, uy: true, rz: false }],
      nodalLoads: [{ node: NEL + 1, fx: -0.5 * Pcr }],
      memberLoads: xs.slice(1).map((_, i) => ({ member: i + 1, w: -2 })),
    };
    const r = solveFramePDelta(model);
    expect(Math.abs(r.amplification - 2.0) / 2.0).toBeLessThan(0.15);
  });
});

// ── MIDAS FEA Verification Manual cases (theory + cited reference) ──
describe("Benchmark — MIDAS Verification Manual cases", () => {
  test("Linear Buckling-B1 Case 1 (pin-roller) Pcr=π²EI/L² [Gere & Timoshenko Ch.11]", () => {
    const L = 6000, NEL = 8, Pcr = (Math.PI ** 2 * E * I) / (L * L);
    const xs = Array.from({ length: NEL + 1 }, (_, k) => (L * k) / NEL);
    const model: FrameModel = {
      nodes: xs.map((x, i) => ({ id: i + 1, x, y: 0 })),
      members: xs.slice(1).map((_, i) => ({ id: i + 1, n1: i + 1, n2: i + 2, E, A, I })),
      supports: [{ node: 1, ux: true, uy: true, rz: false }, { node: NEL + 1, ux: false, uy: true, rz: false }],
      nodalLoads: [{ node: NEL + 1, fx: -0.5 * Pcr }],
      memberLoads: xs.slice(1).map((_, i) => ({ member: i + 1, w: -2 })),
    };
    expect(Math.abs(solveFramePDelta(model).amplification - 2.0) / 2.0).toBeLessThan(0.15);
  });

  test("Linear Buckling-B1 Case 2 (fixed-free) Pcr=π²EI/4L² [Gere & Timoshenko Ch.11]", () => {
    const L = 6000, NEL = 8, Pcr = (Math.PI ** 2 * E * I) / (4 * L * L);
    const xs = Array.from({ length: NEL + 1 }, (_, k) => (L * k) / NEL);
    const model: FrameModel = {
      nodes: xs.map((x, i) => ({ id: i + 1, x, y: 0 })),
      members: xs.slice(1).map((_, i) => ({ id: i + 1, n1: i + 1, n2: i + 2, E, A, I })),
      supports: [{ node: 1, ux: true, uy: true, rz: true }],   // fixed-free cantilever
      nodalLoads: [{ node: NEL + 1, fx: -0.5 * Pcr }],
      memberLoads: xs.slice(1).map((_, i) => ({ member: i + 1, w: -1 })),
    };
    expect(Math.abs(solveFramePDelta(model).amplification - 2.0) / 2.0).toBeLessThan(0.15);
  });

  test("Eigenvalue 2-DOF (equal m,k) → golden-ratio ω² [Greenwood, MD191 method]", () => {
    const m = 2, k = 1000;   // K=[[2k,-k],[-k,k]], M=diag(m,m)
    const r = computeModal2({ m1: m, m2: m, k1: k, k2: k, Sa1: 0, Sa2: 0 });
    const w1 = (2 * Math.PI) / r.T1, w2 = (2 * Math.PI) / r.T2;
    expect(w1 * w1).toBeCloseTo(((3 - Math.sqrt(5)) / 2) * (k / m), 1);
    expect(w2 * w2).toBeCloseTo(((3 + Math.sqrt(5)) / 2) * (k / m), 0);
  });
});
