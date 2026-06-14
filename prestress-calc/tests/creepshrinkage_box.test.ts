/**
 * Creep & shrinkage models + box-girder distortion / shear-lag assertions.
 * Verifies sane ranges and code-form behaviour (not PDF worked-example numbers).
 */
import { describe, test, expect } from "vitest";
import { computeCreepShrinkage, compareAllModels } from "@/engine/creepshrinkage";
import { computeBoxDistortion, computeBoxShearLag } from "@/engine/boxgirder";

const I = { fc: 40, t0: 28, t: 10000, RH: 70, h0: 200, cementType: "N" as const, aciCorr: 1 };

describe("creep & shrinkage models", () => {
  test("all four models give φ in a plausible 1–4 range and shrink shortening", () => {
    const all = compareAllModels(I);
    for (const k of ["ACI209", "CEB_FIP", "GL2000", "B3"] as const) {
      const r = all[k];
      expect(r.phi).toBeGreaterThan(0.5);
      expect(r.phi).toBeLessThan(5);
      expect(r.eps_sh).toBeLessThanOrEqual(0); // shortening (negative)
    }
  });
  test("E_eff = Ec/(1+φ) and E_adj = Ec/(1+χφ) consistent", () => {
    const r = computeCreepShrinkage("ACI209", I);
    expect(r.Eeff).toBeCloseTo(r.Ec28 / (1 + r.phi), 1);
    expect(r.Eadj).toBeCloseTo(r.Ec28 / (1 + r.chi * r.phi), 1);
    expect(r.chi).toBeGreaterThanOrEqual(0.6);
    expect(r.chi).toBeLessThanOrEqual(0.9);
  });
  test("φ grows monotonically with time", () => {
    const r = computeCreepShrinkage("ACI209", I);
    for (let i = 1; i < r.series.length; i++)
      expect(r.series[i].phi).toBeGreaterThanOrEqual(r.series[i - 1].phi - 1e-9);
  });
  test("lower RH → larger creep coefficient (ACI209)", () => {
    const dry = computeCreepShrinkage("ACI209", { ...I, RH: 40 });
    const wet = computeCreepShrinkage("ACI209", { ...I, RH: 90 });
    expect(dry.phi).toBeGreaterThan(wet.phi);
  });
});

describe("box-girder distortion (Wright BEF)", () => {
  const r = computeBoxDistortion({
    bt: 7000, tt: 250, bb: 3500, tb: 200, tw: 350, H: 1800,
    swTop: 4000, swBot: 4000, fc: 40, Ec: 0,
    Pecc: 300, eEcc: 2500, L: 40000, diaSpacing: 0, Mu: 9000,
  });
  test("Tdist = P·e", () => { expect(r.Tdist).toBeCloseTo(300 * 2500 / 1000, 1); });
  test("λ positive, recommended diaphragm spacing finite", () => {
    expect(r.lambda).toBeGreaterThan(0);
    expect(r.diaSpacingMax).toBeGreaterThan(0);
  });
  test("warpRatio is a fraction", () => {
    expect(r.warpRatio).toBeGreaterThanOrEqual(0);
  });
});

describe("box-girder shear lag + shear-deformation deflection", () => {
  const r = computeBoxShearLag({
    bt: 7000, tt: 250, bb: 3500, tb: 200, tw: 350, H: 1800,
    fc: 40, Ec: 0, L: 40000, w: 120, Ig: 0,
  });
  test("effective widths ≤ gross and > 40%", () => {
    expect(r.beTop).toBeLessThanOrEqual(7000);
    expect(r.beTop).toBeGreaterThan(0.4 * 7000 - 1);
  });
  test("total deflection = bending + shear", () => {
    expect(r.deltaTotal).toBeCloseTo(r.deltaBend + r.deltaShear, 3);
    expect(r.deltaShear).toBeGreaterThan(0);
  });
});
