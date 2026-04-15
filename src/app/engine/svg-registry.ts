/**
 * SVG Registry — Browser-side SVG storage for import() in SCAD.
 *
 * Users upload .svg files through the UI. The registry stores the raw
 * SVG text keyed by filename. The SCAD interpreter looks up SVGs by name
 * when evaluating import("filename.svg").
 */

// ─── Registry ─────────────────────────────────────────────────────────────────

const svgStore = new Map<string, string>();

/**
 * Register an SVG from raw text content.
 */
export function registerSvg(name: string, svgText: string): void {
  svgStore.set(name.toLowerCase(), svgText);
}

/**
 * Retrieve SVG text by filename.
 */
export function getSvg(name: string): string | null {
  return svgStore.get(name.toLowerCase()) || null;
}

/**
 * Check if an SVG is registered.
 */
export function hasSvg(name: string): boolean {
  return svgStore.has(name.toLowerCase());
}

/**
 * Get list of registered SVG filenames.
 */
export function getRegisteredSvgNames(): string[] {
  return Array.from(svgStore.keys());
}

/**
 * Remove an SVG from the registry.
 */
export function removeSvg(name: string): void {
  svgStore.delete(name.toLowerCase());
}

/**
 * Clear all registered SVGs.
 */
export function clearSvgs(): void {
  svgStore.clear();
}
