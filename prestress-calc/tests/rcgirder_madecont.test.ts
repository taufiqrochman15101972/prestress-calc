import { describe, it, expect } from "vitest";
import { computeRCGirder } from "../src/engine/rcgirder";
import { computeMadeContinuous } from "../src/engine/madecontinuous";

describe("RC T-beam bridge girder (Bina Marga Balok-T, book 152)", () => {
  const base = {
    L: 20, S: 1.75, hf: 200, bw: 400, H: 1300, d: 1210,
    fc: 30, fy: 420, tAsphalt: 50, wSdl: 1.0, gammaC: 24,
    As: 6433, Asp: 0, dp: 60, gLL: 0.85,
  };

  it("effective flange width = min of the three rules", () => {
    const r = computeRCGirder(base);
    // L/4 = 5000, S = 1750, bw+16hf = 400+3200 = 3600 → min = 1750
    expect(r.beff).toBeCloseTo(1750, 0);
  });

  it("dead + live loads positive and factored Mu/Vu sensible", () => {
    const r = computeRCGirder(base);
    expect(r.wDC).toBeGreaterThan(0);
    expect(r.Mlive).toBeGreaterThan(0);
    expect(r.Mu).toBeGreaterThan(r.Mlive);
    expect(r.Vu).toBeGreaterThan(0);
  });

  it("flexural capacity with strain-controlled phi in [0.65,0.90]", () => {
    const r = computeRCGirder(base);
    expect(r.phi).toBeGreaterThanOrEqual(0.65);
    expect(r.phi).toBeLessThanOrEqual(0.90);
    expect(r.Mn).toBeGreaterThan(0);
    expect(r.phiMn).toBeCloseTo(r.phi * r.Mn, 6);
  });

  it("As,min uses governing 1.4/fy or 0.25√fc/fy rule", () => {
    const r = computeRCGirder(base);
    const m1 = (0.25 * Math.sqrt(30) / 420) * 400 * 1210;
    const m2 = (1.4 / 420) * 400 * 1210;
    expect(r.AsMin).toBeCloseTo(Math.max(m1, m2), 0);
  });

  it("Vc = 0.17√fc·bw·d (kN) and shear capacity screen", () => {
    const r = computeRCGirder(base);
    expect(r.Vc).toBeCloseTo(0.17 * Math.sqrt(30) * 400 * 1210 / 1000, 1);
    expect(typeof r.shearOk).toBe("boolean");
  });

  it("very large As triggers true-T behaviour (a > hf)", () => {
    const r = computeRCGirder({ ...base, As: 30000 });
    expect(r.isTrueT).toBe(true);
    expect(r.a).toBeGreaterThan(base.hf);
  });
});

describe("Made-continuous precast girder restraint (NCHRP 322, book 147/148)", () => {
  const base = {
    nSpans: 2 as const, L: 30000, fc: 40, Ic: 3.729e11, Pe: 4500, eDrape: 650,
    wSelf: 14, phi: 2.0, Msh: 180, fcDeck: 30, Zconn: 3.0e7, fy: 420, jd: 1500,
  };

  it("prestress gives positive, self-weight negative continuity moment", () => {
    const r = computeMadeContinuous(base);
    expect(r.MpCont).toBeGreaterThan(0);
    expect(r.MgCont).toBeLessThan(0);
  });

  it("creep factor (1−e^−φ) and shrinkage kernel (1−e^−φ)/φ", () => {
    const r = computeMadeContinuous(base);
    expect(r.creepFactor).toBeCloseTo(1 - Math.exp(-2.0), 6);
    expect(r.shFactor).toBeCloseTo((1 - Math.exp(-2.0)) / 2.0, 6);
  });

  it("differential shrinkage relieves the positive restraint", () => {
    const withSh = computeMadeContinuous(base);
    const noSh = computeMadeContinuous({ ...base, Msh: 0 });
    expect(withSh.Mr).toBeLessThan(noSh.Mr);
  });

  it("positive-moment connection design >= 1.2 Mcr", () => {
    const r = computeMadeContinuous(base);
    expect(r.MconnReq).toBeGreaterThanOrEqual(1.2 * r.Mcr - 1e-6);
    expect(r.AsConn).toBeGreaterThan(0);
  });

  it("connection capacity check is satisfied for the demo bars", () => {
    const r = computeMadeContinuous(base);
    expect(r.connectionOk).toBe(true);
  });
});
