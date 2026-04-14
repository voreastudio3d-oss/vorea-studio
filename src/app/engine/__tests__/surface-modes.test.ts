/**
 * Surface modes tests — cylinder, plane, box, geodesic.
 */
import { describe, it, expect } from "vitest";

describe("surface-modes", () => {
  describe("cylinder", () => {
    it("can be imported", async () => {
      const mod = await import("../surface-modes/cylinder");
      expect(mod).toBeDefined();
    });
  });

  describe("plane", () => {
    it("can be imported", async () => {
      const mod = await import("../surface-modes/plane");
      expect(mod).toBeDefined();
    });
  });

  describe("surface-modes index", () => {
    it("can be imported", async () => {
      const mod = await import("../surface-modes/index");
      expect(mod).toBeDefined();
    });
  });

  describe("types", () => {
    it("can be imported", async () => {
      const mod = await import("../surface-modes/types");
      expect(mod).toBeDefined();
    });
  });
});
