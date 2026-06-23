import { describe, it, expect } from "vitest";
import {
  solveLinear, flexibilityRedundants, threeMomentContinuous,
  proppedCantileverUDL, fixedFixedUDL,
} from "../src/engine/forcemethod";

// MTH matrix-structural-analysis library = textbooks → formulas only.
// Assert exact closed-form force-method / three-moment identities.

describe("linear solver & flexibility core", () => {
  it("solves a 2×2 system", () => {
    const x = solveLinear([[2, 1], [1, 3]], [5, 10]); // x=1,y=3
    expect(x[0]).toBeCloseTo(1, 8);
    expect(x[1]).toBeCloseTo(3, 8);
  });
  it("flexibility redundants solve [f]{X} = −{Δ0}", () => {
    const X = flexibilityRedundants([[2]], [-4]); // 2X = 4 → X=2
    expect(X[0]).toBeCloseTo(2, 8);
  });
});

describe("three-moment equation (continuous beam, UDL)", () => {
  const w = 10, L = 6;
  it("two equal spans → M_B = −wL²/8, R_B = 1.25wL, R_A = R_C = 3wL/8", () => {
    const r = threeMomentContinuous([{ L, w }, { L, w }]);
    expect(r.supportMoments[1]).toBeCloseTo(-w * L * L / 8, 6);
    expect(r.reactions[1]).toBeCloseTo(1.25 * w * L, 6);
    expect(r.reactions[0]).toBeCloseTo(3 * w * L / 8, 6);
    expect(r.reactions[2]).toBeCloseTo(3 * w * L / 8, 6);
  });
  it("total reaction equals total load (equilibrium)", () => {
    const spans = [{ L: 5, w: 8 }, { L: 7, w: 12 }, { L: 4, w: 10 }];
    const r = threeMomentContinuous(spans);
    const totalR = r.reactions.reduce((s, v) => s + v, 0);
    const totalW = spans.reduce((s, sp) => s + sp.w * sp.L, 0);
    expect(totalR).toBeCloseTo(totalW, 5);
  });
  it("single span reduces to simply supported (M_mid = wL²/8, ends 0)", () => {
    const r = threeMomentContinuous([{ L, w }]);
    expect(r.supportMoments[0]).toBeCloseTo(0, 8);
    expect(r.supportMoments[1]).toBeCloseTo(0, 8);
    expect(r.midspanMoments[0]).toBeCloseTo(w * L * L / 8, 6);
    expect(r.reactions[0]).toBeCloseTo(w * L / 2, 6);
  });
});

describe("classic indeterminate closed forms", () => {
  const w = 12, L = 8;
  it("propped cantilever UDL: R_B = 3wL/8, M_fix = −wL²/8, R_A = 5wL/8", () => {
    const r = proppedCantileverUDL(w, L);
    expect(r.RB).toBeCloseTo(3 * w * L / 8, 8);
    expect(r.RA).toBeCloseTo(5 * w * L / 8, 8);
    expect(r.Mfix).toBeCloseTo(-w * L * L / 8, 8);
    expect(r.RA + r.RB).toBeCloseTo(w * L, 8);
  });
  it("fixed-fixed UDL: M_end = −wL²/12, M_mid = wL²/24, R = wL/2", () => {
    const r = fixedFixedUDL(w, L);
    expect(r.Mend).toBeCloseTo(-w * L * L / 12, 8);
    expect(r.Mmid).toBeCloseTo(w * L * L / 24, 8);
    expect(r.R).toBeCloseTo(w * L / 2, 8);
  });
});
