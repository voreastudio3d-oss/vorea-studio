/**
 * analytics service tests — isInternalRoute, trackAnalyticsEvent guards.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { isInternalRoute } from "../analytics";

describe("analytics", () => {
  describe("isInternalRoute", () => {
    it("returns true for /admin paths", () => {
      expect(isInternalRoute("/admin")).toBe(true);
      expect(isInternalRoute("/admin/users")).toBe(true);
    });

    it("returns true for /docs paths", () => {
      expect(isInternalRoute("/docs")).toBe(true);
      expect(isInternalRoute("/docs/api")).toBe(true);
    });

    it("returns true for locale-prefixed internal paths", () => {
      expect(isInternalRoute("/es/admin")).toBe(true);
      expect(isInternalRoute("/en/docs")).toBe(true);
      expect(isInternalRoute("/pt/admin/stats")).toBe(true);
    });

    it("returns false for public paths", () => {
      expect(isInternalRoute("/")).toBe(false);
      expect(isInternalRoute("/studio")).toBe(false);
      expect(isInternalRoute("/community")).toBe(false);
      expect(isInternalRoute("/plans")).toBe(false);
      expect(isInternalRoute("/relief")).toBe(false);
    });

    it("returns false for paths containing admin/docs as substring", () => {
      expect(isInternalRoute("/community/admin-model")).toBe(false);
      expect(isInternalRoute("/user/documentation")).toBe(false);
    });
  });
});
