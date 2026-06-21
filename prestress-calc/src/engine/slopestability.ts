/**
 * slopestability.ts — Slope-stability factor of safety (geotechnical, MIDAS GTS
 * theme MD482). Two methods: (1) INFINITE-SLOPE (translational, exact closed
 * form, with optional seepage), and (2) circular-arc METHOD OF SLICES — Fellenius
 * (ordinary) and Bishop's Simplified (iterative) for a uniform slope + trial
 * circle through the toe. Procedure per standard soil-mechanics texts (Das,
 * Budhu). Units SI: c kPa, φ deg, γ kN/m³, lengths m.
 */

export interface InfiniteSlopeInputs {
  c: number; phi: number; gamma: number; z: number; beta: number;   // beta deg
  seepage: boolean; gammaW?: number;
}
export function infiniteSlopeFS(i: InfiniteSlopeInputs): number {
  const b = (i.beta * Math.PI) / 180, phir = (i.phi * Math.PI) / 180;
  const gw = i.gammaW ?? 9.81;
  // dry/no-seepage: FS = [c + γ·z·cos²β·tanφ] / [γ·z·sinβ·cosβ]
  // full seepage parallel to slope: γ_buoyant on the friction term, pore u
  if (!i.seepage) {
    return (i.c + i.gamma * i.z * Math.cos(b) ** 2 * Math.tan(phir)) / (i.gamma * i.z * Math.sin(b) * Math.cos(b));
  }
  const gb = i.gamma - gw;
  return (i.c + gb * i.z * Math.cos(b) ** 2 * Math.tan(phir)) / (i.gamma * i.z * Math.sin(b) * Math.cos(b));
}

export interface SliceSlopeInputs {
  H: number; beta: number;        // slope height m, angle deg
  c: number; phi: number; gamma: number;
  ru: number;                     // pore-pressure ratio u/(γh)
  xc: number; yc: number; R: number;   // trial circle centre & radius, m
  nSlices?: number;
}
export interface SliceSlopeResult {
  readonly FS_fellenius: number;
  readonly FS_bishop: number;
  readonly nSlices: number;
  readonly valid: boolean;
}

export function slopeSlicesFS(i: SliceSlopeInputs): SliceSlopeResult {
  const n = i.nSlices ?? 30;
  const tanB = Math.tan((i.beta * Math.PI) / 180), B = i.H / tanB;
  // ground surface: y=0 (x≤0, toe flat) ; slope 0..B rises to H ; y=H (x≥B crest)
  const ground = (x: number) => x <= 0 ? 0 : x >= B ? i.H : x * tanB;
  // circle bottom arc y = yc − √(R²−(x−xc)²)
  const arc = (x: number) => { const d = i.R * i.R - (x - i.xc) ** 2; return d <= 0 ? NaN : i.yc - Math.sqrt(d); };
  // entry/exit x where arc meets ground (scan)
  const xL = i.xc - i.R, xR = i.xc + i.R;
  let x0 = NaN, x1 = NaN;
  const N = 400;
  for (let k = 0; k <= N; k++) {
    const x = xL + (xR - xL) * k / N, a = arc(x);
    if (isNaN(a)) continue;
    if (a < ground(x)) { if (isNaN(x0)) x0 = x; x1 = x; }
  }
  if (isNaN(x0) || x1 - x0 < 1e-3) return Object.freeze({ FS_fellenius: 0, FS_bishop: 0, nSlices: 0, valid: false });

  const dx = (x1 - x0) / n, phir = (i.phi * Math.PI) / 180, tanphi = Math.tan(phir);
  type S = { W: number; alpha: number; b: number; u: number; h: number };
  const slices: S[] = [];
  for (let k = 0; k < n; k++) {
    const xm = x0 + (k + 0.5) * dx;
    const h = ground(xm) - arc(xm);
    if (h <= 0) continue;
    const W = i.gamma * dx * h;
    const alpha = Math.asin(Math.max(-1, Math.min(1, (xm - i.xc) / i.R)));
    const u = i.ru * i.gamma * h;
    slices.push({ W, alpha, b: dx, u, h });
  }
  let driving = 0; for (const s of slices) driving += s.W * Math.sin(s.alpha);
  if (Math.abs(driving) < 1e-9) return Object.freeze({ FS_fellenius: 0, FS_bishop: 0, nSlices: slices.length, valid: false });

  // Fellenius (ordinary)
  let resF = 0;
  for (const s of slices) { const l = s.b / Math.cos(s.alpha); resF += i.c * l + (s.W * Math.cos(s.alpha) - s.u * l) * tanphi; }
  const FS_fellenius = resF / driving;

  // Bishop simplified (iterate)
  let FS = Math.max(FS_fellenius, 0.5);
  for (let it = 0; it < 50; it++) {
    let num = 0;
    for (const s of slices) {
      const ma = Math.cos(s.alpha) * (1 + (Math.tan(s.alpha) * tanphi) / FS);
      num += (i.c * s.b + (s.W - s.u * s.b) * tanphi) / ma;
    }
    const FSn = num / driving;
    if (Math.abs(FSn - FS) < 1e-5) { FS = FSn; break; }
    FS = FSn;
  }
  return Object.freeze({ FS_fellenius, FS_bishop: FS, nSlices: slices.length, valid: true });
}
