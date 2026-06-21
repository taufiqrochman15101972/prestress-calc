# build_lib.jl — compile FemSolver.jl into a C-callable shared library.
#
# Requires:  julia  +  PackageCompiler.jl   (] add PackageCompiler)
# Run:       julia build_lib.jl
# Output:    ./lib/lib/libfemsolver.{so,dll,dylib}  (exports `solve_cg`)
#
# The Node FFI bridge (src/engine/fem/nativebackend.ts) looks for this artifact;
# if it is absent the app silently uses the TypeScript CG backend instead.

using PackageCompiler

create_library(
    @__DIR__,                                  # package dir containing FemSolver.jl
    joinpath(@__DIR__, "lib");                 # output dir
    lib_name = "femsolver",
    precompile_execution_file = joinpath(@__DIR__, "precompile.jl"),
    incremental = false,
    filter_stdlibs = true,
    header_files = String[],
    force = true,
)
