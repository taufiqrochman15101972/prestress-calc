/**
 * Unit System Utilities
 * All engine calculations remain in SI (N, mm, MPa).
 * This module provides display-time conversion to US customary units.
 *
 * SI  : kN, mm, MPa, kN·m, mm², mm⁴
 * US  : kip, in, ksi, kip·ft, in², in⁴
 */

export type UnitSystem = "SI" | "US";
export type FormulaVariant = "STANDARD" | "KERNEL";
export type PrestressType  = "FULL" | "PARTIAL";
export type ACIBeamClass   = "U" | "T" | "C";

// ── Conversion factors (SI → US) ────────────────────────────
const KN_TO_KIP     = 0.22480894;   // 1 kN = 0.2248 kip
const KNM_TO_KIPFT  = 0.73756215;   // 1 kN·m = 0.7376 kip·ft
const MPa_TO_KSI    = 0.14503774;   // 1 MPa = 0.14504 ksi
const MM_TO_IN      = 1 / 25.4;     // 1 mm = 0.03937 in
const MM2_TO_IN2    = MM_TO_IN ** 2;
const MM3_TO_IN3    = MM_TO_IN ** 3;
const MM4_TO_IN4    = MM_TO_IN ** 4;
const KNPM_TO_KIPFT = KN_TO_KIP * 0.3048; // 1 kN/m = 0.06852 kip/ft

// ── Label sets ───────────────────────────────────────────────

export interface UnitLabels {
  force: string;
  stress: string;
  length: string;
  moment: string;
  area: string;
  smz: string;
  inertia: string;
  udl: string;
  density: string;
}

export const LABELS: Record<UnitSystem, UnitLabels> = {
  SI: {
    force:   "kN",
    stress:  "MPa",
    length:  "mm",
    moment:  "kN·m",
    area:    "mm²",
    smz:     "mm³",
    inertia: "mm⁴",
    udl:     "kN/m",
    density: "kN/m³",
  },
  US: {
    force:   "kip",
    stress:  "ksi",
    length:  "in",
    moment:  "kip·ft",
    area:    "in²",
    smz:     "in³",
    inertia: "in⁴",
    udl:     "kip/ft",
    density: "kip/ft³",
  },
};

// ── Display helpers ──────────────────────────────────────────

function fi(v: number, dec: number): string { return v.toFixed(dec); }

export function dispForce(kN: number, sys: UnitSystem, dec = 1): string {
  return sys === "SI"
    ? `${fi(kN, dec)} kN`
    : `${fi(kN * KN_TO_KIP, dec)} kip`;
}

export function dispStress(MPa: number, sys: UnitSystem, dec = 2): string {
  return sys === "SI"
    ? `${fi(MPa, dec)} MPa`
    : `${fi(MPa * MPa_TO_KSI, dec)} ksi`;
}

export function dispLength(mm: number, sys: UnitSystem, dec?: number): string {
  if (sys === "SI") return `${fi(mm, dec ?? 0)} mm`;
  return `${fi(mm * MM_TO_IN, dec ?? 2)} in`;
}

export function dispMoment(kNm: number, sys: UnitSystem, dec = 1): string {
  return sys === "SI"
    ? `${fi(kNm, dec)} kN·m`
    : `${fi(kNm * KNM_TO_KIPFT, dec)} kip·ft`;
}

export function dispArea(mm2: number, sys: UnitSystem, dec?: number): string {
  if (sys === "SI") return `${fi(mm2, dec ?? 0)} mm²`;
  return `${fi(mm2 * MM2_TO_IN2, dec ?? 3)} in²`;
}

export function dispSmz(mm3: number, sys: UnitSystem, dec = 3): string {
  if (sys === "SI") return `${(mm3 / 1e6).toFixed(dec)}×10⁶ mm³`;
  return `${fi(mm3 * MM3_TO_IN3, 1)} in³`;
}

export function dispInertia(mm4: number, sys: UnitSystem, dec = 4): string {
  if (sys === "SI") return `${(mm4 / 1e11).toFixed(dec)}×10¹¹ mm⁴`;
  return `${fi(mm4 * MM4_TO_IN4, 0)} in⁴`;
}

export function dispUDL(kNm: number, sys: UnitSystem, dec = 2): string {
  return sys === "SI"
    ? `${fi(kNm, dec)} kN/m`
    : `${fi(kNm * KNPM_TO_KIPFT, dec)} kip/ft`;
}

/** Raw numeric conversion only (no label) — for inputs */
export const convert = {
  /** kN → kip */     forceToUS: (kN: number)  => kN  * KN_TO_KIP,
  /** MPa → ksi */    stressToUS: (MPa: number) => MPa * MPa_TO_KSI,
  /** mm → in */      lengthToUS: (mm: number)  => mm  * MM_TO_IN,
  /** kN·m → kip·ft */momentToUS: (kNm: number) => kNm * KNM_TO_KIPFT,
  /** mm² → in² */    areaToUS:   (mm2: number) => mm2 * MM2_TO_IN2,
  /** kN/m → kip/ft */udlToUS:    (kNm: number) => kNm * KNPM_TO_KIPFT,
  /** kip → kN */     forceToSI:  (kip: number) => kip / KN_TO_KIP,
  /** ksi → MPa */    stressToSI: (ksi: number) => ksi / MPa_TO_KSI,
  /** in → mm */      lengthToSI: (inp: number) => inp / MM_TO_IN,
  /** kip·ft → kN·m */momentToSI: (kft: number) => kft / KNM_TO_KIPFT,
};
