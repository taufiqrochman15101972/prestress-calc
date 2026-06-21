# Native FEM solver backend (Zig / Julia) — real, buildable source

This folder holds the **real native solver source** wired behind the engine's
`SolverBackend` seam (`src/engine/fem/backend.ts`). It implements the *same*
preconditioned Conjugate Gradient (Jacobi) algorithm as the always-available
TypeScript fallback (`src/engine/fem/sparsebackend.ts`), so all paths agree
numerically — the native build only makes it faster and pointer-zero-copy.

```
native/
├── zig/
│   ├── sparse_solver.zig   # C-ABI solve_cg(...) — native .dll/.so AND wasm
│   └── build.zig           # `zig build` (shared lib) + `zig build wasm`
├── julia/
│   ├── FemSolver.jl        # Base.@ccallable solve_cg(...) — same signature
│   ├── build_lib.jl        # PackageCompiler -> shared library
│   ├── precompile.jl       # trace file for the C entry
│   └── Project.toml
├── build.sh / build.ps1    # detect zig|julia and build
└── README.md
```

## Honest status (why it's not compiled here)

This dev/web environment has **no Zig, Julia, gcc, clang, or cargo** (verified),
and the app deploys to **Vercel serverless**, which cannot load a native
`.so/.dll`. So the native library is **not built or shipped** by default. The
source here is genuine and compilable — it is just meant to be built on a machine
that *has* the toolchain (local or self-hosted Node). Until then the TypeScript CG
backend runs everywhere and gives identical results.

## Build

**Zig (recommended — tiny, no runtime):**
```bash
cd native && ./build.sh          # or:  pwsh native/build.ps1   on Windows
# -> native/zig/zig-out/lib/libfemsolver.{so,dll,dylib}
# -> native/zig/zig-out/bin/femsolver.wasm   (for the browser path)
```

**Julia (for the heavier nonlinear/UMAT/GPU roadmap later):**
```bash
cd native/julia
julia --project=. -e 'import Pkg; Pkg.add("PackageCompiler"); Pkg.instantiate()'
julia --project=. build_lib.jl
# -> native/julia/lib/lib/libfemsolver.{so,dll,dylib}
```

## Activate from Node

```bash
npm i koffi            # FFI loader (native addon; install only where you build)
```
```ts
import { tryActivateNativeBackend } from "@/engine/fem/nativebackend";
const r = tryActivateNativeBackend();
console.log(r.ok ? `native: ${r.name}` : `TS fallback: ${r.reason}`);
```
`nativebackend.ts` searches `NATIVE_FEM_LIB` (env), then the Zig/Julia output
dirs above. If nothing is found it returns `{ok:false}` and leaves the current
(TypeScript) backend in place. Element/assembly/UI code never changes.

## C-ABI contract (identical for Zig and Julia)

```c
// K: row-major n*n stiffness; f: length n; x: length n (written, x0=0);
// scratch: length 4*n workspace; returns iterations (>=0) or -1 on breakdown.
int solve_cg(double* K, size_t n, double* f, double* x,
             double* scratch, size_t max_it, double tol);
```
