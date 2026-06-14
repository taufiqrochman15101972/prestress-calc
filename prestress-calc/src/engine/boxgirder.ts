/**
 * Box-Girder Bridge Superstructure Engine
 * Christian Menn, "Prestressed Concrete Bridges" (Birkhäuser, 1990) — Chapter 5
 *
 * Covers the structural mechanics that distinguish a single-cell box girder
 * (closed, torsionally stiff) from an open girder, plus the design of the
 * individual cross-section components:
 *
 *  §5.1.2  Torsion & introduction of loads in single-cell box girders
 *          → St. Venant closed-section (Bredt) torsion: constant shear flow
 *            v = T / (2·A_k); wall shear stress τ = v/t; torsion constant
 *            J = 4·A_k² / ∮(ds/t); twist rate θ' = T/(G·J).
 *  §5.1.1  Introduction / distribution of eccentric loads to the two webs
 *          → P·e split into a symmetric (flexural) part carried equally by
 *            both webs and an antisymmetric (torsional) part carried by the
 *            closed-section shear flow (opposite web shears).
 *  §5.1.3  Comparison with the open double-T girder (warping torsion):
 *          J_open = Σ(b·t³)/3 ≪ J_box → an open section is torsionally soft.
 *  §5.3    Analysis & design of cross-section components
 *          §5.3.1 Deck slab  — transverse bending (cantilever overhang + the
 *                              continuous interior span between the webs).
 *          §5.3.2 Webs       — combined flexural + torsional shear, web
 *                              crushing (diagonal compression) and stirrups
 *                              via the variable-angle truss.
 *          §5.3.3 Bottom slab — longitudinal compression over interior
 *                              supports of a continuous box.
 *
 * Sign convention follows the project: + = tension, − = compression.
 * Internal units N and mm; results converted to kN, kN·m, MPa.
 *
 * NOTE: structure/procedure taken from Menn Ch.5; all numeric design values
 * (limits, factors) follow the project's adopted codes, NOT the book's figures.
 */

export type WebOrientation = "VERTICAL" | "INCLINED";

export interface BoxGirderInputs {
  // ── Single-cell box geometry (mm) ───────────────────────────
  /** Top slab (deck) total width including cantilever overhangs */
  bt: number;
  /** Top slab thickness */
  tt: number;
  /** Bottom slab width */
  bb: number;
  /** Bottom slab thickness */
  tb: number;
  /** Web thickness (each web; 2 webs assumed) */
  tw: number;
  /** Total structural height */
  H: number;
  /** Web centreline spacing at top slab (mm) — for inclined webs differs from bottom */
  swTop: number;
  /** Web centreline spacing at bottom slab (mm) */
  swBot: number;
  /** Cantilever overhang length, web centreline → deck edge (mm) */
  overhang: number;

  // ── Materials ───────────────────────────────────────────────
  /** Concrete cylinder strength f'c (MPa) */
  fc: number;
  /** Concrete elastic modulus Ec (MPa); if 0, computed as 4700√f'c */
  Ec: number;
  /** Stirrup / slab reinforcement yield (MPa) */
  fy: number;

  // ── Actions ─────────────────────────────────────────────────
  /** Factored design vertical shear at the section (kN) — total on the box */
  Vu: number;
  /** Factored design torsion at the section (kN·m) */
  Tu: number;
  /** Factored longitudinal bending moment at the section (kN·m, + = sagging) */
  Mu: number;
  /** Eccentric live load magnitude applied on the deck (kN) — for load distribution */
  Pecc: number;
  /** Transverse eccentricity of Pecc from box centreline (mm) */
  eEcc: number;
  /** Concentrated wheel load for deck transverse design (kN) */
  Pwheel: number;
  /** Transverse distribution width of the wheel load (mm) */
  wheelWidth: number;
  /** Superimposed dead load on the deck slab (kN/m²) */
  wDeckDL: number;

  /** Assumed variable strut angle θ for the web truss (deg) */
  theta: number;
}

export interface BoxGirderResult {
  // ── Section properties (longitudinal) ───────────────────────
  readonly A: number;        // gross area (mm²)
  readonly yb: number;       // centroid from bottom fibre (mm)
  readonly yt: number;       // centroid from top fibre (mm)
  readonly Ig: number;       // 2nd moment of area (mm⁴)
  readonly Zt: number;       // top section modulus (mm³)
  readonly Zb: number;       // bottom section modulus (mm³)

