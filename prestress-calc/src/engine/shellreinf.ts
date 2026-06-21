/**
 * shellreinf.ts — Reinforcement design for concrete SHELLS from the 8 stress
 * resultants (membrane n_x,n_y,n_xy + bending m_x,m_y,m_xy), "unified/sandwich"
 * approach after Medwadowski & Samartin (IASS) + CEB-FIP / Baumann membrane rule.
 * The shell is replaced by two outer steel-bearing layers at lever z = t − 2·cover;
 * each face's membrane triad (n*, with bending added via ±m/z) is reinforced with
 * the Baumann/Nielsen rule As·fy = n + |n_xy| (compression clamped). Feeds from
 * the shell solver (fem/shellsolver.ts) results. Units SI: n N/mm, m N·mm/mm,
 * t,cover mm, fy MPa → As mm²/m.
 */

export interface ShellForces {
  nx: number; ny: number; nxy: number;   // membrane, N/mm
  mx: number; my: number; mxy: number;   // bending, N·mm/mm
  t: number; cover: number; fy: number;
}
export interface FaceReinf { Asx: number; Asy: number; nx: number; ny: number; nxy: number; }
export interface ShellReinfResult {
  readonly z: number;                  // lever, mm
  readonly bottom: FaceReinf;          // tension face under +M (mm²/m)
  readonly top: FaceReinf;
  readonly AsxTotal: number; readonly AsyTotal: number;   // mm²/m both faces
}

/** Baumann/CEB membrane reinforcement for a layer (forces N/mm) → As N/mm needed. */
function layerSteel(nx: number, ny: number, nxy: number, fy: number): { Asx: number; Asy: number } {
  const a = Math.abs(nxy);
  // basic Baumann (45° default): demand each direction = n + |nxy|, clamp ≥0
  let Fx = nx + a, Fy = ny + a;
  if (Fx < 0 && Fy >= 0) { Fx = 0; Fy = ny + (nx !== 0 ? nxy * nxy / Math.abs(nx) : a); }
  else if (Fy < 0 && Fx >= 0) { Fy = 0; Fx = nx + (ny !== 0 ? nxy * nxy / Math.abs(ny) : a); }
  else if (Fx < 0 && Fy < 0) { Fx = 0; Fy = 0; }
  // As (mm²/mm) = F(N/mm)/fy(MPa); ×1000 → mm²/m
  return { Asx: Math.max(0, Fx) / fy * 1000, Asy: Math.max(0, Fy) / fy * 1000 };
}

export function designShellReinf(f: ShellForces): ShellReinfResult {
  const z = Math.max(f.t - 2 * f.cover, 0.1 * f.t);
  // split membrane half each face; bending adds ±(m/z) as a membrane force pair
  const mzx = f.mx / z, mzy = f.my / z, mzxy = f.mxy / z;
  const bF = { nx: f.nx / 2 + mzx, ny: f.ny / 2 + mzy, nxy: f.nxy / 2 + mzxy };
  const tF = { nx: f.nx / 2 - mzx, ny: f.ny / 2 - mzy, nxy: f.nxy / 2 - mzxy };
  const bs = layerSteel(bF.nx, bF.ny, bF.nxy, f.fy);
  const ts = layerSteel(tF.nx, tF.ny, tF.nxy, f.fy);
  const bottom: FaceReinf = { ...bs, ...bF };
  const top: FaceReinf = { ...ts, ...tF };
  return Object.freeze({
    z, bottom, top,
    AsxTotal: bottom.Asx + top.Asx, AsyTotal: bottom.Asy + top.Asy,
  });
}
