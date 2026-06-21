// build.zig — builds the native FEM solver two ways:
//   zig build           -> shared library (libfemsolver.{so,dll,dylib}) for Node FFI
//   zig build wasm      -> femsolver.wasm (freestanding) for the deployed web app
//
// Tested against Zig 0.13 / 0.14. The TypeScript path (sparsebackend.ts cgBackend)
// is the always-available fallback when this is not compiled, so the app never
// depends on the toolchain being present.

const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{ .preferred_optimize_mode = .ReleaseFast });

    // ---- native shared library (C-ABI, dlopen-able from Node) ----
    const lib = b.addSharedLibrary(.{
        .name = "femsolver",
        .root_source_file = b.path("sparse_solver.zig"),
        .target = target,
        .optimize = optimize,
    });
    b.installArtifact(lib);

    // ---- freestanding WebAssembly (runs in the browser, no libc/allocator) ----
    const wasm = b.addExecutable(.{
        .name = "femsolver",
        .root_source_file = b.path("sparse_solver.zig"),
        .target = b.resolveTargetQuery(.{
            .cpu_arch = .wasm32,
            .os_tag = .freestanding,
        }),
        .optimize = .ReleaseSmall,
    });
    wasm.entry = .disabled;        // library-style: no _start
    wasm.rdynamic = true;          // keep `export fn` symbols
    const wasm_step = b.step("wasm", "Build femsolver.wasm (freestanding)");
    wasm_step.dependOn(&b.addInstallArtifact(wasm, .{}).step);
}
