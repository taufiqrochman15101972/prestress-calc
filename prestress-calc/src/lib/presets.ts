/**
 * Standard Girder Presets — section catalog / database.
 * Real-world precast/prestressed profiles with trapezoidal fillets (h4 bottom,
 * h5 top) so the bottom (tension) and top (compression) zones are trapezoidal —
 * the demouldable shape used in practice (plain rectangular-I is rare).
 * Dimensions in mm. Sources: WIKA catalog, AASHTO M 23, PCI Design Handbook,
 * SNI/Indonesian PCI girder tables, Caltrans. Stored, sortable, browsable in the
 * 📚 Database Profil tab (ordered by overall height).
 */

import type { IGirderGeometry } from "@/types";

export type PresetCategory =
  | "CUSTOM" | "WIKA_WF" | "AASHTO_I" | "PCI_BT" | "PCI_I"
  | "NU" | "CPCI"
  | "DECK_BULB_T" | "DOUBLE_T" | "PC_U" | "VOIDED_SLAB" | "BOX";

export interface GirderPreset {
  id: string;
  name: string;
  category: PresetCategory;
  spanRange: string;    // typical span range
  girder: IGirderGeometry;
}

export const CATEGORY_LABEL: Record<PresetCategory, string> = {
  CUSTOM: "Custom",
  WIKA_WF: "WIKA WF (PC-I Indonesia)",
  AASHTO_I: "AASHTO Type I–VI",
  PCI_BT: "PCI Bulb-Tee",
  PCI_I: "PCI / Standard I",
  NU: "NU I-Girder (Nebraska, metrik)",
  CPCI: "CPCI I-Girder (Kanada, metrik)",
  DECK_BULB_T: "Deck Bulb-Tee",
  DOUBLE_T: "Double-Tee",
  PC_U: "PC-U Girder (trough)",
  VOIDED_SLAB: "Voided Slab",
  BOX: "Box / Spread-Box Beam",
};

