#!/usr/bin/env bash
# build.sh — build the native FEM solver on Linux/macOS.
# Prefers Zig; falls back to Julia. Node picks up the lib via nativebackend.ts.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if command -v zig >/dev/null 2>&1; then
  echo "==> Building with Zig (shared library + wasm)"
  ( cd "$here/zig" && zig build && zig build wasm )
  echo "OK: zig/zig-out/lib + zig/zig-out/bin"
elif command -v julia >/dev/null 2>&1; then
  echo "==> Building with Julia + PackageCompiler"
  ( cd "$here/julia" \
      && julia --project=. -e 'import Pkg; Pkg.instantiate()' \
      && julia --project=. build_lib.jl )
  echo "OK: julia/lib/lib"
else
  echo "Neither zig nor julia found on PATH."
  echo "Install Zig (https://ziglang.org) or Julia (https://julialang.org),"
  echo "or keep using the built-in TypeScript CG backend (identical results)."
  exit 1
fi
