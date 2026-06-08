/**
 * Differential Shrinkage in Composite Members
 * Abeles & Bardhan-Roy, "Prestressed Concrete Designer's Handbook" 3rd Ed.
 * §11.5 / §11.7.4 — analysis after Evans & Parker (also BS 5400 / Hambly).
 *
 * When a cast-in-place deck slab is added to an already-cured precast
 * prestressed girder, the YOUNG deck shrinks (and creeps) more than the older
 * girder.  Were they free, the deck would shorten relative to the girder by a
 * "differential" strain Δε.  Bond prevents that relative movement, so a
 * self-equilibrating set of stresses develops:
 *   • the deck is restrained from shrinking → goes into TENSION,
 *   • a restraint force F_sh (tension in deck = compression in girder, co-linear)
 *     plus a moment M_cs about the composite neutral axis,
 *   • the moment puts TENSION at the girder soffit — it ADDS to the service
 *     bottom-fibre tension and must be included in the soffit crack check.
 * Sustained-load creep relaxes these stresses → a reduction factor
 *   φ_red = (1 − e^(−φ)) / φ.
 *
 * Force/stress method (+ tension, − compression):
 *   F_sh        = Δε · E_deck · A_deck · φ_red           (deck restraint force)
 *   M_cs        = F_sh · a_cent     (a_cent = NA→deck-centroid distance)
 *   f_free      = Δε · E_deck · φ_red   (released free-shrink tension in deck)
 *   σ(deck)     =  f_free − F_sh/A_c − M_cs·y/I_c   (y above NA +)
 *   σ(girder)   =        − F_sh/A_c ± M_cs·y/I_c
 *
 * Internal SI: N, mm, MPa.  NOTE: the Evans-Parker procedure & φ_red form are
 * the book's; Δε and moduli follow the project's adopted code, not the book's
 * worked numbers.
 */

export interface DiffShrinkageInputs {
  /** Differential shrinkage strain Δε (×10⁻⁶) — deck relative to girder */
  epsDiffMicro: number;
  /** Deck concrete elastic modulus E_deck (MPa); if 0 → 4700√f'c_deck */
  Edeck: number;
  /** f'c of deck (MPa) — used only if Edeck = 0 */
  fcDeck: number;
  /** Effective deck width b_eff (mm) */
  bEff: number;
  /** Deck thickness t_d (mm) */
  td: number;
  /** Composite gross area A_c (mm²) */
  Ac: number;
  /** Composite second moment of area I_c (mm⁴) */
  Ic: number;
  /** Distance from composite NA up to the TOP of the deck (mm) */
  yTopSlab: number;
  /** Total composite depth incl. deck (mm) — gives the girder soffit lever */
  Htotal: number;
  /** Creep coefficient φ for the stress-relaxation reduction factor */
  phiCreep: number;
}

export interface DiffShrinkageResult {
  readonly Edeck: number;
  readonly Adeck: number;        // mm²
  readonly phiRed: number;       // creep reduction (1−e^−φ)/φ
  readonly aCent: number;        // NA → deck centroid (mm)
  readonly Fsh: number;          // restraint force (kN, + = tension in deck)
  readonly Mcs: number;          // differential-shrinkage moment (kN·m)
  readonly fFree: number;        // released free-shrink stress in deck (MPa)
  readonly sigmaTopSlab: number; // MPa (+ tension)
  readonly sigmaBotSlab: number; // at interface, deck side
  readonly sigmaTopGirder: number; // at interface, girder side
  readonly sigmaBotGirder: number; // girder soffit (governs crack check)
  readonly addsSoffitTension: boolean; // true if soffit goes into tension
}

export function computeDiffShrinkage(inp: DiffShrinkageInputs): DiffShrinkageResult {
  const { epsDiffMicro, fcDeck, bEff, td, Ac, Ic, yTopSlab, Htotal, phiCreep } = inp;

  const Edeck = inp.Edeck > 0 ? inp.Edeck : 4700 * Math.sqrt(fcDeck);
  const Adeck = bEff * td;
  const epsDiff = epsDiffMicro * 1e-6;

  // Creep relaxation reduction factor
  const phiRed = phiCreep > 0 ? (1 - Math.exp(-phiCreep)) / phiCreep : 1.0;

  // Lever arms about the composite neutral axis
  const aCent = yTopSlab - td / 2;       // NA → deck centroid
  const yIntf = yTopSlab - td;           // NA → slab/girder interface
  const yBot = Htotal - yTopSlab;        // NA → girder soffit (below NA)

  // Restraint force and moment (creep-reduced)
  const Fsh_N = epsDiff * Edeck * Adeck * phiRed;     // N (+ tension in deck)
  const Mcs_Nmm = Fsh_N * aCent;                       // N·mm (sagging)
  const fFree = epsDiff * Edeck * phiRed;              // MPa (released tension)

  // Self-equilibrating stresses (+ tension). For points ABOVE the NA the
  // sagging M_cs gives compression (−M·y/I); below the NA it gives tension.
  const axial = -Fsh_N / Ac;                           // compression on composite
  const sigmaTopSlab   = fFree + axial - (Mcs_Nmm * yTopSlab) / Ic;
  const sigmaBotSlab   = fFree + axial - (Mcs_Nmm * yIntf) / Ic;
  const sigmaTopGirder = axial - (Mcs_Nmm * yIntf) / Ic;
  const sigmaBotGirder = axial + (Mcs_Nmm * yBot) / Ic;

  return Object.freeze({
    Edeck, Adeck, phiRed, aCent,
    Fsh: Fsh_N / 1000,
    Mcs: Mcs_Nmm / 1e6,
    fFree,
    sigmaTopSlab, sigmaBotSlab, sigmaTopGirder, sigmaBotGirder,
    addsSoffitTension: sigmaBotGirder > 0,
  });
}