export const GIRDER_PRESETS: GirderPreset[] = [
  {
    id: "custom", name: "Custom (Manual)", category: "CUSTOM", spanRange: "—",
    girder: { b1: 600, h1: 200, h5: 0, b2: 200, h2: 1200, h4: 0, b3: 700, h3: 250 },
  },

  // ── WIKA WF Series (Indonesian PC-I girder) ───────────────
  { id: "wika_wf25", name: "WIKA WF-25", category: "WIKA_WF", spanRange: "20–25 m",
    girder: { b1: 500, h1: 150, h5: 50, b2: 150, h2: 550, h4: 50, b3: 550, h3: 150 } },
  { id: "wika_wf30", name: "WIKA WF-30", category: "WIKA_WF", spanRange: "25–30 m",
    girder: { b1: 550, h1: 160, h5: 60, b2: 160, h2: 700, h4: 60, b3: 600, h3: 160 } },
  { id: "wika_wf35", name: "WIKA WF-35", category: "WIKA_WF", spanRange: "30–35 m",
    girder: { b1: 580, h1: 170, h5: 70, b2: 180, h2: 850, h4: 70, b3: 650, h3: 170 } },
  { id: "wika_wf40", name: "WIKA WF-40", category: "WIKA_WF", spanRange: "35–40 m",
    girder: { b1: 600, h1: 180, h5: 75, b2: 200, h2: 950, h4: 75, b3: 700, h3: 180 } },
  { id: "wika_wf45", name: "WIKA WF-45", category: "WIKA_WF", spanRange: "40–45 m",
    girder: { b1: 600, h1: 190, h5: 80, b2: 200, h2: 1120, h4: 80, b3: 700, h3: 180 } },
  { id: "wika_wf50", name: "WIKA WF-50", category: "WIKA_WF", spanRange: "45–50 m",
    girder: { b1: 650, h1: 200, h5: 90, b2: 200, h2: 1260, h4: 90, b3: 750, h3: 200 } },
  { id: "wika_wf55", name: "WIKA WF-55", category: "WIKA_WF", spanRange: "48–55 m",
    girder: { b1: 700, h1: 200, h5: 100, b2: 220, h2: 1380, h4: 100, b3: 800, h3: 220 } },
  { id: "wika_wf60", name: "WIKA WF-60", category: "WIKA_WF", spanRange: "50–60 m",
    girder: { b1: 750, h1: 220, h5: 110, b2: 220, h2: 1520, h4: 110, b3: 850, h3: 240 } },

  // ── AASHTO Prestressed Concrete I-Beam Types ───
  { id: "aashto_i", name: "AASHTO Type I", category: "AASHTO_I", spanRange: "9–18 m",
    girder: { b1: 406, h1: 89, h5: 32, b2: 152, h2: 203, h4: 32, b3: 457, h3: 89 } },
  { id: "aashto_ii", name: "AASHTO Type II", category: "AASHTO_I", spanRange: "12–24 m",
    girder: { b1: 406, h1: 127, h5: 38, b2: 152, h2: 305, h4: 38, b3: 457, h3: 127 } },
  { id: "aashto_iii", name: "AASHTO Type III", category: "AASHTO_I", spanRange: "18–30 m",
    girder: { b1: 406, h1: 178, h5: 64, b2: 152, h2: 457, h4: 64, b3: 559, h3: 203 } },
  { id: "aashto_iv", name: "AASHTO Type IV", category: "AASHTO_I", spanRange: "25–40 m",
    girder: { b1: 457, h1: 203, h5: 76, b2: 178, h2: 610, h4: 76, b3: 660, h3: 229 } },
  { id: "aashto_v", name: "AASHTO Type V", category: "AASHTO_I", spanRange: "33–45 m",
    girder: { b1: 1067, h1: 140, h5: 89, b2: 191, h2: 914, h4: 89, b3: 711, h3: 178 } },
  { id: "aashto_vi", name: "AASHTO Type VI", category: "AASHTO_I", spanRange: "36–55 m",
    girder: { b1: 1067, h1: 140, h5: 89, b2: 191, h2: 1118, h4: 89, b3: 711, h3: 178 } },

  // ── PCI Bulb-T Series ─────────────────────────────────────
  { id: "pci_bt54", name: "PCI BT-54", category: "PCI_BT", spanRange: "30–45 m",
    girder: { b1: 1067, h1: 76, h5: 90, b2: 152, h2: 1010, h4: 90, b3: 686, h3: 76 } },
  { id: "pci_bt63", name: "PCI BT-63", category: "PCI_BT", spanRange: "36–50 m",
    girder: { b1: 1067, h1: 76, h5: 102, b2: 152, h2: 1195, h4: 102, b3: 686, h3: 76 } },
  { id: "pci_bt72", name: "PCI BT-72", category: "PCI_BT", spanRange: "40–55 m",
    girder: { b1: 1067, h1: 76, h5: 102, b2: 152, h2: 1346, h4: 102, b3: 686, h3: 76 } },

  // ── PCI / standard I-beams ────────────────────────────────
  { id: "pci_24x12", name: "PCI Std I 600", category: "PCI_I", spanRange: "12–18 m",
    girder: { b1: 450, h1: 90, h5: 50, b2: 150, h2: 320, h4: 50, b3: 500, h3: 90 } },
  { id: "pci_36x16", name: "PCI Std I 900", category: "PCI_I", spanRange: "18–27 m",
    girder: { b1: 500, h1: 110, h5: 70, b2: 160, h2: 540, h4: 70, b3: 600, h3: 110 } },

  // ── NU I-Girder series (Geren & Tadros, PCI Journal 1994) ──
  // "Hard"-metric Nebraska girders: thin 150 web, wide 1225×65 top
  // flange + 975×140 bottom flange, R=200 circular fillets. The
  // circular fillets are idealised here as area-equivalent trapezoids
  // (h5=94, h4=242 calibrated so NU2000 matches the true ≈635,600 mm²);
  // flange dims are identical for the whole series — only h2 varies.
  { id: "nu_750", name: "NU 750", category: "NU", spanRange: "15–24 m",
    girder: { b1: 1225, h1: 65, h5: 94, b2: 150, h2: 209, h4: 242, b3: 975, h3: 140 } },
  { id: "nu_900", name: "NU 900", category: "NU", spanRange: "18–28 m",
    girder: { b1: 1225, h1: 65, h5: 94, b2: 150, h2: 359, h4: 242, b3: 975, h3: 140 } },
  { id: "nu_1100", name: "NU 1100", category: "NU", spanRange: "22–33 m",
    girder: { b1: 1225, h1: 65, h5: 94, b2: 150, h2: 559, h4: 242, b3: 975, h3: 140 } },
  { id: "nu_1350", name: "NU 1350", category: "NU", spanRange: "27–39 m",
    girder: { b1: 1225, h1: 65, h5: 94, b2: 150, h2: 809, h4: 242, b3: 975, h3: 140 } },
  { id: "nu_1600", name: "NU 1600", category: "NU", spanRange: "32–44 m",
    girder: { b1: 1225, h1: 65, h5: 94, b2: 150, h2: 1059, h4: 242, b3: 975, h3: 140 } },
  { id: "nu_1800", name: "NU 1800", category: "NU", spanRange: "36–48 m",
    girder: { b1: 1225, h1: 65, h5: 94, b2: 150, h2: 1259, h4: 242, b3: 975, h3: 140 } },
  { id: "nu_2000", name: "NU 2000", category: "NU", spanRange: "38–52 m",
    girder: { b1: 1225, h1: 65, h5: 94, b2: 150, h2: 1459, h4: 242, b3: 975, h3: 140 } },
  { id: "nu_2400", name: "NU 2400", category: "NU", spanRange: "45–60 m",
    girder: { b1: 1225, h1: 65, h5: 94, b2: 150, h2: 1859, h4: 242, b3: 975, h3: 140 } },
  // post-tensioned variant: 175 web for 12×15.2 mm strand ducts
  { id: "nu_2000pt", name: "NU 2000PT (multi-tendon)", category: "NU", spanRange: "38–52 m",
    girder: { b1: 1250, h1: 65, h5: 94, b2: 175, h2: 1459, h4: 242, b3: 1000, h3: 140 } },

  // ── CPCI metric I-girders (Hassanain & Loov, PCI J. 1999) ──
  // Canadian Precast/Prestressed Concrete Institute standard types;
  // 150 web throughout — areas check against the published table
  // (320/414/499/544/604 ×10³ mm²) within the trapezoid idealisation.
  { id: "cpci_1200", name: "CPCI 1200", category: "CPCI", spanRange: "20–30 m",
    girder: { b1: 400, h1: 150, h5: 50, b2: 150, h2: 700, h4: 120, b3: 550, h3: 180 } },
  { id: "cpci_1400", name: "CPCI 1400", category: "CPCI", spanRange: "25–35 m",
    girder: { b1: 550, h1: 150, h5: 80, b2: 150, h2: 840, h4: 150, b3: 650, h3: 180 } },
  { id: "cpci_1600", name: "CPCI 1600", category: "CPCI", spanRange: "30–40 m",
    girder: { b1: 900, h1: 125, h5: 125, b2: 150, h2: 1000, h4: 150, b3: 650, h3: 200 } },
  { id: "cpci_1900", name: "CPCI 1900", category: "CPCI", spanRange: "35–48 m",
    girder: { b1: 900, h1: 125, h5: 125, b2: 150, h2: 1300, h4: 150, b3: 650, h3: 200 } },
  { id: "cpci_2300", name: "CPCI 2300", category: "CPCI", spanRange: "40–55 m",
    girder: { b1: 900, h1: 125, h5: 125, b2: 150, h2: 1700, h4: 150, b3: 650, h3: 200 } },

  // ── Deck Bulb-Tee (wide top flange acts as the deck) ──────
  { id: "dbt_1200", name: "Deck Bulb-Tee 1200", category: "DECK_BULB_T", spanRange: "20–30 m",
    girder: { b1: 1500, h1: 120, h5: 90, b2: 150, h2: 850, h4: 90, b3: 600, h3: 90 } },
  { id: "dbt_1700", name: "Deck Bulb-Tee 1700", category: "DECK_BULB_T", spanRange: "30–42 m",
    girder: { b1: 1800, h1: 140, h5: 110, b2: 165, h2: 1240, h4: 110, b3: 650, h3: 100 } },

  // ── Double-Tee (single-stem equivalent for section props) ──
  { id: "dt_600", name: "Double-Tee 600", category: "DOUBLE_T", spanRange: "10–18 m",
    girder: { b1: 1200, h1: 100, h5: 60, b2: 200, h2: 380, h4: 0, b3: 200, h3: 60 } },
  { id: "dt_800", name: "Double-Tee 800", category: "DOUBLE_T", spanRange: "15–24 m",
    girder: { b1: 1200, h1: 120, h5: 80, b2: 240, h2: 540, h4: 0, b3: 240, h3: 60 } },

  // ── PC-U Girder (trough — wide bottom slab, two webs ≈ 2·tw) ──
  { id: "pcu_1700", name: "PC-U 1700", category: "PC_U", spanRange: "25–35 m",
    girder: { b1: 1200, h1: 180, h5: 120, b2: 350, h2: 1220, h4: 0, b3: 1700, h3: 180 } },
  { id: "pcu_2000", name: "PC-U 2000", category: "PC_U", spanRange: "32–45 m",
    girder: { b1: 1400, h1: 200, h5: 140, b2: 400, h2: 1460, h4: 0, b3: 2000, h3: 200 } },

  // ── Voided slab (solid-slab idealisation with side bevels) ──
  { id: "vs_600", name: "Voided Slab 600", category: "VOIDED_SLAB", spanRange: "8–15 m",
    girder: { b1: 1000, h1: 150, h5: 0, b2: 700, h2: 300, h4: 0, b3: 1000, h3: 150 } },
  { id: "vs_800", name: "Voided Slab 800", category: "VOIDED_SLAB", spanRange: "12–20 m",
    girder: { b1: 1200, h1: 180, h5: 0, b2: 850, h2: 440, h4: 0, b3: 1200, h3: 180 } },

  // ── Box / spread-box beam (single-web idealisation) ───────
  { id: "box_1000", name: "Spread-Box 1000", category: "BOX", spanRange: "18–28 m",
    girder: { b1: 1200, h1: 175, h5: 0, b2: 900, h2: 650, h4: 0, b3: 1200, h3: 175 } },
  { id: "box_1400", name: "Spread-Box 1400", category: "BOX", spanRange: "26–38 m",
    girder: { b1: 1300, h1: 200, h5: 0, b2: 1000, h2: 1000, h4: 0, b3: 1300, h3: 200 } },
];

export function findPreset(id: string): GirderPreset | undefined {
  return GIRDER_PRESETS.find(p => p.id === id);
}
