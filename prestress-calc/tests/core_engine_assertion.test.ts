/**
 * PRESTRESS-CALC — Core Engine Assertion Tests
 * Benchmark geometry: I-girder 30m span as defined in PRD §10
 *
 * NOTE: The PRD §10 benchmark values (y_b=721.5, I_g=1.942e11) contain
 * arithmetic errors from the AI-generated document. These tests use
 * values computed from the correct engineering formulas.
 *
 * Correct values for the given dimensions:
 *   b1=600, h1=200, b2=200, h2=1200, b3=700, h3=250 → H=1650mm
 *   A_g  = 535,000 mm²
 *   y_b  = 769.86 mm  (PRD said 721.5 — incorrect)
 *   y_t  = 880.14 mm  (PRD said 928.5 — incorrect)
 *   I_g  ≈ 1.7747e11 mm⁴  (PRD said 1.942e11 — incorrect)
 */

import { describe, test, expect } from "vitest";
import { calculateGrossProperties, calculateCompositeProperties } from "@/engine/section";
import { computeFlexuralStrength } from "@/engine/uls";
import { computeSLSChecks } from "@/engine/sls";
import type { ULSFlexInputs } from "@/engine/uls";

// ─── Benchmark input ─────────────────────────────────────────

const GIRDER = { b1: 600, h1: 200, b2: 200, h2: 1200, b3: 700, h3: 250 };
const DECK = { thicknessTd: 200, widthBeff: 2100, fcDeck: 30, fcGirder: 50 };

// ─── Section Tests ───────────────────────────────────────────

describe("Section Engine — Gross Properties", () => {
  const g = calculateGrossProperties(GIRDER);

  test("gross area A_g = 535,000 mm²", () => {
    expect(g.areaAg).toBeCloseTo(535_000, 0);
  });

  test("total height H = 1650 mm", () => {
    expect(g.hTotal).toBe(1650);
  });

  test("y_b ≈ 769.86 mm", () => {
    expect(g.yb).toBeCloseTo(769.86, 1);
  });

  test("y_t ≈ 880.14 mm (= H - y_b)", () => {
    expect(g.yt).toBeCloseTo(880.14, 1);
  });

  test("y_b + y_t = H", () => {
    expect(g.yb + g.yt).toBeCloseTo(1650, 5);
  });

  test("I_g ≈ 1.7746e11 mm⁴", () => {
    // Computed: 177,459,822,819 mm⁴ — precision to nearest 10⁸
    expect(g.momentOfInertiaIg).toBeCloseTo(1.7746e11, -7);
  });

  test("Z_tg = I_g / y_t", () => {
    expect(g.Ztg).toBeCloseTo(g.momentOfInertiaIg / g.yt, 0);
  });

  test("Z_bg = I_g / y_b", () => {
    expect(g.Zbg).toBeCloseTo(g.momentOfInertiaIg / g.yb, 0);
  });
});

describe("Section Engine — Composite Properties", () => {
  const comp = calculateCompositeProperties(GIRDER, DECK);

  test("modular ratio n_c = sqrt(30/50) ≈ 0.7746", () => {
    // E_c = 4700*sqrt(fc); n_c = E_c_deck/E_c_girder = sqrt(30)/sqrt(50)
    expect(comp.modularRatioNc).toBeCloseTo(Math.sqrt(30 / 50), 4);
  });

  test("transformed deck area ≈ 325,332 mm²", () => {
    const expected = Math.sqrt(30 / 50) * 2100 * 200;
    expect(comp.deckTransformedArea).toBeCloseTo(expected, 0);
  });

  test("composite area A_c > A_g", () => {
    const gross = calculateGrossProperties(GIRDER);
    expect(comp.compositeAreaAc).toBeGreaterThan(gross.areaAg);
  });

  test("y_bc > y_b (composite NA is higher)", () => {
    const gross = calculateGrossProperties(GIRDER);
    expect(comp.ybc).toBeGreaterThan(gross.yb);
  });

  test("y_bc + y_tgc = H_girder", () => {
    expect(comp.ybc + comp.ytgc).toBeCloseTo(1650, 3);
  });

  test("I_c > I_g (composite is stiffer)", () => {
    const gross = calculateGrossProperties(GIRDER);
    expect(comp.momentOfInertiaIc).toBeGreaterThan(gross.momentOfInertiaIg);
  });

  test("Z_bc = I_c / y_bc", () => {
    expect(comp.Zbc).toBeCloseTo(comp.momentOfInertiaIc / comp.ybc, 0);
  });
});

// ─── SLS Tests ───────────────────────────────────────────────

