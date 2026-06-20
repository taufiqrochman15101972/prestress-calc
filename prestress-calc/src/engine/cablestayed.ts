/**
 * cablestayed.ts — Cable-supported (cable-stayed) bridge preliminary analysis.
 * Procedure/flow after Gimsing & Georgakis "Cable Supported Bridges — Concept
 * and Design" 3rd Ed. PDF numbers are NOT code references — only the procedure.
 *
 * Covers: fan/harp/semi-fan stay geometry, stay force from tributary deck load
 * (vertical component balance), required stay area from allowable stress, sag/
 * Ernst effective modulus (cable sag reduces axial stiffness), pylon axial from
 * the sum of vertical stay components, and the horizontal deck compression
 * accumulated by the horizontal stay components toward the pylon.
 *
 * Units (SI): force kN · length m · stress MPa · area mm². Frozen results.
 */

export type StayLayout = "FAN" | "HARP" | "SEMI_FAN";

export interface CableStayedInputs {
  /** main span, m */
  mainSpan: number;
  /** pylon height above deck, m */
  pylonHeight: number;
  /** number of stays per side (one plane), n */
  nStays: number;
  layout: StayLayout;
  /** uniform deck dead+live load, kN/m */
  w: number;
  /** stay allowable stress (≈0.45 f_pu), MPa */
  sigmaAllow: number;
  /** stay steel unit weight, kN/m³ (≈ 78.5) */
  gammaCable: number;
  /** cable modulus E, MPa (≈ 195 000) */
  Ecable: number;
}

export interface StayRow {
  readonly index: number;
  readonly x: number;        // anchor distance from pylon, m
  readonly angle: number;    // stay inclination to horizontal, deg
  readonly trib: number;     // tributary deck length, m
  readonly force: number;    // stay axial force, kN
  readonly area: number;     // required area, mm²
  readonly Eeff: number;     // Ernst effective modulus, MPa
}

export interface CableStayedResult {
  readonly stays: ReadonlyArray<StayRow>;
  readonly pylonAxial: number;     // kN (Σ vertical stay components)
  readonly deckCompression: number; // kN (Σ horizontal stay components)
  readonly totalCableForce: number; // kN
  readonly note: string;
}

export function computeCableStayed(i: CableStayedInputs): CableStayedResult {
  const half = i.mainSpan / 2;
  const trib = half / i.nStays;           // equal deck spacing per stay
  const stays: StayRow[] = [];
  let pylonAxial = 0, deckCompression = 0, totalForce = 0;

  for (let k = 1; k <= i.nStays; k++) {
    const x = (k - 0.5) * trib;           // anchor distance from pylon
    // Pylon-top attachment height for the layout.
    const hTop = i.layout === "HARP"
      ? (i.pylonHeight * k) / i.nStays           // distributed down the pylon
      : i.pylonHeight;                           // fan / semi-fan: near top
    const angle = Math.atan2(hTop, x);           // rad
    const Vstay = i.w * trib;                     // vertical load carried
    const force = Vstay / Math.sin(angle);        // axial stay force
    const area = (force * 1000) / i.sigmaAllow;   // mm²  (kN→N / MPa)

    // Ernst effective modulus (sag reduction): Ee = E / (1 + (γ²·Lh²·E)/(12·σ³))
    const Lh = x;                                 // horizontal projected length
    const sigma = force * 1000 / Math.max(area, 1);  // MPa
    const gammaMPa = i.gammaCable / 1e6;          // kN/m³ → N/mm³ ~ MPa/mm
    const Eeff = i.Ecable / (1 + (gammaMPa ** 2 * Lh * Lh * 1e6 * i.Ecable) / (12 * sigma ** 3));

    pylonAxial += force * Math.sin(angle);
    deckCompression += force * Math.cos(angle);
    totalForce += force;
    stays.push({
      index: k, x, angle: (angle * 180) / Math.PI, trib,
      force, area, Eeff,
    });
  }

  return Object.freeze({
    stays: Object.freeze(stays),
    pylonAxial, deckCompression, totalCableForce: totalForce,
    note: `${i.layout} · ${i.nStays} stay/sisi · jarak angkur ${trib.toFixed(1)} m`,
  });
}
