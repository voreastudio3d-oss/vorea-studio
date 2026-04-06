/**
 * CSG Engine — Constructive Solid Geometry via BSP Trees.
 * Adapted from Evan Wallace's csg.js (MIT License).
 * Provides: union, subtract, intersect + primitive generators.
 */

// ─── Vector3 ──────────────────────────────────────────────────────────────────

export class Vec3 {
  constructor(public x: number, public y: number, public z: number) {}
  clone() { return new Vec3(this.x, this.y, this.z); }
  negated() { return new Vec3(-this.x, -this.y, -this.z); }
  plus(a: Vec3) { return new Vec3(this.x + a.x, this.y + a.y, this.z + a.z); }
  minus(a: Vec3) { return new Vec3(this.x - a.x, this.y - a.y, this.z - a.z); }
  times(a: number) { return new Vec3(this.x * a, this.y * a, this.z * a); }
  dividedBy(a: number) { return new Vec3(this.x / a, this.y / a, this.z / a); }
  dot(a: Vec3) { return this.x * a.x + this.y * a.y + this.z * a.z; }
  lerp(a: Vec3, t: number) { return this.plus(a.minus(this).times(t)); }
  length() { return Math.sqrt(this.dot(this)); }
  unit() {
    const len = this.length();
    return len > 1e-10 ? this.dividedBy(len) : new Vec3(0, 0, 0);
  }
  cross(a: Vec3) {
    return new Vec3(
      this.y * a.z - this.z * a.y,
      this.z * a.x - this.x * a.z,
      this.x * a.y - this.y * a.x
    );
  }
}

// ─── Vertex ───────────────────────────────────────────────────────────────────

export class Vertex {
  constructor(public pos: Vec3, public normal: Vec3) {}
  clone() { return new Vertex(this.pos.clone(), this.normal.clone()); }
  flip() { this.normal = this.normal.negated(); }
  interpolate(other: Vertex, t: number) {
    return new Vertex(this.pos.lerp(other.pos, t), this.normal.lerp(other.normal, t));
  }
}

// ─── Polygon ──────────────────────────────────────────────────────────────────

export class Polygon {
  plane: Plane;
  constructor(public vertices: Vertex[], public shared?: any) {
    this.plane = Plane.fromPoints(
      vertices[0].pos, vertices[1].pos, vertices[2].pos
    );
  }
  clone() {
    return new Polygon(
      this.vertices.map(v => v.clone()),
      this.shared
    );
  }
  flip() {
    this.vertices.reverse().forEach(v => v.flip());
    this.plane.flip();
  }
}

// ─── Plane ────────────────────────────────────────────────────────────────────

const EPSILON = 1e-5;
const COPLANAR = 0;
const FRONT = 1;
const BACK = 2;
const SPANNING = 3;

export class Plane {
  constructor(public normal: Vec3, public w: number) {}

  clone() { return new Plane(this.normal.clone(), this.w); }
  flip() { this.normal = this.normal.negated(); this.w = -this.w; }

  static fromPoints(a: Vec3, b: Vec3, c: Vec3) {
    const cross = b.minus(a).cross(c.minus(a));
    const len = cross.length();
    const n = len > 1e-10 ? cross.dividedBy(len) : new Vec3(0, 0, 1);
    return new Plane(n, n.dot(a));
  }

