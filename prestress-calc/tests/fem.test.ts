import { describe, test, expect } from "vitest";
import { solveFrame, frameLocalK, type FrameModel } from "@/engine/fem/frame";
import { linearRepeat, mirror, rotateCopy } from "@/engine/fem/model";
import { membraneK, plateK, flatShellK } from "@/engine/fem/shell";

const E = 200000, b = 200, h = 400, A = b * h, I = (b * h ** 3) / 12;

function mkBeam(nodesX: number[], y = 0) {
  const nodes = nodesX.map((x, i) => ({ id: i + 1, x, y }));
  const members = nodesX.slice(1).map((_, i) => ({ id: i + 1, n1: i + 1, n2: i + 2, E, A, I }));
  return { nodes, members };
}

describe("Frame FEM — closed-form validation", () => {
  test("cantilever tip load: δ = P·L³/3EI", () => {
    const L = 5000, P = 10000;
    const { nodes, members } = mkBeam([0, L]);
    const model: FrameModel = {
      nodes, members,
      supports: [{ node: 1, ux: true, uy: true, rz: true }],
      nodalLoads: [{ node: 2, fy: -P }], memberLoads: [],
    };
    const r = solveFrame(model);
    const tip = r.disp.find(d => d.node === 2)!;
    const exact = -(P * L ** 3) / (3 * E * I);
    expect(tip.uy).toBeCloseTo(exact, 2);
  });

  test("simply-supported central load: δ_mid = P·L³/48EI, M_mid = P·L/4", () => {
    const L = 6000, P = 20000;
    const { nodes, members } = mkBeam([0, L / 2, L]);
    const model: FrameModel = {
      nodes, members,
      supports: [{ node: 1, ux: true, uy: true, rz: false }, { node: 3, ux: false, uy: true, rz: false }],
      nodalLoads: [{ node: 2, fy: -P }], memberLoads: [],
    };
    const r = solveFrame(model);
    const mid = r.disp.find(d => d.node === 2)!;
    expect(mid.uy).toBeCloseTo(-(P * L ** 3) / (48 * E * I), 1);
    const Mmid = Math.max(...r.members.flatMap(m => m.samples.map(s => Math.abs(s.M))));
    expect(Mmid).toBeCloseTo((P * L) / 4, -1);
  });

  test("simply-supported UDL: δ_mid = 5wL⁴/384EI", () => {
    const L = 6000, w = 30;   // N/mm
    const xs = [0, 1500, 3000, 4500, 6000];
    const nodes = xs.map((x, i) => ({ id: i + 1, x, y: 0 }));
    const members = xs.slice(1).map((_, i) => ({ id: i + 1, n1: i + 1, n2: i + 2, E, A, I }));
    const model: FrameModel = {
      nodes, members,
      supports: [{ node: 1, ux: true, uy: true, rz: false }, { node: 5, ux: false, uy: true, rz: false }],
      nodalLoads: [], memberLoads: members.map(m => ({ member: m.id, w: -w })),
    };
    const r = solveFrame(model);
    const mid = r.disp.find(d => d.node === 3)!;
    expect(mid.uy).toBeCloseTo(-(5 * w * L ** 4) / (384 * E * I), 0);
  });

  test("axial bar: elongation = P·L/EA", () => {
    const L = 4000, P = 50000;
    const { nodes, members } = mkBeam([0, L]);
    const model: FrameModel = {
      nodes, members, supports: [{ node: 1, ux: true, uy: true, rz: true }],
      nodalLoads: [{ node: 2, fx: P }], memberLoads: [],
    };
    const r = solveFrame(model);
    expect(r.disp.find(d => d.node === 2)!.ux).toBeCloseTo((P * L) / (E * A), 4);
  });

  test("local stiffness symmetric", () => {
    const k = frameLocalK(E, A, I, 3000);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) expect(k[i][j]).toBeCloseTo(k[j][i], 6);
  });
});

describe("Pre-processor copy methods", () => {
  const base: FrameModel = {
    ...mkBeam([0, 3000]),
    supports: [], nodalLoads: [], memberLoads: [],
  };
  test("linearRepeat adds copies & merges coincident nodes", () => {
    const r = linearRepeat(base, [1], 3000, 0, 2);
    expect(r.members.length).toBe(3);          // original + 2 copies
    expect(r.nodes.length).toBe(4);            // 0,3000,6000,9000 (merged)
  });
  test("mirror reflects about a vertical axis", () => {
    const r = mirror(base, [1], "V", 3000);
    expect(r.members.length).toBe(2);
    expect(r.nodes.some(n => Math.abs(n.x - 6000) < 1e-6)).toBe(true);
  });
  test("rotateCopy makes a circular pattern", () => {
    const r = rotateCopy(base, [1], 0, 0, 90, 3);
    expect(r.members.length).toBe(4);
  });
});

describe("Flat shell — membrane & plate (shear-locking-free)", () => {
  const x = [0, 1, 1, 0], y = [0, 0, 1, 1];   // unit square
  const nu = 0.3, t = 1;

  test("membrane: constant-strain εx=1 → energy = ½·E/(1−ν²)·A·t", () => {
    const k = membraneK(x, y, E, nu, t);
    const d = [0, 0, 1, 0, 1, 0, 0, 0];        // u = x (nodes at x=0→u0, x=1→u1)
    let en = 0; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) en += 0.5 * d[i] * k[i][j] * d[j];
    expect(en).toBeCloseTo(0.5 * (E / (1 - nu * nu)), 3);
  });

  test("plate: constant curvature κx=1 with ZERO shear (no locking) → energy = ½·D·A", () => {
    const D0 = (E * t ** 3) / (12 * (1 - nu * nu));
    const k = plateK(x, y, E, nu, t);
    // θx = x, θy = 0, w = x²/2  →  κx=1, γ=0
    const d: number[] = [];
    for (let i = 0; i < 4; i++) d.push(0.5 * x[i] * x[i], x[i], 0);
    let en = 0; for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) en += 0.5 * d[i] * k[i][j] * d[j];
    expect(en).toBeCloseTo(0.5 * D0, 3);       // pure bending, NO spurious shear energy
  });

  test("plate: pure translation rigid body → ~0 energy", () => {
    const k = plateK(x, y, E, nu, t);
    const d = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0];
    let en = 0; for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) en += d[i] * k[i][j] * d[j];
    expect(Math.abs(en)).toBeLessThan(1e-6 * k[0][0] + 1e-6);
  });

  test("flat shell 24×24 symmetric & finite", () => {
    const K = flatShellK(x, y, E, nu, t);
    expect(K.length).toBe(24);
    for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) expect(K[i][j]).toBeCloseTo(K[j][i], 4);
  });
});
