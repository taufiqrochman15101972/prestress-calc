/**
 * Substructure (bangunan bawah) engine assertions.
 * Verifies the AASHTO load-combination factors, RC strain-control φ ramp,
 * footing punching/bearing, pile-group rigid-cap distribution, Rankine
 * abutment stability and the ground-anchor capacities. Tolerance ±0.5%.
 */
import { describe, test, expect } from "vitest";
import {
  beta1, phiFromStrain, computeLoadCombos, computePierColumn,
  computeBentCap, computeSpreadFooting, computePileGroup,
  computeAbutment, computeGroundAnchor,
} from "@/engine/substructure";

const near = (a: number, b: number, tol = 0.005) =>
  Math.abs(a - b) <= Math.abs(b) * tol + 1e-9;

describe("helpers", () => {
  test("β₁ ramp", () => {
    expect(beta1(28)).toBeCloseTo(0.85, 5);
    expect(beta1(50)).toBeCloseTo(0.6929, 3);
    expect(beta1(70)).toBe(0.65);
  });
  test("φ strain control (tied, fy=420)", () => {
    expect(phiFromStrain(0.006, 420).phi).toBeCloseTo(0.90, 5);   // tension
    expect(phiFromStrain(0.001, 420).phi).toBeCloseTo(0.65, 5);   // compression
    const tr = phiFromStrain(0.0035, 420);                        // transition
    expect(tr.phi).toBeGreaterThan(0.65);
    expect(tr.phi).toBeLessThan(0.90);
    expect(tr.classification).toBe("transisi");
  });
});

describe("load combinations (AASHTO LRFD)", () => {
  const r = computeLoadCombos({
    DC: { P: 1000, M: 0, H: 0 }, DW: { P: 100, M: 0, H: 0 },
    LL: { P: 500, M: 0, H: 0 }, WS: { P: 0, M: 0, H: 0 }, WL: { P: 0, M: 0, H: 0 },
    EH: { P: 0, M: 0, H: 0 }, EV: { P: 0, M: 0, H: 0 }, ES: { P: 0, M: 0, H: 0 },
    EQ: { P: 0, M: 0, H: 0 },
  });
  test("Strength I axial = 1.25·1000+1.5·100+1.75·500", () => {
    const s1 = r.combos.find(c => c.name.startsWith("Strength I"))!;
    expect(near(s1.Pu, 1250 + 150 + 875)).toBe(true); // 2275
  });
  test("Service I axial = sum", () => {
    const sv = r.combos.find(c => c.name.startsWith("Service"))!;
    expect(near(sv.Pu, 1600)).toBe(true);
  });
});

describe("RC pier column", () => {
  const r = computePierColumn({
    b: 800, h: 1000, fc: 30, fy: 420, spiral: false,
    layers: [{ d: 70, As: 5 * 804 }, { d: 500, As: 2 * 804 }, { d: 930, As: 5 * 804 }],
    Pu: 4500, Mu: 1200,
  });
  test("P₀ = 0.85f'c(Ag−Ast)+fy·Ast", () => {
    const Ag = 800 * 1000, Ast = 12 * 804;
    const Pn0 = (0.85 * 30 * (Ag - Ast) + 420 * Ast) / 1000;
    expect(near(r.Pn0, Pn0)).toBe(true);
  });
  test("φPn cap = 0.8·0.65·Pn0", () => {
    expect(near(r.phiPnMax, 0.8 * 0.65 * r.Pn0)).toBe(true);
  });
  test("ρ within 1–8%", () => { expect(r.rhoOk).toBe(true); });
  test("balanced point exists below P₀", () => {
    expect(r.balanced.Pn).toBeGreaterThan(0);
    expect(r.balanced.Pn).toBeLessThan(r.Pn0);
  });
});

