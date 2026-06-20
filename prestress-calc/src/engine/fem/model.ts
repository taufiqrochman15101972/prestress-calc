/**
 * fem/model.ts — Pre-processor: geometry/mesh helpers + the THREE flexible
 * copy/paste methods (STAAD.Pro-style, extensible toward MIDAS/Robot):
 *   1) linearRepeat  — translational repeat (Δx,Δy × n copies)
 *   2) mirror        — reflect about a vertical/horizontal axis
 *   3) rotateCopy    — circular/rotational copy about a centre by Δθ × n
 * Each returns NEW nodes+members with fresh ids, merging coincident nodes.
 */
import type { FemNode, FemMember, FrameModel } from "./frame";

const TOL = 1e-6;

function nextNodeId(nodes: FemNode[]): number { return nodes.reduce((m, n) => Math.max(m, n.id), 0) + 1; }
function nextMemId(ms: FemMember[]): number { return ms.reduce((m, e) => Math.max(m, e.id), 0) + 1; }

/** find existing node at (x,y) within tol, else create. Returns id. */
function getOrAdd(nodes: FemNode[], x: number, y: number): number {
  const f = nodes.find(n => Math.abs(n.x - x) < TOL && Math.abs(n.y - y) < TOL);
  if (f) return f.id;
  const id = nextNodeId(nodes);
  nodes.push({ id, x, y });
  return id;
}

/** Generic: duplicate a selected set of members (by transform) n times. */
function duplicate(
  model: FrameModel, memberIds: number[], xform: (p: { x: number; y: number }) => { x: number; y: number }, copies: number,
): FrameModel {
  const nodes = model.nodes.map(n => ({ ...n }));
  const members = model.members.map(m => ({ ...m }));
  const idxById = new Map(nodes.map(n => [n.id, n]));
  const sel = members.filter(m => memberIds.includes(m.id));
  let cur = sel.map(m => ({ ...m }));
  for (let c = 0; c < copies; c++) {
    const fresh: FemMember[] = [];
    for (const m of cur) {
      const a = idxById.get(m.n1)!, b = idxById.get(m.n2)!;
      const pa = xform({ x: a.x, y: a.y }), pb = xform({ x: b.x, y: b.y });
      const n1 = getOrAdd(nodes, pa.x, pa.y), n2 = getOrAdd(nodes, pb.x, pb.y);
      nodes.forEach(nn => idxById.set(nn.id, nn));
      const nm: FemMember = { ...m, id: nextMemId(members.concat(fresh)), n1, n2 };
      fresh.push(nm);
    }
    members.push(...fresh);
    cur = fresh;
  }
  return { ...model, nodes, members };
}

/** 1) translational repeat */
export function linearRepeat(model: FrameModel, memberIds: number[], dx: number, dy: number, copies: number): FrameModel {
  return duplicate(model, memberIds, p => ({ x: p.x + dx, y: p.y + dy }), copies);
}

/** 2) mirror about x=axisX (vertical) or y=axisY (horizontal) — one copy */
export function mirror(model: FrameModel, memberIds: number[], axis: "V" | "H", at: number): FrameModel {
  const xf = axis === "V" ? (p: { x: number; y: number }) => ({ x: 2 * at - p.x, y: p.y })
    : (p: { x: number; y: number }) => ({ x: p.x, y: 2 * at - p.y });
  return duplicate(model, memberIds, xf, 1);
}

/** 3) rotational/circular copy about (cx,cy) by dThetaDeg, n copies */
export function rotateCopy(model: FrameModel, memberIds: number[], cx: number, cy: number, dThetaDeg: number, copies: number): FrameModel {
  const nodes = model.nodes.map(n => ({ ...n }));
  const members = model.members.map(m => ({ ...m }));
  const idxById = new Map(nodes.map(n => [n.id, n]));
  const sel = members.filter(m => memberIds.includes(m.id));
  for (let c = 1; c <= copies; c++) {
    const th = (dThetaDeg * c * Math.PI) / 180, cs = Math.cos(th), sn = Math.sin(th);
    const rot = (p: { x: number; y: number }) => ({
      x: cx + (p.x - cx) * cs - (p.y - cy) * sn,
      y: cy + (p.x - cx) * sn + (p.y - cy) * cs,
    });
    for (const m of sel) {
      const a = idxById.get(m.n1)!, b = idxById.get(m.n2)!;
      const pa = rot({ x: a.x, y: a.y }), pb = rot({ x: b.x, y: b.y });
      const n1 = getOrAdd(nodes, pa.x, pa.y), n2 = getOrAdd(nodes, pb.x, pb.y);
      nodes.forEach(nn => idxById.set(nn.id, nn));
      members.push({ ...m, id: nextMemId(members), n1, n2 });
    }
  }
  return { ...model, nodes, members };
}

/** sample a member's deflected polyline (cubic Hermite) for the post-processor. */
export function deflectedShape(
  ax: number, ay: number, bx: number, by: number,
  d1: { ux: number; uy: number; rz: number }, d2: { ux: number; uy: number; rz: number },
  scale: number, n = 11,
): { x: number; y: number }[] {
  const L = Math.hypot(bx - ax, by - ay), c = (bx - ax) / L, s = (by - ay) / L;
  // local transverse displacements
  const v1 = -s * d1.ux + c * d1.uy, v2 = -s * d2.ux + c * d2.uy;
  const u1 = c * d1.ux + s * d1.uy, u2 = c * d2.ux + s * d2.uy;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const xi = i / (n - 1), X = xi * L;
    const N1 = 1 - 3 * xi * xi + 2 * xi ** 3, N2 = X * (1 - xi) ** 2;
    const N3 = 3 * xi * xi - 2 * xi ** 3, N4 = X * (xi * xi - xi);
    const v = N1 * v1 + N2 * d1.rz + N3 * v2 + N4 * d2.rz;
    const u = (1 - xi) * u1 + xi * u2;
    const gx = ax + c * X - s * v * scale + c * u * scale;
    const gy = ay + s * X + c * v * scale + s * u * scale;
    out.push({ x: gx, y: gy });
  }
  return out;
}
