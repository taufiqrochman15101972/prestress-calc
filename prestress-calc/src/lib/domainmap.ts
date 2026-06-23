/**
 * domainmap.ts — DOMAIN CLASSIFICATION of every calculator/engine into the four
 * design families requested for the landing page, plus a COMMON family of
 * theories usable across all structures. This is the blueprint the 4-quadrant
 * launcher consumes; it also documents which method belongs where so formulas
 * are never applied out of context.
 *
 * Quadrants (2×2 landing grid):
 *   TL  BUILDING   — gedung & hunian (baja/beton)
 *   TR  COMPOSITE  — komposit/FRP/polimer/polymer-concrete/thermoset/thermoplastic
 *   BL  BRIDGE     — bangunan atas jembatan & infrastruktur sipil (baja/beton)
 *   BR  FOUNDATION — pondasi & bangunan bawah / geoteknik (daya dukung & stabilitas tanah)
 *   COMMON         — teori umum dipakai semua struktur & elemen
 *
 * Each calculation case carries a `kind`: "DESIGN" (program proposes/sizes the
 * result) or "ANALYSIS" (engineer supplies the member, program checks every
 * criterion → which pass / which fail) or "BOTH". Profiles entered once are
 * persisted/recalled via Supabase CloudModal + the profile DB.
 */

export type Domain = "BUILDING" | "COMPOSITE" | "BRIDGE" | "FOUNDATION" | "COMMON";
export type CaseKind = "DESIGN" | "ANALYSIS" | "BOTH";

export interface DomainEntry {
  key: string;        // ExtraTab key or main-app section id
  emoji: string;
  label: string;
  kind: CaseKind;
}

export const DOMAIN_META: Record<Domain, { title: string; quadrant: "TL" | "TR" | "BL" | "BR" | "—"; blurb: string }> = {
  BUILDING:  { title: "Gedung & Bangunan Hunian", quadrant: "TL", blurb: "Desain & analisis gedung bertingkat (baja / beton)" },
  COMPOSITE: { title: "Material Komposit & Polimer", quadrant: "TR", blurb: "Komposit/FRP, polimer, polymer-concrete, thermoset & thermoplastic, serat carbon/E-glass/S2-glass, resin polyester/vinylester/epoxy/PU/polyurea" },
  BRIDGE:    { title: "Jembatan & Infrastruktur (Bangunan Atas)", quadrant: "BL", blurb: "Bangunan atas jembatan & infrastruktur sipil (baja / beton)" },
  FOUNDATION:{ title: "Pondasi & Bangunan Bawah (Tanah)", quadrant: "BR", blurb: "Pondasi & bangunan bawah jembatan/infrastruktur — daya dukung & stabilitas tanah" },
  COMMON:    { title: "Teori Umum (Semua Struktur)", quadrant: "—", blurb: "Analisis & metode yang dipakai bersama semua domain" },
};

/** COMMON — general structural theory/analysis usable by any structure/element. */
export const COMMON: DomainEntry[] = [
  { key: "fem", emoji: "🧮", label: "FEM Modeler 2D (kekakuan)", kind: "ANALYSIS" },
  { key: "fem3d", emoji: "🧊", label: "Rangka Ruang 3D", kind: "ANALYSIS" },
  { key: "plate", emoji: "▦", label: "Pelat/Shell FEM", kind: "ANALYSIS" },
  { key: "shellsolve", emoji: "▣", label: "Shell 3D penuh", kind: "ANALYSIS" },
  { key: "forces", emoji: "📊", label: "Diagram gaya dalam & tegangan", kind: "ANALYSIS" },
  { key: "influence", emoji: "📉", label: "Garis pengaruh & beban bergerak", kind: "ANALYSIS" },
  { key: "timehistory", emoji: "🌊", label: "Time-history dinamik (SDOF linier)", kind: "ANALYSIS" },
  { key: "modal", emoji: "📳", label: "Modal N-DOF & Response Spectrum", kind: "ANALYSIS" },
  { key: "forcemethod", emoji: "🔢", label: "Metode matriks gaya & tiga-momen", kind: "ANALYSIS" },
  { key: "hyst", emoji: "🔄", label: "Histeresis & respons siklik nonlinier", kind: "ANALYSIS" },
  { key: "pushover", emoji: "📈", label: "Pushover nonlinier statik", kind: "ANALYSIS" },
  { key: "fibermc", emoji: "🧵", label: "Momen-kurvatur serat", kind: "ANALYSIS" },
  { key: "umat", emoji: "⚗", label: "UMAT material 1D", kind: "ANALYSIS" },
  { key: "straincompat", emoji: "🎚", label: "Kompatibilitas regangan ULS", kind: "ANALYSIS" },
  { key: "limit", emoji: "⚖️", label: "Analisis batas & garis leleh", kind: "BOTH" },
  { key: "stm", emoji: "▽", label: "Strut-and-tie (batas bawah)", kind: "DESIGN" },
  { key: "dxf", emoji: "📐", label: "Impor gambar DWG/DXF", kind: "ANALYSIS" },
  { key: "opt", emoji: "💰", label: "Optimasi biaya penampang", kind: "DESIGN" },
  { key: "profiles", emoji: "📚", label: "Database profil (simpan/panggil)", kind: "BOTH" },
];