  splitPolygon(
    polygon: Polygon,
    coplanarFront: Polygon[], coplanarBack: Polygon[],
    front: Polygon[], back: Polygon[]
  ) {
    let polygonType = 0;
    const types: number[] = [];
    for (const vertex of polygon.vertices) {
      const t = this.normal.dot(vertex.pos) - this.w;
      const type = (t < -EPSILON) ? BACK : (t > EPSILON) ? FRONT : COPLANAR;
      polygonType |= type;
      types.push(type);
    }
    switch (polygonType) {
      case COPLANAR:
        (this.normal.dot(polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon);
        break;
      case FRONT:
        front.push(polygon);
        break;
      case BACK:
        back.push(polygon);
        break;
      case SPANNING: {
        const f: Vertex[] = [], b: Vertex[] = [];
        for (let i = 0; i < polygon.vertices.length; i++) {
          const j = (i + 1) % polygon.vertices.length;
          const ti = types[i], tj = types[j];
          const vi = polygon.vertices[i], vj = polygon.vertices[j];
          if (ti !== BACK) f.push(vi);
          if (ti !== FRONT) b.push(ti !== BACK ? vi.clone() : vi);
          if ((ti | tj) === SPANNING) {
            const t = (this.w - this.normal.dot(vi.pos)) / this.normal.dot(vj.pos.minus(vi.pos));
            const v = vi.interpolate(vj, t);
            f.push(v);
            b.push(v.clone());
          }
        }
        if (f.length >= 3) front.push(new Polygon(f, polygon.shared));
        if (b.length >= 3) back.push(new Polygon(b, polygon.shared));
        break;
      }
    }
  }
}

// ─── BSP Node ─────────────────────────────────────────────────────────────────

class Node {
  plane: Plane | null = null;
  front: Node | null = null;
  back: Node | null = null;
  polygons: Polygon[] = [];

  constructor(polygons?: Polygon[]) {
    if (polygons) this.build(polygons);
  }

  clone(): Node {
    const node = new Node();
    if (this.plane) node.plane = this.plane.clone();
    if (this.front) node.front = this.front.clone();
    if (this.back) node.back = this.back.clone();
    node.polygons = this.polygons.map(p => p.clone());
    return node;
  }

  invert() {
    for (const p of this.polygons) p.flip();
    if (this.plane) this.plane.flip();
    if (this.front) this.front.invert();
    if (this.back) this.back.invert();
    const temp = this.front;
    this.front = this.back;
    this.back = temp;
  }

  clipPolygons(polygons: Polygon[]): Polygon[] {
    if (!this.plane) return polygons.slice();
    let front: Polygon[] = [], back: Polygon[] = [];
    for (const p of polygons) {
      this.plane.splitPolygon(p, front, back, front, back);
    }
    if (this.front) front = this.front.clipPolygons(front);
    if (this.back) back = this.back.clipPolygons(back);
    else back = []; // required: no back child = polygon is inside the solid → discard
    return front.concat(back);
  }


  clipTo(bsp: Node) {
    this.polygons = bsp.clipPolygons(this.polygons);
    if (this.front) this.front.clipTo(bsp);
    if (this.back) this.back.clipTo(bsp);
  }

  allPolygons(): Polygon[] {
    let polygons = this.polygons.slice();
    if (this.front) polygons = polygons.concat(this.front.allPolygons());
    if (this.back) polygons = polygons.concat(this.back.allPolygons());
    return polygons;
  }

  build(polygons: Polygon[], depth = 0) {
    if (!polygons.length) return;
    // Guard against excessive BSP depth (prevents stack overflow)
    if (depth > 400) {
      this.polygons.push(...polygons);
      return;
    }
    if (!this.plane) this.plane = polygons[0].plane.clone();
    const front: Polygon[] = [], back: Polygon[] = [];
    for (const p of polygons) {
      this.plane.splitPolygon(p, this.polygons, this.polygons, front, back);
    }
    if (front.length) {
      if (!this.front) this.front = new Node();
      this.front.build(front, depth + 1);
    }
    if (back.length) {
      if (!this.back) this.back = new Node();
      this.back.build(back, depth + 1);
    }
  }
}

// ─── CSG Solid ────────────────────────────────────────────────────────────────

export class CSG {
  polygons: Polygon[];

  constructor() { this.polygons = []; }

  clone(): CSG {
    const csg = new CSG();
    csg.polygons = this.polygons.map(p => p.clone());
    return csg;
  }

  toPolygons(): Polygon[] { return this.polygons; }

