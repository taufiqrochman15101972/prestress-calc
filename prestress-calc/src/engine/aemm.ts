/**
 * Time-Dependent Cross-Section Analysis — Age-Adjusted Effective
 * Modulus Method (AEMM)
 * Gilbert, Mickleborough & Ranzi "Design of Prestressed Concrete to
 * Eurocode 2" §5.7 (uncracked section) and §5.11.4 (creep- and
 * shrinkage-induced curvature), after Trost–Bažant.
 *
 * Concept: the stress history of a prestressed section is gradual, so
 * creep of stress increments is reduced by the ageing coefficient χ:
 *
 *   E_e   = E_c / (1 + φ)          effective modulus (constant stress)
 *   Ē_e   = E_c / (1 + χ·φ)        age-adjusted effective modulus
 *
 * Procedure (reference axis at the gross-section centroid):
 *  1. Instantaneous state from sustained actions N₀ = −P_e,
 *     M₀ = M_sus − P_e·e:  ε₀ = N₀/(E_c·A),  κ₀ = M₀/(E_c·I).
 *  2. Restraining actions if the time effects were fully restrained:
 *       creep      : δN_cr = −Ē_e·φ·ε₀·A,   δM_cr = −Ē_e·φ·κ₀·I
 *       shrinkage  : δN_sh = −Ē_e·ε_sh·A    (ε_sh < 0 = shortening)
 *       relaxation : δN_r  = −Δσ_rel·A_ps applied at the tendon level
 *  3. Release the restraint on the AGE-ADJUSTED transformed section
 *     (n̄ = E_p/Ē_e):  [Ā B̄; B̄ Ī]{Δε, Δκ} = −{δN, δM}/Ē_e.
 *  4. Final curvature κ∞ = κ₀ + Δκ → long-term deflection;
 *     change of steel stress Δσ_p = E_p·(Δε − Δκ·e) (loss cross-check);
 *     final concrete fibre stresses from the imposed strain minus the
 *     free creep + shrinkage strain.
 *
 * Sign convention: + tension, − compression; ε_sh entered POSITIVE as a
 * magnitude (treated as shortening); y measured + upward from centroid.
 * Internal SI: N, mm, MPa.
 */

export interface AEMMInputs {
  /** Gross area A (mm²) */
  A: number;
  /** Gross inertia I (mm⁴) */
  I: number;
  /** Centroid from bottom y_b (mm) */
  yb: number;
  /** Section depth h (mm) */
  h: number;
  /** Concrete modulus at loading age E_c (MPa) */
  Ec: number;
  /** Tendon modulus E_p (MPa) */
  Eps: number;
  /** Tendon area A_ps (mm²) */
  Aps: number;
  /** Tendon eccentricity below centroid e (mm, +down) */
  e: number;
  /** Effective prestress at start of period P_e (kN) */
  Pe: number;
  /** Sustained moment M_sus = M_g + M_sdl (kN·m) */
  Msus: number;
  /** Creep coefficient φ(t,t₀) */
  phi: number;
  /** Ageing coefficient χ (≈ 0.80 typical) */
  chi: number;
  /** Final shrinkage magnitude ε_sh (×10⁻⁶, positive number) */
  epsShMicro: number;
  /** Intrinsic relaxation loss Δσ_rel of the tendon (MPa) */
  deltaSigmaRel: number;
  /** Span (mm) for the deflection integration */
  spanMm: number;
}

