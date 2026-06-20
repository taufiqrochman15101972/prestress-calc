import { describe, test, expect } from "vitest";
import {
  computeSDOF, computeModal2, computeCapacityDesign, computeLiquefaction,
} from "@/engine/seismicdynamics";

describe("SDOF dynamic response", () => {
  const r = computeSDOF({ W: 5000, K: 40000, zeta: 0.05, Sa: 0.6 });
  test("T = 2π√(m/K) consistent with ω", () => {
    expect(r.T).toBeCloseTo((2 * Math.PI) / r.omega, 6);
    expect(r.mass).toBeCloseTo(5000 / 9.81, 3);
  });
  test("base shear = Sa·W, Sd = Sa·g/ω²", () => {
    expect(r.Vbase).toBeCloseTo(r.Sa * 5000, 3);
    expect(r.Sd).toBeCloseTo((r.Sa * 9.81) / (r.omega * r.omega), 6);
  });
  test("damping B = 1 at ζ = 0.05", () => {
    expect(r.damping).toBeCloseTo(1.0, 6);
  });
});

describe("2-DOF modal analysis", () => {
  const r = computeModal2({ m1: 300, m2: 200, k1: 80000, k2: 50000, Sa1: 0.6, Sa2: 0.5 });
  test("T1 > T2 (mode 1 is the longer period)", () => {
    expect(r.T1).toBeGreaterThan(r.T2);
  });
  test("modal mass ratio of mode 1 between 0 and 1", () => {
    expect(r.Mratio1).toBeGreaterThan(0);
    expect(r.Mratio1).toBeLessThanOrEqual(1);
  });
  test("SRSS base shear positive", () => {
    expect(r.Vbase).toBeGreaterThan(0);
  });
});

describe("Capacity design — plastic hinge / ductility / P-Δ", () => {
  const r = computeCapacityDesign({
    Mp: 4500, H: 8, fixity: "CANTILEVER", lambdaO: 1.2, D: 1.2,
    phiY: 0.0045, phiU: 0.035, fye: 420, dbl: 25, Pdl: 6000, deltaD: 0.12,
  });
  test("M_po = λ_o·M_p and V_po = M_po/H (cantilever)", () => {
    expect(r.Mpo).toBeCloseTo(1.2 * 4500, 3);
    expect(r.Vpo).toBeCloseTo(r.Mpo / 8, 3);
  });
  test("fixed-fixed doubles the plastic shear", () => {
    const f = computeCapacityDesign({
      Mp: 4500, H: 8, fixity: "FIXED", lambdaO: 1.2, D: 1.2,
      phiY: 0.0045, phiU: 0.035, fye: 420, dbl: 25, Pdl: 6000, deltaD: 0.12,
    });
    expect(f.Vpo).toBeCloseTo(2 * r.Vpo, 3);
  });
  test("ductility μ_Δ = Δ_C/Δ_y > 1", () => {
    expect(r.muDelta).toBeGreaterThan(1);
    expect(r.deltaC).toBeCloseTo(r.deltaY + r.deltaP, 6);
  });
});

describe("Liquefaction triggering (Seed–Idriss)", () => {
  test("FS = CRR·MSF/CSR and loose sand liquefies", () => {
    const loose = computeLiquefaction({
      z: 6, gamma: 18, waterDepth: 2, amax: 0.4, N160: 6, fines: 5, Mw: 7.5,
    });
    expect(loose.FS).toBeCloseTo((loose.CRR75 * loose.MSF) / loose.CSR, 4);
    expect(loose.liquefies).toBe(true);
  });
  test("dense sand does not liquefy", () => {
    const dense = computeLiquefaction({
      z: 6, gamma: 18, waterDepth: 2, amax: 0.2, N160: 30, fines: 10, Mw: 6.5,
    });
    expect(dense.FS).toBeGreaterThan(1);
  });
  test("effective stress < total when below water table", () => {
    const r = computeLiquefaction({ z: 6, gamma: 18, waterDepth: 2, amax: 0.35, N160: 12, fines: 15, Mw: 7 });
    expect(r.sigmaVeff).toBeLessThan(r.sigmaV);
  });
});
