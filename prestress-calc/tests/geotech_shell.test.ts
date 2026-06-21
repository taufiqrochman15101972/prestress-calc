import { describe, test, expect } from "vitest";
import { infiniteSlopeFS, slopeSlicesFS } from "@/engine/slopestability";
import { designShellReinf } from "@/engine/shellreinf";
import { umatLinear, umatHognestad, umatElastoPlastic, computeUmatCurve } from "@/engine/umat";

describe("Slope stability (MIDAS GTS theme, MD482)", () => {
  test("infinite cohesionless slope: FS = tanφ/tanβ", () => {
    const fs = infiniteSlopeFS({ c: 0, phi: 30, gamma: 18, z: 3, beta: 20, seepage: false });
    expect(fs).toBeCloseTo(Math.tan(30 * Math.PI / 180) / Math.tan(20 * Math.PI / 180), 3);
  });
  test("seepage reduces FS by ~γ'/γ", () => {
    const dry = infiniteSlopeFS({ c: 0, phi: 30, gamma: 18, z: 3, beta: 20, seepage: false });
    const wet = infiniteSlopeFS({ c: 0, phi: 30, gamma: 18, z: 3, beta: 20, seepage: true, gammaW: 9.81 });
    expect(wet / dry).toBeCloseTo((18 - 9.81) / 18, 2);
  });
  test("circular slices: valid, Bishop ≥ Fellenius, FS>0", () => {
    const r = slopeSlicesFS({ H: 10, beta: 30, c: 20, phi: 20, gamma: 18, ru: 0, xc: 10, yc: 16, R: 18 });
    expect(r.valid).toBe(true);
    expect(r.FS_bishop).toBeGreaterThan(0);
    expect(r.FS_bishop).toBeGreaterThanOrEqual(r.FS_fellenius - 0.05);
  });
  test("lower cohesion → lower FS", () => {
    const hi = slopeSlicesFS({ H: 10, beta: 30, c: 40, phi: 20, gamma: 18, ru: 0, xc: 10, yc: 16, R: 18 });
    const lo = slopeSlicesFS({ H: 10, beta: 30, c: 10, phi: 20, gamma: 18, ru: 0, xc: 10, yc: 16, R: 18 });
    expect(lo.FS_bishop).toBeLessThan(hi.FS_bishop);
  });
});

describe("UMAT user-material (MIDAS USSR / ABAQUS UMAT, file 255)", () => {
  test("linear: σ=E·ε, Et=E", () => {
    const m = umatLinear(200000);
    expect(m(0.001).sigma).toBeCloseTo(200, 6);
    expect(m(0.001).Et).toBeCloseTo(200000, 6);
  });
  test("Hognestad concrete: peak ≈ f'c at ε0, zero past crushing", () => {
    const m = umatHognestad(30, 0.002, 0.0038);
    expect(m(0.002).sigma).toBeCloseTo(30, 4);
    expect(m(0.005).sigma).toBeCloseTo(0, 6);
    const c = computeUmatCurve(m, 0.004, 80);
    expect(Math.abs(c.peak - 30)).toBeLessThan(0.5);
    expect(c.epsAtPeak).toBeCloseTo(0.002, 3);
  });
  test("elasto-plastic steel: elastic then yields fy; hardening Eh", () => {
    const m = umatElastoPlastic(200000, 420, 0);
    expect(m(420 / 200000 / 2).Et).toBeCloseTo(200000, 6);   // elastic
    expect(m(0.01).sigma).toBeCloseTo(420, 6);               // yielded
    expect(m(0.01).Et).toBeCloseTo(0, 6);
    const mh = umatElastoPlastic(200000, 420, 2000);
    expect(mh(0.01).sigma).toBeGreaterThan(420);             // hardening
  });
});

describe("Shell reinforcement design (IASS sandwich, 253)", () => {
  test("pure tension nx → As split both faces = nx/fy", () => {
    const r = designShellReinf({ nx: 1000, ny: 0, nxy: 0, mx: 0, my: 0, mxy: 0, t: 200, cover: 30, fy: 400 });
    expect(r.AsxTotal).toBeCloseTo(1000 / 400 * 1000, 0);
    expect(r.AsyTotal).toBeCloseTo(0, 6);
  });
  test("pure bending mx → tension face only", () => {
    const r = designShellReinf({ nx: 0, ny: 0, nxy: 0, mx: 1e6, my: 0, mxy: 0, t: 200, cover: 30, fy: 400 });
    expect(r.bottom.Asx).toBeGreaterThan(0);
    expect(r.top.Asx).toBeCloseTo(0, 6);
  });
  test("twisting nxy adds steel both directions", () => {
    const r = designShellReinf({ nx: 200, ny: 200, nxy: 300, mx: 0, my: 0, mxy: 0, t: 200, cover: 30, fy: 400 });
    expect(r.AsxTotal).toBeGreaterThan(0);
    expect(r.AsyTotal).toBeGreaterThan(0);
  });
});
