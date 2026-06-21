/**
 * baseisolation.ts — Seismic BASE ISOLATION & supplemental DAMPING design
 * (MIDAS/Robot isolator-damper, AASHTO Guide Spec for Seismic Isolation / SNI).
 * A flexible isolation layer (lateral stiffness K_iso + high damping ζ_iso)
 * lengthens the period and detunes from the ground motion → reduced base shear,
 * at the cost of large isolator displacement. Computes the isolated period,
 * damping reduction factor B, isolator displacement, and the base-shear
 * reduction vs the fixed-base structure.
 *
 * Units: W kN, K_iso kN/m, periods s, accel g, displacement mm.
 */
const G = 9.81;

export interface IsolationInputs {
  W: number;          // seismic weight, kN
  Kiso: number;       // isolation-system effective stiffness, kN/m
  zetaIso: number;    // isolator effective damping ratio (0.05–0.30)
  Tfixed: number;     // fixed-base period, s
  SDS: number; SD1: number;   // design spectrum (g)
}
export interface IsolationResult {
  readonly Tiso: number;      // isolated period, s
  readonly B: number;         // damping reduction factor
  readonly SaFixed: number;   // g
  readonly SaIso: number;     // g (after B)
  readonly Vfixed: number;    // fixed-base shear, kN
  readonly Viso: number;      // isolated base shear, kN
  readonly dIso: number;      // isolator displacement, mm
  readonly reductionPct: number;
}

/** design-spectrum ordinate Sa(T) from SDS/SD1 (g). */
function Sa(T: number, SDS: number, SD1: number): number {
  const Ts = SD1 / SDS, T0 = 0.2 * Ts;
  if (T < T0) return SDS * (0.4 + 0.6 * T / T0);
  if (T <= Ts) return SDS;
  return SD1 / T;
}

export function computeBaseIsolation(i: IsolationInputs): IsolationResult {
  const m = i.W / G;                     // ton (kN·s²/m)
  const Tiso = 2 * Math.PI * Math.sqrt(m / i.Kiso);
  // damping reduction factor B (AASHTO isolation table, fitted): B=(ζ/0.05)^0.3
  const B = Math.max(0.8, Math.pow(i.zetaIso / 0.05, 0.3));
  const SaFixed = Sa(i.Tfixed, i.SDS, i.SD1);
  const SaIso = Sa(Tiso, i.SDS, i.SD1) / B;
  const Vfixed = SaFixed * i.W;
  const Viso = SaIso * i.W;
  // isolator displacement d = Sa·g·(T/2π)²  (spectral displacement), mm
  const dIso = SaIso * G * (Tiso / (2 * Math.PI)) ** 2 * 1000;
  return Object.freeze({
    Tiso, B, SaFixed, SaIso, Vfixed, Viso, dIso,
    reductionPct: Vfixed > 0 ? (1 - Viso / Vfixed) * 100 : 0,
  });
}
