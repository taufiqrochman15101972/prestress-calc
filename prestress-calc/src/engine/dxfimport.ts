/**
 * dxfimport.ts — Pure ASCII-DXF parser + bridge-geometry extractor.
 *
 * AutoCAD DWG is a BINARY format that cannot be parsed without a vendor
 * converter (ODA / LibreDWG / AutoCAD), none of which run in this environment.
 * DXF (Drawing eXchange Format) is the ASCII interchange format produced by
 * "SAVE AS → DXF" or DXFOUT in any CAD program — and IS fully parseable. This
 * module reads the DXF text and extracts the structural geometry the designer
 * needs: overall extents (bridge length/width), girder cross-section bounding
 * box (→ profile H & flange widths), girder/diaphragm spacing, dimension
 * annotations, and substructure rectangles (abutment / pier / pilecap /
 * pierhead). Heuristic detection; the designer confirms before "apply".
 *
 * Pure functions → Object.freeze(). No DOM (UI reads the file then calls parse).
 */

export interface DxfEntity {
  type: string;
  layer: string;
  /** group code → list of string values (repeats kept, e.g. polyline 10/20) */
  codes: Record<number, string[]>;
}

export interface DxfPoint { x: number; y: number; }
export interface DxfBBox { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number; }
export interface DxfTextLabel { text: string; x: number; y: number; layer: string; }

export interface DxfParseResult {
  readonly entityCount: number;
  readonly layers: ReadonlyArray<string>;
  readonly counts: Readonly<Record<string, number>>;
  readonly extents: DxfBBox;
  readonly texts: ReadonlyArray<DxfTextLabel>;
  /** DIMENSION measured values (group code 42), mm/units as drawn */
  readonly dimensions: ReadonlyArray<number>;
  /** candidate girder cross-section bbox (tallest tall-narrow closed polyline) */
  readonly girderProfile: DxfBBox | null;
  /** detected centre-to-centre spacing of vertical members (girders/webs), units */
  readonly memberSpacing: number | null;
  /** rectangles by descending area (→ abutment/pier/pilecap/pierhead candidates) */
  readonly rectangles: ReadonlyArray<DxfBBox>;
  readonly note: string;
}

// ── low-level tokenizer: DXF is alternating (code\nvalue\n) lines ──────────
export function parseDxf(text: string): DxfEntity[] {
  // Normalise line endings, split. DXF lines: odd = group code, even = value.
  const lines = text.split(/\r\n|\r|\n/);
  const entities: DxfEntity[] = [];
  let cur: DxfEntity | null = null;
  let inEntities = false;

  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    const value = lines[i + 1];
    if (isNaN(code)) { i -= 1; continue; }     // resync on stray line

    if (code === 0) {
      const v = value.trim();
      if (v === "SECTION") { continue; }
      if (v === "ENDSEC") { inEntities = false; if (cur) { entities.push(cur); cur = null; } continue; }
      // start of a new entity
      if (cur) entities.push(cur);
      cur = { type: v, layer: "0", codes: {} };
      continue;
    }
    if (code === 2 && !cur) { inEntities = inEntities || value.trim() === "ENTITIES"; }
    if (!cur) continue;
    if (code === 8) cur.layer = value.trim();
    (cur.codes[code] ??= []).push(value.trim());
  }
  if (cur) entities.push(cur);
  // keep only real geometry/annotation entity types
  const keep = new Set([
    "LINE", "LWPOLYLINE", "POLYLINE", "VERTEX", "CIRCLE", "ARC",
    "TEXT", "MTEXT", "DIMENSION", "SOLID", "HATCH", "INSERT",
  ]);
  return entities.filter(e => keep.has(e.type));
}

const num = (e: DxfEntity, code: number, idx = 0): number => {
  const a = e.codes[code]; return a && a[idx] !== undefined ? parseFloat(a[idx]) : NaN;
};

