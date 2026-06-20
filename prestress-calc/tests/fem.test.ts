import { describe, test, expect } from "vitest";
import { solveFrame, frameLocalK, type FrameModel } from "@/engine/fem/frame";
import { linearRepeat, mirror, rotateCopy } from "@/engine/fem/model";
import { membraneK, plateK, flatShellK } from "@/engine/fem/shell";
import { computeBeamFieldsFEM } from "@/engine/fem/beamfields";
import { computeBeamFields, type BeamFieldInputs } from "@/engine/internalforces";
import { solvePlate } from "@/engine/fem/plate";
import { solveFrame3D, type Frame3DModel } from "@/engine/fem/frame3d";
import { computeStrainCompatibility, type SteelLayer } from "@/engine/straincompat";
import { computeInfluenceLine } from "@/engine/fem/influence";

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

describe("📊 fields via FEM solver ≈ closed-form", () => {
  const fin: BeamFieldInputs = {
    L: 30000, EI: 200000 * 1.77e11, EIlat: 200000 * 1e10,
    wUDL: 30, Pmid: 0, wBal: 18, Plong: 4_500_000, e: 650,
    A: 535000, Ig: 1.77e11, yb: 770, yt: 880, Tu: 0, wLat: 0, Naxial: 0, samples: 81,
  };
  test("max |Mz| and mid deflection match within 2%", () => {
    const fem = computeBeamFieldsFEM(fin);
    const cf = computeBeamFields(fin);
    const maxM = (r: typeof fem) => Math.max(...r.pts.map(p => Math.abs(p.Mz)));
    expect(Math.abs(maxM(fem) - maxM(cf)) / maxM(cf)).toBeLessThan(0.02);
    const minDz = (r: typeof fem) => Math.min(...r.pts.map(p => p.dz));
    expect(Math.abs(minDz(fem) - minDz(cf)) / Math.abs(minDz(cf))).toBeLessThan(0.02);
  });
  test("axial N carried as prestress compression", () => {
    const fem = computeBeamFieldsFEM(fin);
    expect(fem.pts[10].N).toBeCloseTo(-fin.Plong, 3);
  });
});

describe("3D space frame (#3) — closed-form validation", () => {
  const E3 = 200000, G3 = 80000, A3 = 80000, Iy3 = 1.067e9, Iz3 = 2.5e9, J3 = 1.5e9;
  const mk = (loads: Frame3DModel["loads"]): Frame3DModel => ({
    nodes: [{ id: 1, x: 0, y: 0, z: 0 }, { id: 2, x: 5000, y: 0, z: 0 }],
    members: [{ id: 1, n1: 1, n2: 2, E: E3, G: G3, A: A3, Iy: Iy3, Iz: Iz3, J: J3 }],
    supports: [{ node: 1, dofs: [true, true, true, true, true, true] }],
    loads,
  });
  const L = 5000, P = 10000;
  test("cantilever load in Y: uy = −PL³/3EIz", () => {
    const r = solveFrame3D(mk([{ node: 2, fy: -P }]));
    expect(r.disp[1].uy).toBeCloseTo(-(P * L ** 3) / (3 * E3 * Iz3), 2);
  });
  test("cantilever load in Z: uz = −PL³/3EIy", () => {
    const r = solveFrame3D(mk([{ node: 2, fz: -P }]));
    expect(r.disp[1].uz).toBeCloseTo(-(P * L ** 3) / (3 * E3 * Iy3), 2);
  });
  test("axial: ux = PL/EA", () => {
    const r = solveFrame3D(mk([{ node: 2, fx: P }]));
    expect(r.disp[1].ux).toBeCloseTo((P * L) / (E3 * A3), 4);
  });
  test("torsion: rx = T·L/GJ", () => {
    const Tq = 5e6;
    const r = solveFrame3D(mk([{ node: 2, mx: Tq }]));
    expect(r.disp[1].rx).toBeCloseTo((Tq * L) / (G3 * J3), 4);
  });
  test("vertical column carries axial along global Z", () => {
    const m: Frame3DModel = {
      nodes: [{ id: 1, x: 0, y: 0, z: 0 }, { id: 2, x: 0, y: 0, z: 4000 }],
      members: [{ id: 1, n1: 1, n2: 2, E: E3, G: G3, A: A3, Iy: Iy3, Iz: Iz3, J: J3 }],
      supports: [{ node: 1, dofs: [true, true, true, true, true, true] }],
      loads: [{ node: 2, fz: -P }],
    };
    const r = solveFrame3D(m);
    expect(r.disp[1].uz).toBeCloseTo(-(P * 4000) / (E3 * A3), 4);
  });
});

