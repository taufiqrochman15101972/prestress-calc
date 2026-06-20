/**
 * fem/backend.ts — Pluggable SOLVER BACKEND seam (#4).
 *
 * This is the single swap-point that lets the linear-algebra core be replaced by
 * a native high-performance backend WITHOUT touching any element/assembly/UI code
 * (frame.ts, frame3d.ts, plate.ts, beamfields.ts all call `solveLinear`, which is
 * routed here). The contract is intentionally pointer-friendly (flat Float64Array,
 * row-major n×n K, length-n F) so the eventual native stack can share the SAME
 * memory buffers (zero-copy) instead of marshalling data.
 *
 * Target native architecture (Phase-2, requires Python/Julia/Zig toolchains that
 * are NOT present in this web-deploy environment — documented, not faked):
 *
 *   [ TS/JS pre-processor ]  (mesh + Float64Array buffers)
 *          │  pointer (WASM linear memory / SharedArrayBuffer)
 *          ▼
 *   [ Zig engine .wasm/.dll ]  Custom allocator → CSR sparse assembly, no GC,
 *          │                    High-perf I/O, C-ABI glue (ctypes / ccall)
 *          ▼  shared pointer (zero-copy)
 *   [ Julia solver ]  PDE/FEM element library, UMAT constitutive, non-linear
 *          │           Newton iteration, GPU/threads (CUDA.jl / KernelAbstractions)
 *          ▼  writes stress/strain into the SAME buffer
 *   [ TS/JS post-processor ]  reads buffer → renders (no copy)
 *
 * To activate a native backend later: implement `SolverBackend.solve` over the
 * same (K,n,F) buffers (e.g. via a WASM module exported as C-ABI) and register it
 * with `setSolverBackend(...)`. Element code stays unchanged.
 */
import { solveLinear as denseLU } from "./core";

export interface SolverBackend {
  readonly name: string;
  /** Solve K·d = F. K row-major n×n, F length n. Returns d length n. */
  solve(K: Float64Array, n: number, F: Float64Array): Float64Array;
  /** true if this backend keeps results in the SAME buffers (zero-copy). */
  readonly zeroCopy: boolean;
}

/** Default backend: in-engine dense LU (TypeScript, runs everywhere, deployable). */
export const denseBackend: SolverBackend = Object.freeze({
  name: "TS dense LU (Float64Array)",
  zeroCopy: true,            // K/F/d are Float64Array passed by reference
  solve: (K: Float64Array, n: number, F: Float64Array) => denseLU(K, n, F),
});

let active: SolverBackend = denseBackend;

export function setSolverBackend(b: SolverBackend): void { active = b; }
export function getSolverBackend(): SolverBackend { return active; }

/** Routed solve — every element/assembly module calls this. */
export function solve(K: Float64Array, n: number, F: Float64Array): Float64Array {
  return active.solve(K, n, F);
}
