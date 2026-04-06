/**
 * Image Registry — Browser-side image storage for surface() heightmaps.
 * 
 * Users upload PNG/JPG images through the UI. The registry stores them
 * as decoded pixel data (ImageData), keyed by filename. The SCAD interpreter
 * looks up images by name when evaluating surface("filename.png").
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DecodedImage {
  width: number;
  height: number;
  /** RGBA pixel data, row-major, 4 bytes per pixel */
  data: Uint8ClampedArray;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const imageStore = new Map<string, DecodedImage>();

/**
 * Register an image from a data URL (e.g. from FileReader.readAsDataURL).
 * Decodes the image into pixel data using an offscreen canvas.
 * Returns a promise that resolves when the image is decoded and stored.
 */
export async function registerImage(name: string, dataUrl: string): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Use offscreen canvas to decode pixels
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas 2D context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);

      const decoded: DecodedImage = {
        width: img.width,
        height: img.height,
        data: imageData.data,
      };

      imageStore.set(name.toLowerCase(), decoded);
      resolve(decoded);
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${name}`));
    img.src = dataUrl;
  });
}

/**
 * Register an image from raw pixel data (for use in workers or tests).
 */
export function registerImageData(name: string, decoded: DecodedImage): void {
  imageStore.set(name.toLowerCase(), decoded);
}

/**
 * Retrieve decoded image data by filename.
 */
export function getImage(name: string): DecodedImage | null {
  return imageStore.get(name.toLowerCase()) || null;
}

/**
 * Get list of registered image names.
 */
export function getRegisteredImageNames(): string[] {
  return Array.from(imageStore.keys());
}

/**
 * Check if an image is registered.
 */
export function hasImage(name: string): boolean {
  return imageStore.has(name.toLowerCase());
}

/**
 * Remove an image from the registry.
 */
export function removeImage(name: string): void {
  imageStore.delete(name.toLowerCase());
}

/**
 * Clear all registered images.
 */
export function clearImages(): void {
  imageStore.clear();
}

/**
 * Get brightness (0..1) at a pixel coordinate.
 * Uses average of R, G, B channels.
 */
export function getPixelBrightness(decoded: DecodedImage, x: number, y: number): number {
  const idx = (y * decoded.width + x) * 4;
  const r = decoded.data[idx];
  const g = decoded.data[idx + 1];
  const b = decoded.data[idx + 2];
  // Alpha channel ignored — fully transparent pixels treated as black
  const a = decoded.data[idx + 3];
  if (a === 0) return 0;
  return (r + g + b) / (3 * 255);
}

/**
 * Sample the image at normalized coordinates (0..1, 0..1) using bilinear interpolation.
 * Returns brightness (0..1).
 */
export function sampleBrightness(
  decoded: DecodedImage,
  u: number,
  v: number
): number {
  // Clamp to valid range
  u = Math.max(0, Math.min(1, u));
  v = Math.max(0, Math.min(1, v));

  const fx = u * (decoded.width - 1);
  const fy = v * (decoded.height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, decoded.width - 1);
  const y1 = Math.min(y0 + 1, decoded.height - 1);
  const dx = fx - x0;
  const dy = fy - y0;

  // Bilinear interpolation
  const b00 = getPixelBrightness(decoded, x0, y0);
  const b10 = getPixelBrightness(decoded, x1, y0);
  const b01 = getPixelBrightness(decoded, x0, y1);
  const b11 = getPixelBrightness(decoded, x1, y1);

  return (
    b00 * (1 - dx) * (1 - dy) +
    b10 * dx * (1 - dy) +
    b01 * (1 - dx) * dy +
    b11 * dx * dy
  );
}

/**
 * Get RGB (0..1 each) of a pixel at integer coordinates.
 */
export function getPixelColor(decoded: DecodedImage, x: number, y: number): [number, number, number] {
  const idx = (y * decoded.width + x) * 4;
  const a = decoded.data[idx + 3];
  if (a === 0) return [0, 0, 0];
  return [decoded.data[idx] / 255, decoded.data[idx + 1] / 255, decoded.data[idx + 2] / 255];
}

/**
 * Sample RGB at normalized coordinates (0..1) using bilinear interpolation.
 * Returns [r, g, b] each in 0..1.
 */
export function sampleColor(
  decoded: DecodedImage,
  u: number,
  v: number
): [number, number, number] {
  u = Math.max(0, Math.min(1, u));
  v = Math.max(0, Math.min(1, v));

  const fx = u * (decoded.width - 1);
  const fy = v * (decoded.height - 1);
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, decoded.width - 1);
  const y1 = Math.min(y0 + 1, decoded.height - 1);
  const dx = fx - x0, dy = fy - y0;

  const [r00, g00, b00] = getPixelColor(decoded, x0, y0);
  const [r10, g10, b10] = getPixelColor(decoded, x1, y0);
  const [r01, g01, b01] = getPixelColor(decoded, x0, y1);
  const [r11, g11, b11] = getPixelColor(decoded, x1, y1);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const bilerp = (v00: number, v10: number, v01: number, v11: number) =>
    lerp(lerp(v00, v10, dx), lerp(v01, v11, dx), dy);

  return [
    bilerp(r00, r10, r01, r11),
    bilerp(g00, g10, g01, g11),
    bilerp(b00, b10, b01, b11),
  ];
}

