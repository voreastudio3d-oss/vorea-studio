import "@testing-library/jest-dom/vitest";

// Polyfill SVG CSS properties for happy-dom / jsdom.
// Three.js SVGLoader accesses node.style['fill'] etc. via bracket notation.
// In real browsers these return '' when unset; in happy-dom they return undefined,
// which causes SVGLoader's addStyle() to crash ("undefined.startsWith is not a function").
if (typeof CSSStyleDeclaration !== "undefined") {
  const svgProps = [
    "fill", "fill-opacity", "fill-rule", "opacity",
    "stroke", "stroke-opacity", "stroke-width",
    "stroke-linejoin", "stroke-linecap", "stroke-miterlimit",
    "visibility",
  ];
  for (const prop of svgProps) {
    if (!(prop in CSSStyleDeclaration.prototype)) {
      Object.defineProperty(CSSStyleDeclaration.prototype, prop, {
        get() { return this.getPropertyValue(prop) || ""; },
        set(v: string) { this.setProperty(prop, v); },
        configurable: true,
      });
    }
  }
}

// Mock localStorage for happy-dom
const localStorageMock: Storage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});
