/**
 * STL Surface Strategy — Loads a parsed STL mesh and uses it as a deformable
 * surface for heightmap displacement, alongside Plane/Cylinder/Box/etc.
 *
 * The approach: project the loaded mesh from above (top-down) to create a
 * regular UV grid that follows the STL's topography. Heightmap displacement
 * is then applied along the surface normal (upward for horizontal surfaces).
 *
 * A validity mask tracks which grid cells received actual ray hits, so that
 * areas with no surface coverage are excluded from mesh generation (no fake
 * flat rectangles for complex non-convex shapes).
 *
 * Vorea Studio — voreastudio.com
 */

import * as THREE from "three";
import type {
  SurfaceStrategy,
  SurfaceCommonConfig,
  Vec3Tuple,
  TriEmitter,
} from "./types";

// ─── Config ──────────────────────────────────────────────────────────────────

export interface StlSurfaceConfig extends SurfaceCommonConfig {
  /** Pre-computed depth field from STL raycasting (gridW+1 × gridH+1) */
  depthField: Float32Array;
  /** Normal field (3 floats per vertex: nx, ny, nz) */
  normalField: Float32Array;
  /** Validity mask: 1 = ray hit, 0 = missed (gridW+1 × gridH+1) */
  validMask: Uint8Array;
  /** Physical width of the surface (mm) */
  width: number;
  /** Physical depth of the surface (mm) */
  depth: number;
  /** Min Y from the STL's depth field (base offset) */
  baseOffset: number;
}

// ─── Depth-field extraction from STL geometry ────────────────────────────────

/**
 * Raycast from above to sample the STL mesh's height at a regular grid.
 * Returns depthField (heights), normalField (normals), validMask, and metadata.
 */
export function extractDepthField(
  geometry: THREE.BufferGeometry,
  gridW: number,
  gridH: number,
): {
  depthField: Float32Array;
  normalField: Float32Array;
  validMask: Uint8Array;
  width: number;
  depth: number;
  baseOffset: number;
} {
  // ─── Auto-detect optimal projection axis ────────────────────────
  // Clone geometry so we don't mutate the original
  const geo = geometry.clone();
  geo.computeBoundingBox();
  geo.computeVertexNormals();
  const origBbox = geo.boundingBox!;
  const origSize = new THREE.Vector3();
  origBbox.getSize(origSize);

  // Find the axis with the LARGEST extent — projecting along this axis
  // gives the most depth/detail in the heightfield. The other two axes
  // form the grid (XZ plane after rotation).
  const dims = [origSize.x, origSize.y, origSize.z];
  const maxDim = Math.max(...dims);

  if (maxDim === dims[2]) {
    // Z is largest → rotate so Z becomes Y: rotate -90° around X
    geo.rotateX(-Math.PI / 2);
  } else if (maxDim === dims[0]) {
    // X is largest → rotate so X becomes Y: rotate 90° around Z
    geo.rotateZ(Math.PI / 2);
  }
  // else Y is already the largest, no rotation needed

  // Recompute after rotation
  geo.computeBoundingBox();
  geo.computeVertexNormals();
  const bbox = geo.boundingBox!;
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const center = new THREE.Vector3();
  bbox.getCenter(center);

  const cols = gridW + 1;
  const rows = gridH + 1;
  const depthField = new Float32Array(cols * rows);
  const normalField = new Float32Array(cols * rows * 3);
  const validMask = new Uint8Array(cols * rows); // 0=miss, 1=hit

  // Create mesh for raycasting
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, material);

  const raycaster = new THREE.Raycaster();
  const rayOrigin = new THREE.Vector3();
  const rayDir = new THREE.Vector3(0, -1, 0); // Raycast downward

  const padX = size.x * 0.02; // 2% padding
  const padZ = size.z * 0.02;
  const startX = bbox.min.x - padX;
  const startZ = bbox.min.z - padZ;
  const rangeX = size.x + padX * 2;
  const rangeZ = size.z + padZ * 2;
  const rayStartY = bbox.max.y + 1; // Start above the mesh

  let minHit = Infinity;

  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const u = ix / gridW;
      const v = iy / gridH;
      rayOrigin.set(startX + u * rangeX, rayStartY, startZ + v * rangeZ);
      raycaster.set(rayOrigin, rayDir);

      const hits = raycaster.intersectObject(mesh, false);
      const idx = iy * cols + ix;

      if (hits.length > 0) {
        const hit = hits[0];
        depthField[idx] = hit.point.y;
        validMask[idx] = 1;
        if (hit.point.y < minHit) minHit = hit.point.y;
        // Store normal
        const face = hit.face;
        if (face) {
          normalField[idx * 3]     = face.normal.x;
          normalField[idx * 3 + 1] = face.normal.y;
          normalField[idx * 3 + 2] = face.normal.z;
        } else {
          normalField[idx * 3]     = 0;
          normalField[idx * 3 + 1] = 1;
          normalField[idx * 3 + 2] = 0;
        }
      } else {
        // No hit — mark as invalid
        depthField[idx] = NaN;
        validMask[idx] = 0;
        normalField[idx * 3]     = 0;
        normalField[idx * 3 + 1] = 1;
        normalField[idx * 3 + 2] = 0;
      }
    }
  }

  // Fix NaN entries (missed rays) with the minimum hit value
  if (!isFinite(minHit)) minHit = 0;
  for (let i = 0; i < depthField.length; i++) {
    if (isNaN(depthField[i])) depthField[i] = minHit;
  }

  // Normalize: shift so minimum = 0
  for (let i = 0; i < depthField.length; i++) {
    depthField[i] -= minHit;
  }

  // ─── Depth discontinuity filter ─────────────────────────────────
  // For hollow/thin-walled objects, adjacent cells can hit opposing
  // surfaces (front vs back), creating stretched triangles. Mark cells
  // as invalid if the depth gradient with any neighbor is too steep.
  let maxDepth = 0;
  for (let i = 0; i < depthField.length; i++) {
    if (validMask[i] && depthField[i] > maxDepth) maxDepth = depthField[i];
  }
  const discontinuityThreshold = maxDepth * 0.12; // 12% of total depth range
  if (discontinuityThreshold > 0) {
    // Clone mask to avoid contamination during iteration
    const maskCopy = new Uint8Array(validMask);
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const idx = iy * cols + ix;
        if (!maskCopy[idx]) continue;
        const d = depthField[idx];
        // Check 4-neighbors for steep gradients
        const neighbors: number[] = [];
        if (ix > 0)       neighbors.push(depthField[idx - 1]);
        if (ix < gridW)   neighbors.push(depthField[idx + 1]);
        if (iy > 0)       neighbors.push(depthField[idx - cols]);
        if (iy < gridH)   neighbors.push(depthField[idx + cols]);
        // Filter only valid neighbors
        let hasDiscontinuity = false;
        for (const nd of neighbors) {
          if (Math.abs(d - nd) > discontinuityThreshold) {
            hasDiscontinuity = true;
            break;
          }
        }
        if (hasDiscontinuity) {
          validMask[idx] = 0; // Mark as invalid boundary
        }
      }
    }
  }

  material.dispose();
  geo.dispose();

  return {
    depthField,
    normalField,
    validMask,
    width: rangeX,
    depth: rangeZ,
    baseOffset: minHit,
  };
}

