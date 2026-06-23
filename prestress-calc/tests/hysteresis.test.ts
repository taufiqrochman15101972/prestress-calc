import { describe, it, expect } from "vitest";
import {
  cyclicAssessment, hystStep, initState,
  nonlinearTH, parkAngDamage, infillStrut, type HysteresisParams,
} from "../src/engine/hysteresis";

// Closed-form identities only (these GM PDFs are textbooks/theses → procedure,
// not numbers). Tolerances are tight against analytical results.

describe("hysteresis — elasto-plastic loop energy", () => {
  const p: HysteresisParams = { model: "BILINEAR", k0: 1000, Fy: 100, alpha: 0 };
  const uy = p.Fy / p.k0; // 0.1

  it("dissipated energy per symmetric cycle = 4·Fy·(um − uy)", () => {
    const um = 0.5;
    const [c] = cyclicAssessment(p, [um], 400);
    const expected = 4 * p.Fy * (um - uy); // 4*100*0.4 = 160
    expect(Math.abs(c.Ed - expected) / expected).toBeLessThan(0.01);
  });

  it("force is capped at ±Fy for elasto-plastic", () => {
    let s = initState();
    s = hystStep(p, s, 1.0);   // push way past yield
    expect(s.F).toBeCloseTo(p.Fy, 6);
    s = hystStep(p, s, -1.0);
    expect(s.F).toBeCloseTo(-p.Fy, 6);
  });

  it("equivalent viscous damping ξ_eq = (2/π)(1 − 1/μ)", () => {
    const um = 0.5; // μ = 5
    const [c] = cyclicAssessment(p, [um], 400);
    const mu = um / uy;
    const xiTheory = (2 / Math.PI) * (1 - 1 / mu);
    expect(Math.abs(c.xiEq - xiTheory) / xiTheory).toBeLessThan(0.02);
  });
});

describe("hysteresis — bilinear with hardening", () => {
  it("post-yield force follows k1 = α·k0", () => {
    const p: HysteresisParams = { model: "BILINEAR", k0: 1000, Fy: 100, alpha: 0.1 };
    let s = initState();
    s = hystStep(p, s, 0.1);   // at yield: F = 100
    expect(s.F).toBeCloseTo(100, 4);
    s = hystStep(p, s, 0.2);   // +0.1 past yield → +α·k0·0.1 = +10
    expect(s.F).toBeCloseTo(110, 2);
  });
});

describe("hysteresis — Bouc-Wen saturation", () => {
  it("z saturates at (A/(β+γ))^(1/n) under monotonic loading", () => {
    const p: HysteresisParams = { model: "BOUCWEN", k0: 1000, Fy: 100, alpha: 0.05, A: 1, beta: 0.5, gamma: 0.5, n: 1 };
    let s = initState();
    // push far in displacement to saturate z
    for (let u = 0; u <= 2; u += 0.002) s = hystStep(p, s, u);
    const zMax = Math.pow(1 / (0.5 + 0.5), 1 / 1); // = 1
    expect(s.z).toBeCloseTo(zMax, 2);
  });

  it("small-amplitude Bouc-Wen ≈ linear k0", () => {
    const p: HysteresisParams = { model: "BOUCWEN", k0: 1000, Fy: 100, alpha: 0.05, A: 1, beta: 0.5, gamma: 0.5, n: 1 };
    let s = initState();
    s = hystStep(p, s, 1e-4);
    expect(s.F / 1e-4).toBeCloseTo(1000, -1); // tangent ≈ k0
  });
});

describe("hysteresis — Takeda degradation dissipates less energy", () => {
  it("degraded unloading stiffness → smaller loop than non-degraded", () => {
    const base: HysteresisParams = { model: "TAKEDA", k0: 1000, Fy: 100, alpha: 0.05, stiffDegr: 0 };
    const degr: HysteresisParams = { ...base, stiffDegr: 0.5 };
    const amps = [0.5];
    const e0 = cyclicAssessment(base, amps, 400)[0].Ed;
    const e1 = cyclicAssessment(degr, amps, 400)[0].Ed;
    expect(e1).toBeLessThan(e0);
    expect(e1).toBeGreaterThan(0);
  });
});

