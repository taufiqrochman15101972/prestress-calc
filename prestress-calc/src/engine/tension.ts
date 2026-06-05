/**
 * Prestressed Concrete Tension Members
 * Nilson "Design of Prestressed Concrete" 2nd Ed.
 *   §11.7  Behavior of Tension Members
 *   §11.8  Example: Behavior of Prestressed Concrete Tension Element
 *   §11.9  Design of Tension Members
 *   §11.10 Example: Design of Rigid-Frame Tie Member
 *
 * ── Concept ──────────────────────────────────────────────────
 * A concentrically prestressed tie carries axial tension N. The
 * effective prestress Pe first compresses the concrete; as N grows
 * the member passes through:
 *
 *   N = 0          concrete at −Pe/Ac (compression)
 *   N = N_dec      concrete decompressed (σ = 0)        N_dec = Pe
 *   N = N_cr       concrete reaches +f_ct → cracks      N_cr = Pe + f_ct·Ac
 *   N = N_n        steel at ultimate                    N_n = Aps·fpu + As·fy
 *
 * Axial stiffness drops sharply at cracking:
 *   Uncracked: AE = Ec·(Ac + (n−1)Aps + (ns−1)As)   (transformed)
 *   Cracked:   AE = Ep·Aps + Es·As                  (steel only)
 *
 * Steel-stress rise:
 *   Uncracked: Δf_p = n·(N − N_dec)/A_trans
 *   Cracked:   the strand carries essentially all of N
 *
 * Sign convention here: N positive = applied tension.
 */

export interface TensionMemberInputs {
  /** Gross concrete area Ac (mm²) */
  Ac: number;
  /** Prestressed steel area (mm²) */
  Aps: number;
  /** Mild steel area (mm²) */
  As: number;
  /** Effective prestress stress f_se (MPa) */
  fse: number;
  /** Strand ultimate fpu (MPa) */
  fpu: number;
  /** Strand yield fpy (MPa) */
  fpy: number;
  /** Strand modulus Ep (MPa) */
  Ep: number;
  /** Mild steel yield fy (MPa) */
  fy: number;
  /** Mild steel modulus Es (MPa, default 200000) */
  Es?: number;
  /** Concrete f'c (MPa) */
  fc: number;
  /** Member length L (mm) — for elongation */
  L: number;
  /** Service (unfactored) axial tension (kN) */
  N_service: number;
  /** Factored axial tension (kN) */
  N_ultimate: number;
  /** Direct-tension cracking stress factor (× √f'c); default 0.50 (lower than flexural fr) */
  ctFactor?: number;
}

export interface TensionMemberResult {
  /** Effective prestress force Pe = fse·Aps (kN) */
  readonly Pe: number;
  /** Concrete direct-tension strength f_ct (MPa) */
  readonly f_ct: number;
  /** Decompression load (kN) */
  readonly N_dec: number;
  /** Cracking load (kN) */
  readonly N_cr: number;
  /** Nominal axial capacity N_n = Aps·fpu + As·fy (kN) */
  readonly N_n: number;
  /** φN_n with φ = 0.90 (kN) */
  readonly phiN_n: number;
  /** Uncracked transformed axial stiffness AE (N) */
  readonly AE_uncracked: number;
  /** Cracked axial stiffness AE (N) */
  readonly AE_cracked: number;
  /** Elongation under service load (mm) */
  readonly elongation_service: number;
  /** Strand stress under service load (MPa) */
  readonly fp_service: number;
  /** Is the member uncracked under service load? */
  readonly isUncrackedService: boolean;
  /** φN_n ≥ N_u ? */
  readonly isStrengthOk: boolean;
  /** Modular ratios for reference */
  readonly n_p: number;
  readonly n_s: number;
}

export function computeTensionMember(inp: TensionMemberInputs): TensionMemberResult {
  const {
    Ac, Aps, As, fse, fpu, fpy, Ep, fy, Es = 200_000, fc, L,
    N_service, N_ultimate, ctFactor = 0.50,
  } = inp;

  const Ec = 4700 * Math.sqrt(fc);
  const n_p = Ep / Ec;
  const n_s = Es / Ec;

  const Pe = (fse * Aps) / 1000; // kN
  const f_ct = ctFactor * Math.sqrt(fc); // MPa (direct tension)

  // Net concrete area (subtract holes occupied by steel)
  const Ac_net = Ac - Aps - As;

  // Decompression: external N that cancels the prestress compression
  const N_dec = Pe; // kN (concrete σ from −Pe/Ac to 0)

  // Cracking: concrete tension reaches f_ct over the transformed area
  const A_trans = Ac_net + n_p * Aps + n_s * As; // mm²
  // σ_c = −Pe/A_trans + N/A_trans = f_ct  → N_cr = Pe + f_ct·A_trans
  const N_cr = Pe + (f_ct * A_trans) / 1000; // kN

  // Nominal strength
  const N_n = (Aps * fpu + As * fy) / 1000; // kN
  const phiN_n = 0.90 * N_n;

  // Stiffness
  const AE_uncracked = Ec * A_trans;        // N (force per unit strain)
  const AE_cracked = Ep * Aps + Es * As;    // N

  // Service behavior
  const Nserv_N = N_service * 1000;
  const isUncrackedService = N_service <= N_cr;
  const AE = isUncrackedService ? AE_uncracked : AE_cracked;
  const elongation_service = (Nserv_N * L) / AE; // mm

  // Strand stress under service load
  let fp_service: number;
  if (isUncrackedService) {
    // Δf_p = n_p · (N − N_dec)/A_trans  (rise above effective once decompressing)
    const extra = Math.max(0, (N_service - N_dec) * 1000); // N
    fp_service = fse + (n_p * extra) / A_trans;
  } else {
    // Cracked: strand carries the whole tension (plus residual locked-in)
    fp_service = Math.min(fpy, (Nserv_N) / Aps);
  }

  return Object.freeze({
    Pe,
    f_ct,
    N_dec,
    N_cr,
    N_n,
    phiN_n,
    AE_uncracked,
    AE_cracked,
    elongation_service,
    fp_service,
    isUncrackedService,
    isStrengthOk: phiN_n >= N_ultimate,
    n_p,
    n_s,
  });
}
