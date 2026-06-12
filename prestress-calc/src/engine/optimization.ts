/**
 * Girder-Bridge Cost Optimization — HPC / girder-spacing trade-off
 * Hassanain & Loov, "Design of Prestressed Girder Bridges Using High
 * Performance Concrete — An Optimization Approach" (PCI Journal,
 * Mar–Apr 1999). Cost model also informed by the KTH comparison of
 * construction methods (El Hamad & Tanhan, 2018).
 *
 * The superstructure cost per unit deck area (eq. 1):
 *   C = [ n_g·C_g + C_c·V_c + C_s·(m_pos + m_neg) ] / (W·L)
 * where C_g = cost of ONE girder (materials, production, transport,
 * erection), C_c = deck concrete cost per volume, C_s = cost of
 * non-prestressed steel per mass, W = deck width, L = span.
 *
 * Concrete mix cost ratio vs a 40 MPa reference mix (eq. 2a, SI):
 *   CMCR = 0.936 + (f'c / 100 MPa)³
 * (US: CMCR = 0.936 + (f'c / 14.5 ksi)³.)
 *
 * Transportation + erection (eq. 3): C_te = C_f + n_g·[f(l_g) + f(m_g)]
 * — a fixed mobilization charge plus per-girder length- and mass-
 * dependent charges (modelled here as linear rates).
 *
 * Practical constraint screens from the paper:
 *   girder spacing 3.0–6.0 m · n_g ≥ 2 (≥ 3 preferred for staged
 *   repair / redundancy) · deck thickness ≥ 225 mm · span/depth
 *   feasibility is checked upstream by the SLS/ULS pipeline.
 *
 * Pure function — returns a frozen result object. SI units:
 * m, mm, MPa, kN; costs in user currency units (consistent).
 */

export interface CostAlternative {
  name: string;        // e.g. "4 gelagar · f'c 60"
  ng: number;          // number of girders
  Ag: number;          // girder cross-section area (mm²)
  fcGirder: number;    // girder concrete strength (MPa)
}

export interface OptimizationInputs {
  W: number;            // deck width (m)
  L: number;            // span length (m)
  td: number;           // deck thickness (mm)
  fcRef: number;        // reference mix strength for girder base cost (MPa, typ. 40)
  cGirderConc: number;  // girder concrete-in-place cost at fcRef (per m³ — forms, labour incl.)
  cDeckConc: number;    // deck concrete cost in place (per m³)
  cSteel: number;       // non-prestressed steel cost (per kg)
  mSteelDeck: number;   // mild-steel mass in deck + girders (kg total)
  cFixedTE: number;     // fixed mobilization charge for transport+erection (lump)
  cPerGirderTE: number; // per-girder transport+erection charge (per girder)
  alternatives: CostAlternative[];
}

export interface AlternativeResult {
  readonly name: string;
  readonly ng: number;
  readonly fcGirder: number;
  readonly spacing: number;       // W / ng (m)
  readonly CMCR: number;          // mix cost ratio vs fcRef
  readonly girderVol: number;     // n_g·A_g·L (m³)
  readonly costGirders: number;   // n_g·C_g
  readonly costDeck: number;      // C_c·V_c
  readonly costSteel: number;     // C_s·m_s
  readonly costTE: number;        // transport + erection
  readonly costTotal: number;
  readonly costPerM2: number;     // C — cost per m² deck (eq. 1)
  readonly spacingOk: boolean;    // 3.0 ≤ S ≤ 6.0 m
  readonly ngOk: boolean;         // n_g ≥ 2
  readonly feasible: boolean;
}

export interface OptimizationResult {
  readonly deckVol: number;          // m³
  readonly deckOk: boolean;          // t_d ≥ 225 mm
  readonly alternatives: readonly AlternativeResult[];
  readonly bestIdx: number;          // cheapest FEASIBLE alternative (−1 if none)
  readonly bestName: string;
  readonly savingPct: number;        // best vs most expensive feasible (%)
}

/** CMCR — concrete mix cost ratio, eq. (2a) SI form. */
export function concreteMixCostRatio(fc: number): number {
  return 0.936 + Math.pow(fc / 100, 3);
}

export function computeCostOptimization(inp: OptimizationInputs): OptimizationResult {
  const { W, L, td, fcRef, cGirderConc, cDeckConc, cSteel, mSteelDeck, cFixedTE, cPerGirderTE } = inp;

  const deckVol = W * L * (td / 1000);       // m³
  const deckOk = td >= 225;
  const cmcrRef = concreteMixCostRatio(fcRef);

  const alts: AlternativeResult[] = inp.alternatives.map(a => {
    const spacing = a.ng > 0 ? W / a.ng : 0;
    const CMCR = concreteMixCostRatio(a.fcGirder);
    const girderVol = (a.ng * a.Ag * (L * 1000)) / 1e9;   // mm²·mm → m³
    // one girder's cost scales with its volume and its mix cost ratio
    const costGirders = girderVol * cGirderConc * (CMCR / cmcrRef);
    const costDeck = deckVol * cDeckConc;
    const costSteel = mSteelDeck * cSteel;
    const costTE = cFixedTE + a.ng * cPerGirderTE;
    const costTotal = costGirders + costDeck + costSteel + costTE;
    const spacingOk = spacing >= 3.0 && spacing <= 6.0;
    const ngOk = a.ng >= 2;
    return {
      name: a.name, ng: a.ng, fcGirder: a.fcGirder, spacing,
      CMCR, girderVol, costGirders, costDeck, costSteel, costTE, costTotal,
      costPerM2: costTotal / (W * L),
      spacingOk, ngOk, feasible: spacingOk && ngOk,
    };
  });

  let bestIdx = -1;
  let worst = -Infinity;
  for (let i = 0; i < alts.length; i++) {
    if (!alts[i].feasible) continue;
    if (bestIdx === -1 || alts[i].costPerM2 < alts[bestIdx].costPerM2) bestIdx = i;
    if (alts[i].costPerM2 > worst) worst = alts[i].costPerM2;
  }
  const savingPct =
    bestIdx >= 0 && worst > 0 ? ((worst - alts[bestIdx].costPerM2) / worst) * 100 : 0;

  return Object.freeze({
    deckVol, deckOk,
    alternatives: Object.freeze(alts),
    bestIdx,
    bestName: bestIdx >= 0 ? alts[bestIdx].name : "—",
    savingPct,
  });
}
