import { describe, it, expect } from "vitest";
import { DOMAINS, DOMAIN_META, type Domain } from "../src/lib/domainmap";

describe("domain classification", () => {
  it("every real tab key is classified into exactly one domain", () => {
    const seen = new Map<string, Domain>();
    (Object.keys(DOMAINS) as Domain[]).forEach(d => {
      DOMAINS[d].forEach(e => {
        if (e.key.startsWith("_")) return; // planned/virtual sections
        expect(seen.has(e.key), `duplicate key ${e.key}`).toBe(false);
        seen.set(e.key, d);
      });
    });
    expect(seen.size).toBeGreaterThan(40);
  });

  it("every domain has metadata and a quadrant", () => {
    (Object.keys(DOMAINS) as Domain[]).forEach(d => {
      expect(DOMAIN_META[d]).toBeDefined();
      expect(DOMAIN_META[d].title.length).toBeGreaterThan(0);
    });
    // four visual quadrants are distinct
    const quads = (["BUILDING", "COMPOSITE", "BRIDGE", "FOUNDATION"] as Domain[]).map(d => DOMAIN_META[d].quadrant);
    expect(new Set(quads).size).toBe(4);
  });

  it("every entry carries a DESIGN/ANALYSIS/BOTH kind", () => {
    (Object.keys(DOMAINS) as Domain[]).forEach(d => {
      DOMAINS[d].forEach(e => {
        expect(["DESIGN", "ANALYSIS", "BOTH"]).toContain(e.kind);
      });
    });
  });
});
