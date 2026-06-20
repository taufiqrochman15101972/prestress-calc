# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Rules (selalu berlaku)

- **Selalu baca MEMORY.md di awal sesi** (`C:\Users\Taufiq\.claude\projects\D--Belajar-Coding-Desain-Prategang\memory\MEMORY.md`) — indeks satu-baris per memori; buka file memori yang relevan sebelum bekerja.
- **Update MEMORY.md setelah setiap sesi** dengan progress & keputusan baru (file memori baru + satu baris indeks).
- **Jika ada `/clear`, baca ulang CLAUDE.md dan MEMORY.md sebelum lanjut** — keduanya adalah satu-satunya konteks yang bertahan.
- File rujukan tetap di folder ini: `PRD Prategang.md` (spesifikasi mengikat, riwayat revisi), `CLAUDE.md` (ini), `.claude/skills.md` (definisi skill per engine), `.claude/agents.md`, PDF buku referensi bernomor `1.pdf`–`180.pdf` (+ `170.xls`, `174.jpg`, `123.ppm`; semua berawalan `NN-udah-…` = sudah selesai ditinjau; **buku 1–180 tuntas**). **Rujukan dasar GAMBAR output desain** = `A.pdf` (SD APB Girder Depth-End L=40.8m), `B.pdf` (DED NPEA PCI-Girder H=2.10m), `C.pdf` (DED PCI-Girder Manggarai H=1.25m) + semua file gambar (`*.png`) sebelumnya — gaya DED: Tampak Samping (elevasi+tendon+blok ujung+perletakan), Potongan berdimensi lengkap, blok CATATAN/NOTES material, kop gambar; **buku 153** = "Perhitungan Teknis PCI Girder Standar PT Adhi Persada Beton" (H=2.1m, L=40.8m, fc'=50MPa) sebagai tambahan dasar prosedur (beban MS/MA/TD/TT/TB/EW/EQ/EUn, kehilangan ES/R/CR/SH/F/A, tegangan, lendutan, geser) — semua sudah tercakup engine eksisting.
- **Buku 154–180 (+170.xls/174.jpg/143)** — mayoritas PCI BDM Appendix B (tabel produk standar AASHTO/PCI — I-beam 157, bulb-tee 158, slab/box/segmental 154), contoh desain AASHTO Type IV LRFD (175, prosedur sudah tercakup engine), jurnal PC-I (155), dan brosur produsen (143 WIKA-KOBE, 156 WIKA Beton, 164/165, 176 Waskita). DUA famili produk standar yang BELUM ada → ditambahkan ke `lib/presets.ts` (idealisasi trapesium 1-web yang sama dgn BOX/PC_U): **AASHTO-PCI-ASBI Segmental Box** (buku 162, kategori baru `SEG_BOX`, H-1800/2100/2400 span-by-span + H-2700/3000 balanced cantilever, tangga 300 mm) dan **Texas U-Beam tub** (buku 171, `pcu_txu40`/`pcu_txu54`). DB profil kini **62 profil / 13 kategori**. Strand 0.5″/0.6″ (G1725/G1860) + multi-strand PT sudah lengkap di `lib/strands.ts`. Tetap: angka PDF bukan acuan kode — hanya bab/sub-bab/urutan/prosedur/kelengkapan; tidak menebak profil ambigu agar tak redundant.

## Project Overview

**PRESTRESS-CALC Design Suite** — A full-stack engineering application for post-tensioned prestressed concrete I-girder bridge design per ACI 318 / SNI 2847 / AASHTO LRFD, with parallel **BS 8110** (Kong & Evans) and **Eurocode 2 / EN 1992-1-1** (M.K. Hurst) code paths for cross-comparison. The suite covers SLS stress verification, detailed prestress losses (AASHTO LRFD Refined Method + EC2 combined §5.10.6), ULS flexural/shear capacity, composite section analysis, and long-term deflection checks.

**Design codes (computed in parallel, displayed side-by-side):**
- ACI 318-19 / SNI 2847:2019 — primary path (`uls.ts`, `losses.ts`, `sls.ts`)
- AASHTO LRFD Refined — prestress losses, anchorage
- BS 8110 — Kong & Evans Ch.9 (`bs8110.ts`): Class 1/2/3, Vco/Vcr
- Eurocode 2 / EN 1992-1-1 — M.K. Hurst (`ec2.ts`): fcd/fctm/Ecm/fpd, stress limits by load combination, combined time-dependent loss eq.(5.46), λx rectangular block, VRd,c (uncracked/cracked) + variable-strut VRd,max

**Box-girder bridge superstructure** — Christian Menn "Prestressed Concrete Bridges" Ch.5 (`boxgirder.ts`, standalone 🌉 Box Girder tab): single-cell closed-section St. Venant/Bredt torsion (shear flow v = T/(2·A_k), J = 4·A_k²/∮(ds/t), J_box/J_open stiffness ratio), eccentric-load distribution to the two webs (symmetric flexural + antisymmetric torsional split), and §5.3 cross-section component design (deck slab transverse bending, web combined shear+torsion / diagonal compression, bottom-slab longitudinal compression over continuous supports).

**Bridge live-load generator** — SNI 1725:2016 / RSNI T-02-2005 "D" lane load, from Soetoyo "Konstruksi Beton Pratekan" §9 + Nawir Rasidi "Monograf Jembatan" BAB 4 (`bridgeload.ts`, standalone 🚚 Beban Jembatan SNI 1725 tab): BTR q (L≤30m→9 kPa, else 9(0.5+15/L)), BGT p = 49 kN/m, dynamic allowance FBD (0.40→0.30), per-girder M_live = qL²/8 + (1+FBD)·P·L/4 and V_live via tributary width; outputs `wLive_equiv` as a drop-in for the main-panel uniform `wLive`.

**Lateral-torsional buckling** — slender-beam lateral stability per Abeles & Bardhan-Roy "Prestressed Concrete Designer's Handbook" §13.3 (after Timoshenko) (`lateralstability.ts`, standalone 🌀 Stabilitas Lateral / Tekuk Torsi tab): torsional + weak-axis properties (I_y, J open built-up, B₁ = E·I_y, C = G·J), slenderness screen L/b > 30 (CP 115), Timoshenko critical load W_cr = (K/L²)·√(B₁·C) with K by support/load case, creep-softened E, load-height effect, and factor of safety FS = W_cr/W_applied ≥ 3. Complements the ACI §22.7 V+T reinforcement design in `torsion.ts`.

**Construction-stage / segmental bridges** — Hewson "Prestressed Concrete Bridges" Ch.12–15 + PTI "Post-Tensioning Manual" §2.7 (`segmental.ts`, standalone 🏗 Konstruksi Bertahap / Segmental tab): balanced-cantilever erection (pier hogging from self-weight + form-traveller + erection live load, out-of-balance moment, cantilever-tendon stress check), incremental launching (leading-cantilever moment with launching-nose reduction, mid-span sagging, concentric "central" prestress, reversing ±M fibre-stress envelope at early-age strength), and creep redistribution on a system change M_final = M_built + (M_mono − M_built)(1 − e^−φ). Also `computePrelimPT` (Montgomery, ASPIRE "Preliminary Determination of Post-Tensioning Layouts"): strand count from the governing Service III tension via tendon efficiency η = 1 − M₂/M₁ — σ_Design = (M_DC+M_DW+M_CR+M_SH+0.8·M_LL+0.5·M_TG)·c/I, σ_PT,1 = P₁/A + η·P₁·e·c/I, n = (σ_Design − σ_LIMIT)/σ_PT,1 → tendon count suggestion (sub-block in the 🏗 tab).

**External / unbonded prestressing** — Hewson §6–7 + PTI §3.2.3 (`external.ts`, standalone 🪢 Prategang Eksternal tab): polygonal tendon deviated only at saddles, deviator force F = 2·P·sin(Δθ/2) and deviator friction, equivalent uplift (load balancing by deviator forces), second-order eccentricity loss (a straight tendon does not follow the beam deflection → reduced lever arm), and the ULS unbonded/external tendon stress f_ps per ACI 318-19 §20.3.2.4.1 (span/depth-dependent caps) with M_n.

**Component handling, erection & long-term camber** — PCI Design Handbook 7th Ed. Ch.8 + Ch.5 multipliers (`handling.ts`, standalone 🏭 Handling & Ereksi + Camber tab): two-point symmetric pickup (M_support = −w·a²/2, M_mid = w·L1²/8 − w·a²/2), per-stage impact factors (stripping / transport / erection), early-age fibre-stress checks, and the classic PCI long-term camber multipliers (erection 1.80/1.85; final 2.45/2.70/3.00, or with composite topping 2.20/2.40/3.00/2.30). Plus `checkDebondLimits` in `engine/development.ts` (AASHTO §5.9.4.3.3, the FDOT LRFD "middle break" strand patterns): debonded/shielded strands ≤ 25% of the total and ≤ 40% per row — surfaced as a sub-block in the 🏭 tab.

**Fire-resistance design** — PCI Design Handbook 7th Ed. Ch.10 + Abeles & Bardhan-Roy §16, after ACI 216.1 (`fireresistance.ts`, standalone 🔥 Ketahanan Api tab): prescriptive minimum equivalent thickness and minimum cover to the strand by fire rating and aggregate type (siliceous/carbonate/lightweight), restrained vs unrestrained classification, plus the strength check — strand retained-strength factor k_θ(θ_s), f_pu,θ = k_θ·f_pu, reduced flexural capacity M_n,θ ≥ M_fire at the fire limit state (load factor 1.0).

**AASHTO LRFD live-load distribution factors** — "Bridge Superstructure Design" Ch.3 / AASHTO LRFD §4.6.2.2 (`distribution.ts`, standalone 🛤 Faktor Distribusi LRFD tab): longitudinal stiffness K_g = n(I + A·e_g²); interior-girder moment and shear distribution factors for one and two-or-more loaded lanes; exterior-girder lever rule (multiple-presence m) and e·g_interior with e_M = 0.77 + d_e/2800, e_V = 0.6 + d_e/3000; the governing g_M / g_V feed the manual `girderDF` of the SNI bridge live-load generator (`bridgeload.ts`).

**Differential shrinkage in composite members** — Abeles & Bardhan-Roy §11.5/§11.7.4 (Evans & Parker; also BS 5400/Hambly) (`diffshrinkage.ts`, standalone 💧 Susut Diferensial Komposit tab): a young cast-in-place deck shrinks more than the older precast girder; bond restraint gives a creep-reduced restraint force F_sh = Δε·E_deck·A_deck·φ_red (φ_red = (1−e^−φ)/φ, tension in deck), a moment M_cs = F_sh·a_cent about the composite NA, and self-equilibrating fibre stresses — flagging the added tension at the girder soffit that must enter the SLS crack check.

**Girder section database** — `lib/presets.ts` catalogs 62 precast/prestressed profiles across 13 categories (WIKA WF, AASHTO I–VI, PCI Bulb-Tee, PCI/standard I incl. the **WIKA PCI-Girder H-125/H-160/H-170/H-210 Indonesian series** (books 139 + WIKA brochure 143/144), **NU Nebraska metric series** NU750–NU2400 + NU2000PT per Geren & Tadros PCI J. 1994 — thin 150 web, 1225×65 top / 975×140 bottom flanges, R=200 circular fillets idealised as area-equivalent trapezoids (h5=94, h4=242, calibrated so NU2000 matches the true ≈635,600 mm²), **CPCI 1200–2300 Canadian metric girders** per Hassanain & Loov PCI J. 1999 (areas check against the published 320/414/499/544/604 ×10³ mm² table), Deck Bulb-Tee, Double-Tee, PC-U trough incl. **Texas U40/U54 tub** (book 171), voided slab, spread-box, AASHTO Box BI–BIV, and **AASHTO-PCI-ASBI Segmental Box** H-1800…H-3000 (book 162, span-by-span + balanced-cantilever depth ladder)), all with trapezoidal fillets / single-web idealisation. The 📚 Database Profil tab (`ProfileDatabaseCalculator`) computes gross section properties (A, y_b/y_t, I_g, Z_t/Z_b, r², kern, efficiency ρ) for every profile via `calculateGrossProperties`, sortable by height/area/I_g/efficiency/name and filterable by category, with a click-to-preview section sketch.

**HPC cost optimization** — Hassanain & Loov "Design of Prestressed Girder Bridges Using High Performance Concrete — An Optimization Approach" (PCI Journal 1999) (`engine/optimization.ts`, standalone 💰 Optimasi Biaya HPC tab): superstructure cost per unit deck area C = [n_g·C_g + C_c·V_c + C_s·m_s]/(W·L); concrete mix cost ratio CMCR = 0.936 + (f'c/100 MPa)³ — raising girder f'c (HPC) lets fewer girders at wider spacing carry the same deck, trading a small mix-cost rise against fewer girder/transport/erection units; transport+erection C_te = C_f + n_g·(per-girder charge); constraint screens (spacing 3.0–6.0 m, n_g ≥ 2 with ≥ 3 preferred for staged-repair redundancy, deck ≥ 225 mm); alternatives table + cost bar chart + cheapest-feasible verdict.

**Strand & multi-strand PT tendon database** — `lib/strands.ts`: ASTM A416/A416M (AASHTO M203) seven-wire low-relaxation catalog (Ø9.53–15.24 mm, Grade 1725/1860, A_ps, f_pu, f_py = 0.90·f_pu, MBL = f_pu·A_ps, mass) plus multi-strand post-tensioning units (4/7/12/19/22/27/31/37 strands: ΣA_ps, unit MBL, P_jack at 0.75/0.80·f_pu, duct internal Ø from AASHTO LRFD §5.4.6.2 fill rule A_duct ≥ 2.5·ΣA_ps) and `suggestTendonLayout()` (fewest equal tendons ≤ 6). Wired into InputPanel (standard-strand dropdown syncs area/Ø/f_pu/f_py; summary box shows the suggested multi-tendon arrangement with duct & jacking forces) and a second view in the 📚 Database tab.

**Dual design method — Full vs LRFD-Partial side-by-side** — `engine/dualmethod.ts` (`computeDualMethod`): the SAME service fibre stresses judged under BOTH philosophies in parallel — Full = ACI Class U (tension ≤ 0.5√f'c, uncracked) vs Partial = Class C / AASHTO LRFD (tension ≤ 1.0√f'c; if σ_b > f_r = 0.62√f'c the section cracks → Gergely–Lutz crack width vs 0.30 mm, required A_s, steel stress, PPR). Always computed in `runPipeline` → `results.dualMethod`; rendered as the two-column `DualMethodBlock` in the SLS tab and report §16A (3-line format), with a "governs" conclusion.

**Unified design output sheet** — `lib/designsheet.ts` (`designSheetSVG`): ONE complete engineering drawing (1150×815 SVG, double border + title block) modelled on the DED references A/B/C, composing (A) composite cross-section **POTONGAN** — strand rows, both neutral axes, **and full witness/arrow dimension lines** (b₁, b₃, b_eff, H girder, H total) with **isotropic fit-to-box auto-scaling** (`secScale = min(BOX_H/hC, 2·BOX_HALF_W/fitWmm)`) so the section stays proportional and NEVER overflows its panel however the live geometry changes; (B) multi-tendon PT **TAMPAK SAMPING** elevation with anchors, parabola, e_mid, **dashed end-blocks + bearing-support triangles + a span dimension line**; (C) M_u & net-deflection curves; (D) transfer/service/deck stress diagrams (blue compression, red tension) with all code limits incl. Full vs Partial; (N) a DED-style **CATATAN/NOTES** block auto-filled from inputs (concrete f'c/f'ci/deck, BjTS 420B/BjTP 280 + cover 30/50 mm, PC strand Ø/grade/jacking %, PT system); (E) key-results column + verdict stamps (SLS/ULS/deflection/shear/Full/Partial); and an engineering title block. The on-screen live `SectionDiagram.tsx` is likewise fully dimensioned and fit-to-box auto-scaling (shape + numbers update on every input change). Pure string generator — rendered identically by the 📋 Lembar tab (`DesignSheet.tsx`) and embedded as report §0 (single source, no duplication).

**Long-term analysis (AEMM)** — Gilbert, Mickleborough & Ranzi "Design of Prestressed Concrete to Eurocode 2" §5.7/§5.11.4 (`engine/aemm.ts`, ⏳ tab): Trost–Bažant age-adjusted effective modulus Ē = E_c/(1+χφ); instantaneous (ε₀, κ₀) from sustained N, M; fully-restrained creep/shrinkage/relaxation actions released on the age-adjusted transformed section [Ā B̄; B̄ Ī] → Δε, Δκ, final curvature κ∞, long-term deflection (δ ≈ 5/48·κ·L²) with an implied multiplier to compare against PCI 2.45, tendon-stress change (loss cross-check) and t₀/t∞ fibre stresses. Also `computeJointMovement` (LRFD design-example flow / WSDOT BDM §5.8.1.E): superstructure shortening (elastic P/(A·E)·L + creep φ·δ_el + shrinkage ε_sh·L) plus thermal range α·ΔT·L → joint opening/closing totals and design movement range γ·Σ (sub-block in the ⏳ tab, sharing the AEMM time parameters). Also `computePTApproxLoss` in `engine/losses.ts` (Shing & Kottari, UCSD SSRP-11/02 / Caltrans 2011, eq. 6.7): the AASHTO approximate long-term loss extended for POST-TENSIONED girders — Δf_pLT = (14·γ_st·γ_ac·f_pi·A_ps/A_t + 69·γ_as)·γ_h·γ_sr + Δf_pR, with creep-maturity γ_ac = t_i^−0.118 and remaining-shrinkage γ_as = 1−[t_i/(35+t_i)]·[(45+t_i)/(157+t_i)] at the age of stressing t_i, and the mild-steel restraint factor γ_sr = 1/(1+(η̄_s−1)(ρ_ps+ρ_ns)), η̄_s = 6(1+1.2·t_i^−0.118) — both effects ignored by the pretensioned approximate formula (third sub-block in the ⏳ tab).

**Curved-tendon radial force effects** — Stone & Breen CTR 208-3F + Powell/Breen/Kreger CTR 365-1, as codified in AASHTO LRFD §5.9.5.4.3 (`engine/curvedtendon.ts`, standalone ➰ Tendon Melengkung tab): in-plane deviation force F_in = P_u/R and out-of-plane multistrand-flattening force F_out = P_u/(π·R) per metre; cover shear resistance on two planes through d_eff = d_c + Ø_duct/4 (V_r = φ·2·0.33√f'ci·d_eff); tieback reinforcement carrying the full radial force when the cover fails (the Stone–Breen multistrand side-face mechanism); web lateral-bending stress from F_out; and the R ≥ 6 m duct-radius screen (tighter curves → steel-pipe deviator, see `external.ts`).

**Bridge load rating (LRFR)** — AASHTO Manual for Bridge Evaluation §6A, procedure per CDOT Bridge Rating Manual §9B (`engine/rating.ts`, standalone 🏷 Load Rating tab): RF = (φ_c·φ_s·φ·R_n − γ_DC·DC − γ_DW·DW)/(γ_LL·(LL+IM)) with γ_LL = 1.75 inventory / 1.35 operating (φ_c·φ_s ≥ 0.85), plus the prestressed-member Service III stress rating RF = (f_R − f_D)/(0.80·f_LL) with f_R = 0.5√f'c; governing RF → adequate/posting verdict and safe-load tonnage RF × rating-vehicle weight.

**Spliced two-stage PT girders** — Ronald (PCI Journal 2001) + TxDOT 0-6652-1 (Bayrak/Jirsa) + WSDOT BDM §5.9 (`engine/splicedgirder.ts`, standalone 🧩 Gelagar Spliced tab): stress ACCUMULATION through the build sequence — Stage A pretension + M_g on the precast section (f'ci limits), Stage B stage-1 PT + deck weight still non-composite, Stage C stage-2 PT + SDL + LL on the composite section (f'c limits); closure-joint check (no pretension crosses the splice → joint must stay compressive under PT alone); and the PT-duct web-shear knock-down λ_duct = 1 − 2·(Ø_duct/b_w)² applied to (V_c+V_s) per AASHTO §5.7.2.8, reported beside the legacy b_v,eff = b_w − k·Ø alternative.

**Fatigue limit state** — FHWA NHI-04-043/044 design step 5.6.6, per AASHTO LRFD §5.5.3 (`engine/fatigue.ts`, standalone 🔁 Fatik tab): uncracked screen σ_bot(perm + γ·M_fat/Z_bc) ≤ 0.25√f'c waives the strand check; otherwise strand stress range Δf_p = n_p·γ·M_fat·e_ps/I_c vs the curvature-dependent threshold (125 MPa for R > 9 m → 70 MPa for R ≤ 3.6 m, interpolated), and mild-steel range Δf_s vs ΔF_TH = 166 − 0.33·f_min.

**Longitudinal-reinforcement tie check** — AASHTO §5.7.3.5 / FHWA NHI step 5.7.6, folded into `engine/mcft.ts` (same inputs, no new module): shear demands extra tension in the flexural steel — T_req = |M_u|/(d_v·φ_f) + 0.5N_u/φ_f + (|V_u/φ_v − V_p| − 0.5V_s)·cotθ ≤ A_ps·f_ps + A_s·f_y; surfaced as an extra CheckRow in the MCFT block (ULS tab) and report §22.

**Special prestressed members** — Krishna Raju "Prestressed Concrete" Ch.16/19 (`engine/specialmembers.ts`, 🧪 tab, three sub-tabs): circular prestressed **pipes** (thin-wall hoop N_θ = p·D_i/2, required residual compression, wire-winding pitch s = A_w·σ_w/(σ_pre·t), test pressure), **poles** (annular base section, cantilever M = P·H + w·H²/2 from conductor + wind, ±M/Z faces vs Class-U limits, M_crack FS), and **railway sleepers** (R = axle/2·impact, uniform ballast pressure, rail-seat overhang sagging + centre hogging moments, fibre checks).

**Mast roll-equilibrium lateral stability** — Mast "Lateral Stability of Long Prestressed Concrete Beams" PCI J. 1989/1993, as codified in PCI Bridge Design Manual §8.10 (`engine/lateralstability.ts`, added beside the Timoshenko buckling in the 🌀 tab): a physically different mechanism — rigid-body **roll** about the support/roll axis plus lateral bending, not Euler buckling. Lateral deflection of the c.g. z̄_o = w·L⁵/(120·E·I_y·a_span)-type sweep, initial eccentricity e_i from sweep tolerance + offset factor ((L1/L)²−1/3), and two cases: **hanging** (roll axis above c.g.) FS_cracking = 1/(z̄_o/y_r + θ_i/θ_max) ≥ 1.5, and **hauling/transport** (roll axis below c.g., superelevation α) θ_eq = (α·r + e_i)/(r − y − z̄_o) with FS_cracking ≥ 1.0 and FS_rollover ≥ 1.5, where r = K_θ/W is the truck/support rotational-spring radius. Complements the slenderness-buckling W_cr in the same module.

**AASHTO HL-93 closed-form live load** — PCI Bridge Design Manual §8.11 + Ch.7 / AASHTO LRFD §3.6.1 (`engine/bridgeload.ts`, added beside the SNI "D" load in the 🚚 tab): simple-span closed-form per-lane envelopes for the **design truck** (HS20, 35+145+145 kN axles), **design tandem** (2×110 kN @1.2 m), uniform **lane** load 9.3 kN/m, and the **fatigue truck** (rear-axle spacing fixed 9.1 m, IM 15%); HL-93 = max(truck, tandem)·(1+IM) + lane, governing-vehicle flag, then per-girder M/V via the LLDF g_M/g_V from the 🛤 tab and a `wLive_equiv` drop-in. Runs parallel to the SNI generator for cross-comparison.

**Improved (refined) multiplier camber** — Tadros, Ghali & Meyer "Prestress Loss and Deflection of Precast Concrete Members" + PCI Bridge Design Manual §8.7.2 (`engine/handling.ts` `computeImprovedMultipliers`, sub-block in the 🏭 tab): refines the lumped PCI 2.45/3.00 multipliers by giving each load component its **own** time-dependent multiplier — m_Pe = 1+C_a and m_Pf = 1+C_u for prestress, m_Le = α(1+χ·C_a) for the prestress-loss "apparent negative prestress", m_Df = 1+C'_u for composite/erection dead load applied to the older section — so erection (C_a, α) and final (C_u, C'_u, χ aging) cambers are computed separately. More accurate for composite girders with delayed erection.

**Adjacent box-beam transverse design** — El-Remaily, Tadros et al. PCI Bridge Design Manual §8.9 (`engine/transversept.ts`, standalone 🔲 tab): two methods to tie side-by-side box beams into a transverse diaphragm — (1) **rational PT diaphragm** with required transverse PT force from the digitized Fig 8.9.3-2 design chart (kip/ft by bridge width 28–90 ft × beam depth 27/33/39/42 in, bilinearly interpolated → kN/m), A_pt = F/(0.55·f_pu), grout no-tension + 1.72 MPa (0.250 ksi) rigid-connection limit, ×1.30 if unbonded; and (2) the empirical **Oregon tie-rod** layout (Ø22 A449 @ 175 kN, count by span, total ≥ beam weight).

**Strut-and-tie modeling (D-regions)** — PCI Bridge Design Manual §8.12 / AASHTO LRFD §5.6.3 (`engine/strutandtie.ts`, standalone ▽ tab): disturbed-region truss idealization — concrete-strut limiting stress f_cu = f'c/(0.8+170·ε₁) ≤ 0.85·f'c with ε₁ = (ε_s+0.002)·cot²α_s (compression softening), node-region factors CCC 0.85 / CCT 0.75 / CTT 0.65, φ_strut = 0.70 / φ_tie = 0.90, tie steel A_st = T_u/(φ·f_y); plus `computePierCapTruss` (two-panel symmetric pier-cap truss: top tie F = P_u/tanθ, diagonals P_u/sinθ).

**Bridge deck slab design** — PCI Bridge Design Manual §8.8 (`engine/deckslab.ts`, standalone 🛞 tab): transverse deck bending two ways — **AASHTO Standard** equivalent-strip M_LL = continuity·((S_ft+2)/32)·P_axle with 30% impact, M_u = 1.3(M_D+1.67·M_LLI); and **AASHTO LRFD** strip method (E_pos = 660+0.55·S, E_neg = 1220+0.25·S, E_overhang = 1140+0.833·X in mm, IM 1.33, M_u = 1.25·M_DC+1.75·M_LL) for positive, negative, and cantilever-overhang regions.

**Seismic single-mode uniform-load method** — PCI Bridge Design Manual Ch.15 / AASHTO Standard Div. I-A + LRFD §4.7.4 (`engine/seismic.ts`, standalone 🌐 tab): seismic-performance-category SPC A–D by acceleration A, equivalent stiffness K (direct, or 3·EI/h³ single- / 12·EI/h³ double-curvature column), period T = 2π·√(W/(g·K)), elastic seismic coefficient C_s = 1.2·A·S/T^(2/3) ≤ 2.5·A, design force V = C_s·W/R, equivalent static load p_e, SPC-A minimum connection force 0.20·DL, and the minimum support-seat width N anti-loss-of-span (STD I-A in vs LRFD §4.7.4.4 mm, skew factor). Precast prestressed girders are typically force-protected — the columns/connections absorb the seismic energy.

**AASHTO box-beam presets BI–BIV** — PCI Bridge Design Manual Appendix B (`lib/presets.ts`, new `AASHTO_BOX` category): the standard adjacent-box sections (BI/BII/BIII/BIV × 36/48 in width) entered as area-equivalent **trapezoidal-I** profiles (web = 2×127 mm walls, fillets idealising the void corners, flange thickness calibrated to the published 560.5–842.5 in² gross areas) so the same `calculateGrossProperties` machinery and the transverse 🔲 tab apply.

**Substructure / bangunan bawah — ordinary RC (beton bertulang biasa)** — Wai-Fah Chen & Lian Duan "Bridge Engineering: Substructure Design" + AASHTO LRFD §3 (loads) / §5 (concrete) / §10 (foundations) + SUSPA/VSL rock-anchor data sheet (`engine/substructure.ts`, standalone 🏛️ Bangunan Bawah tab, 7 sub-tabs). The reinforced-concrete companion to the prestressed superstructure — loads flow girder → bent cap → pier column → footing/pile-cap → soil/piles, plus the abutment that retains the approach fill. Shared helpers `beta1`, `Ec`, **`phiFromStrain`** (strain-control φ ramp: φ=0.90 if εt≥0.005, 0.65/0.75 if εt≤εty, linear transition). (1) `computeLoadCombos` — AASHTO Table 3.4.1-1 Strength I/III/V + Service I + Extreme I, γ_p max/min, governing Pu/Mu/Hu; (2) `computePierColumn` — RC P-M interaction by neutral-axis sweep with εt strain control, ρ 1–8%, moment magnification δ=Cm/(1−Pu/0.75Pc); (3) `computeBentCap` — RC beam flexure (As, As,min) + one-way shear Vc=0.166√f'c·b·d (deep caps → STM ▽ tab); (4) `computeSpreadFooting` — soil bearing q=ΣP/A±M/S with kern L/6 (full/partial triangular), two-way punching b₀ at d/2 (min of three vc terms), one-way shear at d, flexure at column face; (5) `computePileGroup` — rigid-cap reaction R=P/n±M·x/Σx², Converse-Labarre group efficiency, uplift screen; (6) `computeAbutment` — Rankine Ka=tan²(45−φ/2), Pa+surcharge, FS_overturning≥2.0, FS_sliding≥1.5, base bearing, cantilever stem RC at base; (7) `computeGroundAnchor` — tieback T_steel=0.6f_pu·A_ps & grout-ground bond T_bond=π·d·L_b·τ/FS (permanent FS≥2.0), free-length elastic stretch, lock-off 0.7T, H/V components.

**Creep & shrinkage prediction models — long-term backbone** — the recurring theme of books 123–135 (Sousa SHM, the ACI CI 2010 record-span box over-deflection, BJRBE 2018 non-uniform box shrinkage, Reybrouck & Savino PhD theses, the multi-decade balanced-cantilever deflection study) is that long-term deflection and prestress loss are GOVERNED by the chosen creep/shrinkage model (`engine/creepshrinkage.ts`, standalone 🕰 Model Rangkak & Susut tab). Four families computed in parallel and compared: **ACI 209R-92** (hyperbolic-power φ_u·τ^0.6/(10+τ^0.6), ε_shu·t/(35+t)), **CEB-FIP MC90 / fib MC2010** (φ_RH·β(fcm)·β(t₀)·β_c, drying ε_cd + autogenous ε_ca), **GL2000** (Gardner–Lockman), **B3** (Bažant–Baweja condensed). Returns φ(t,t₀), ε_sh(t), E_eff = E_c/(1+φ), the Trost–Bažant aging coefficient χ and E_adj = E_c/(1+χφ) plus a φ-vs-log-time and ε_sh-vs-time comparison chart — feeding the ⏳ AEMM tab, PCI camber multipliers and the creep/shrinkage prestress-loss path (a single time-dependent source for the whole long-term chain). `compareAllModels()` runs all four at once.

**Box-girder distortion & shear-deformation deflection** — two additions to `engine/boxgirder.ts` surfaced as new sub-blocks in the 🌉 Box Girder tab. (a) `computeBoxDistortion` — Richard Wright "Design of Box Girders of Deformable Cross Section" (book 124) + Abdel-Samad/Robinson **Beam-on-Elastic-Foundation analogy**: the eccentric load's distortional component racks the cell into a parallelogram, resisted by the transverse frame stiffness K_frame of the four walls; distortional warping rigidity EI_dw → BEF characteristic length λ = (K/4EI_dw)^0.25, β·L slenderness, transverse-frame corner moment + transverse bending stress, longitudinal distortional warping stress vs longitudinal bending (target ≤ 10%), and recommended interior-diaphragm spacing. (b) `computeBoxShearLag` — "Simplified Calculation Method of Box-Girder Deflection Considering Full-Section Shear Deformation" (book 135): shear-lag effective flange widths b_eff = ψ·b, and the Timoshenko split δ_total = δ_bending (5wL⁴/384EI) + δ_shear (wL²/8GA_v) with the shear/bending ratio that matters for deep/short boxes, checked against L/800.

**RC T-beam bridge superstructure — ordinary RC (beton bertulang biasa, bangunan atas)** — "Standar Jembatan Gelagar Beton Bertulang Balok-T, Bentang 5–25 m" (Direktorat Jenderal Bina Marga, book 152) + AASHTO LRFD §4.6.2.6 / §5 + SNI 2847:2019 + SNI 1725:2016 (`engine/rcgirder.ts`, standalone 🧱 Gelagar Balok-T tab). The non-prestressed superstructure companion for short/medium spans where prestressing is uneconomic — the deck slab acts as the compression flange of the T, the web carries tension steel + stirrups. Chronological procedure: (1) effective flange width b_eff = min(L/4, S, b_w+16h_f); (2) loads → factored M_u/V_u (self + tributary deck + asphalt + SNI 1725 "D" lane load × g); (3) flexure as a T-section — rectangular block if a ≤ h_f else true-T (overhanging-flange couple + web couple), with εt strain control via the shared `phiFromStrain`, A_s,min = max(0.25√f'c/f_y, 1.4/f_y)·b_w·d, and required A_s for M_u; (4) one-way shear V_c = 0.17√f'c·b_w·d, A_v/s, s_max, V_s ≤ 0.66√f'c·b_w·d cap. Scaled T-section SVG sketch (flange/web, Whitney block, tension-steel row). Reuses `beta1`/`phiFromStrain` from `substructure.ts` (no duplication).

**Made-continuous precast prestressed girders — restraint moments** — NCHRP Report 322 "Design of Precast Prestressed Bridge Girders Made Continuous" (books 147/148) + Freyermuth/PCA + PCI Bridge Design Manual §11.1 (`engine/madecontinuous.ts`, standalone ⛓️ Gelagar Dibuat Menerus tab). A mechanism DISTINCT from `continuous.ts` (which does TY-Lin equivalent-load secondary moments for a member continuous-and-PT from the start): here girders are erected as **simple spans**, then a CIP deck + continuity diaphragm over the pier ties them continuous AFTER prestress + self-weight are locked in. Time-dependent creep then induces a restraint moment M_r at the interior support — prestress wants to camber up (held down → POSITIVE/sagging restraint → tension at diaphragm bottom → positive-moment connection), self-weight adds NEGATIVE, differential shrinkage relieves the positive. Rotation method (two/three equal spans): simple-span end rotation θ = w·L³/(24EI), continuity moment M = −3EI·θ/L; loads locked-in before continuity develop via creep (1−e^−φ), differential shrinkage via (1−e^−φ)/φ. Positive-moment connection per AASHTO LRFD §5.12.3.3: M_conn = max(1.2·M_cr, M_r⁺), A_s = M/(φ·f_y·jd). Reuses `Ec` from `substructure.ts`.

**Current state:** Python/Streamlit MVP (`app.py` + `engine/`) — SLS non-composite stress checks only.  
**Target:** Next.js (TypeScript) full design suite as specified in `PRD Prategang.md`.

Additional context is in:
- `.claude/skills.md` — custom skill definitions for each engine layer
- `.claude/agents.md` — sub-agent definitions for validation and review

---

## Target Tech Stack

| Concern | Technology |
|---|---|
| UI + Routing | Next.js (App Router), Tailwind CSS, Shadcn UI |
| State | Zustand |
| Numerics | Math.js (matrix operations, precision arithmetic) |
| Database | Supabase (PostgreSQL) |
| Visualization | Recharts / Chart.js |
| Testing | Vitest — numerical tolerance ±0.5% for all assertions |

Source layout target:
```
src/
├── app/            # Next.js routes
├── components/     # UI components
├── engine/         # Pure calculation modules (section.ts, tendon.ts, losses.ts, sls.ts, uls.ts)
├── store/          # Zustand stores
└── types/          # Shared TypeScript interfaces
tests/
└── core_engine_assertion.test.ts
```

---

## 5-Layer Engine Architecture

Data flows strictly one-way. No circular dependencies between layers.

```
[Layer 1: Section & Geometry]  ──>  [Layer 2: Tendon Profile & Forces]
          │                                       │
          ▼                                       ▼
[Layer 3: Time-Dependent Losses] ─────────>  [Layer 4: SLS Stress Validator]
                                                   │
                                                   ▼
                                  [Layer 5: ULS Deflection & Detailing]
```

| Layer | File | Responsibility |
|---|---|---|
| 1 | `src/engine/section.ts` | Gross and composite section properties (A, y_b, y_t, I_g, I_c, Z) |
| 2 | `src/engine/tendon.ts` | Tendon profile geometry (straight/harped/parabolic), jacking force, immediate losses |
| 3 | `src/engine/losses.ts` | AASHTO Refined: creep (ΔfpCR), shrinkage (ΔfpSR), relaxation (ΔfpR2) |
| 4 | `src/engine/sls.ts` | Transfer and service SLS fiber stress checks with AMAN/OVERSTRESS verdict |
| 5 | `src/engine/uls.ts` | Flexural ULS (Whitney block iteration), shear Vci/Vcw, interface shear, deflection/camber |

Each engine module exports a **pure function** — takes an input object, returns a frozen result object. No side effects.

---

## Engineering Conventions

**Units:** All dimensions in `mm`. Stresses in `MPa`. External forces/loads in `kN` and `kN/m`. Moments in `kN·m`. At the section calculation level, convert to `N` and `N·mm` explicitly (`kN × 1000`, `kN·m × 1e6`).

**Sign convention:** Positive σ = tension, Negative σ = compression. Applied uniformly throughout all stress formulas and output values.

**Reference axis:** `y = 0` at the bottom fiber of the precast girder. All distances measured upward.
- `y_b` = centroid from bottom fiber
- `y_t` = H_girder − y_b (centroid from top fiber of precast girder)
- `e` = eccentricity, measured downward from neutral axis to tendon centroid (positive = tendon below NA)

**Composite modular ratio:** `n_c = E_c_deck / E_c_girder` where `E_c = 4700 × √f'c` (MPa). Recompute dynamically; never hardcode.

---

## Key Formula Reference

### Layer 1 — Gross Section (Non-Composite)

```
A_g  = Σ(b_i × h_i)                                          [3 rectangles: bot flange, web, top flange]
y_b  = Σ(A_i × y_i) / A_g                                    [y_i = centroid of rectangle from bottom]
y_t  = H_girder − y_b
I_g  = Σ(b_i×h_i³/12 + A_i×(y_i − y_b)²)
Z_tg = I_g / y_t,   Z_bg = I_g / y_b
```

### Layer 1 — Composite Transformed Section

```
n_c       = E_c_deck / E_c_girder
A_deck_tr = n_c × b_eff × t_d
y_deck    = H_girder + t_d/2
y_bc      = (A_g×y_b + A_deck_tr×y_deck) / (A_g + A_deck_tr)
y_tgc     = H_girder − y_bc
y_ttc     = H_girder + t_d − y_bc
I_c       = I_g + A_g×(y_b−y_bc)² + n_c×b_eff×t_d³/12 + A_deck_tr×(y_deck−y_bc)²
Z_bc      = I_c / y_bc
Z_tgc     = I_c / y_tgc
Z_ttc     = I_c / (n_c × y_ttc)
```

### Layer 4 — SLS Transfer Stage (non-composite, P_i and M_g only)

```
f_t = −P_i/A_g + P_i×e/Z_tg − M_g/Z_tg
f_b = −P_i/A_g − P_i×e/Z_bg + M_g/Z_bg
Limits → compression: −0.60×f'ci  |  tension: +0.50×√f'ci
```

### Layer 4 — SLS Service Stage (composite)

```
f_t_serv  = −Pe/A_g + Pe×e/Z_tg − (M_g+M_sdl)/Z_tg − M_live/Z_tgc
f_b_serv  = −Pe/A_g − Pe×e/Z_bg + (M_g+M_sdl)/Z_bg + M_live/Z_bc
f_deck    = −M_live / Z_ttc
Limits → compression: −0.45×f'c  |  tension: +0.50×√f'c (full) / +1.00×√f'c (partial)
```

### Layer 5 — ULS Flexure (Whitney block iteration)

```
f_ps = f_pu × [1 − (γ_p/β₁) × (ρ_p×f_pu/f'c + d/d_p×(ω−ω'))]
Iterate a until |C_b − T_total| < 1×10⁻⁵ N:
  if a ≤ t_d:  C_b = 0.85×f'c_deck×b_eff×a
  if a > t_d:  C_b = deck + girder flange contributions
M_n = A_ps×f_ps×(d_p − a/2) + A_s×f_y×(d − a/2)
Check: φ×M_n ≥ M_u  (φ = 0.90)
```

---

## Database Schema (Supabase)

Four primary tables (full SQL in `PRD Prategang.md`):

| Table | Key Columns |
|---|---|
| `structural_projects` | project_id (UUID PK), title, standard_code (ENUM), span_length, relative_humidity |
| `material_properties` | project_id (FK), fc_girder_transfer, fc_girder_service, fc_deck_service, fpu_strand, fpy_strand, es_strand, ec_girder_service, fy_rebar, fys_rebar |
| `section_geometries` | project_id (FK), profile_type (ENUM), total_height, top/web/bottom flange dimensions, deck_thickness, deck_width_effective |
| `tendon_configurations` | project_id (FK), profile_geometry (ENUM: STRAIGHT/HARPED/PARABOLIC), total_strands_count, single_strand_area, jacking_force_percentage, eccentricity_midspan, eccentricity_support, hold_down_distance_ratio |

---

## Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Run all tests
npm test

# Run single test file
npx vitest run tests/core_engine_assertion.test.ts

# Type check
npx tsc --noEmit
```

For the existing Python MVP:
```bash
pip install -r requirements.txt
streamlit run app.py
```

---

## Benchmark Test Case (PRD §10)

All engine implementations must pass these numerical assertions within ±0.5%:

| Parameter | Value |
|---|---|
| L | 30,000 mm |
| Top flange b₁/h₁ | 600 / 200 mm |
| Web b₂/h₂ | 200 / 1,200 mm |
| Bottom flange b₃/h₃ | 700 / 250 mm |
| H_girder | 1,650 mm |
| Deck t_d / b_eff | 200 / 2,100 mm |
| f'ci / f'c (girder) | 40 / 50 MPa |
| f'c (deck) | 30 MPa |
| A_ps | 36 × 98.7 = 3,553.2 mm² |
| e_midspan / e_support | 650 / 0 mm |

**Verified gross section** (engine-computed, 29 vitest assertions passing):

| Property | Value |
|---|---|
| A_g | 535,000 mm² |
| y_b | **769.86 mm** *(PRD typo said 721.5 — incorrect)* |
| y_t | 880.14 mm |
| I_g | **1.7746 × 10¹¹ mm⁴** *(PRD typo said 1.942e11 — incorrect)* |
| Z_tg | 201.627 × 10⁶ mm³ |
| Z_bg | 230.509 × 10⁶ mm³ |

**Verified composite section:**

| Property | Value |
|---|---|
| n_c | 0.7746 |
| A_c | 860,331 mm² |
| y_bc | **1,140.5 mm** *(PRD typo said 1110.8 — incorrect)* |
| y_tgc | 509.5 mm |
| I_c | **3.7290 × 10¹¹ mm⁴** *(PRD typo said 4.105e11 — incorrect)* |
| Z_bc | 326.960 × 10⁶ mm³ |

**Verified ULS** (d_p = 1730.1 mm from top of composite):

| Property | Value |
|---|---|
| f_ps | **1,822.2 MPa** *(PRD typo said 1710.5 — incorrect)* |
| a | **120.91 mm** *(PRD typo said 145.2 — incorrect)* |
| M_n | **10,811 kN·m = 1.081 × 10¹⁰ N·mm** *(PRD typo said 7.23e9 — incorrect)* |
| φM_n | 9,730 kN·m (φ = 0.90) |