describe("SLS Stress Validator", () => {
  const gross = calculateGrossProperties(GIRDER);
  const comp = calculateCompositeProperties(GIRDER, DECK);

  // Approximate forces for benchmark
  const Aps = 3553.2;
  const fj = 0.75 * 1860;
  const Pj = (fj * Aps) / 1000;         // kN
  const Pe = Pj * 0.80;                  // 20% total loss

  const spanM = 30;
  const wSelf = 0.535 * 24;             // kN/m (A_g * gamma_c, rough)
  const Mg = wSelf * spanM ** 2 / 8;   // kN·m
  const Msdl = 5 * spanM ** 2 / 8;
  const Mlive = 20 * spanM ** 2 / 8;

  const result = computeSLSChecks(
    { Pi: Pj, Pe, e: 650, Mg, Msdl, Mlive, fci: 40, fc: 50 },
    gross,
    comp
  );

  test("Transfer stage has valid structure", () => {
    expect(result.transfer.sigmaTop).toBeDefined();
    expect(result.transfer.sigmaBot).toBeDefined();
    expect(["AMAN", "OVERSTRESS"]).toContain(result.transfer.topFiber.verdict);
  });

  test("Service stage has valid structure", () => {
    expect(result.service.sigmaTop).toBeDefined();
    expect(result.service.sigmaBot).toBeDefined();
    expect(result.service.sigmaDeck).toBeDefined();
  });

  test("Compression limit transfer = 0.60 × f'ci = 24 MPa", () => {
    expect(result.transfer.topFiber.limitCompMpa).toBeCloseTo(24, 2);
  });

  test("Tension limit transfer = 0.50 × √40 ≈ 3.162 MPa", () => {
    expect(result.transfer.topFiber.limitTensMpa).toBeCloseTo(0.5 * Math.sqrt(40), 3);
  });

  test("Compression limit service = 0.45 × f'c = 22.5 MPa", () => {
    expect(result.service.topFiber.limitCompMpa).toBeCloseTo(22.5, 2);
  });

  test("Sign convention: negative sigma = compression", () => {
    // Deck fiber under live load (pure bending) should be compressive
    expect(result.service.sigmaDeck).toBeLessThan(0);
  });
});

// ─── ULS Flexure Tests ──────────────────────────────────────

describe("ULS Flexure Engine", () => {
  const gross = calculateGrossProperties(GIRDER);
  const comp = calculateCompositeProperties(GIRDER, DECK);

  const inputs: ULSFlexInputs = {
    tendon: {
      profileType: "PARABOLIC",
      rows: [
        { id: 1, strandCount: 12, yFromBottom: 85 },
        { id: 2, strandCount: 12, yFromBottom: 120 },
        { id: 3, strandCount: 12, yFromBottom: 155 },
      ],
      singleStrandArea: 98.7,
      jackingRatio: 0.75,
      fpu: 1860,
      fpy: 1580,
      Eps: 197_000,
      eccentricityMidspan: 650,   // provided directly for engine test
      eccentricitySupport: 0,
      holdDownRatio: 0,
      strandDiameter: 12.7,
      totalStrands: 36,           // provided directly for engine test
    },
    girder: GIRDER,
    deck: DECK,
    comp,
    gross,
    As: 0,
    fy: 420,
    Mu: 6000, // kN·m (example required moment)
  };

  const result = computeFlexuralStrength(inputs);

  test("f_ps is between 0.9*fpu and fpu", () => {
    expect(result.fps).toBeGreaterThan(0.9 * 1860);
    expect(result.fps).toBeLessThanOrEqual(1860);
  });

  test("Whitney block depth a > 0", () => {
    expect(result.a).toBeGreaterThan(0);
  });

  test("phi*Mn >= Mu (adequate for Mu=6000 kN·m)", () => {
    expect(result.phiMn).toBeGreaterThan(inputs.Mu);
  });

  test("Nominal moment Mn > phi*Mn (phi reduction applied)", () => {
    expect(result.Mn).toBeGreaterThan(result.phiMn);
  });

  test("isAdequate flag matches comparison", () => {
    expect(result.isAdequate).toBe(result.phiMn >= inputs.Mu);
  });
});

// ─── Internal Consistency Tests ─────────────────────────────

describe("Engine Internal Consistency", () => {
  const g1 = calculateGrossProperties(GIRDER);
  const g2 = calculateGrossProperties(GIRDER);

  test("Pure function: same inputs → same output", () => {
    expect(g1.yb).toBe(g2.yb);
    expect(g1.momentOfInertiaIg).toBe(g2.momentOfInertiaIg);
  });

  test("Larger bottom flange → lower centroid (y_b decreases)", () => {
    const heavierBot = calculateGrossProperties({ ...GIRDER, b3: 1000 });
    expect(heavierBot.yb).toBeLessThan(g1.yb);
  });

  test("Adding deck raises composite centroid above girder centroid", () => {
    const comp = calculateCompositeProperties(GIRDER, DECK);
    expect(comp.ybc).toBeGreaterThan(g1.yb);
  });
});
