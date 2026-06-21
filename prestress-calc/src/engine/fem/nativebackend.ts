/**
 * fem/nativebackend.ts — Node FFI bridge to the REAL native solver (Zig / Julia).
 *
 * This is the integration point that activates the compiled native library
 * (native/zig/sparse_solver.zig or native/julia/FemSolver.jl) behind the existing
 * SolverBackend seam (fem/backend.ts) — element/assembly/UI code is untouched.
 *
 * HONEST DEPLOYMENT NOTE: the native shared library is NOT built in this
 * environment (no Zig/Julia toolchain) and Vercel serverless cannot load a native
 * .so/.dll either. So this bridge is OPT-IN and FAILS SOFT: if the toolchain/lib
 * is absent it returns {ok:false, ...} and the app keeps using the TypeScript CG
 * backend (sparsebackend.ts) which produces identical results. It is intended for
 * a local/self-hosted Node runtime where the user has built the lib per
 * native/README.md. Use it from benchmarks/tooling, e.g.:
 *
 *     import { tryActivateNativeBackend } from "@/engine/fem/nativebackend";
 *     const r = tryActivateNativeBackend();   // registers via setSolverBackend
 *     console.log(r.ok ? `native: ${r.name}` : `fallback: ${r.reason}`);
 *
 * The native C-ABI (identical for Zig and Julia) is:
 *   int solve_cg(double* K, size_t n, double* f, double* x,
 *                double* scratch, size_t max_it, double tol);
 */
import type { SolverBackend } from "./backend";
import { setSolverBackend } from "./backend";

export interface NativeActivation {
  ok: boolean;
  name: string;
  reason?: string;
}

/** Indirect require so web bundlers (Next.js/Turbopack) never try to resolve it. */
function nodeRequire(id: string): unknown {
  // eslint-disable-next-line no-eval
  const req = eval("require") as (m: string) => unknown;
  return req(id);
}

function isNode(): boolean {
  return (
    typeof process !== "undefined" &&
    !!(process as { versions?: { node?: string } }).versions?.node
  );
}

/** Candidate paths for the compiled library (env override wins). */
function libCandidates(): string[] {
  const path = nodeRequire("path") as typeof import("path");
  const root = path.resolve(__dirname, "..", "..", "..", "native");
  const env = (process.env.NATIVE_FEM_LIB || "").trim();
  const plat = process.platform;
  const ext = plat === "win32" ? "dll" : plat === "darwin" ? "dylib" : "so";
  const stem = plat === "win32" ? "femsolver" : "libfemsolver";
  const list: string[] = [];
  if (env) list.push(env);
  list.push(path.join(root, "zig", "zig-out", "lib", `${stem}.${ext}`));
  list.push(path.join(root, "zig", "zig-out", "bin", `${stem}.${ext}`));
  list.push(path.join(root, "julia", "lib", "lib", `${stem}.${ext}`));
  list.push(path.join(root, "julia", "lib", "bin", `${stem}.${ext}`));
  return list;
}

let nativeBackend: SolverBackend | null = null;

/**
 * Build (once) a SolverBackend backed by the native solve_cg via koffi FFI.
 * Returns null if anything is missing (no Node, no koffi, no compiled lib).
 */
export function loadNativeBackend(): SolverBackend | null {
  if (nativeBackend) return nativeBackend;
  if (!isNode()) return null;

  let koffi: {
    load: (p: string) => { func: (sig: string) => (...a: unknown[]) => number };
  };
  try {
    koffi = nodeRequire("koffi") as typeof koffi;
  } catch {
    return null; // koffi not installed — fail soft
  }

  const fs = nodeRequire("fs") as typeof import("fs");
  const found = libCandidates().find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
  if (!found) return null;

  let solveCg: (...a: unknown[]) => number;
  try {
    const lib = koffi.load(found);
    // int solve_cg(double*K, size_t n, double*f, double*x, double*scratch, size_t, double)
    solveCg = lib.func(
      "int solve_cg(double*, size_t, double*, double*, double*, size_t, double)",
    );
  } catch {
    return null;
  }

  const tag = found.replace(/\\/g, "/");
  nativeBackend = Object.freeze({
    name: `native CG via FFI (${tag})`,
    zeroCopy: true, // koffi passes the Float64Array buffers by pointer
    solve: (K: Float64Array, n: number, F: Float64Array): Float64Array => {
      const x = new Float64Array(n);
      const scratch = new Float64Array(4 * n);
      const it = solveCg(K, n, F, x, scratch, 5000, 1e-10);
      if (it < 0) throw new Error("native solve_cg breakdown (pKp≈0)");
      return x;
    },
  });
  return nativeBackend;
}

/** Activate the native backend if available; otherwise leave the current one. */
export function tryActivateNativeBackend(): NativeActivation {
  if (!isNode())
    return { ok: false, name: "", reason: "not a Node runtime (browser/serverless)" };
  const b = loadNativeBackend();
  if (!b)
    return {
      ok: false,
      name: "",
      reason:
        "native lib/koffi not found — build per native/README.md (using TS CG fallback)",
    };
  setSolverBackend(b);
  return { ok: true, name: b.name };
}
