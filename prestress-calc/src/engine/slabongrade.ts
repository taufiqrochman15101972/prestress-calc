/**
 * Post-Tensioned Slab-on-Grade — Khan & Williams "Post-tensioned Concrete
 * Floors" §11 (Slabs on Grade / post-tensioned ground floors).
 *
 * A ground-bearing slab rests on an elastic subgrade (Winkler springs). Two
 * actions are checked and combined:
 *
 *   • Flexure from concentrated loads — Westergaard plate-on-elastic-foundation
 *     stresses (interior / edge / corner) using the radius of relative
 *     stiffness ℓ = [E·h³ / (12(1−ν²)·k)]^¼.
 *   • Restraint of shrinkage / thermal shortening by subgrade friction
 *     (subgrade drag P = μ·w·L/2) — overcome by the post-tensioning, which
 *     leaves a residual compression keeping the slab crack-free.
 *
 * Crack-free criterion: σ_flex(tension) − σ_residual,compression ≤ f_r (or ≤ 0
 * for a fully-compressed, joint-free slab). Procedure only — not book numbers.
 * SI: mm, MPa, kN, N/mm³ (k), kN/m³ (γ).
 */

export interface SlabOnGradeInputs {
  thickness_mm: number;  // slab thickness h
  fc: number;            // f'c (MPa)
  poisson: number;       // ν (≈0.15 concrete)
  k_subgrade: number;    // modulus of subgrade reaction (N/mm³, ≈0.03–0.14)
  P_load: number;        // concentrated (wheel / rack) load (kN)
  contactRadius_mm: number; // equivalent radius of loaded area a
  Pe_perWidth: number;   // effective post-tensioning force per unit width (kN/m)
  slabLength_m: number;  // slab length between free/joint ends
  mu_friction: number;   // subgrade friction coefficient (≈0.5–1.0)
  unitWeight: number;    // concrete unit weight (kN/m³)
}

export interface SlabOnGradeResult {
  readonly Ec: number;            // MPa
  readonly radiusRelStiffness: number; // ℓ (mm)
  readonly b_equiv: number;       // Westergaard equivalent radius (mm)
  readonly sigma_interior: number;// MPa (flexural tension, bottom)
  readonly sigma_edge: number;    // MPa
  readonly sigma_corner: number;  // MPa (top)
  readonly sigma_governing: number;// max tension (MPa)
  readonly residualCompression: number; // MPa from PT (Pe/area)
  readonly frictionRestraintStress: number; // MPa subgrade drag at mid-length
  readonly netResidualComp: number; // residual after friction loss (MPa)
  readonly netTension: number;    // σ_gov − netResidualComp (MPa, + = tension)
  readonly fr_allow: number;      // modulus of rupture 0.62√f'c (MPa)
  readonly isCrackFree: boolean;  // netTension ≤ 0
  readonly isOk: boolean;         // netTension ≤ fr_allow
}

export function computeSlabOnGrade(inp: SlabOnGradeInputs): SlabOnGradeResult {
  const { thickness_mm: h, fc, poisson: nu, k_subgrade: k,
          P_load, contactRadius_mm: a, Pe_perWidth,
          slabLength_m: L, mu_friction: mu, unitWeight: gamma } = inp;

  const Ec = 4700 * Math.sqrt(fc); // MPa
  const P = P_load * 1000;         // N

  // Radius of relative stiffness ℓ = [E·h³/(12(1−ν²)·k)]^¼
  const radiusRelStiffness = Math.pow(
    (Ec * h ** 3) / (12 * (1 - nu * nu) * k), 0.25
  );
  const l = radiusRelStiffness;

  // Westergaard equivalent radius for a small loaded area (a < 1.724h):
  //   b = √(1.6a² + h²) − 0.675h
  const b_equiv = a < 1.724 * h
    ? Math.sqrt(1.6 * a * a + h * h) - 0.675 * h
    : a;

  // Westergaard stresses (closed form, MPa with P in N, h in mm):
  const log10 = (x: number) => Math.log10(x);
  const sigma_interior = (0.316 * P / (h * h)) * (4 * log10(l / b_equiv) + 1.069);
  const sigma_edge     = (0.572 * P / (h * h)) * (4 * log10(l / b_equiv) + 0.359);
  const sigma_corner   = (3 * P / (h * h)) * (1 - Math.pow((a * Math.SQRT2) / l, 0.6));
  const sigma_governing = Math.max(sigma_interior, sigma_edge, sigma_corner);

  // Post-tensioning residual compression: Pe per width over the cross-section.
  // Pe_perWidth (kN/m) over thickness h (mm): σ = Pe[N/mm]/h[mm].
  const residualCompression = (Pe_perWidth * 1000 / 1000) / h; // (kN/m=N/mm)/mm = MPa

  // Subgrade drag (friction restraint) — max at mid-length:
  //   F = μ·w·(L/2);  w = γ·h is the slab self-weight per area.
  const w_area = gamma * (h / 1000);          // kN/m² (γ kN/m³ × h m)
  const frictionForce_perWidth = mu * w_area * (L / 2); // kN/m
  const frictionRestraintStress = (frictionForce_perWidth * 1000 / 1000) / h; // MPa

  const netResidualComp = Math.max(0, residualCompression - frictionRestraintStress);
  const netTension = sigma_governing - netResidualComp;

  const fr_allow = 0.62 * Math.sqrt(fc); // modulus of rupture (MPa)
  const isCrackFree = netTension <= 0;
  const isOk = netTension <= fr_allow;

  return Object.freeze({
    Ec,
    radiusRelStiffness,
    b_equiv,
    sigma_interior,
    sigma_edge,
    sigma_corner,
    sigma_governing,
    residualCompression,
    frictionRestraintStress,
    netResidualComp,
    netTension,
    fr_allow,
    isCrackFree,
    isOk,
  });
}