export interface AEMMResult {
  readonly Ee: number;            // effective modulus (MPa)
  readonly EeBar: number;         // age-adjusted effective modulus (MPa)
  readonly eps0: number;          // instantaneous axial strain (×10⁻⁶)
  readonly kappa0: number;        // instantaneous curvature (×10⁻⁶ /mm)
  readonly dEps: number;          // time-dependent axial strain change (×10⁻⁶)
  readonly dKappa: number;        // time-dependent curvature change (×10⁻⁶ /mm)
  readonly kappaFinal: number;    // κ∞ (×10⁻⁶ /mm)
  readonly deltaInstMm: number;   // midspan deflection at t₀ (mm, + sag)
  readonly deltaFinalMm: number;  // midspan deflection at t∞ (mm, + sag)
  readonly multiplier: number;    // δ∞/δ₀ — compare with PCI 2.45 etc.
  readonly dSigmaP: number;       // tendon stress change (MPa, − = loss)
  readonly lossPct: number;       // |Δσ_p| / σ_p0 × 100 (%)
  readonly sigmaTop0: number;     // concrete top stress at t₀ (MPa)
  readonly sigmaBot0: number;     // bottom at t₀ (MPa)
  readonly sigmaTopInf: number;   // top at t∞ (MPa)
  readonly sigmaBotInf: number;   // bottom at t∞ (MPa)
}

export function computeAEMM(inp: AEMMInputs): AEMMResult {
  const {
    A, I, yb, h, Ec, Eps, Aps, e, Pe, Msus,
    phi, chi, epsShMicro, deltaSigmaRel, spanMm,
  } = inp;

  const Ee    = Ec / (1 + phi);
  const EeBar = Ec / (1 + chi * phi);
  const epsSh = -epsShMicro * 1e-6;        // shortening = negative strain

  // 1 ── instantaneous state (reference axis at the gross centroid)
  const N0 = -Pe * 1000;                    // N (compression)
  const M0 = Msus * 1e6 - Pe * 1000 * e;    // N·mm (+ sag)
  const eps0   = N0 / (Ec * A);
  const kappa0 = M0 / (Ec * I);

  // 2 ── restraining actions (fully-restrained time effects)
  const dNcr = -EeBar * phi * eps0 * A;
  const dMcr = -EeBar * phi * kappa0 * I;
  const dNsh = -EeBar * epsSh * A;
  const dMsh = 0;                           // uniform shrinkage on symmetric ref axis
  // relaxation force applied at the tendon level y_p = −e
  const dNr = -deltaSigmaRel * Aps;
  const dMr = -dNr * e;                     // = +Δσ·Aps·e about centroid

  const dN = dNcr + dNsh + dNr;
  const dM = dMcr + dMsh + dMr;

  // 3 ── release on age-adjusted transformed section (steel restrains)
  const nBar = Eps / EeBar;
  const Abar = A + nBar * Aps;
  const Bbar = nBar * Aps * (-e);           // steel below centroid
  const Ibar = I + nBar * Aps * e * e;
  const det  = Abar * Ibar - Bbar * Bbar;
  const dEps   = (-dN * Ibar + dM * Bbar) / (EeBar * det);
  const dKappa = (-dM * Abar + dN * Bbar) / (EeBar * det);

  // 4 ── results
  const kappaFinal = kappa0 + dKappa;
  // midspan deflection of a simple span with ~uniform curvature
  // distribution from a parabolic tendon + UDL: δ ≈ 5/48·κ·L²
  const deltaInst  = (5 / 48) * kappa0 * spanMm * spanMm;
  const deltaFinal = (5 / 48) * kappaFinal * spanMm * spanMm;

  const dSigmaP = Eps * (dEps + dKappa * (-e));  // strain at tendon level
  const sigmaP0 = Aps > 0 ? (Pe * 1000) / Aps : 0;
  const lossPct = sigmaP0 > 0 ? Math.abs(Math.min(dSigmaP, 0)) / sigmaP0 * 100 : 0;

  // concrete fibre stresses: σ∞ = σ₀ + Ē·(Δε_imposed − Δε_free)
  const yTop = h - yb, yBot = -yb;
  const fibre0   = (y: number) => Ec * (eps0 + kappa0 * y);
  const fibreInf = (y: number) => {
    const dImposed = dEps + dKappa * y;                  // actual strain change
    const dFree    = phi * (eps0 + kappa0 * y) + epsSh;  // unrestrained creep+shrinkage
    return fibre0(y) + EeBar * (dImposed - dFree);
  };

  return Object.freeze({
    Ee, EeBar,
    eps0:   eps0 * 1e6,
    kappa0: kappa0 * 1e6,
    dEps:   dEps * 1e6,
    dKappa: dKappa * 1e6,
    kappaFinal: kappaFinal * 1e6,
    deltaInstMm:  deltaInst,
    deltaFinalMm: deltaFinal,
    multiplier: Math.abs(deltaInst) > 1e-9 ? deltaFinal / deltaInst : 0,
    dSigmaP,
    lossPct,
    sigmaTop0:   fibre0(yTop),
    sigmaBot0:   fibre0(yBot),
    sigmaTopInf: fibreInf(yTop),
    sigmaBotInf: fibreInf(yBot),
  });
}

