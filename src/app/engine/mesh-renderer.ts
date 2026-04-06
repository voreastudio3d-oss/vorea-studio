/**
 * Canvas 2D Mesh Renderer – Renders CSG polygons with flat shading,
 * depth sorting (painter's algorithm), orbit controls, and wireframe overlay.
 * Accepts both full CSG objects and lightweight RenderableMesh (from workers).
 */

import type { CSG } from "./csg";
import { Vec3 } from "./csg";
import type { RenderableMesh } from "./mesh-data";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RenderMode = "smooth" | "faceted" | "wireframe";

export interface RenderOptions {
  showWireframe?: boolean;
  showAxes?: boolean;
  showGrid?: boolean;
  fillColor?: [number, number, number];
  wireColor?: string;
  bgColor?: string;
  lightDir?: Vec3;
  ambient?: number;
  renderMode?: RenderMode;
}

export interface ViewState {
  rotX: number;
  rotY: number;
  zoom: number;
  panX: number;
  panY: number;
}

// ─── Duck-typed mesh interface ────────────────────────────────────────────────

type AnyMesh = CSG | RenderableMesh;

// ─── Projected face for sorting ───────────────────────────────────────────────

interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

interface ProjectedFace {
  points: [number, number][];
  depth: number;
  brightness: number;
  normal: Vec3Like;
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

export function renderMesh(
  ctx: CanvasRenderingContext2D,
  csg: AnyMesh,
  view: ViewState,
  opts: RenderOptions = {}
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w / 2 + (view.panX || 0);
  const cy = h / 2 + (view.panY || 0);

  const {
    showWireframe = false,
    showAxes = true,
    showGrid = true,
    fillColor = [198, 227, 108],
    wireColor = "rgba(255,255,255,0.12)",
    bgColor = "#0f1320",
    ambient = 0.25,
    renderMode = "smooth",
  } = opts;

  // Light direction (normalized)
  const lightDir = (opts.lightDir || new Vec3(0.3, 0.8, 0.5)).unit();

  // Clear
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);

  // ─── 3D → 2D Projection ────────────────────────────────────────────
  const project = (x: number, y: number, z: number): [number, number, number] => {
    const { rotX, rotY, zoom } = view;
    // Y-up rotation
    const x1 = x * Math.cos(rotY) + z * Math.sin(rotY);
    const z1 = -x * Math.sin(rotY) + z * Math.cos(rotY);
    const y2 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
    const z2 = y * Math.sin(rotX) + z1 * Math.cos(rotX);
    const scale = zoom;
    return [cx + x1 * scale, cy - y2 * scale, z2];
  };

  // ─── Grid ──────────────────────────────────────────────────────────
  if (showGrid) {
    const gridSize = 50;
    const gridCount = 6;
    ctx.strokeStyle = "rgba(42,48,64,0.35)";
    ctx.lineWidth = 0.5;
    for (let i = -gridCount; i <= gridCount; i++) {
      const [ax, ay] = project(i * gridSize, 0, -gridCount * gridSize);
      const [bx, by] = project(i * gridSize, 0, gridCount * gridSize);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      const [cx2, cy2] = project(-gridCount * gridSize, 0, i * gridSize);
      const [dx, dy] = project(gridCount * gridSize, 0, i * gridSize);
      ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(dx, dy); ctx.stroke();
    }
  }

  // ─── Project and sort polygons ─────────────────────────────────────
  const polygons = csg.toPolygons();
  const projected: ProjectedFace[] = [];

  for (const poly of polygons) {
    if (poly.vertices.length < 3) continue;

    const points: [number, number][] = [];
    let avgZ = 0;

    for (const v of poly.vertices) {
      const [px, py, pz] = project(v.pos.x, v.pos.z, v.pos.y);
      points.push([px, py]);
      avgZ += pz;
    }
    avgZ /= poly.vertices.length;

    // Face normal for lighting (use polygon plane normal)
    const normal = poly.plane.normal;

    // Simple diffuse lighting (world-space)
    const dot = Math.abs(
      normal.x * lightDir.x + normal.y * lightDir.y + normal.z * lightDir.z
    );
    const brightness = Math.min(1, ambient + dot * (1 - ambient));

    projected.push({ points, depth: avgZ, brightness, normal });
  }

  // Sort back-to-front (painter's algorithm)
  projected.sort((a, b) => a.depth - b.depth);

  // ─── Render faces ──────────────────────────────────────────────────
  for (const face of projected) {
    const [r, g, b] = fillColor;
    const br = face.brightness;
    const fr = Math.round(r * br);
    const fg = Math.round(g * br);
    const fb = Math.round(b * br);

    ctx.beginPath();
    ctx.moveTo(face.points[0][0], face.points[0][1]);
    for (let i = 1; i < face.points.length; i++) {
      ctx.lineTo(face.points[i][0], face.points[i][1]);
    }
    ctx.closePath();

    if (renderMode === "wireframe") {
      // Wireframe only – no fill
      ctx.strokeStyle = "rgba(198,227,108,0.55)";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    } else {
      // Fill the face
      ctx.fillStyle = `rgb(${fr},${fg},${fb})`;
      ctx.fill();

      if (renderMode === "faceted" || showWireframe) {
        // Faceted: always show edges to emphasise flat faces
        ctx.strokeStyle = renderMode === "faceted"
          ? "rgba(255,255,255,0.18)"
          : wireColor;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      // Smooth: no edge overlay → faces blend together
    }
  }

  // ─── Axes ──────────────────────────────────────────────────────────
  if (showAxes) {
    const axLen = 40;
    const [ox, oy] = project(0, 0, 0);
    const axes = [
      { dir: [axLen, 0, 0] as const, color: "#ef4444", label: "X" },
      { dir: [0, 0, axLen] as const, color: "#22c55e", label: "Y" },
      { dir: [0, axLen, 0] as const, color: "#3b82f6", label: "Z" },
    ];
    for (const { dir, color, label } of axes) {
      const [ex, ey] = project(dir[0] * 2, dir[1] * 2, dir[2] * 2);
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = "10px monospace";
      ctx.fillText(label, ex + 4, ey - 4);
    }
  }

  // ─── Stats overlay ─────────────────────────────────────────────────
  ctx.fillStyle = "rgba(198,227,108,0.6)";
  ctx.font = "10px monospace";
  ctx.fillText(`${polygons.length} faces`, 10, h - 10);
}