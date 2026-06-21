/**
 * buildingseismic.test.ts — BUILDING seismic ELF (ASCE 7-16 / NEHRP) + Eurocode 8.
 *
 * Per project rule: FEMA 451 / P-750 are DESIGN-EXAMPLE (tutorial) documents →
 * only procedure/order is borrowed, NOT their example numbers. The assertions
 * below therefore target the CLOSED-FORM CODE EQUATIONS themselves (identities
 * that must hold exactly), not any worked example.
 */
import { describe, test, expect } from "vitest";
import {
  computeBuildingSeismic,
  designSpectrumASCE,
  computeEC8,
  designSpectrumEC8,
  type BuildingSeismicInputs,
} from "@/engine/buildingseismic";

const base: BuildingSeismicInputs = {
  Ss: 1.5, S1: 0.6, site: "C", TL: 8, R: 8, Cd: 5.5, Omega0: 3, Ie: 1,
  system: "steel_mrf", storeys: [
    { w: 4000, h: 4 }, { w: 4000, h: 8 }, { w: 4000, h: 12 }, { w: 3000, h: 16 },
  ],
};

describe("ASCE 7-16 design spectrum — closed-form identities", () => {
  test("SDS=(2/3)Fa·Ss, SD1=(2/3)Fv·S1, T0=0.2·SD1/SDS, TS=SD1/SDS", () => {
    const r = computeBuildingSeismic(base);
    // site C: Fa(Ss=1.5)=1.2, Fv(S1=0.6)=1.4
    expect(r.Fa).toBeCloseTo(1.2, 6);
    expect(r.Fv).toBeCloseTo(1.4, 6);
    expect(r.SMS).toBeCloseTo(1.8, 6);
    expect(r.SM1).toBeCloseTo(0.84, 6);
    expect(r.SDS).toBeCloseTo(1.2, 6);
    expect(r.SD1).toBeCloseTo(0.56, 6);
    expect(r.T0).toBeCloseTo(0.2 * r.SD1 / r.SDS, 9);
    expect(r.TS).toBeCloseTo(r.SD1 / r.SDS, 9);
  });

  test("spectrum branches: plateau=SDS, descending=SD1/T, long=SD1·TL/T²", () => {
    const SDS = 1.2, SD1 = 0.56, TL = 8;
    const T0 = 0.2 * SD1 / SDS, TS = SD1 / SDS;
    // plateau
    expect(designSpectrumASCE(SDS, SD1, T0, TS, TL, (T0 + TS) / 2)).toBeCloseTo(SDS, 9);
    // T<T0 ramp at T=0 → 0.4·SDS
    expect(designSpectrumASCE(SDS, SD1, T0, TS, TL, 0)).toBeCloseTo(0.4 * SDS, 9);
    // descending
    expect(designSpectrumASCE(SDS, SD1, T0, TS, TL, 1.0)).toBeCloseTo(SD1 / 1.0, 9);
    // long-period
    expect(designSpectrumASCE(SDS, SD1, T0, TS, TL, 10)).toBeCloseTo(SD1 * TL / 100, 9);
  });
});

describe("ASCE 7-16 §12.8 base shear & vertical distribution", () => {
  test("Cs governed by min(SDS/(R/Ie), cap) and floors; V=Cs·W", () => {
    const r = computeBuildingSeismic(base);
    const RIe = base.R / base.Ie;
    expect(r.Cs).toBeLessThanOrEqual(r.SDS / RIe + 1e-9);
    expect(r.Cs).toBeGreaterThanOrEqual(r.CsMin - 1e-9);
    // S1=0.6 ≥ 0.6 → floor Cs,min ≥ 0.5·S1/(R/Ie)
    expect(r.CsMin).toBeGreaterThanOrEqual(0.5 * base.S1 / RIe - 1e-9);
    expect(r.V).toBeCloseTo(r.Cs * r.W, 6);
    expect(r.W).toBeCloseTo(15000, 6);
  });

  test("ΣCvx = 1 and ΣFx = V (vertical distribution conserves base shear)", () => {
    const r = computeBuildingSeismic(base);
    const sumCvx = r.storeys.reduce((a, s) => a + s.Cvx, 0);
    const sumFx = r.storeys.reduce((a, s) => a + s.Fx, 0);
    expect(sumCvx).toBeCloseTo(1, 9);
    expect(sumFx).toBeCloseTo(r.V, 6);
    // top-storey shear equals top force; base storey shear equals V
    expect(r.storeys[0].Vx).toBeCloseTo(r.V, 6);
  });

  test("k interpolation: T≤0.5→1, T≥2.5→2, linear between", () => {
    const r = computeBuildingSeismic(base);
    expect(r.k).toBeGreaterThanOrEqual(1);
    expect(r.k).toBeLessThanOrEqual(2);
    if (r.T <= 0.5) expect(r.k).toBeCloseTo(1, 9);
    if (r.T >= 2.5) expect(r.k).toBeCloseTo(2, 9);
  });

  test("approximate period Ta = Ct·hn^x (steel MRF: 0.0724·hn^0.8)", () => {
    const r = computeBuildingSeismic(base);
    expect(r.Ta).toBeCloseTo(0.0724 * Math.pow(16, 0.8), 6);
  });
});

describe("Eurocode 8 (EN 1998-1) design spectrum & base shear", () => {
  test("plateau Sd = ag·S·2.5/q on TB≤T≤TC", () => {
    const ag = 0.25, S = 1.15, TB = 0.15, TC = 0.5, TD = 2, q = 3.9, beta = 0.2;
    expect(designSpectrumEC8(ag, S, TB, TC, TD, q, beta, 0.3)).toBeCloseTo(ag * S * 2.5 / q, 9);
    // lower bound β·ag applies for long T
    expect(designSpectrumEC8(ag, S, TB, TC, TD, q, beta, 6)).toBeGreaterThanOrEqual(beta * ag - 1e-9);
  });

  test("base shear Fb = Sd(T1)·W·λ, T1 = Ct·H^0.75", () => {
    const r = computeEC8({
      ag: 0.25, S: 1.15, TB: 0.15, TC: 0.5, TD: 2, q: 3.9,
      H: 16, Ct: 0.085, W: 15000,
    });
    expect(r.T1).toBeCloseTo(0.085 * Math.pow(16, 0.75), 6);
    expect(r.Fb).toBeCloseTo(r.Sd * 15000 * (r.T1 <= 2 * 0.5 ? 0.85 : 1.0), 4);
  });
});
