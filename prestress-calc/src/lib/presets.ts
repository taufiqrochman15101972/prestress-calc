/**
 * Standard Girder Presets
 * Real-world I-girder profiles with trapezoidal fillets (h4, h5).
 * Dimensions in mm. Sources: WIKA catalog, AASHTO M 23, PCI Design Handbook.
 */

import type { IGirderGeometry } from "@/types";

export interface GirderPreset {
  id: string;
  name: string;
  spanRange: string;    // typical span range
  girder: IGirderGeometry;
}

export const GIRDER_PRESETS: GirderPreset[] = [
  {
    id: "custom",
    name: "Custom (Manual)",
    spanRange: "—",
    girder: { b1: 600, h1: 200, h5: 0, b2: 200, h2: 1200, h4: 0, b3: 700, h3: 250 },
  },

  // ── WIKA WF Series (Indonesian PC-I girder) ───────────────
  {
    id: "wika_wf25",
    name: "WIKA WF-25",
    spanRange: "20–25 m",
    girder: { b1: 500, h1: 150, h5: 50, b2: 150, h2: 550, h4: 50, b3: 550, h3: 150 },
  },
  {
    id: "wika_wf30",
    name: "WIKA WF-30",
    spanRange: "25–30 m",
    girder: { b1: 550, h1: 160, h5: 60, b2: 160, h2: 700, h4: 60, b3: 600, h3: 160 },
  },
  {
    id: "wika_wf35",
    name: "WIKA WF-35",
    spanRange: "30–35 m",
    girder: { b1: 580, h1: 170, h5: 70, b2: 180, h2: 850, h4: 70, b3: 650, h3: 170 },
  },
  {
    id: "wika_wf40",
    name: "WIKA WF-40",
    spanRange: "35–40 m",
    girder: { b1: 600, h1: 180, h5: 75, b2: 200, h2: 950, h4: 75, b3: 700, h3: 180 },
  },
  {
    id: "wika_wf45",
    name: "WIKA WF-45",
    spanRange: "40–45 m",
    girder: { b1: 600, h1: 190, h5: 80, b2: 200, h2: 1120, h4: 80, b3: 700, h3: 180 },
  },
  {
    id: "wika_wf50",
    name: "WIKA WF-50",
    spanRange: "45–50 m",
    girder: { b1: 650, h1: 200, h5: 90, b2: 200, h2: 1260, h4: 90, b3: 750, h3: 200 },
  },
  {
    id: "wika_wf55",
    name: "WIKA WF-55",
    spanRange: "48–55 m",
    girder: { b1: 700, h1: 200, h5: 100, b2: 220, h2: 1380, h4: 100, b3: 800, h3: 220 },
  },
  {
    id: "wika_wf60",
    name: "WIKA WF-60",
    spanRange: "50–60 m",
    girder: { b1: 750, h1: 220, h5: 110, b2: 220, h2: 1520, h4: 110, b3: 850, h3: 240 },
  },

  // ── AASHTO Prestressed Concrete I-Beam Types (in-converted to mm) ───
  {
    id: "aashto_i",
    name: "AASHTO Type I",
    spanRange: "9–18 m",
    girder: { b1: 406, h1: 89, h5: 32, b2: 152, h2: 203, h4: 32, b3: 457, h3: 89 },
  },
  {
    id: "aashto_ii",
    name: "AASHTO Type II",
    spanRange: "12–24 m",
    girder: { b1: 406, h1: 127, h5: 38, b2: 152, h2: 305, h4: 38, b3: 457, h3: 127 },
  },
  {
    id: "aashto_iii",
    name: "AASHTO Type III",
    spanRange: "18–30 m",
    girder: { b1: 406, h1: 178, h5: 64, b2: 152, h2: 457, h4: 64, b3: 559, h3: 203 },
  },
  {
    id: "aashto_iv",
    name: "AASHTO Type IV",
    spanRange: "25–40 m",
    girder: { b1: 457, h1: 203, h5: 76, b2: 178, h2: 610, h4: 76, b3: 660, h3: 229 },
  },
  {
    id: "aashto_v",
    name: "AASHTO Type V",
    spanRange: "33–45 m",
    girder: { b1: 1067, h1: 140, h5: 89, b2: 191, h2: 914, h4: 89, b3: 711, h3: 178 },
  },
  {
    id: "aashto_vi",
    name: "AASHTO Type VI",
    spanRange: "36–55 m",
    girder: { b1: 1067, h1: 140, h5: 89, b2: 191, h2: 1118, h4: 89, b3: 711, h3: 178 },
  },

  // ── PCI Bulb-T Series ─────────────────────────────────────
  {
    id: "pci_bt54",
    name: "PCI BT-54",
    spanRange: "30–45 m",
    girder: { b1: 1067, h1: 76, h5: 90, b2: 152, h2: 1010, h4: 90, b3: 686, h3: 76 },
  },
  {
    id: "pci_bt63",
    name: "PCI BT-63",
    spanRange: "36–50 m",
    girder: { b1: 1067, h1: 76, h5: 102, b2: 152, h2: 1195, h4: 102, b3: 686, h3: 76 },
  },
  {
    id: "pci_bt72",
    name: "PCI BT-72",
    spanRange: "40–55 m",
    girder: { b1: 1067, h1: 76, h5: 102, b2: 152, h2: 1346, h4: 102, b3: 686, h3: 76 },
  },
];

export function findPreset(id: string): GirderPreset | undefined {
  return GIRDER_PRESETS.find(p => p.id === id);
}