function entityPoints(e: DxfEntity): DxfPoint[] {
  const pts: DxfPoint[] = [];
  if (e.type === "LINE") {
    pts.push({ x: num(e, 10), y: num(e, 20) }, { x: num(e, 11), y: num(e, 21) });
  } else if (e.type === "LWPOLYLINE" || e.type === "POLYLINE") {
    const xs = e.codes[10] ?? [], ys = e.codes[20] ?? [];
    for (let k = 0; k < Math.min(xs.length, ys.length); k++) pts.push({ x: parseFloat(xs[k]), y: parseFloat(ys[k]) });
  } else if (e.type === "CIRCLE" || e.type === "ARC") {
    const cx = num(e, 10), cy = num(e, 20), r = num(e, 40);
    if (!isNaN(r)) pts.push({ x: cx - r, y: cy - r }, { x: cx + r, y: cy + r });
  } else if (e.type === "TEXT" || e.type === "MTEXT" || e.type === "INSERT" || e.type === "SOLID") {
    pts.push({ x: num(e, 10), y: num(e, 20) });
  }
  return pts.filter(p => !isNaN(p.x) && !isNaN(p.y));
}

function bbox(pts: DxfPoint[]): DxfBBox | null {
  if (!pts.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export function analyseDxf(text: string): DxfParseResult {
  const ents = parseDxf(text);
  const layers = Array.from(new Set(ents.map(e => e.layer))).sort();
  const counts: Record<string, number> = {};
  for (const e of ents) counts[e.type] = (counts[e.type] ?? 0) + 1;

  // overall extents
  const allPts: DxfPoint[] = [];
  for (const e of ents) allPts.push(...entityPoints(e));
  const extents = bbox(allPts) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 };

  // text labels
  const texts: DxfTextLabel[] = ents
    .filter(e => e.type === "TEXT" || e.type === "MTEXT")
    .map(e => ({
      text: (e.codes[1]?.join("") ?? "").replace(/\\[A-Za-z0-9.|]+;?/g, "").trim(),
      x: num(e, 10), y: num(e, 20), layer: e.layer,
    }))
    .filter(t => t.text.length > 0);

  // dimension measured values (group code 42)
  const dimensions = ents.filter(e => e.type === "DIMENSION")
    .map(e => num(e, 42)).filter(v => !isNaN(v) && v > 0);

  // closed polylines → rectangles & girder-profile candidate
  const polyBoxes: DxfBBox[] = ents
    .filter(e => e.type === "LWPOLYLINE" || e.type === "POLYLINE")
    .map(e => bbox(entityPoints(e)))
    .filter((b): b is DxfBBox => b !== null && b.w > 0 && b.h > 0);

  // rectangles ~ roughly axis-aligned boxes, by descending area
  const rectangles = [...polyBoxes].sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 8);

  // girder profile: tallest "tall & relatively narrow" closed polyline
  const girderProfile = polyBoxes
    .filter(b => b.h >= b.w * 0.6 && b.h <= b.w * 6)
    .sort((a, b) => b.h - a.h)[0] ?? null;

  // member spacing: x of (near-)vertical lines, median of gaps
  const vxs = ents.filter(e => e.type === "LINE")
    .map(e => ({ x1: num(e, 10), y1: num(e, 20), x2: num(e, 11), y2: num(e, 21) }))
    .filter(l => Math.abs(l.x2 - l.x1) < Math.abs(l.y2 - l.y1) * 0.1 && Math.abs(l.y2 - l.y1) > 0)
    .map(l => (l.x1 + l.x2) / 2)
    .sort((a, b) => a - b);
  const uniq: number[] = [];
  for (const x of vxs) if (!uniq.length || Math.abs(x - uniq[uniq.length - 1]) > 1e-6) uniq.push(x);
  let memberSpacing: number | null = null;
  if (uniq.length >= 2) {
    const gaps = uniq.slice(1).map((x, i) => x - uniq[i]).filter(g => g > 1e-6).sort((a, b) => a - b);
    if (gaps.length) memberSpacing = gaps[Math.floor(gaps.length / 2)];   // median gap
  }

  return Object.freeze({
    entityCount: ents.length,
    layers, counts: Object.freeze(counts), extents,
    texts: Object.freeze(texts.slice(0, 60)),
    dimensions: Object.freeze(dimensions),
    girderProfile, memberSpacing,
    rectangles: Object.freeze(rectangles),
    note: `DXF: ${ents.length} entitas, ${layers.length} layer, ${dimensions.length} dimensi. ` +
      (girderProfile ? `Profil girder terdeteksi ${girderProfile.w.toFixed(0)}×${girderProfile.h.toFixed(0)}. ` : "Profil girder tidak terdeteksi otomatis. ") +
      (memberSpacing ? `Spasi anggota ≈ ${memberSpacing.toFixed(0)}.` : ""),
  });
}