describe("bent cap", () => {
  const r = computeBentCap({ b: 1200, h: 1200, d: 1120, fc: 30, fy: 420, Mu: 2800, Vu: 1800, Av: 2 * 129, s: 150 });
  test("Vc = 0.166√f'c·b·d", () => {
    expect(near(r.Vc, 0.166 * Math.sqrt(30) * 1200 * 1120 / 1000)).toBe(true);
  });
  test("flexure provides positive φMn and As ≥ As,min", () => {
    expect(r.AsReq).toBeGreaterThanOrEqual(r.AsMin);
    expect(r.phiMn).toBeGreaterThan(0);
  });
});

describe("spread footing", () => {
  const r = computeSpreadFooting({
    B: 3500, L: 4000, t: 900, d: 800, cx: 800, cy: 1000,
    fc: 25, fy: 420, P: 3000, M: 600, Pu: 4500, Mu: 900, qAllow: 350, gammaC: 24,
  });
  test("punching perimeter b0 = 2(cx+d)+2(cy+d)", () => {
    expect(near(r.b0, 2 * (800 + 800) + 2 * (1000 + 800))).toBe(true);
  });
  test("kern = L/6", () => { expect(near(r.ekern, 4000 / 6)).toBe(true); });
  test("As ≥ shrinkage minimum", () => { expect(r.AsReq).toBeGreaterThanOrEqual(r.AsMin); });
});

describe("pile group", () => {
  // 2×3 group, spacing 1200, P=6000, Mx=1500
  const piles: { x: number; y: number }[] = [];
  for (let rI = 0; rI < 2; rI++) for (let c = 0; c < 3; c++)
    piles.push({ x: (c - 1) * 1200, y: (rI - 0.5) * 1200 });
  const r = computePileGroup({ piles, P: 6000, Mx: 1500, Pu: 9000, Mux: 2250, pileCap: 1800, rows: 2, cols: 3, spacing: 1200, diameter: 400 });
  test("n = 6", () => { expect(r.n).toBe(6); });
  test("R_max = P/n + M·x/Σx²", () => {
    const Sxx = piles.reduce((s, p) => s + p.x * p.x, 0);
    const Rmax = 6000 / 6 + (1500 * 1e6) * 1200 / Sxx / 1000;
    expect(near(r.Rmax, Rmax)).toBe(true);
  });
  test("Converse-Labarre efficiency < 1", () => {
    expect(r.efficiency!).toBeGreaterThan(0);
    expect(r.efficiency!).toBeLessThan(1);
  });
});

describe("abutment (Rankine)", () => {
  const r = computeAbutment({
    H: 6000, stemT: 700, baseB: 4500, toe: 1200, heel: 2600, baseT: 800,
    gammaSoil: 18, phiSoil: 30, gammaC: 24, surcharge: 12, Vbearing: 600,
    muBase: 0.5, qAllow: 350, fc: 25, fy: 420, dStem: 620,
  });
  test("Ka = tan²(45−φ/2), φ=30 → 1/3", () => { expect(near(r.Ka, 1 / 3, 0.01)).toBe(true); });
  test("Pa = ½Ka·γ·H²", () => { expect(near(r.Pa, 0.5 * (1 / 3) * 18 * 36, 0.01)).toBe(true); });
  test("stability FS positive", () => { expect(r.FSot).toBeGreaterThan(0); expect(r.FSsl).toBeGreaterThan(0); });
});

describe("ground anchor", () => {
  const r = computeGroundAnchor({
    Tdesign: 900, nStrand: 7, Aps: 140, fpu: 1860, dHole: 150, Lbond: 8000,
    tauUlt: 600, Lfree: 6000, inclination: 20, FSbond: 2.0,
  });
  test("T_steel = 0.6·fpu·Aps", () => {
    expect(near(r.Tsteel, 0.6 * 1860 * 7 * 140 / 1000)).toBe(true);
  });
  test("T_bond = π·d·Lb·τ/FS", () => {
    expect(near(r.Tbond, Math.PI * 0.15 * 8.0 * 600 / 2.0)).toBe(true);
  });
});
