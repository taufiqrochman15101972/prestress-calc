import { describe, test, expect } from "vitest";
import { parseDxf, analyseDxf } from "@/engine/dxfimport";

// Minimal ASCII DXF: one vertical LINE + one closed LWPOLYLINE (700×1650 box)
// + a TEXT label + a DIMENSION measurement.
const DXF = [
  "0", "SECTION", "2", "ENTITIES",
  "0", "LINE", "8", "GIRDER", "10", "0", "20", "0", "11", "0", "21", "1650",
  "0", "LWPOLYLINE", "8", "GIRDER", "90", "4",
  "10", "0", "20", "0", "10", "700", "20", "0", "10", "700", "20", "1650", "10", "0", "20", "1650",
  "0", "TEXT", "8", "NOTES", "10", "100", "20", "200", "1", "H=1650",
  "0", "DIMENSION", "8", "DIM", "10", "0", "20", "0", "42", "1650",
  "0", "ENDSEC", "0", "EOF",
].join("\n");

describe("DXF parser", () => {
  test("parses entities and types", () => {
    const ents = parseDxf(DXF);
    const types = ents.map(e => e.type);
    expect(types).toContain("LINE");
    expect(types).toContain("LWPOLYLINE");
    expect(types).toContain("TEXT");
    expect(types).toContain("DIMENSION");
  });

  test("analyse extracts extents, girder profile, text, dimension", () => {
    const r = analyseDxf(DXF);
    expect(r.extents.w).toBeCloseTo(700, 3);
    expect(r.extents.h).toBeCloseTo(1650, 3);
    expect(r.girderProfile).not.toBeNull();
    expect(r.girderProfile!.h).toBeCloseTo(1650, 3);
    expect(r.dimensions).toContain(1650);
    expect(r.texts.some(t => t.text.includes("H=1650"))).toBe(true);
  });

  test("non-DXF text yields no entities gracefully", () => {
    const r = analyseDxf("this is not a dxf file at all");
    expect(r.entityCount).toBe(0);
  });
});