/** BUILDING — buildings & residential only. */
export const BUILDING: DomainEntry[] = [
  { key: "bldgeq", emoji: "🏙️", label: "Gempa bangunan gedung (ASCE 7-16/EC8 ELF)", kind: "DESIGN" },
  { key: "slab", emoji: "🏗", label: "Pelat PT/RC 2-arah (lantai gedung)", kind: "BOTH" },
  { key: "grade", emoji: "🛣", label: "Slab-on-grade (lantai industri)", kind: "BOTH" },
  { key: "column", emoji: "🏛", label: "Kolom RC interaksi P-M", kind: "BOTH" },
  { key: "corbel", emoji: "📐", label: "Korbel/konsol pendek", kind: "DESIGN" },
];

/** BRIDGE & civil-infrastructure superstructure only. */
export const BRIDGE: DomainEntry[] = [
  { key: "_girder", emoji: "📋", label: "Gelagar prategang inti (SLS/ULS/loss/lendutan)", kind: "BOTH" },
  { key: "box", emoji: "🌉", label: "Box girder (Bredt/Menn)", kind: "BOTH" },
  { key: "load", emoji: "🚚", label: "Beban jembatan (SNI 1725/HL-93)", kind: "ANALYSIS" },
  { key: "seg", emoji: "🏗", label: "Segmental (kantilever seimbang/launching)", kind: "DESIGN" },
  { key: "spliced", emoji: "🧩", label: "Gelagar spliced PT 2-tahap", kind: "DESIGN" },
  { key: "ext", emoji: "🪢", label: "Prategang eksternal", kind: "DESIGN" },
  { key: "curved", emoji: "➰", label: "Tendon melengkung (gaya radial)", kind: "ANALYSIS" },
  { key: "madecont", emoji: "⛓️", label: "Made-continuous (restraint rangkak/susut)", kind: "ANALYSIS" },
  { key: "rcgirder", emoji: "🧱", label: "Gelagar balok-T RC (Bina Marga)", kind: "BOTH" },
  { key: "lldf", emoji: "🛤", label: "LLDF distribusi beban AASHTO", kind: "ANALYSIS" },
  { key: "deck", emoji: "🛞", label: "Pelat dek jembatan", kind: "DESIGN" },
  { key: "transpt", emoji: "🔲", label: "Transversal box adjacent PT", kind: "DESIGN" },
  { key: "diffsh", emoji: "💧", label: "Susut diferensial komposit", kind: "ANALYSIS" },
  { key: "handling", emoji: "🏭", label: "Handling/camber/debonding", kind: "ANALYSIS" },
  { key: "ltb", emoji: "🌀", label: "Stabilitas lateral girder", kind: "ANALYSIS" },
  { key: "fatigue", emoji: "🔁", label: "Fatik", kind: "ANALYSIS" },
  { key: "rating", emoji: "🏷", label: "Load rating LRFR", kind: "ANALYSIS" },
  { key: "fire", emoji: "🔥", label: "Ketahanan api", kind: "ANALYSIS" },
  { key: "aemm", emoji: "⏳", label: "AEMM jangka panjang + loss", kind: "ANALYSIS" },
  { key: "creepsh", emoji: "🕰", label: "Rangkak & susut (4 model)", kind: "ANALYSIS" },
  { key: "bearing", emoji: "🧱", label: "Bantalan elastomer", kind: "DESIGN" },
  { key: "dapped", emoji: "🪚", label: "Dapped-end", kind: "DESIGN" },
  { key: "cable", emoji: "🪢", label: "Jembatan kabel (cable-stayed)", kind: "BOTH" },
  { key: "truss", emoji: "🔺", label: "Jembatan rangka baja", kind: "BOTH" },
  { key: "special", emoji: "🧪", label: "Pipa/pole/sleeper pracetak", kind: "DESIGN" },
  { key: "seismic", emoji: "🌐", label: "Gempa jembatan (mode tunggal)", kind: "DESIGN" },
  { key: "snieq", emoji: "🌎", label: "Gempa & beban SNI jembatan", kind: "DESIGN" },
  { key: "seisdyn", emoji: "🌋", label: "Dinamik & gempa substruktur jembatan", kind: "ANALYSIS" },
  { key: "isolation", emoji: "🛡", label: "Isolasi dasar & damper", kind: "DESIGN" },
];

/** FOUNDATION & substructure / geotechnical (soil) only. */
export const FOUNDATION: DomainEntry[] = [
  { key: "pile", emoji: "🪨", label: "Pondasi tiang/dangkal (statik & dinamik)", kind: "BOTH" },
  { key: "substructure", emoji: "🏛️", label: "Bangunan bawah RC (pier/abutmen/footing)", kind: "BOTH" },
  { key: "slope", emoji: "⛰", label: "Stabilitas lereng + konsolidasi + Mohr-Coulomb", kind: "ANALYSIS" },
  { key: "shellreinf", emoji: "◫", label: "Tulangan shell (sandwich IASS)", kind: "DESIGN" },
  { key: "tank", emoji: "🛢", label: "Tangki/pipa melingkar", kind: "DESIGN" },
];

/** COMPOSITE / polymer / FRP — NEW domain; engine to be added next increment. */
export const COMPOSITE: DomainEntry[] = [
  // placeholder entries marking the planned composite material engine:
  { key: "_clt", emoji: "🧬", label: "Laminat FRP — classical lamination theory (A,B,D)", kind: "ANALYSIS" },
  { key: "_frp_strength", emoji: "🩹", label: "Perkuatan FRP lentur/geser (ACI 440)", kind: "DESIGN" },
  { key: "_polyconc", emoji: "🧱", label: "Polymer concrete / resin matrix", kind: "BOTH" },
];

export const DOMAINS: Record<Domain, DomainEntry[]> = {
  COMMON, BUILDING, BRIDGE, FOUNDATION, COMPOSITE,
};