// ─── Surface Strategy ────────────────────────────────────────────────────────

export function createStlSurface(config: StlSurfaceConfig): SurfaceStrategy {
  const { gridW, gridH, depthField, normalField, validMask, width, depth, baseThickness } = config;
  const cols = gridW + 1;
  const offX = -width / 2;
  const offZ = -depth / 2;
  const baseY = -baseThickness;

  const getX = (ix: number) => offX + (ix / gridW) * width;
  const getZ = (iz: number) => offZ + (iz / gridH) * depth;

  const maxIx = gridW;
  const maxIy = gridH;
  const clampIdx = (ix: number, iy: number) => {
    const cIx = Math.min(Math.max(0, ix), maxIx);
    const cIy = Math.min(Math.max(0, iy), maxIy);
    return cIy * cols + cIx;
  };
  const getBaseY = (_ix: number, _iy: number) => {
    const idx = clampIdx(_ix, _iy);
    const v = depthField[idx];
    return isFinite(v) ? v : 0;
  };
  const getNormal = (_ix: number, _iy: number): Vec3Tuple => {
    const idx = clampIdx(_ix, _iy) * 3;
    const nx = normalField[idx], ny = normalField[idx + 1], nz = normalField[idx + 2];
    return (isFinite(nx) && isFinite(ny) && isFinite(nz)) ? [nx, ny, nz] : [0, 1, 0];
  };
  /** Check if a grid vertex had a valid ray hit */
  const isValid = (ix: number, iy: number): boolean => {
    const idx = clampIdx(ix, iy);
    return validMask[idx] === 1;
  };

  return {
    mode: "stl",

    outerPoint(ix, iy, height) {
      const baseHeight = getBaseY(ix, iy);
      const [nx, ny, nz] = getNormal(ix, iy);
      // Displace along surface normal
      return [
        getX(ix) + nx * height,
        baseHeight + ny * height,
        getZ(iy) + nz * height,
      ];
    },

    innerPoint(ix, iy) {
      return [getX(ix), baseY, getZ(iy)];
    },

    preferredNormal(ix, iy) {
      return getNormal(ix, iy);
    },

    estimateTriCount(gW, gH, solid) {
      // Over-estimate (actual may be less due to validity mask)
      const topTris = gW * gH * 2;
      return topTris + (solid ? topTris + (gW + gH) * 4 : 0);
    },

    generateOuterSurface(gW, gH, getHeight, getColor, emitTri) {
      for (let iz = 0; iz < gH; iz++) {
        for (let ix = 0; ix < gW; ix++) {
          // Skip cells where ANY corner has an invalid hit or discontinuity
          const v00 = isValid(ix, iz);
          const v10 = isValid(ix + 1, iz);
          const v01 = isValid(ix, iz + 1);
          const v11 = isValid(ix + 1, iz + 1);
          if (!v00 || !v10 || !v01 || !v11) continue; // Partial or complete miss → skip

          const p00 = this.outerPoint(ix, iz, getHeight(ix, iz));
          const p10 = this.outerPoint(ix + 1, iz, getHeight(ix + 1, iz));
          const p01 = this.outerPoint(ix, iz + 1, getHeight(ix, iz + 1));
          const p11 = this.outerPoint(ix + 1, iz + 1, getHeight(ix + 1, iz + 1));
          const [fr, fg, fb] = getColor(ix, iz);

          const pref = this.preferredNormal(ix, iz);
          emitTri(p00, p01, p10, fr, fg, fb, pref);
          emitTri(p10, p01, p11, fr, fg, fb, pref);
        }
      }
    },

    generateSolidGeometry(gW, gH, getHeight, emitTri, baseColor, getColor) {
      const [br, bg, bb] = baseColor;

      // Bottom face — keep flat baseColor (not visible from top)
      for (let iz = 0; iz < gH; iz++) {
        for (let ix = 0; ix < gW; ix++) {
          const v00 = isValid(ix, iz);
          const v10 = isValid(ix + 1, iz);
          const v01 = isValid(ix, iz + 1);
          const v11 = isValid(ix + 1, iz + 1);
          if (!v00 || !v10 || !v01 || !v11) continue;

          const x0 = getX(ix), x1 = getX(ix + 1);
          const z0 = getZ(iz), z1 = getZ(iz + 1);
          emitTri([x0, baseY, z0], [x1, baseY, z1], [x0, baseY, z1], br, bg, bb, [0, -1, 0]);
          emitTri([x0, baseY, z0], [x1, baseY, z0], [x1, baseY, z1], br, bg, bb, [0, -1, 0]);
        }
      }

      // Side walls — sample image texture at edge grid coordinates
      const isCellValid = (cx: number, cy: number) => {
        if (cx < 0 || cx >= gW || cy < 0 || cy >= gH) return false;
        return isValid(cx, cy) && isValid(cx + 1, cy) && isValid(cx, cy + 1) && isValid(cx + 1, cy + 1);
      };

      for (let iz = 0; iz < gH; iz++) {
        for (let ix = 0; ix < gW; ix++) {
          if (!isCellValid(ix, iz)) continue;

          // Wall color: sample image at (ix, iz) or fallback to baseColor
          const [wr, wg, wb] = getColor ? getColor(ix, iz) : [br, bg, bb];

          // Front edge (z_min)
          if (!isCellValid(ix, iz - 1)) {
            const x0 = getX(ix), x1 = getX(ix + 1), z = getZ(iz);
            const p0 = this.outerPoint(ix, iz, getHeight(ix, iz));
            const p1 = this.outerPoint(ix + 1, iz, getHeight(ix + 1, iz));
            emitTri([x0, baseY, z], p1, [x1, baseY, z], wr, wg, wb, [0, 0, -1]);
            emitTri([x0, baseY, z], p0, p1, wr, wg, wb, [0, 0, -1]);
          }
          // Back edge (z_max)
          if (!isCellValid(ix, iz + 1)) {
            const x0 = getX(ix), x1 = getX(ix + 1), z = getZ(iz + 1);
            const p0 = this.outerPoint(ix, iz + 1, getHeight(ix, iz + 1));
            const p1 = this.outerPoint(ix + 1, iz + 1, getHeight(ix + 1, iz + 1));
            emitTri([x0, baseY, z], [x1, baseY, z], p1, wr, wg, wb, [0, 0, 1]);
            emitTri([x0, baseY, z], p1, p0, wr, wg, wb, [0, 0, 1]);
          }
          // Left edge (x_min)
          if (!isCellValid(ix - 1, iz)) {
            const z0 = getZ(iz), z1 = getZ(iz + 1), x = getX(ix);
            const p0 = this.outerPoint(ix, iz, getHeight(ix, iz));
            const p1 = this.outerPoint(ix, iz + 1, getHeight(ix, iz + 1));
            emitTri([x, baseY, z0], [x, baseY, z1], p1, wr, wg, wb, [-1, 0, 0]);
            emitTri([x, baseY, z0], p1, p0, wr, wg, wb, [-1, 0, 0]);
          }
          // Right edge (x_max)
          if (!isCellValid(ix + 1, iz)) {
            const z0 = getZ(iz), z1 = getZ(iz + 1), x = getX(ix + 1);
            const p0 = this.outerPoint(ix + 1, iz, getHeight(ix + 1, iz));
            const p1 = this.outerPoint(ix + 1, iz + 1, getHeight(ix + 1, iz + 1));
            emitTri([x, baseY, z0], p0, p1, wr, wg, wb, [1, 0, 0]);
            emitTri([x, baseY, z0], p1, [x, baseY, z1], wr, wg, wb, [1, 0, 0]);
          }
        }
      }
    },
  };
}
