# precompile.jl — exercise FemSolver.cg! so PackageCompiler traces the C entry.
include(joinpath(@__DIR__, "FemSolver.jl"))
using .FemSolver

let n = 3
    # SPD test system: K = [[4,1,0],[1,3,0],[0,0,2]], f = [1,2,3]
    K = Float64[4,1,0, 1,3,0, 0,0,2]    # row-major
    f = Float64[1,2,3]
    x = zeros(Float64, n)
    sc = zeros(Float64, 4n)
    FemSolver.cg!(pointer(x), pointer(K), n, pointer(f), pointer(sc), 1000, 1e-12)
end
