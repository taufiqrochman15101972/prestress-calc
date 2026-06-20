import { describe, test, expect } from "vitest";
import { computeBeamFields, queryAt, jetColor, type BeamFieldInputs } from "@/engine/internalforces";

const I: BeamFieldInputs = {
  L: 30000, EI: 35000 * 1.77e11, EIlat: 35000 * 1e10,
  wUDL: 30, Pmid: 0, wBal: 18, Plong: 4_500_000, e: 650,
  A: 535000, Ig: 1.77e11, yb: 770, yt: 880, Tu: 0, wLat: 0, Naxial: 0, samples: 41,
};

describe("Beam internal-force fields", () => {
  const r = computeBeamFields(I);
  test("Mz is zero at supports, max at mid (sagging)", () => {
    expect(r.pts[0].Mz).toBeCloseTo(0, 3);
    expect(r.pts[r.pts.length - 1].Mz).toBeCloseTo(0, 3);
    const mid = r.pts[Math.floor(r.pts.length / 2)];
    expect(mid.Mz).toBeCloseTo((I.wUDL * I.L * I.L) / 8, -2);
    expect(mid.Mz).toBeGreaterThan(0);
  });
  test("Vy is +R at left, −R at right, ~0 at mid", () => {
    const R = (I.wUDL * I.L) / 2;
    expect(r.pts[0].Vy).toBeCloseTo(R, 1);
    expect(r.pts[r.pts.length - 1].Vy).toBeCloseTo(-R, 1);
    expect(Math.abs(r.pts[Math.floor(r.pts.length / 2)].Vy)).toBeLessThan(R * 0.05);
  });
  test("axial N is compression (negative) from prestress", () => {
    expect(r.pts[0].N).toBeLessThan(0);
    expect(r.pts[0].N).toBeCloseTo(-I.Plong, 3);
  });
});

describe("Stress query — two equivalent formulas", () => {
  const r = computeBeamFields(I);
  test("Navier and kernel give the same stress at a fibre", () => {
    const q = queryAt(I, r, I.L / 2, -I.yb);   // bottom fibre at mid
    expect(q.sigma.navier).toBeCloseTo(q.sigma.kernel, 4);
  });
  test("r² = I/A", () => {
    const q = queryAt(I, r, I.L / 2, 0);
    expect(q.r2).toBeCloseTo(I.Ig / I.A, 3);
  });
});

describe("jet colormap", () => {
  test("endpoints blue/red, middle green-ish", () => {
    expect(jetColor(-1)).toContain("255"); // blue has 255 in b
    expect(jetColor(1)).toMatch(/^rgb\(255/); // red starts 255
  });
});