describe("Strain-compatibility ULS (Naaman) — full & partial", () => {
  const psLayer: SteelLayer = { kind: "PS", A: 3553, d: 1500, Eps: 197000, fpu: 1860, fpy: 1674, epsPE: 1150 / 197000 };
  test("full prestressed: equilibrium converges, tension-controlled, f_ps ≤ f_pu", () => {
    const r = computeStrainCompatibility({ b: 600, h: 1650, fc: 50, layers: [psLayer] });
    expect(r.converged).toBe(true);
    expect(r.c).toBeGreaterThan(0);
    expect(r.c).toBeLessThan(1650);
    expect(Math.abs(r.Cc - r.layers.reduce((s, l) => s + l.force, 0))).toBeLessThan(50); // ΣT = Cc
    expect(r.layers[0].stress).toBeLessThanOrEqual(1860 + 1e-6);
    expect(r.phiMn).toBeGreaterThan(0);
  });
  test("adding mild steel (partial) raises M_n", () => {
    const full = computeStrainCompatibility({ b: 600, h: 1650, fc: 50, layers: [psLayer] });
    const partial = computeStrainCompatibility({ b: 600, h: 1650, fc: 50, layers: [psLayer, { kind: "RC", A: 2000, d: 1560, Es: 200000, fy: 420 }] });
    expect(partial.Mn).toBeGreaterThan(full.Mn);
  });
});

describe("Influence line / moving load (MIDAS-style, MD1)", () => {
  const L = 30000;
  const r = computeInfluenceLine({ spans: 1, L, E: 200000, A: 535000, I: 1.77e11, perSpan: 12 });
  test("R_left influence: 1 at left support, ~0.5 at mid, 0 at right", () => {
    expect(r.line[0].R0).toBeCloseTo(1, 2);
    expect(r.line[r.line.length - 1].R0).toBeCloseTo(0, 2);
    const mid = r.line.reduce((b, p) => Math.abs(p.x - L / 2) < Math.abs(b.x - L / 2) ? p : b);
    expect(mid.R0).toBeCloseTo(0.5, 2);
  });
  test("M_mid influence peaks ≈ L/4 with unit load at mid", () => {
    const mid = r.line.reduce((b, p) => Math.abs(p.x - L / 2) < Math.abs(b.x - L / 2) ? p : b);
    expect(Math.abs(mid.Mmid)).toBeCloseTo(L / 4, -1);
  });
  test("moving 2-axle vehicle gives a positive mid-moment envelope", () => {
    const rv = computeInfluenceLine({ spans: 1, L, E: 200000, A: 535000, I: 1.77e11, perSpan: 12, axles: [{ P: 145000, dx: 0 }, { P: 145000, dx: 4300 }] });
    expect(Math.abs(rv.env.MmidMax)).toBeGreaterThan(0);
  });
});

describe("Plate FEM solve (meshing) vs thin-plate theory", () => {
  test("SS square plate central deflection within ~15% of theory (coarse mesh)", () => {
    const r = solvePlate({ a: 4000, b: 4000, nx: 10, ny: 10, t: 200, E: 25000, nu: 0.3, q: 0.01, edge: "SS" });
    expect(r.ratio).toBeGreaterThan(0.85);
    expect(r.ratio).toBeLessThan(1.15);
    expect(r.centerW).toBeLessThan(0);   // downward
  });
  test("clamped plate deflects less than simply-supported", () => {
    const ss = solvePlate({ a: 4000, b: 4000, nx: 8, ny: 8, t: 200, E: 25000, nu: 0.3, q: 0.01, edge: "SS" });
    const cl = solvePlate({ a: 4000, b: 4000, nx: 8, ny: 8, t: 200, E: 25000, nu: 0.3, q: 0.01, edge: "CLAMPED" });
    expect(Math.abs(cl.centerW)).toBeLessThan(Math.abs(ss.centerW));
  });
  test("thin plate does NOT lock (t/a=1/200 still converges near theory)", () => {
    const r = solvePlate({ a: 4000, b: 4000, nx: 10, ny: 10, t: 20, E: 25000, nu: 0.3, q: 0.0001, edge: "SS" });
    expect(r.ratio).toBeGreaterThan(0.8);   // no shear locking → not stiff/near-zero
    expect(r.ratio).toBeLessThan(1.2);
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
