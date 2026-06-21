// sparse_solver.zig — REAL native solver backend (Zig) for the FEM seam.
//
// Implements the SAME preconditioned Conjugate Gradient (Jacobi) algorithm as
// src/engine/fem/sparsebackend.ts (cgBackend) so results are bit-comparable to
// the TypeScript path it replaces — only faster (no GC, tight loops, SIMD-able)
// and pointer-friendly (zero-copy: the caller's Float64Array buffer IS K).
//
// Allocation-free by design: the caller supplies a scratch buffer of length 4*n
// (r, z, p, Kp). This keeps the same code compilable BOTH as:
//   * a native shared library (.dll/.so/.dylib) loaded by Node via FFI, and
//   * a freestanding WebAssembly module that runs in the deployed web app
// without pulling in an allocator or libc.
//
// Build:  see ../build.zig and ../README.md
//
// C-ABI contract (matches SolverBackend.solve over flat buffers):
//   k    : [*] row-major n*n stiffness matrix (f64)
//   n    : usize, system size
//   f    : [*] length-n right-hand side (f64)
//   x    : [*] length-n solution (written; x0 = 0 assumed)
//   scratch : [*] length-4*n workspace (f64)
//   max_it  : usize iteration cap
//   tol     : f64 relative residual tolerance
// returns iterations performed (>=0), or -1 on a degenerate pKp breakdown.

const std = @import("std");

export fn solve_cg(
    k: [*]const f64,
    n: usize,
    f: [*]const f64,
    x: [*]f64,
    scratch: [*]f64,
    max_it: usize,
    tol: f64,
) i32 {
    if (n == 0) return 0;

    const r = scratch[0..n];
    const z = scratch[n .. 2 * n];
    const p = scratch[2 * n .. 3 * n];
    const kp = scratch[3 * n .. 4 * n];

    // x0 = 0  ->  r = f - K*x = f
    var i: usize = 0;
    while (i < n) : (i += 1) {
        x[i] = 0.0;
        r[i] = f[i];
    }

    // Jacobi preconditioner z = M^-1 r ; M = diag(K)
    var bnorm: f64 = 0.0;
    i = 0;
    while (i < n) : (i += 1) {
        const d = k[i * n + i];
        const minv = if (d != 0.0) 1.0 / d else 1.0;
        z[i] = minv * r[i];
        p[i] = z[i];
        bnorm += f[i] * f[i];
    }
    bnorm = std.math.sqrt(bnorm);
    if (bnorm == 0.0) bnorm = 1.0;

    var rz: f64 = 0.0;
    i = 0;
    while (i < n) : (i += 1) rz += r[i] * z[i];

    var it: usize = 0;
    while (it < max_it) : (it += 1) {
        // Kp = K * p   (dense row-major mat-vec)
        i = 0;
        while (i < n) : (i += 1) {
            var s: f64 = 0.0;
            const row = i * n;
            var j: usize = 0;
            while (j < n) : (j += 1) s += k[row + j] * p[j];
            kp[i] = s;
        }
        var pkp: f64 = 0.0;
        i = 0;
        while (i < n) : (i += 1) pkp += p[i] * kp[i];
        if (@abs(pkp) < 1e-300) return -1;

        const alpha = rz / pkp;
        i = 0;
        while (i < n) : (i += 1) {
            x[i] += alpha * p[i];
            r[i] -= alpha * kp[i];
        }

        var rnorm: f64 = 0.0;
        i = 0;
        while (i < n) : (i += 1) rnorm += r[i] * r[i];
        if (std.math.sqrt(rnorm) / bnorm < tol) return @intCast(it + 1);

        i = 0;
        while (i < n) : (i += 1) {
            const d = k[i * n + i];
            const minv = if (d != 0.0) 1.0 / d else 1.0;
            z[i] = minv * r[i];
        }
        var rz_new: f64 = 0.0;
        i = 0;
        while (i < n) : (i += 1) rz_new += r[i] * z[i];
        const beta = rz_new / rz;
        rz = rz_new;
        i = 0;
        while (i < n) : (i += 1) p[i] = z[i] + beta * p[i];
    }
    return @intCast(max_it);
}

// Convenience query so an FFI caller can size its scratch buffer.
export fn scratch_len(n: usize) usize {
    return 4 * n;
}