  // ── §5.1.2 Closed-section (Bredt) torsion ───────────────────
  readonly Ak: number;       // area enclosed by wall mid-lines (mm²)
  readonly Lweb: number;     // web length along its slope (mm)
  readonly shearFlow: number;// v = T/(2·A_k) (N/mm)
  readonly tauTop: number;   // torsional shear stress in top slab (MPa)
  readonly tauBot: number;   // torsional shear stress in bottom slab (MPa)
  readonly tauWeb: number;   // torsional shear stress in each web (MPa)
  readonly Jbox: number;     // closed-section torsion constant (mm⁴)
  readonly Jopen: number;    // equivalent open (Σbt³/3) torsion constant (mm⁴)
  readonly torsionStiffRatio: number; // Jbox / Jopen (× how much stiffer closed is)
  readonly G: number;        // shear modulus (MPa)
  readonly twistRate: number;// θ' = T/(G·J) (rad/mm)

  // ── §5.1.1 Eccentric-load distribution to the two webs ──────
  readonly Tecc: number;       // torsion from eccentric load P·e (kN·m)
  readonly Vtor_web: number;   // torsional shear per web (kN)
  readonly Vsym_web: number;   // symmetric (flexural) shear per web (kN)
  readonly Vweb_max: number;   // most-loaded web total shear (kN)
  readonly Vweb_min: number;   // least-loaded web total shear (kN)

  // ── §5.3.2 Web design (combined V + T, variable-angle truss) ─
  readonly Vweb_design: number;// governing web shear incl. torsion (kN)
  readonly z: number;          // internal lever arm ≈ 0.9·d (mm)
  readonly Av_s: number;       // required stirrups per web (mm²/mm)
  readonly sigma_strut: number;// diagonal compression stress in web (MPa)
  readonly sigma_strut_lim: number; // crushing limit (MPa)
  readonly webCrushOk: boolean;

  // ── §5.3.1 Deck slab transverse design ──────────────────────
  readonly Mcant: number;      // cantilever (overhang) transverse moment (kN·m/m)
  readonly Minterior: number;  // interior-span transverse moment (kN·m/m)
  readonly McantSlab: number;  // governing deck design moment (kN·m/m)
  readonly As_deck: number;    // required transverse deck steel (mm²/m)

  // ── §5.3.3 Bottom slab longitudinal compression (cont. box) ──
  readonly sigma_bot_long: number;  // longitudinal stress in bottom slab (MPa)
  readonly sigma_bot_lim: number;   // compressive limit (MPa)
  readonly bottomSlabOk: boolean;
}

const PHI_SHEAR = 0.75;

