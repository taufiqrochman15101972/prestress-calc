/**
 * geotech_verif.test.ts — BENCHMARK VERIFICATION against ABSOLUTE published
 * numbers (per the corrected rule: for verification/benchmark documents the PDF
 * / textbook values are the absolute target, only a small tolerance allowed).
 *
 * Sources behind the MIDAS GTS / DIANA geotechnical verification (MD 470–522):
 *   - Terzaghi 1-D consolidation U–Tv table (Das; Holtz & Kovacs)
 *   - Mohr–Coulomb / MMC triaxial-at-failure (MD 474 constitutive verification)
 *   - Prandtl–Reissner / Vesic bearing-capacity factors (published values)
 */
import { describe, test, expect } from "vitest";
import {
  degreeOfConsolidation,
  timeFactor,
  computeConsolidation,
} from "@/engine/consolidation";
import { triaxialFailure, passiveCoeff } from "@/engine/mohrcoulomb";
import { computeBearingCapacity } from "@/engine/foundationdynamics";

describe("Terzaghi 1-D consolidation — absolute U–Tv targets", () => {
  // Textbook: U=50% ↔ Tv=0.197 ; U=90% ↔ Tv=0.848.
  test("U(Tv=0.197) ≈ 0.500", () => {
    expect(degreeOfConsolidation(0.197)).toBeCloseTo(0.5, 2);
  });
  test("U(Tv=0.848) ≈ 0.900", () => {
    expect(degreeOfConsolidation(0.848)).toBeCloseTo(0.9, 2);
  });
  test("inverse Tv(U=50%) = 0.197 and Tv(U=90%) = 0.848", () => {
    expect(timeFactor(0.5)).toBeCloseTo(0.197, 2);
    expect(timeFactor(0.9)).toBeCloseTo(0.848, 2);
  });
  test("series U(Tv=0.2) ≈ 0.504 (published)", () => {
    expect(degreeOfConsolidation(0.2)).toBeCloseTo(0.504, 2);
  });
  test("t50/t90 ratio = 0.197/0.848 and S(t)=U·Sc", () => {
    const r = computeConsolidation({
      H: 4, drainage: "double", cv: 1.5, Cc: 0.3, e0: 0.9,
      sigma0: 100, dSigma: 100, t: 2,
    });
    expect(r.t50 / r.t90).toBeCloseTo(0.197 / 0.848, 4);
    expect(r.St).toBeCloseTo(r.U * r.Sc, 9);
    // Sc = (0.3/1.9)·4·log10(200/100) = 0.1901 m
    expect(r.Sc).toBeCloseTo(0.19012, 4);
  });
});

describe("Mohr–Coulomb triaxial at failure — MD 474 absolute targets", () => {
  test("c=0, φ=30°, σ3=100 → Kp=3, σ1f=300, q_f=200 kPa", () => {
    const r = triaxialFailure({ c: 0, phi: 30, sigma3: 100 });
    expect(r.Kp).toBeCloseTo(3, 6);
    expect(r.sigma1f).toBeCloseTo(300, 6);
    expect(r.qf).toBeCloseTo(200, 6);
  });
  test("undrained Tresca: c=cu, φ=0 → q_f = 2·cu", () => {
    const r = triaxialFailure({ c: 25, phi: 0, sigma3: 80 });
    expect(passiveCoeff(0)).toBeCloseTo(1, 9);
    expect(r.qf).toBeCloseTo(50, 6); // 2·25
  });
});

describe("Bearing-capacity factors — published Prandtl/Vesic targets", () => {
  test("φ=0 → Nc=5.14", () => {
    const r = computeBearingCapacity({
      B: 2, L: 2, Df: 1, gamma: 18, phi: 0, c: 25, P: 500, FS: 3,
    });
    expect(r.Nc).toBeCloseTo(5.14, 2);
  });
  test("φ=30° → Nq≈18.40, Nc≈30.14, Nγ(Vesic)≈22.40", () => {
    const r = computeBearingCapacity({
      B: 2, L: 2, Df: 1, gamma: 18, phi: 30, c: 0, P: 500, FS: 3,
    });
    expect(r.Nq).toBeCloseTo(18.40, 1);
    expect(r.Nc).toBeCloseTo(30.14, 1);
    expect(r.Ngamma).toBeCloseTo(22.40, 1);
  });
});
