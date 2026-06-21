# build.ps1 — build the native FEM solver on Windows (PowerShell).
# Prefers Zig (tiny, no runtime); falls back to Julia if only Julia is present.
# After building, Node picks the lib up automatically via nativebackend.ts.

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

if (Get-Command zig -ErrorAction SilentlyContinue) {
    Write-Host "==> Building with Zig (shared library + wasm)"
    Push-Location (Join-Path $here "zig")
    zig build                # libfemsolver.dll -> zig/zig-out/lib
    zig build wasm           # femsolver.wasm   -> zig/zig-out/bin
    Pop-Location
    Write-Host "OK: zig/zig-out/lib + zig/zig-out/bin"
}
elseif (Get-Command julia -ErrorAction SilentlyContinue) {
    Write-Host "==> Building with Julia + PackageCompiler"
    Push-Location (Join-Path $here "julia")
    julia --project=. -e "import Pkg; Pkg.instantiate()"
    julia --project=. build_lib.jl   # -> julia/lib/lib/libfemsolver.dll
    Pop-Location
    Write-Host "OK: julia/lib/lib"
}
else {
    Write-Host "Neither zig nor julia found on PATH."
    Write-Host "Install Zig (https://ziglang.org) or Julia (https://julialang.org),"
    Write-Host "or just keep using the built-in TypeScript CG backend (identical results)."
    exit 1
}