  union(csg: CSG): CSG {
    // Fast path: if either side is empty, return the other
    if (this.polygons.length === 0) return csg.clone();
    if (csg.polygons.length === 0) return this.clone();

    const a = new Node(this.clone().polygons);
    const b = new Node(csg.clone().polygons);
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.build(b.allPolygons());
    return CSG.fromPolygons(a.allPolygons());
  }

  subtract(csg: CSG): CSG {
    if (this.polygons.length === 0) return new CSG();
    if (csg.polygons.length === 0) return this.clone();

    const a = new Node(this.clone().polygons);
    const b = new Node(csg.clone().polygons);
    a.invert();
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.build(b.allPolygons());
    a.invert();
    return CSG.fromPolygons(a.allPolygons());
  }

  intersect(csg: CSG): CSG {
    if (this.polygons.length === 0 || csg.polygons.length === 0) return new CSG();
    const a = new Node(this.clone().polygons);
    const b = new Node(csg.clone().polygons);
    a.invert();
    b.clipTo(a);
    b.invert();
    a.clipTo(b);
    b.clipTo(a);
    a.build(b.allPolygons());
    a.invert();
    return CSG.fromPolygons(a.allPolygons());
  }

  inverse(): CSG {
    const csg = this.clone();
    csg.polygons.forEach(p => p.flip());
    return csg;
  }

  /** Apply a 4x4 transform matrix */
  transform(m: number[]): CSG {
    const csg = new CSG();
    csg.polygons = this.polygons.map(p => {
      const verts = p.vertices.map(v => {
        const pos = transformPoint(m, v.pos);
        const normal = transformDir(m, v.normal).unit();
        return new Vertex(pos, normal);
      });
      return new Polygon(verts, p.shared);
    });
    return csg;
  }

  static fromPolygons(polygons: Polygon[]): CSG {
    const csg = new CSG();
    csg.polygons = polygons;
    return csg;
  }

  // ─── Primitives ───────────────────────────────────────────────────────

  static cube(options?: { center?: Vec3; radius?: Vec3 }): CSG {
    const c = options?.center || new Vec3(0, 0, 0);
    const r = options?.radius || new Vec3(1, 1, 1);
    const faces: [number[], Vec3][] = [
      [[0,4,6,2], new Vec3(-1,0,0)],
      [[1,3,7,5], new Vec3(1,0,0)],
      [[0,1,5,4], new Vec3(0,-1,0)],
      [[2,6,7,3], new Vec3(0,1,0)],
      [[0,2,3,1], new Vec3(0,0,-1)],
      [[4,5,7,6], new Vec3(0,0,1)],
    ];
    return CSG.fromPolygons(faces.map(([indices, n]) => {
      const verts = indices.map(i => {
        const pos = new Vec3(
          c.x + r.x * (2 * Number(!!(i & 1)) - 1),
          c.y + r.y * (2 * Number(!!(i & 2)) - 1),
          c.z + r.z * (2 * Number(!!(i & 4)) - 1)
        );
        return new Vertex(pos, n);
      });
      return new Polygon(verts);
    }));
  }

  static sphere(options?: { center?: Vec3; radius?: number; slices?: number; stacks?: number }): CSG {
    const c = options?.center || new Vec3(0, 0, 0);
    const r = options?.radius ?? 1;
    const slices = options?.slices ?? 16;
    const stacks = options?.stacks ?? 8;
    const polygons: Polygon[] = [];

    const vertex = (theta: number, phi: number): Vertex => {
      const dir = new Vec3(
        Math.cos(theta) * Math.sin(phi),
        Math.cos(phi),
        Math.sin(theta) * Math.sin(phi)
      );
      return new Vertex(c.plus(dir.times(r)), dir);
    };

    for (let i = 0; i < slices; i++) {
      for (let j = 0; j < stacks; j++) {
        const t0 = (i / slices) * Math.PI * 2;
        const t1 = ((i + 1) / slices) * Math.PI * 2;
        const p0 = (j / stacks) * Math.PI;
        const p1 = ((j + 1) / stacks) * Math.PI;
        const verts: Vertex[] = [];
        verts.push(vertex(t0, p0));
        if (j > 0) verts.push(vertex(t1, p0));
        if (j < stacks - 1) verts.push(vertex(t1, p1));
        verts.push(vertex(t0, p1));
        polygons.push(new Polygon(verts));
      }
    }
    return CSG.fromPolygons(polygons);
  }