export function computeBoxGirder(inp: BoxGirderInputs): BoxGirderResult {
  const {
    bt, tt, bb, tb, tw, H, swTop, swBot, overhang,
    fc, fy, Vu, Tu, Mu, Pecc, eEcc, Pwheel, wheelWidth, wDeckDL, theta,
  } = inp;

  const Ec = inp.Ec > 0 ? inp.Ec : 4700 * Math.sqrt(fc);
  const G = Ec / 2.4; // ν ≈ 0.2 → G = E / 2(1+ν)

  // ── Longitudinal section properties (top slab + bottom slab + 2 webs) ──
  const hWeb = H - tt - tb;                 // clear web height between slabs
  const At = bt * tt,  ytA = H - tt / 2;
  const Ab = bb * tb,  ybA = tb / 2;
  const Aw = tw * hWeb, ywA = tb + hWeb / 2; // per web
  const A = At + Ab + 2 * Aw;
  const yb = (At * ytA + Ab * ybA + 2 * Aw * ywA) / A;
  const yt = H - yb;
  const Ig =
    (bt * tt ** 3) / 12 + At * (ytA - yb) ** 2 +
    (bb * tb ** 3) / 12 + Ab * (ybA - yb) ** 2 +
    2 * ((tw * hWeb ** 3) / 12 + Aw * (ywA - yb) ** 2);
  const Zt = Ig / yt;
  const Zb = Ig / yb;

  // ── §5.1.2 Closed-section (Bredt) torsion ─────────────────────
  // Area enclosed by wall mid-lines: trapezoid between the web centrelines,
  // height between top- and bottom-slab centrelines.
  const hk = H - tt / 2 - tb / 2;
  const bkTop = swTop;
  const bkBot = swBot;
  const Ak = 0.5 * (bkTop + bkBot) * hk;
  // Web length along slope (inclined webs lengthen the wall): horizontal
  // offset between top and bottom web centreline, per web = |swTop−swBot|/2.
  const dxWeb = Math.abs(bkTop - bkBot) / 2;
  const Lweb = Math.sqrt(hk ** 2 + dxWeb ** 2);

  const Tu_Nmm = Tu * 1e6;
  const shearFlow = Tu_Nmm / (2 * Ak);             // N/mm (Bredt 1st)
  const tauTop = shearFlow / tt;
  const tauBot = shearFlow / tb;
  const tauWeb = shearFlow / tw;

  // ∮ ds/t around the cell: top + bottom + 2 webs
  const lineIntegral = bkTop / tt + bkBot / tb + 2 * (Lweb / tw);
  const Jbox = (4 * Ak ** 2) / lineIntegral;        // Bredt 2nd
  // Equivalent open section (sum of plates) for comparison
  const Jopen =
    (bt * tt ** 3 + bb * tb ** 3 + 2 * hWeb * tw ** 3) / 3;
  const torsionStiffRatio = Jbox / Jopen;
  const twistRate = Tu_Nmm / (G * Jbox);            // rad/mm

  // ── §5.1.1 Distribution of an eccentric load to the two webs ──
  // Symmetric part: vertical load shared equally by both webs.
  // Antisymmetric part: torsion T = P·e → closed-section shear flow →
  // equal & opposite vertical web shears v·h_k.
  const Tecc = (Pecc * eEcc) / 1e6 * 1e3;           // (kN·mm→kN·m): P[kN]·e[mm]/1e3
  const vEcc = (Tecc * 1e6) / (2 * Ak);             // N/mm shear flow from Tecc
  const Vtor_web = (vEcc * hk) / 1000;              // kN per web (vertical component)
  const Vsym_web = Pecc / 2;                        // kN per web
  const Vweb_max = Vsym_web + Vtor_web;
  const Vweb_min = Vsym_web - Vtor_web;

  // ── §5.3.2 Web design — combined gravity shear + applied torsion ──
  // Governing web: half the section's vertical shear + torsional web shear
  // from the section torsion Tu, plus the eccentric-load contribution.
  const Vtor_fromTu = (shearFlow * hk) / 1000;      // kN per web from Tu
  const Vweb_design = Vu / 2 + Vtor_fromTu + Vtor_web;
  const z = 0.9 * (H - tt / 2 - tb / 2);            // lever arm ≈ 0.9·hk
  const thetaRad = (theta * Math.PI) / 180;
  const cot = 1 / Math.tan(thetaRad);
  // Variable-angle truss stirrups (per web): Av/s = Vu/(φ·z·fy·cotθ)
  const Av_s = (Vweb_design * 1000) / (PHI_SHEAR * z * fy * cot);
  // Diagonal compression (web crushing): σ_c = V/(b_w·z·sinθ·cosθ)
  const sigma_strut = (Vweb_design * 1000) / (tw * z * Math.sin(thetaRad) * Math.cos(thetaRad));
  const nu = 0.6 * (1 - fc / 250);                  // strut efficiency (EC2-style)
  const sigma_strut_lim = nu * fc;
  const webCrushOk = sigma_strut <= sigma_strut_lim;

  // ── §5.3.1 Deck slab transverse bending ───────────────────────
  // Cantilever overhang: wheel at tip + slab self/superimposed DL.
  const wSlab = 25e-3 * tt;                         // self wt kN/m² (25 kN/m³ × t)
  const wTot = wSlab + wDeckDL;                     // kN/m²
  const Pw_per_m = Pwheel / (wheelWidth / 1000);    // kN/m (load per metre run)
  const Lc = overhang / 1000;                       // m
  // M_cant per metre width: wheel near tip (arm ≈ Lc) + UDL Lc²/2
  const Mcant = Pw_per_m * Lc + wTot * Lc ** 2 / 2; // kN·m/m
  // Interior span between webs (continuous slab, coeff 1/10 for wheel+UDL)
  const Li = (swTop - tw) / 1000;                   // m clear interior span
  const Minterior = Pw_per_m * Li / 8 + wTot * Li ** 2 / 10; // kN·m/m
  const McantSlab = Math.max(Mcant, Minterior);
  // Required transverse steel: As = M/(0.9·d·fy), d ≈ tt − 40 cover
  const dDeck = Math.max(tt - 40, 0.5 * tt);        // mm
  const As_deck = (McantSlab * 1e6) / (0.9 * dDeck * fy); // mm²/m

  // ── §5.3.3 Bottom slab longitudinal compression (continuous box) ──
  // Over interior supports the moment is hogging → bottom slab compressed.
  // σ = M / Z_bottom (use |Mu| as the support moment proxy).
  const sigma_bot_long = -(Math.abs(Mu) * 1e6) / Zb; // MPa (− = compression)
  const sigma_bot_lim = -0.6 * fc;                   // compressive limit
  const bottomSlabOk = sigma_bot_long >= sigma_bot_lim;

  return Object.freeze({
    A, yb, yt, Ig, Zt, Zb,
    Ak, Lweb, shearFlow, tauTop, tauBot, tauWeb,
    Jbox, Jopen, torsionStiffRatio, G, twistRate,
    Tecc, Vtor_web, Vsym_web, Vweb_max, Vweb_min,
    Vweb_design, z, Av_s, sigma_strut, sigma_strut_lim, webCrushOk,
    Mcant, Minterior, McantSlab, As_deck,
    sigma_bot_long, sigma_bot_lim, bottomSlabOk,
  });
}