// ─────────────────────────────────────────────────────────────────
// Superstructure shortening & expansion-joint movement
// (procedure per the LRFD design-example flow / WSDOT BDM §5.8.1.E:
//  total movement = elastic + creep + shrinkage shortening + thermal
//  range; joint gap sized with a movement factor γ ≈ 1.2).
// Reuses the AEMM time parameters so the long-term strains stay
// consistent with the cross-section analysis above.
// ─────────────────────────────────────────────────────────────────

export interface JointMovementInputs {
  /** Contributing superstructure length to the joint L (m) */
  L: number;
  /** Effective prestress P_e (kN) */
  Pe: number;
  /** Section area A (mm²) */
  A: number;
  /** Concrete modulus E_c (MPa) */
  Ec: number;
  /** Creep coefficient φ */
  phi: number;
  /** Shrinkage magnitude ε_sh (×10⁻⁶) */
  epsShMicro: number;
  /** Coefficient of thermal expansion α (×10⁻⁶/°C, ≈ 10) */
  alphaMicro: number;
  /** Temperature rise above mean (°C) */
  dTplus: number;
  /** Temperature fall below mean (°C) */
  dTminus: number;
  /** Movement factor γ on the total (≈ 1.2) */
  gamma: number;
}

export interface JointMovementResult {
  /** Elastic shortening P/(A·E)·L (mm) */
  readonly dElastic: number;
  /** Creep shortening φ·δ_elastic (mm) */
  readonly dCreep: number;
  /** Shrinkage shortening ε_sh·L (mm) */
  readonly dShrink: number;
  /** Thermal closing (expansion) α·ΔT⁺·L (mm) */
  readonly dThermalPlus: number;
  /** Thermal opening (contraction) α·ΔT⁻·L (mm) */
  readonly dThermalMinus: number;
  /** Total joint OPENING movement (shortening side, mm) */
  readonly openTotal: number;
  /** Total joint CLOSING movement (mm) */
  readonly closeTotal: number;
  /** Design movement range γ·(open + close) (mm) */
  readonly designRange: number;
}

export function computeJointMovement(inp: JointMovementInputs): JointMovementResult {
  const { L, Pe, A, Ec, phi, epsShMicro, alphaMicro, dTplus, dTminus, gamma } = inp;
  const Lmm = L * 1000;

  const epsEl = A > 0 && Ec > 0 ? (Pe * 1000) / (A * Ec) : 0;
  const dElastic = epsEl * Lmm;
  const dCreep = phi * dElastic;
  const dShrink = (epsShMicro * 1e-6) * Lmm;
  const dThermalPlus = (alphaMicro * 1e-6) * dTplus * Lmm;
  const dThermalMinus = (alphaMicro * 1e-6) * dTminus * Lmm;

  // PT shortening + shrinkage + cooling OPEN the joint; warming CLOSES it.
  const openTotal = dElastic + dCreep + dShrink + dThermalMinus;
  const closeTotal = dThermalPlus;
  const designRange = gamma * (openTotal + closeTotal);

  return Object.freeze({
    dElastic, dCreep, dShrink, dThermalPlus, dThermalMinus,
    openTotal, closeTotal, designRange,
  });
}
