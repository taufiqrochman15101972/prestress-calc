import { describe, it, expect } from "vitest";
import {
  yieldLineRect, beamCollapse, effectivenessFactor, boundCharacter,
} from "../src/engine/limitanalysis";

// ASM library (Nielsen & Hoang, Johansen, plastic theory) = textbooks →
// procedure/formulas only. Assert exact closed-form limit-analysis identities.

describe("yield-line: rectangular slab (Johansen)", () => {
  it("simply-supported square slab → w_u = 24·m/L²", () => {
    const r = yieldLineRect({ Lx: 5, Ly: 5, m: 10 });
    expect(r.wu).toBeCloseTo(24 * 10 / 25, 6); // 9.6 kN/m²
    expect(r.kappa).toBeCloseTo(1, 6);
  });

  it("one-way limit (Ly ≫ Lx) → w_u → 8·m/Lx²", () => {
    const r = yieldLineRect({ Lx: 4, Ly: 4000000, m: 12 });
    expect(r.wu).toBeCloseTo(8 * 12 / 16, 3); // 6 kN/m²
  });

  it("all-edges fixed square (i=1) → w_u = 48·m/L²", () => {
    const r = yieldLineRect({ Lx: 6, Ly: 6, m: 15, i: 1 });
    expect(r.wu).toBeCloseTo(48 * 15 / 36, 5); // 20 kN/m²
  });

  it("fixed one-way strip (Ly≫Lx, i=1) → 16·m/Lx²", () => {
    const r = yieldLineRect({ Lx: 4, Ly: 4000000, m: 10, i: 1 });
    expect(r.wu).toBeCloseTo(16 * 10 / 16, 3); // 10 kN/m²
  });

  it("inverse: mRequired reproduces wu", () => {
    const r = yieldLineRect({ Lx: 5, Ly: 7, m: 20, i: 0.5 });
    expect(r.mRequired(r.wu)).toBeCloseTo(20, 6);
  });

  it("rectangular SS matches Johansen closed form", () => {
    const Lx = 4, Ly = 6, m = 18;
    const r = Lx / Ly;
    const kappa = Math.pow(Math.sqrt(3 + r * r) - r, 2);
    const wExpect = 24 * m / (Lx * Lx) / kappa;
    expect(yieldLineRect({ Lx, Ly, m }).wu).toBeCloseTo(wExpect, 6);
  });
});

describe("plastic beam collapse (mechanism loads)", () => {
  const Mp = 100, L = 8;
  it("SS UDL → 8·Mp/L²", () => {
    expect(beamCollapse({ Mp, L, restraint: "SS", load: "UDL" }).Pc).toBeCloseTo(8 * Mp / (L * L), 6);
  });
  it("fixed-fixed UDL → 16·Mp/L²", () => {
    expect(beamCollapse({ Mp, L, restraint: "FIXED", load: "UDL" }).Pc).toBeCloseTo(16 * Mp / (L * L), 6);
  });
  it("propped cantilever UDL → 11.657·Mp/L²", () => {
    const r = beamCollapse({ Mp, L, restraint: "PROPPED", load: "UDL" });
    expect(r.coefficient).toBeCloseTo(11.657, 2);
  });
  it("SS central point → 4·Mp/L", () => {
    expect(beamCollapse({ Mp, L, restraint: "SS", load: "POINT_MID" }).Pc).toBeCloseTo(4 * Mp / L, 6);
  });
  it("fixed central point → 8·Mp/L", () => {
    expect(beamCollapse({ Mp, L, restraint: "FIXED", load: "POINT_MID" }).Pc).toBeCloseTo(8 * Mp / L, 6);
  });
  it("propped central point → 6·Mp/L", () => {
    expect(beamCollapse({ Mp, L, restraint: "PROPPED", load: "POINT_MID" }).Pc).toBeCloseTo(6 * Mp / L, 6);
  });
});

describe("concrete plasticity effectiveness factor (Nielsen)", () => {
  it("ν = 0.7 − fc/200, fcEff = ν·fc, τ_max = ½ν·fc", () => {
    const r = effectivenessFactor({ fc: 40 });
    expect(r.nu).toBeCloseTo(0.7 - 40 / 200, 6); // 0.5
    expect(r.fcEff).toBeCloseTo(0.5 * 40, 6);     // 20
    expect(r.tauPlastic).toBeCloseTo(0.25 * 40, 6); // 10
  });
  it("plastic web-crushing shear V = τ·bw·z at θ=45°", () => {
    const r = effectivenessFactor({ fc: 30, bw: 300, z: 500, theta: 45 });
    // ν=0.55, fcEff=16.5, τ@45=½·16.5=8.25 MPa, V=8.25·300·500/1000=1237.5 kN
    expect(r.Vplastic).toBeCloseTo(8.25 * 300 * 500 / 1000, 3);
  });
  it("ν is bounded to [0.4, 1]", () => {
    expect(effectivenessFactor({ fc: 80 }).nu).toBeCloseTo(0.4, 6); // 0.7−0.4=0.3 → clamp 0.4
  });
});

describe("bound theorems", () => {
  it("static lower-bound is safe, kinematic upper-bound is unsafe", () => {
    expect(boundCharacter("STATIC_LOWER").safe).toBe(true);
    expect(boundCharacter("KINEMATIC_UPPER").safe).toBe(false);
  });
});