// ════════════════════════════════════════════════════════════════
//  CROSS-SECTION DISTORTION — deformable cross section
//  Richard N. Wright, "Design of Box Girders of Deformable Cross
//  Section" (book 124) + Abdel-Samad/Robinson BEF analogy.
// ════════════════════════════════════════════════════════════════
/**
 * An eccentric load on a box decomposes into (1) flexure, (2) pure St.-Venant
 * torsion (the shear flow above) and (3) DISTORTION — the cross-section racking
 * into a parallelogram. Distortion is resisted by the transverse frame stiffness
 * of the four walls and analysed by the Beam-on-Elastic-Foundation analogy:
 * distortional warping (longitudinal) ~ "beam bending", transverse frame ~
 * "elastic foundation". Diaphragms add concentrated supports that limit it.
 */
export interface BoxDistortionInputs {
  bt: number; tt: number; bb: number; tb: number; tw: number; H: number;
  swTop: number; swBot: number;
  fc: number; Ec: number;
  Pecc: number;   // eccentric vertical load (kN)
  eEcc: number;   // its transverse eccentricity from box centreline (mm)
  L: number;      // span between bearings (mm)
  diaSpacing: number; // provided interior diaphragm spacing (mm); 0 = none
  Mu: number;     // longitudinal bending moment for the stress-ratio check (kN·m)
}
export interface BoxDistortionResult {
  readonly Tdist: number;       // distortional torque P·e (kN·m)
  readonly bAvg: number; readonly hk: number;
  readonly Vdist: number;       // self-equilibrating distortional web shear (kN)
  readonly Kframe: number;      // transverse frame (foundation) stiffness (N/mm per mm)
  readonly EIdw: number;        // distortional warping rigidity (N·mm²)
  readonly lambda: number;      // BEF characteristic 1/length (1/mm)
  readonly betaL: number;       // λ·L (slenderness of the distortional "beam")
  readonly Mcorner: number;     // transverse frame corner moment (kN·m/m)
  readonly sigmaTransverse: number; // transverse bending stress in wall (MPa)
  readonly sigmaWarp: number;   // longitudinal distortional warping stress (MPa)
  readonly sigmaBend: number;   // longitudinal flexural stress for comparison (MPa)
  readonly warpRatio: number;   // σ_warp / σ_bend (target < ~0.10)
  readonly diaSpacingMax: number; // recommended max diaphragm spacing (mm)
  readonly distortionOk: boolean;
  readonly needsDiaphragm: boolean;
}
export function computeBoxDistortion(i: BoxDistortionInputs): BoxDistortionResult {
  const Ec = i.Ec > 0 ? i.Ec : 4700 * Math.sqrt(i.fc);
  const bAvg = (i.swTop + i.swBot) / 2;
  const hk = i.H - i.tt / 2 - i.tb / 2;
  const Tdist = (i.Pecc * i.eEcc) / 1e6 * 1e3; // kN·m (P[kN]·e[mm]/1e3)
  // distortional couple resolved into equal-opposite vertical web shears
  const Vdist = (Tdist * 1e3) / (2 * bAvg) * 1; // kN (couple / arm), ×1e3: kN·m→kN·mm
  // ── transverse frame (elastic-foundation) stiffness ──
  // Single-cell closed frame racking: combine plate flexural rigidities D=E·t³/12.
  const Dtop = Ec * i.tt ** 3 / 12, Dbot = Ec * i.tb ** 3 / 12, Dweb = Ec * i.tw ** 3 / 12;
  // racking stiffness per unit length ≈ 12·D_eq/(b·h) with series flexibility of walls
  const flex = (bAvg / Dtop + bAvg / Dbot + hk / Dweb + hk / Dweb);
  const Kframe = (24) / (flex * bAvg * hk) * 1e3; // N/mm per mm length (scaled)
  // ── distortional warping rigidity (single cell, area-flange approx) ──
  const Aflange = (i.bt * i.tt + i.bb * i.tb) / 2;
  const EIdw = Ec * Aflange * (bAvg / 2) ** 2 * (hk / 2) ** 2 / 1e3;
  // ── BEF characteristic length ──
  const lambda = Math.pow(Kframe / (4 * EIdw), 0.25);
  const betaL = lambda * i.L;
  // ── transverse frame corner moment (closed-frame distribution) ──
  const Mcorner = Vdist * (hk / 1000) / 4; // kN·m/m, racking ¼ to each corner
  const tWall = Math.min(i.tt, i.tb, i.tw);
  const sigmaTransverse = (Mcorner * 1e6) / (1000 * tWall ** 2 / 6); // MPa
  // ── longitudinal distortional warping stress (decays with diaphragms) ──
  const ld = i.diaSpacing > 0 ? i.diaSpacing : i.L;
  const decay = 1 / (1 + Math.pow(lambda * ld, 2)); // more diaphragms → smaller
  const sigmaWarp = sigmaTransverse * (0.5 + 2 * decay);
  // longitudinal bending stress for ratio (top fibre proxy)
  const At = i.bt * i.tt, Ab = i.bb * i.tb, hWeb = i.H - i.tt - i.tb;
  const Aw = i.tw * hWeb;
  const Atot = At + Ab + 2 * Aw;
  const yb = (At * (i.H - i.tt / 2) + Ab * (i.tb / 2) + 2 * Aw * (i.tb + hWeb / 2)) / Atot;
  const Ig = (i.bt * i.tt ** 3) / 12 + At * (i.H - i.tt / 2 - yb) ** 2 +
    (i.bb * i.tb ** 3) / 12 + Ab * (i.tb / 2 - yb) ** 2 +
    2 * ((i.tw * hWeb ** 3) / 12 + Aw * (i.tb + hWeb / 2 - yb) ** 2);
  const sigmaBend = (Math.abs(i.Mu) * 1e6) * (i.H - yb) / Ig;
  const warpRatio = sigmaBend > 0 ? sigmaWarp / sigmaBend : 0;
  // recommended max diaphragm spacing: keep λ·l_d ≤ ~ (π) so distortion decays
  const diaSpacingMax = Math.min(i.L, (Math.PI / 2) / lambda);
  return Object.freeze({
    Tdist, bAvg, hk, Vdist, Kframe, EIdw, lambda, betaL,
    Mcorner, sigmaTransverse, sigmaWarp, sigmaBend, warpRatio,
    diaSpacingMax,
    distortionOk: warpRatio <= 0.10,
    needsDiaphragm: betaL > 4 && i.diaSpacing === 0,
  });
}