  static cylinder(options?: {
    start?: Vec3; end?: Vec3; radius?: number; slices?: number
  }): CSG {
    const s = options?.start || new Vec3(0, -1, 0);
    const e = options?.end || new Vec3(0, 1, 0);
    const r = options?.radius ?? 1;
    const slices = options?.slices ?? 16;

    const ray = e.minus(s);
    const axisZ = ray.unit();
    const isY = Math.abs(axisZ.y) > 0.5;
    const axisX = new Vec3(isY ? 1 : 0, !isY ? 1 : 0, 0).cross(axisZ).unit();
    const axisY = axisX.cross(axisZ).unit();

    const startV = new Vertex(s, axisZ.negated());
    const endV = new Vertex(e, axisZ.unit());
    const polygons: Polygon[] = [];

    // slice is normalized 0..1 (already i/slices), so angle = slice * 2π
    const point = (stack: number, slice: number, normalBlend: number): Vertex => {
      const angle = slice * Math.PI * 2;
      const out = axisX.times(Math.cos(angle)).plus(axisY.times(Math.sin(angle)));
      const pos = s.plus(ray.times(stack)).plus(out.times(r));
      const normal = out.plus(axisZ.times(normalBlend)).unit();
      return new Vertex(pos, normal);
    };

    for (let i = 0; i < slices; i++) {
      const t0 = i / slices;
      const t1 = (i + 1) / slices;
      polygons.push(new Polygon([startV.clone(), point(0, t0, -1), point(0, t1, -1)]));
      polygons.push(new Polygon([point(0, t1, 0), point(0, t0, 0), point(1, t0, 0), point(1, t1, 0)]));
      polygons.push(new Polygon([endV.clone(), point(1, t1, 1), point(1, t0, 1)]));
    }
    return CSG.fromPolygons(polygons);
  }

  // ─── Convex Hull ────────────────────────────────────────────────────────

