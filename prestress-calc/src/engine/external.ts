/**
 * External / Unbonded Prestressing Engine
 * Nigel R. Hewson, "Prestressed Concrete Bridges" §6 (deviators) & §7
 * (internal vs external tendons) + PTI "Post-Tensioning Manual" §3.2.3
 * (External Post-Tensioning Systems).
 *
 * External tendons run OUTSIDE the concrete section, deviated only at discrete
 * points (deviators / saddles) and anchored at the ends → a POLYGONAL profile.
 * This changes the analysis vs internal bonded tendons:
 *
 *  • The tendon eccentricity is defined only at anchorages and deviators; it is
 *    a straight chord between them (constant slope per segment).
 *  • Each angular change at a deviator produces a concentrated DEVIATOR FORCE
 *    F = 2·P·sin(Δθ/2)  (≈ P·Δθ for small angles) — designed for, and a
 *    source of friction loss μ·Δθ per deviator.
 *  • The tendon provides an EQUIVALENT UPLIFT (load-balancing) via the deviator
 *    forces — analogous to a draped internal tendon but piecewise.
 *  • SECOND-ORDER eccentricity loss: under load the beam deflects but a straight
 *    external tendon between deviators does not follow it, so the lever arm at
 *    mid-span is reduced by ≈ the beam deflection between deviator points.
 *  • At ULS the stress increase Δf_ps is MEMBER-dependent (unbonded), not from
 *    section strain compatibility — use the ACI 318-19 §20.3.2.4.1 equations.
 *
 * Stress convention: + tension, − compression. Internal SI: N, mm, MPa.
 * NOTE: structure/procedure from Hewson/PTI; the ACI Δf_ps caps/limits are code
 * values, not the book's worked numbers.
 */

export interface ExternalTendonInputs {
  /** Span L (m) */
  L: number;
  /** Number of deviators along the span (e.g. 2 at the third points) */
  nDeviators: number;
  /** Effective prestress force per tendon after losses, P_e (kN) */
  Pe: number;
  /** Tendon eccentricity at the anchorage (mm, + below centroid = sagging drape) */
  eAnchor: number;
  /** Tendon eccentricity at the deviator (mm, + below centroid) */
  eDeviator: number;

  /** Section depth available, dp at the deviated (max-drape) section (mm) */
  dp: number;
  /** Total external tendon area A_ps (mm²) */
  Aps: number;
  /** Effective prestress in the tendon f_pe (MPa) */
  fpe: number;
  /** Tendon yield f_py (MPa) */
  fpy: number;
  /** Concrete f'c (MPa) */
  fc: number;
  /** Compression-face width b for ρ_p (mm) */
  b: number;
  /** Span-to-depth ratio L/h (selects the ACI unbonded Δf_ps equation) */
  spanDepthRatio: number;

  /** Deviator friction coefficient μ (per angular change) */
  mu: number;
  /** Mid-span beam deflection under the governing load (mm) — for 2nd-order loss */
  beamDeflection: number;
}

export interface ExternalTendonResult {
  // Geometry / deviator forces
  readonly thetaSeg: number;     // angle change at a deviator (rad)
  readonly Fdeviator: number;    // deviator force per deviator (kN)
  readonly frictionLoss: number; // friction loss fraction at one deviator
  readonly wEquiv: number;       // equivalent uplift (UDL-equivalent) (kN/m)
  // Second-order eccentricity
  readonly eEffective: number;   // mid-span eccentricity after 2nd-order loss (mm)
  readonly dpEffective: number;  // reduced lever-arm depth (mm)
  // ULS unbonded stress
  readonly rhoP: number;         // prestressing ratio ρ_p
  readonly fps: number;          // stress in unbonded/external tendon at ULS (MPa)
  readonly fpsCap: number;       // governing cap applied (MPa)
  readonly a: number;            // Whitney block depth (mm)
  readonly Mn: number;           // nominal flexural capacity (kN·m)
  readonly phiMn: number;        // φ·Mn (kN·m)
}

const PHI_FLEX = 0.90;

export function computeExternalTendon(inp: ExternalTendonInputs): ExternalTendonResult {
  const {
    L, nDeviators, Pe, eAnchor, eDeviator,
    dp, Aps, fpe, fpy, fc, b, spanDepthRatio,
    mu, beamDeflection,
  } = inp;

  const L_mm = L * 1000;
  const Pe_N = Pe * 1000;

  // ── Polygonal geometry → deviator angle & force ─────────────
  // Drape (rise) from anchor to deviator over the chord length to the deviator.
  const drape = (eDeviator - eAnchor);                 // mm
  // Chord from the anchor to the first deviator (assume evenly spaced)
  const chord = L_mm / (nDeviators + 1);
  const thetaSeg = chord > 0 ? Math.atan2(Math.abs(drape), chord) : 0;
  // Angle change AT a deviator = sum of adjacent slopes (interior deviator ≈ 2θ)
  const angleChange = 2 * thetaSeg;
  const Fdeviator = (2 * Pe_N * Math.sin(angleChange / 2)) / 1000;  // kN
  const frictionLoss = 1 - Math.exp(-mu * angleChange);

  // ── Equivalent uplift (load balancing by the deviator forces) ──
  // Total upward deviator force / span ≈ equivalent UDL.
  const wEquiv = (nDeviators * Fdeviator) / L;          // kN/m

  // ── Second-order eccentricity loss ──────────────────────────
  // Straight tendon between deviators does not follow the beam → at mid-span the
  // drape (lever arm) reduces by the beam deflection between deviator points.
  const eEffective = Math.max(eDeviator - beamDeflection, 0);
  const dpEffective = Math.max(dp - beamDeflection, dp * 0.5);

  // ── ULS unbonded / external tendon stress (ACI 318-19) ──────
  const rhoP = Aps / (b * dpEffective);
  // span/depth ≤ 35: fps = fpe + 70 + f'c/(100ρp); else fpe + 70 + f'c/(300ρp)
  const fpsRaw = spanDepthRatio <= 35
    ? fpe + 70 + fc / (100 * rhoP)
    : fpe + 70 + fc / (300 * rhoP);
  // caps: ≤ fpy and ≤ fpe + (420 if ≤35 else 210)
  const addCap = spanDepthRatio <= 35 ? 420 : 210;
  const fpsCap = Math.min(fpy, fpe + addCap);
  const fps = Math.min(fpsRaw, fpsCap);

  // Whitney block + nominal capacity at the reduced lever arm
  const a = (Aps * fps) / (0.85 * fc * b);
  const Mn = (Aps * fps * (dpEffective - a / 2)) / 1e6;  // kN·m
  const phiMn = PHI_FLEX * Mn;

  return Object.freeze({
    thetaSeg, Fdeviator, frictionLoss, wEquiv,
    eEffective, dpEffective,
    rhoP, fps, fpsCap, a, Mn, phiMn,
  });
}