// ════════════════════════════════════════════════════════════════
//  SHEAR LAG + SHEAR-DEFORMATION DEFLECTION
//  "Simplified Calculation Method of Box-Girder Deflection
//  Considering Full-Section Shear Deformation" (book 135) +
//  effective-flange-width shear lag.
// ════════════════════════════════════════════════════════════════
/**
 * In a wide-flanged box the flange longitudinal stress is NOT uniform — it lags
 * near the centre (shear lag), reducing the effective flange width. And for
 * short, deep boxes the SHEAR deformation of the webs adds materially to the
 * bending deflection (Timoshenko beam), which Euler–Bernoulli ignores. This
 * routine returns the effective widths, the bending vs shear deflection split
 * and the total — the missing piece of long-span box deflection prediction.
 */
export interface BoxShearLagInputs {
  bt: number; tt: number; bb: number; tb: number; tw: number; H: number;
  fc: number; Ec: number;
  L: number;      // span (mm)
  w: number;      // uniform service load (kN/m) for the deflection estimate
  Ig: number;     // gross 2nd moment of area (mm⁴); 0 → computed here
}
export interface BoxShearLagResult {
  readonly psiTop: number;     // shear-lag effectiveness factor top flange (≤1)
  readonly psiBot: number;     // shear-lag effectiveness factor bottom flange
  readonly beTop: number;      // effective top flange width (mm)
  readonly beBot: number;      // effective bottom flange width (mm)
  readonly Av: number;         // shear area (2 webs) (mm²)
  readonly G: number;          // shear modulus (MPa)
  readonly deltaBend: number;  // bending deflection 5wL⁴/384EI (mm)
  readonly deltaShear: number; // shear deflection wL²/8GA_v (mm)
  readonly deltaTotal: number; // total (mm)
  readonly shearRatio: number; // δ_shear / δ_bend (significance)
  readonly deflLimit: number;  // L/800 (mm)
  readonly ok: boolean;
}
export function computeBoxShearLag(i: BoxShearLagInputs): BoxShearLagResult {
  const Ec = i.Ec > 0 ? i.Ec : 4700 * Math.sqrt(i.fc);
  const G = Ec / 2.4;
  // shear-lag factor ψ = 1/(1 + (b/L)²·k) — wider flange / shorter span → more lag
  const lag = (b: number) => 1 / (1 + 6 * (b / 2 / i.L) ** 2 * (1 + 0));
  const psiTop = Math.min(1, Math.max(0.4, lag(i.bt)));
  const psiBot = Math.min(1, Math.max(0.4, lag(i.bb)));
  const beTop = psiTop * i.bt;
  const beBot = psiBot * i.bb;
  // shear area = web area (Timoshenko, k_s≈1 for thin webs of a box)
  const hWeb = i.H - i.tt - i.tb;
  const Av = 2 * i.tw * hWeb;
  // section inertia
  let Ig = i.Ig;
  if (!(Ig > 0)) {
    const At = i.bt * i.tt, Ab = i.bb * i.tb, Aw = i.tw * hWeb;
    const Atot = At + Ab + 2 * Aw;
    const yb = (At * (i.H - i.tt / 2) + Ab * (i.tb / 2) + 2 * Aw * (i.tb + hWeb / 2)) / Atot;
    Ig = (i.bt * i.tt ** 3) / 12 + At * (i.H - i.tt / 2 - yb) ** 2 +
      (i.bb * i.tb ** 3) / 12 + Ab * (i.tb / 2 - yb) ** 2 +
      2 * ((i.tw * hWeb ** 3) / 12 + Aw * (i.tb + hWeb / 2 - yb) ** 2);
  }
  const wN = i.w; // kN/m
  // δ_bend = 5wL⁴/384EI ; w[kN/m]=N/mm, L[mm], EI[N·mm²]
  const wNmm = wN; // kN/m == N/mm
  const deltaBend = (5 * wNmm * i.L ** 4) / (384 * Ec * Ig);
  // δ_shear = wL²/(8·G·A_v) (UDL, simply supported)
  const deltaShear = (wNmm * i.L ** 2) / (8 * G * Av);
  const deltaTotal = deltaBend + deltaShear;
  const deflLimit = i.L / 800;
  return Object.freeze({
    psiTop, psiBot, beTop, beBot, Av, G,
    deltaBend, deltaShear, deltaTotal,
    shearRatio: deltaBend > 0 ? deltaShear / deltaBend : 0,
    deflLimit, ok: deltaTotal <= deflLimit,
  });
}
