import { describe, it, expect } from "vitest";
import {
  jacobiEigen, solveModal, shearBuilding, responseSpectrumAnalysis,
} from "../src/engine/modaldynamics";

// DS structural-dynamics library = textbooks → procedure/formulas only.
// Assert exact closed-form modal-analysis & response-spectrum identities.

describe("Jacobi eigensolver (symmetric)", () => {
  it("diagonalizes a known 2×2 symmetric matrix", () => {
    // [[2,1],[1,2]] → eigenvalues 1 and 3
    const { values } = jacobiEigen([[2, 1], [1, 2]]);
    expect(values[0]).toBeCloseTo(1, 8);
    expect(values[1]).toBeCloseTo(3, 8);
  });
});

describe("generalized modal eigenproblem (shear building)", () => {
  const m = 1000, k = 4e6;
  it("2-DOF golden-ratio: ω² = (k/m)(3∓√5)/2", () => {
    const { M, K } = shearBuilding([m, m], [k, k]);
    const r = solveModal(K, M);
    expect(r.modes[0].omega ** 2).toBeCloseTo((k / m) * (3 - Math.sqrt(5)) / 2, 2);
    expect(r.modes[1].omega ** 2).toBeCloseTo((k / m) * (3 + Math.sqrt(5)) / 2, 2);
  });

  it("uniform N-story building matches ωₙ = 2√(k/m)·sin((2n−1)π/(2(2N+1)))", () => {
    const N = 3;
    const { M, K } = shearBuilding(Array(N).fill(m), Array(N).fill(k));
    const r = solveModal(K, M);
    for (let n = 1; n <= N; n++) {
      const exact = 2 * Math.sqrt(k / m) * Math.sin(((2 * n - 1) * Math.PI) / (2 * (2 * N + 1)));
      expect(r.modes[n - 1].omega).toBeCloseTo(exact, 1);
    }
  });

  it("modes are mass-orthonormal (φᵢᵀ M φⱼ = δᵢⱼ)", () => {
    const { M, K } = shearBuilding([m, 1.5 * m, 2 * m], [k, 1.2 * k, 0.8 * k]);
    const r = solveModal(K, M);
    const dot = (a: number[], b: number[]) => {
      let s = 0;
      for (let i = 0; i < a.length; i++) for (let j = 0; j < a.length; j++) s += a[i] * M[i][j] * b[j];
      return s;
    };
    expect(dot(r.modes[0].shape, r.modes[0].shape)).toBeCloseTo(1, 6);
    expect(dot(r.modes[0].shape, r.modes[1].shape)).toBeCloseTo(0, 6);
    expect(dot(r.modes[1].shape, r.modes[2].shape)).toBeCloseTo(0, 6);
  });

  it("effective modal masses sum to total mass", () => {
    const { M, K } = shearBuilding([m, 1.5 * m, 2 * m], [k, 1.2 * k, 0.8 * k]);
    const r = solveModal(K, M);
    const sumMeff = r.modes.reduce((s, md) => s + md.Meff, 0);
    expect(sumMeff).toBeCloseTo(r.totalMass, 4);
    expect(r.totalMass).toBeCloseTo(m + 1.5 * m + 2 * m, 6);
    expect(r.cumulativeMassRatio[r.modes.length - 1]).toBeCloseTo(1, 6);
  });
});

describe("Response Spectrum Analysis (SRSS / CQC)", () => {
  const m = 1000, k = 4e6;

  it("flat spectrum: Σ modal base shears = Sa·M_total", () => {
    const { M, K } = shearBuilding([m, m, m], [k, k, k]);
    const A = 2.0; // m/s² flat
    const rsa = responseSpectrumAnalysis({ M, K, Sa: () => A });
    const sumV = rsa.modalBaseShear.reduce((s, v) => s + v, 0);
    expect(sumV).toBeCloseTo(A * rsa.modal.totalMass, 2);
  });

  it("CQC ≈ SRSS for well-separated modes", () => {
    const { M, K } = shearBuilding([m, m], [k, k]); // ω ratio 0.382 → low correlation
    const rsa = responseSpectrumAnalysis({ M, K, Sa: (T) => 9.81 / Math.max(T, 0.05), zeta: 0.05 });
    expect(Math.abs(rsa.baseShearCQC - rsa.baseShearSRSS) / rsa.baseShearSRSS).toBeLessThan(0.05);
  });

  it("SRSS base shear ≤ Σ|modal base shears| (subadditive)", () => {
    const { M, K } = shearBuilding([m, m, m], [k, k, k]);
    const rsa = responseSpectrumAnalysis({ M, K, Sa: (T) => 9.81 / Math.max(T, 0.1) });
    const absSum = rsa.modalBaseShear.reduce((s, v) => s + Math.abs(v), 0);
    expect(rsa.baseShearSRSS).toBeLessThanOrEqual(absSum + 1e-6);
    expect(rsa.baseShearSRSS).toBeGreaterThan(0);
  });
});
