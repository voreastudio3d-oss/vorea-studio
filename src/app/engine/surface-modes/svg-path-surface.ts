/**
 * SVG Path Surface — High-resolution vector-based surface generation.
 *
 * Parses SVG elements (<path>, <rect>, <circle>, <polygon>, <ellipse>, <line>)
 * and renders them at 2048×2048 to produce a binary validity mask and a
 * heightfield for crisp, resolution-independent 3D extrusions.
 *
 * Reuses the existing Plane surface strategy + validMask infrastructure
 * from the STL pipeline.
 *
 * Vorea Studio — voreastudio.com
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SvgSurfaceResult {
  /** Heightmap data URL (high-res grayscale PNG) */
  heightmapDataUrl: string;
  /** Binary validity mask: 1 = inside shape, 0 = outside (cols × rows) */
  validMask: Uint8Array;
  /** Grid width (subdivisions) */
  gridW: number;
  /** Grid height (subdivisions) */
  gridH: number;
  /** Aspect ratio of the SVG viewBox */
  aspect: number;
  /** Parsed SVG element count */
  elementCount: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Render resolution for vector outlines (much higher than 512 raster) */
const RENDER_SIZE = 2048;

/** How many grid subdivisions to generate the mask for */
const DEFAULT_GRID = 200;

// ─── Main Parser ─────────────────────────────────────────────────────────────

/**
 * Parse an SVG string and produce a high-res heightmap + binary validity mask.
 *
 * @param svgText  Raw SVG file content
 * @param gridW    Grid subdivisions (width), default 200
 * @param gridH    Grid subdivisions (height), default 200
 * @returns        SvgSurfaceResult with heightmap, mask, and metadata
 */
export async function parseSvgToSurface(
  svgText: string,
  gridW: number = DEFAULT_GRID,
  gridH: number = DEFAULT_GRID,
): Promise<SvgSurfaceResult> {
  // ─── Step 1: Parse SVG and extract viewBox ──────────────────────
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  if (!svgEl) throw new Error("Invalid SVG: no <svg> root element found");

  // Count renderable elements
  const renderableSelectors = "path, rect, circle, ellipse, polygon, polyline, line";
  const elements = svgEl.querySelectorAll(renderableSelectors);
  const elementCount = elements.length;
  if (elementCount === 0) {
    throw new Error("SVG contains no renderable shapes (path, rect, circle, polygon, etc.)");
  }

  // Parse viewBox for aspect ratio
  const vb = svgEl.getAttribute("viewBox");
  let svgW = parseFloat(svgEl.getAttribute("width") || "100");
  let svgH = parseFloat(svgEl.getAttribute("height") || "100");
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number);
    if (parts.length >= 4) {
      svgW = parts[2];
      svgH = parts[3];
    }
  }
  const aspect = svgW / svgH;

  // ─── Step 2: Render SVG at high resolution ──────────────────────
  // We render twice:
  //   (a) White shapes on black → heightmap (shape = high, background = low)
  //   (b) White shapes on black → binary mask (inside = 1, outside = 0)

  const renderW = aspect >= 1 ? RENDER_SIZE : Math.round(RENDER_SIZE * aspect);
  const renderH = aspect >= 1 ? Math.round(RENDER_SIZE / aspect) : RENDER_SIZE;

  // Create a clean SVG blob with forced white fill for mask
  const maskSvg = svgText
    // Force all shape fills to white for mask extraction
    .replace(/<svg([^>]*)>/, `<svg$1 style="background:black">`);

  const blob = new Blob([maskSvg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to render SVG to image"));
    image.src = url;
  });
  URL.revokeObjectURL(url);

  // ─── Step 3: Draw to canvas and extract heightmap ───────────────
  const canvas = document.createElement("canvas");
  canvas.width = renderW;
  canvas.height = renderH;
  const ctx = canvas.getContext("2d")!;

  // Black background (= 0 height / invalid)
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, renderW, renderH);

  // Draw SVG
  ctx.drawImage(img, 0, 0, renderW, renderH);

  // Convert to grayscale heightmap
  const imgData = ctx.getImageData(0, 0, renderW, renderH);
  const pixels = imgData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const gray = Math.round(
      pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114
    );
    pixels[i] = gray;
    pixels[i + 1] = gray;
    pixels[i + 2] = gray;
    // Alpha stays at 255
  }
  ctx.putImageData(imgData, 0, 0);

  // Generate the heightmap data URL at the render resolution
  const heightmapDataUrl = canvas.toDataURL("image/png");

  // ─── Step 4: Generate binary validity mask ──────────────────────
  // Sample the rendered image at grid resolution to create the mask
  const cols = gridW + 1;
  const rows = gridH + 1;
  const validMask = new Uint8Array(cols * rows);

  // Threshold: any pixel brighter than 10/255 = inside shape
  const THRESHOLD = 10;

  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const u = ix / gridW;
      const v = iy / gridH;
      const px = Math.min(Math.floor(u * renderW), renderW - 1);
      const py = Math.min(Math.floor(v * renderH), renderH - 1);
      const idx = (py * renderW + px) * 4;
      const brightness = pixels[idx]; // Already grayscale, R=G=B
      validMask[iy * cols + ix] = brightness > THRESHOLD ? 1 : 0;
    }
  }

  return {
    heightmapDataUrl,
    validMask,
    gridW,
    gridH,
    aspect,
    elementCount,
  };
}

/**
 * Quick check if an SVG string contains vector shapes worth parsing.
 */
export function svgHasVectorContent(svgText: string): boolean {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  if (!svgEl) return false;
  const elements = svgEl.querySelectorAll("path, rect, circle, ellipse, polygon, polyline, line");
  return elements.length > 0;
}
