import { describe, test, expect } from "vitest";
import {
  computePileAxialCapacity, computePileGroupCapacity, computePileSettlement,
  computeLateralPileBroms, computePileDriving,
} from "@/engine/pilefoundation";
import {
  computeBearingCapacity, computeMachineFoundation, computeSSI,
} from "@/engine/foundationdynamics";
import { computeSNISeismic } from "@/engine/sni2833seismic";
import { computeCableStayed } from "@/engine/cablestayed";
import { computeSteelTruss } from "@/engine/steeltruss";
import { computeSecondaryLoads } from "@/engine/bridgeload";

describe("Pile foundation — static capacity", () => {
  const base = {
    install: "BORED" as const, shape: "CIRCULAR" as const, size: 0.8, length: 20,
    soil: "SAND" as const, gamma: 18, waterDepth: 3, cu: 75, phi: 30, FS: 2.5,
  };
  test("Q_ult = Q_s + Q_p and Q_all = Q_ult/FS", () => {
    const r = computePileAxialCapacity(base);
    expect(r.Qult).toBeCloseTo(r.Qs + r.Qp, 3);
    expect(r.Qall).toBeCloseTo(r.Qult / base.FS, 3);
    expect(r.Qult).toBeGreaterThan(0);
  });
  test("driven pile mobilises more skin than equivalent bored", () => {
    const driven = computePileAxialCapacity({ ...base, install: "DRIVEN" });
    const bored = computePileAxialCapacity(base);
    expect(driven.Qs).toBeGreaterThan(bored.Qs);
  });
  test("clay end bearing uses 9·c_u", () => {
    const r = computePileAxialCapacity({ ...base, soil: "CLAY", cu: 100 });
    expect(r.qp).toBeCloseTo(900, 6);
  });
});

describe("Pile group & settlement & lateral & driving", () => {
  test("Converse-Labarre efficiency < 1 and > 0", () => {
    const g = computePileGroupCapacity({
      rows: 3, cols: 3, spacing: 2.4, size: 0.8, length: 20,
      QultSingle: 3000, soil: "SAND", cu: 75, FS: 2.5,
    });
    expect(g.efficiency).toBeGreaterThan(0);
    expect(g.efficiency).toBeLessThan(1);
    expect(g.nPiles).toBe(9);
  });
  test("settlement components positive and total = sum", () => {
    const s = computePileSettlement({
      Qp: 800, Qs: 1500, length: 20, size: 0.8, tipArea: 0.503, perimeter: 2.513,
      Ep: 30000, Es: 40, mu: 0.3,
    });
    expect(s.total).toBeCloseTo(s.s1 + s.s2 + s.s3, 3);
    expect(s.total).toBeGreaterThan(0);
  });
  test("Broms lateral governing = min(short, long)", () => {
    const l = computeLateralPileBroms({
      soil: "SAND", size: 0.8, length: 20, e: 1, cu: 75, phi: 30, gamma: 18,
      Myield: 900, headFixed: true,
    });
    expect(l.Hu).toBeCloseTo(Math.min(l.HuShort, l.HuLong), 3);
    expect(l.Kp).toBeGreaterThan(1);
  });
  test("driving formula gives finite capacity, Ra = Ru/FS", () => {
    const d = computePileDriving({
      formula: "HILEY", Eh: 50, eff: 0.8, set: 5, Wr: 35, Wp: 60, nRest: 0.5,
      cElastic: 12, length: 20, Ap: 0.503, Ep: 30000, FS: 3,
    });
    expect(d.Ru).toBeGreaterThan(0);
    expect(d.Ra).toBeCloseTo(d.Ru / 3, 3);
  });
});

describe("Foundation dynamics", () => {
  test("bearing capacity factors: Nq>1, Nc reasonable", () => {
    const b = computeBearingCapacity({ B: 3, L: 4, Df: 2, gamma: 18, c: 10, phi: 30, P: 4000, FS: 3 });
    expect(b.Nq).toBeGreaterThan(1);
    expect(b.Nc).toBeGreaterThan(10);
    expect(b.qall).toBeCloseTo(b.qult / 3, 3);
  });
  test("phi=0 gives Nc=5.14 (undrained)", () => {
    const b = computeBearingCapacity({ B: 3, L: 3, Df: 1, gamma: 18, c: 50, phi: 0, P: 1000, FS: 3 });
    expect(b.Nc).toBeCloseTo(5.14, 2);
  });
  test("machine foundation natural frequency positive", () => {
    const m = computeMachineFoundation({
      B: 3, L: 4, height: 1.5, weight: 800, G: 60, mu: 0.33, rhoSoil: 1900,
      rpm: 600, meE: 0.5, ampAllow: 0.2, mode: "VERTICAL",
    });
    expect(m.fn).toBeGreaterThan(0);
    expect(m.k).toBeGreaterThan(0);
  });
  test("SSI lengthens period (T~/T ≥ 1)", () => {
    const s = computeSSI({ Tfixed: 0.8, kStruct: 50000, height: 8, G: 60, mu: 0.33, r0: 1.95 });
    expect(s.ratio).toBeGreaterThanOrEqual(1);
    expect(s.Tssi).toBeGreaterThanOrEqual(0.8);
  });
});

describe("SNI 2833 seismic response spectrum", () => {
  const r = computeSNISeismic({ PGA: 0.35, Ss: 0.7, S1: 0.3, site: "SD", W: 5000, K: 40000, R: 3 });
  test("S_DS = Fa·Ss, S_D1 = Fv·S1", () => {
    expect(r.SDS).toBeCloseTo(r.Fa * 0.7, 4);
    expect(r.SD1).toBeCloseTo(r.Fv * 0.3, 4);
  });
  test("plateau Csm ≤ SDS and EQdesign = EQelastic/R", () => {
    expect(r.Csm).toBeLessThanOrEqual(r.SDS + 1e-9);
    expect(r.EQdesign).toBeCloseTo(r.EQelastic / 3, 3);
  });
});

describe("Cable-stayed & steel truss & secondary loads", () => {
  test("cable stays: force = V/sinθ, area positive", () => {
    const c = computeCableStayed({
      mainSpan: 200, pylonHeight: 50, nStays: 8, layout: "SEMI_FAN",
      w: 180, sigmaAllow: 720, gammaCable: 78.5, Ecable: 195000,
    });
    expect(c.stays.length).toBe(8);
    expect(c.stays[0].force).toBeGreaterThan(0);
    expect(c.pylonAxial).toBeGreaterThan(0);
  });
  test("steel truss chord force = M/h", () => {
    const t = computeSteelTruss({
      span: 60, panels: 8, height: 7, type: "WARREN", w: 60,
      Fy: 290, Fu: 500, E: 200000, area: 12000, rGyration: 120, Kfac: 1,
    });
    const Mmax = 60 * 60 * 60 / 8;
    expect(t.maxChordForce).toBeCloseTo(Mmax / 7, 1);
    expect(t.phiPn_tension).toBeGreaterThan(0);
  });
  test("secondary loads: wind pressure ∝ V², TB positive", () => {
    const s = computeSecondaryLoads({
      L: 40, Vw: 30, windArea: 2.4, Cw: 1.2, qLane: 9, Plane: 49,
      alphaT: 1e-5, Esteel: 200000, Arestr: 500000, dT: 30, restrained: false,
    });
    expect(s.windPressure).toBeCloseTo(0.0006 * 1.2 * 900, 4);
    expect(s.TB).toBeGreaterThan(0);
    expect(s.EUn).toBe(0); // not restrained
  });
});