  /**
   * Compute the convex hull of multiple CSG solids.
   * Collects all vertex positions, computes the 3D convex hull,
   * and returns a new CSG solid.
   *
   * Handles near-planar inputs (e.g. hull() of very thin cylinders h=0.1)
   * by checking Z-span and adding a minimum thickness guard.
   */
  static hull(csgs: CSG[]): CSG {
    // Collect all unique points
    const points: Vec3[] = [];
    const seen = new Set<string>();
    for (const csg of csgs) {
      for (const poly of csg.polygons) {
        for (const v of poly.vertices) {
          const key = `${v.pos.x.toFixed(6)},${v.pos.y.toFixed(6)},${v.pos.z.toFixed(6)}`;
          if (!seen.has(key)) {
            seen.add(key);
            points.push(v.pos.clone());
          }
        }
      }
    }
    if (points.length < 4) {
      // Degenerate: return union
      let result = new CSG();
      for (const c of csgs) result = result.union(c);
      return result;
    }

    // Guard: check if all points are near-coplanar (e.g. hull of h=0.1 cylinders)
    // If so, the convex hull 3D will degenerate. Measure Z span.
    let minZ = Infinity, maxZ = -Infinity;
    for (const p of points) { minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    const zSpan = maxZ - minZ;
    if (zSpan < 0.5) {
      // Near-flat: add synthetic top/bottom points to give the hull volume
      // The hull will still be correct because the cylinder side-verts exist;
      // we just ensure the BSP gets non-degenerate geometry.
      const extraPoints: Vec3[] = [];
      const guardH = Math.max(0.5, zSpan);
      for (const p of points) {
        extraPoints.push(new Vec3(p.x, p.y, minZ - guardH * 0.01));
        extraPoints.push(new Vec3(p.x, p.y, maxZ + guardH * 0.01));
      }
      points.push(...extraPoints);
    }

    return convexHull3D(points);
  }

  // ─── Rotate Extrude ─────────────────────────────────────────────────────

  /**
   * Revolve a 2D profile (array of [x, z] points) around the Z axis.
   * Points should be in the positive-X half (x >= 0).
   * @param profile 2D points as Vec3 where .x = radius, .z = height, .y ignored
   * @param angle  Revolution angle in radians (default: 2π)
   * @param slices Number of angular segments
   */
  static rotateExtrude(profile: Vec3[], angle?: number, slices?: number): CSG {
    const totalAngle = angle ?? Math.PI * 2;
    const nSlices = slices ?? 24;
    const isClosed = Math.abs(totalAngle - Math.PI * 2) < 0.001;
    const polygons: Polygon[] = [];

    if (profile.length < 2) return new CSG();

    for (let i = 0; i < nSlices; i++) {
      const a0 = (i / nSlices) * totalAngle;
      const a1 = ((i + 1) / nSlices) * totalAngle;
      const cos0 = Math.cos(a0), sin0 = Math.sin(a0);
      const cos1 = Math.cos(a1), sin1 = Math.sin(a1);

      for (let j = 0; j < profile.length - 1; j++) {
        const p0 = profile[j];
        const p1 = profile[j + 1];

        // Four corners of the quad
        const v00 = new Vec3(p0.x * cos0, p0.x * sin0, p0.z);
        const v10 = new Vec3(p0.x * cos1, p0.x * sin1, p0.z);
        const v01 = new Vec3(p1.x * cos0, p1.x * sin0, p1.z);
        const v11 = new Vec3(p1.x * cos1, p1.x * sin1, p1.z);

        // Normal for each vertex (radial direction)
        const dz = p1.z - p0.z;
        const dr = p1.x - p0.x;
        const edgeLen = Math.sqrt(dz * dz + dr * dr);
        if (edgeLen < 1e-8) continue;

        // Surface normal perpendicular to the profile edge, pointing outward
        const nRadial = dz / edgeLen;  // outward radial component
        const nZ = -dr / edgeLen;      // z component

        const n00 = new Vec3(nRadial * cos0, nRadial * sin0, nZ).unit();
        const n10 = new Vec3(nRadial * cos1, nRadial * sin1, nZ).unit();

        // Skip degenerate quads (when profile point is on axis)
        if (p0.x < 1e-6 && p1.x < 1e-6) continue;

        if (p0.x < 1e-6) {
          // Triangle: v00 == v10 (on axis)
          polygons.push(new Polygon([
            new Vertex(v01, n00),
            new Vertex(v00, n00),
            new Vertex(v11, n10),
          ]));
        } else if (p1.x < 1e-6) {
          // Triangle: v01 == v11 (on axis)
          polygons.push(new Polygon([
            new Vertex(v00, n00),
            new Vertex(v10, n10),
            new Vertex(v01, n00),
          ]));
        } else {
          // Full quad as two triangles
          polygons.push(new Polygon([
            new Vertex(v00, n00),
            new Vertex(v10, n10),
            new Vertex(v11, n10),
            new Vertex(v01, n00),
          ]));
        }
      }
    }

    // Cap ends if not a full revolution
    if (!isClosed && profile.length >= 3) {
      // Start cap (angle = 0)
      const startVerts: Vertex[] = profile.map(p => {
        const pos = new Vec3(p.x, 0, p.z);
        return new Vertex(pos, new Vec3(0, -1, 0));
      });
      if (startVerts.length >= 3) polygons.push(new Polygon(startVerts));

      // End cap (angle = totalAngle)
      const cosEnd = Math.cos(totalAngle), sinEnd = Math.sin(totalAngle);
      const endVerts: Vertex[] = profile.map(p => {
        const pos = new Vec3(p.x * cosEnd, p.x * sinEnd, p.z);
        return new Vertex(pos, new Vec3(sinEnd, cosEnd, 0));
      }).reverse();
      if (endVerts.length >= 3) polygons.push(new Polygon(endVerts));
    }

    return CSG.fromPolygons(polygons);
  }
}

// ─── 3D Convex Hull (Incremental Algorithm) ───────────────────────────────────

function convexHull3D(points: Vec3[]): CSG {
  // Deduplicate points by coordinate value (not reference)
  const uniqueMap = new Map<string, Vec3>();
  for (const p of points) {
    const key = `${p.x.toFixed(8)},${p.y.toFixed(8)},${p.z.toFixed(8)}`;
    if (!uniqueMap.has(key)) uniqueMap.set(key, p);
  }
  const pts = Array.from(uniqueMap.values());
  if (pts.length < 4) return new CSG();

  // Find 4 non-coplanar points for initial tetrahedron
  const p0 = pts[0];
  let p1: Vec3 | null = null, p2: Vec3 | null = null, p3: Vec3 | null = null;

  // Find p1: furthest from p0
  let maxDist = 0;
  for (const p of pts) {
    const d = p.minus(p0).length();
    if (d > maxDist) { maxDist = d; p1 = p; }
  }
  if (!p1 || maxDist < 1e-8) return new CSG();

  // Find p2: furthest from line p0-p1
  const lineDir = p1.minus(p0).unit();
  maxDist = 0;
  for (const p of pts) {
    const toP = p.minus(p0);
    const proj = toP.minus(lineDir.times(toP.dot(lineDir)));
    const d = proj.length();
    if (d > maxDist) { maxDist = d; p2 = p; }
  }
  if (!p2 || maxDist < 1e-8) return new CSG();

  // Find p3: furthest from plane p0-p1-p2
  const planeNormal = p1.minus(p0).cross(p2.minus(p0)).unit();
  maxDist = 0;
  for (const p of pts) {
    const d = Math.abs(p.minus(p0).dot(planeNormal));
    if (d > maxDist) { maxDist = d; p3 = p; }
  }
  if (!p3 || maxDist < 1e-8) return new CSG();

  // Ensure correct winding (p3 should be "above" the triangle p0-p1-p2)
  if (p3.minus(p0).dot(planeNormal) < 0) {
    [p1, p2] = [p2, p1];
  }

  // Build initial tetrahedron faces (CCW when viewed from outside)
  interface HullFace {
    a: number; b: number; c: number;
    normal: Vec3;
    d: number; // plane constant
  }

  const allPoints = [p0, p1!, p2!, p3!];

  function makeFace(ai: number, bi: number, ci: number): HullFace {
    const a = allPoints[ai], b = allPoints[bi], c = allPoints[ci];
    const normal = b.minus(a).cross(c.minus(a)).unit();
    const d = normal.dot(a);
    return { a: ai, b: bi, c: ci, normal, d };
  }

  let faces: HullFace[] = [
    makeFace(0, 1, 2),
    makeFace(0, 2, 3),
    makeFace(0, 3, 1),
    makeFace(1, 3, 2),
  ];

  // Ensure faces point outward: centroid should be "behind" each face
  const centroid = p0.plus(p1!).plus(p2!).plus(p3!).times(0.25);
  for (const f of faces) {
    if (f.normal.dot(centroid) - f.d > 0) {
      [f.a, f.b] = [f.b, f.a];
      f.normal = f.normal.negated();
      f.d = -f.d;
    }
  }

  // Track which points are already in the hull via coordinate keys
  const usedKeys = new Set<string>();
  for (const p of allPoints) {
    usedKeys.add(`${p.x.toFixed(8)},${p.y.toFixed(8)},${p.z.toFixed(8)}`);
  }

  // Add remaining points incrementally
  for (const p of pts) {
    const key = `${p.x.toFixed(8)},${p.y.toFixed(8)},${p.z.toFixed(8)}`;
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);

    // Find faces visible from p
    const visible: HullFace[] = [];
    const hidden: HullFace[] = [];
    for (const f of faces) {
      if (f.normal.dot(p) - f.d > 1e-8) {
        visible.push(f);
      } else {
        hidden.push(f);
      }
    }

    if (visible.length === 0) continue; // Point is inside hull

    // Find horizon edges (edges shared between visible and hidden faces)
    const horizon: [number, number][] = [];
    for (const vf of visible) {
      const edges: [number, number][] = [[vf.a, vf.b], [vf.b, vf.c], [vf.c, vf.a]];
      for (const [ea, eb] of edges) {
        const isHorizon = hidden.some(hf => {
          const he: [number, number][] = [[hf.a, hf.b], [hf.b, hf.c], [hf.c, hf.a]];
          return he.some(([ha, hb]) => ha === eb && hb === ea);
        });
        if (isHorizon) horizon.push([ea, eb]);
      }
    }

    // Add new point
    const pIdx = allPoints.length;
    allPoints.push(p);

    // Create new faces from horizon edges to new point
    // Compute hull centroid for outward normal verification
    const hullCenter = allPoints.reduce((s, pt) => s.plus(pt), new Vec3(0, 0, 0)).times(1 / allPoints.length);
    const newFaces: HullFace[] = [];
    for (const [ea, eb] of horizon) {
      const nf = makeFace(ea, eb, pIdx);
      // Verify outward orientation: centroid must be behind the face
      if (nf.normal.dot(hullCenter) - nf.d > 0) {
        // Flip winding
        const flipped = makeFace(eb, ea, pIdx);
        newFaces.push(flipped);
      } else {
        newFaces.push(nf);
      }
    }

    faces = hidden.concat(newFaces);
  }

