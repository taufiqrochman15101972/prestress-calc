/**
 * dwgConvert.ts — In-project DWG → DXF converter (reusable).
 *
 * Binary AutoCAD DWG is decoded by LibreDWG compiled to WebAssembly
 * (@mlightcad/libredwg-web). The WASM module is loaded LAZILY (dynamic import)
 * only when a .dwg is actually opened, so it never bloats the main bundle or
 * runs on the server. Output is DXF text → fed to engine/dxfimport.ts.
 *
 * Reusable: call convertDwgToDxf(arrayBuffer) for any new .dwg file.
 */

let cached: unknown = null;

export async function convertDwgToDxf(buf: ArrayBuffer): Promise<string> {
  // Lazy-load the WASM library (client-only).
  const mod = await import("@mlightcad/libredwg-web");
  const LibreDwg = (mod as { LibreDwg: { create: () => Promise<unknown> } }).LibreDwg;
  if (!cached) cached = await LibreDwg.create();
  const lib = cached as { dwg_write_dxf: (b: ArrayBuffer) => Uint8Array | null };
  const out = lib.dwg_write_dxf(buf);
  if (!out) throw new Error("LibreDWG gagal mengonversi DWG (versi tidak didukung?).");
  return new TextDecoder("utf-8").decode(out);
}

/** Quick magic-byte check: DWG files start with "AC10xx". */
export function isDwg(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  return bytes[0] === 0x41 && bytes[1] === 0x43; // "AC"
}
