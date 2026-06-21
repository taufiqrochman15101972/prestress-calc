# FemSolver.jl — REAL native solver backend (Julia) for the FEM seam.
#
# Same preconditioned Conjugate Gradient (Jacobi) as the TypeScript cgBackend and
# the Zig solver, so all three paths agree numerically. Julia is the natural home
# for the heavier nonlinear/UMAT/GPU work later (CUDA.jl / KernelAbstractions),
# while this CG entry proves the C-ABI bridge end-to-end.
#
# Exposed C-callable symbol `solve_cg` (Base.@ccallable) so a Node FFI bridge can
# dlopen the PackageCompiler-built shared library and call it over the SAME flat
# Float64 buffers (zero-copy via unsafe_wrap) the rest of the engine uses.
#
# Build a shared library (needs Julia + PackageCompiler.jl):
#     julia --project=. build_lib.jl
# See ../README.md.

module FemSolver

"""
    cg!(x, K, n, f, scratch; max_it, tol) -> iterations

Dense row-major K (length n*n), rhs f (length n), solution x (length n),
scratch length 4n. Returns iterations done, or -1 on breakdown.
Pure in-place / allocation-free over the provided buffers.
"""
function cg!(x::Ptr{Float64}, K::Ptr{Float64}, n::Int, f::Ptr{Float64},
             scratch::Ptr{Float64}, max_it::Int, tol::Float64)::Int
    n == 0 && return 0
    xs = unsafe_wrap(Array, x, n)
    ks = unsafe_wrap(Array, K, n * n)
    fs = unsafe_wrap(Array, f, n)
    sc = unsafe_wrap(Array, scratch, 4n)
    r  = view(sc, 1:n)
    z  = view(sc, n+1:2n)
    p  = view(sc, 2n+1:3n)
    Kp = view(sc, 3n+1:4n)

    @inbounds begin
        bnorm = 0.0
        for i in 1:n
            xs[i] = 0.0
            r[i]  = fs[i]
            d     = ks[(i-1)*n + i]
            minv  = d != 0.0 ? 1.0 / d : 1.0
            z[i]  = minv * r[i]
            p[i]  = z[i]
            bnorm += fs[i]^2
        end
        bnorm = sqrt(bnorm); bnorm == 0.0 && (bnorm = 1.0)

        rz = 0.0
        for i in 1:n; rz += r[i] * z[i]; end

        for it in 0:max_it-1
            for i in 1:n
                s = 0.0; row = (i-1)*n
                for j in 1:n; s += ks[row + j] * p[j]; end
                Kp[i] = s
            end
            pKp = 0.0
            for i in 1:n; pKp += p[i] * Kp[i]; end
            abs(pKp) < 1e-300 && return -1
            alpha = rz / pKp
            for i in 1:n
                xs[i] += alpha * p[i]
                r[i]  -= alpha * Kp[i]
            end
            rnorm = 0.0
            for i in 1:n; rnorm += r[i]^2; end
            sqrt(rnorm) / bnorm < tol && return it + 1
            for i in 1:n
                d = ks[(i-1)*n + i]
                minv = d != 0.0 ? 1.0 / d : 1.0
                z[i] = minv * r[i]
            end
            rz_new = 0.0
            for i in 1:n; rz_new += r[i] * z[i]; end
            beta = rz_new / rz; rz = rz_new
            for i in 1:n; p[i] = z[i] + beta * p[i]; end
        end
    end
    return max_it
end

# C-ABI entry: same signature as the Zig solve_cg so the Node bridge is identical.
Base.@ccallable function solve_cg(K::Ptr{Float64}, n::Csize_t, f::Ptr{Float64},
                                  x::Ptr{Float64}, scratch::Ptr{Float64},
                                  max_it::Csize_t, tol::Float64)::Cint
    return Cint(cg!(x, K, Int(n), f, scratch, Int(max_it), tol))
end

end # module