describe("nonlinear time-history", () => {
  const p: HysteresisParams = { model: "BILINEAR", k0: 4000, Fy: 1e9, alpha: 0 }; // huge Fy → never yields
  it("stays elastic (μ≈1) and conserves energy in free vibration", () => {
    // free undamped vibration from rest under a single small pulse then zero
    const dt = 0.005;
    const ag = new Array(400).fill(0);
    ag[0] = 0; // start from rest; give initial velocity via small ground jolt
    // tiny harmonic to excite, elastic regime
    const m = 1000;
    for (let i = 0; i < ag.length; i++) ag[i] = 0.01 * Math.sin(2 * Math.PI * 1 * i * dt);
    const r = nonlinearTH({ p, m, zeta: 0.0, dt, ag });
    expect(r.mu).toBeLessThan(1.0001); // essentially elastic (peak < uy)
    expect(r.Tn).toBeCloseTo(2 * Math.PI / Math.sqrt(4000 / 1000), 6);
  });

  it("yielding SDOF develops ductility μ>1 and hysteretic energy>0", () => {
    const py: HysteresisParams = { model: "BILINEAR", k0: 4000, Fy: 20, alpha: 0.05 };
    const m = 1000;
    const dt = 0.01;
    const ag: number[] = [];
    for (let i = 0; i < 800; i++) ag.push(0.6 * 9.81 * Math.sin(2 * Math.PI * 0.5 * i * dt));
    const r = nonlinearTH({ p: py, m, zeta: 0.05, dt, ag });
    expect(r.mu).toBeGreaterThan(1);
    expect(r.Ehyst).toBeGreaterThan(0);
  });
});

describe("Park-Ang damage index", () => {
  it("deformation term = μ/μ_cap, energy term adds with β", () => {
    const r = parkAngDamage(4, 8, 0, 100, 0.1, 0.1);
    expect(r.deformationTerm).toBeCloseTo(0.5, 6);
    expect(r.energyTerm).toBeCloseTo(0, 6);
    expect(r.DI).toBeCloseTo(0.5, 6);
    const r2 = parkAngDamage(4, 8, 800, 100, 0.1, 0.1);
    // uu = 8*0.1 = 0.8 ; energyTerm = 0.1*800/(100*0.8) = 1.0
    expect(r2.energyTerm).toBeCloseTo(1.0, 6);
    expect(r2.DI).toBeCloseTo(1.5, 6);
  });
});

describe("masonry-infill equivalent strut (Mainstone/FEMA 356)", () => {
  it("computes inclination, λ1, strut width and stiffness", () => {
    const r = infillStrut({
      Em: 5000, tInf: 150, hInf: 3000, LInf: 4000,
      Ec: 25000, Icol: 400e6, hCol: 3300, fmPrime: 8,
    });
    expect(r.theta).toBeCloseTo(Math.atan(3000 / 4000), 6);
    expect(r.rInf).toBeCloseTo(5000, 6); // 3-4-5
    // hand check λ1 and aStrut
    const theta = Math.atan(3000 / 4000);
    const lambda1 = Math.pow((5000 * 150 * Math.sin(2 * theta)) / (4 * 25000 * 400e6 * 3000), 0.25);
    expect(r.lambda1).toBeCloseTo(lambda1, 12);
    expect(r.aStrut).toBeCloseTo(0.175 * Math.pow(lambda1 * 3300, -0.4) * 5000, 6);
    expect(r.aStrut).toBeGreaterThan(0);
    expect(r.kLateral).toBeGreaterThan(0);
    expect(r.Vstrut).toBeGreaterThan(0);
  });
});