  // Convert faces to CSG polygons, skipping degenerate ones
  const polygons: Polygon[] = [];
  for (const f of faces) {
    const a = allPoints[f.a], b = allPoints[f.b], c = allPoints[f.c];
    // Skip degenerate triangles (near-zero area)
    const cross = b.minus(a).cross(c.minus(a));
    if (cross.length() < 1e-10) continue;
    const normal = cross.unit();
    polygons.push(new Polygon([
      new Vertex(a.clone(), normal.clone()),
      new Vertex(b.clone(), normal.clone()),
      new Vertex(c.clone(), normal.clone()),
    ]));
  }

  return CSG.fromPolygons(polygons);
}


// ─── Transform Helpers ────────────────────────────────────────────────────────

function transformPoint(m: number[], v: Vec3): Vec3 {
  return new Vec3(
    m[0]*v.x + m[4]*v.y + m[8]*v.z + m[12],
    m[1]*v.x + m[5]*v.y + m[9]*v.z + m[13],
    m[2]*v.x + m[6]*v.y + m[10]*v.z + m[14]
  );
}

function transformDir(m: number[], v: Vec3): Vec3 {
  return new Vec3(
    m[0]*v.x + m[4]*v.y + m[8]*v.z,
    m[1]*v.x + m[5]*v.y + m[9]*v.z,
    m[2]*v.x + m[6]*v.y + m[10]*v.z
  );
}

export function mat4Identity(): number[] {
  return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
}

export function mat4Translate(x: number, y: number, z: number): number[] {
  return [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1];
}

export function mat4Scale(x: number, y: number, z: number): number[] {
  return [x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1];
}

export function mat4RotateX(angle: number): number[] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1];
}

export function mat4RotateY(angle: number): number[] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1];
}

export function mat4RotateZ(angle: number): number[] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1];
}

export function mat4Multiply(a: number[], b: number[]): number[] {
  const r = new Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      r[j*4+i] = a[i]*b[j*4] + a[4+i]*b[j*4+1] + a[8+i]*b[j*4+2] + a[12+i]*b[j*4+3];
    }
  }
  return r;
}