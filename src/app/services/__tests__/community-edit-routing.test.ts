/**
 * community-edit-routing tests — route parsing, mode detection, URL building.
 */
import { describe, it, expect } from "vitest";
import {
  parseCommunityRouteContext,
  getCommunityPublishMode,
  buildCommunityEditorRoute,
} from "../community-edit-routing";

describe("community-edit-routing", () => {
  describe("parseCommunityRouteContext", () => {
    it("parses valid edit intent", () => {
      const params = new URLSearchParams("intent=edit&modelId=cm_123");
      const ctx = parseCommunityRouteContext(params);
      expect(ctx).toEqual({ intent: "edit", modelId: "cm_123" });
    });

    it("parses valid fork intent", () => {
      const params = new URLSearchParams("intent=fork&modelId=cm_456");
      const ctx = parseCommunityRouteContext(params);
      expect(ctx).toEqual({ intent: "fork", modelId: "cm_456" });
    });

    it("returns null for missing intent", () => {
      const params = new URLSearchParams("modelId=cm_123");
      expect(parseCommunityRouteContext(params)).toBeNull();
    });

    it("returns null for invalid intent", () => {
      const params = new URLSearchParams("intent=delete&modelId=cm_123");
      expect(parseCommunityRouteContext(params)).toBeNull();
    });

    it("returns null for missing modelId", () => {
      const params = new URLSearchParams("intent=edit");
      expect(parseCommunityRouteContext(params)).toBeNull();
    });
  });

  describe("getCommunityPublishMode", () => {
    it("returns 'create' when no context", () => {
      expect(getCommunityPublishMode(null)).toBe("create");
    });

    it("returns 'edit' for edit intent", () => {
      expect(getCommunityPublishMode({ intent: "edit", modelId: "cm_1" })).toBe("edit");
    });

    it("returns 'fork' for fork intent", () => {
      expect(getCommunityPublishMode({ intent: "fork", modelId: "cm_1" })).toBe("fork");
    });
  });

  describe("buildCommunityEditorRoute", () => {
    it("builds /studio route for parametric models", () => {
      const route = buildCommunityEditorRoute(
        { id: "cm_1", modelType: "parametric" },
        "edit"
      );
      expect(route).toContain("/studio");
      expect(route).toContain("intent=edit");
      expect(route).toContain("modelId=cm_1");
    });

    it("builds /relief route for relief models", () => {
      const route = buildCommunityEditorRoute(
        { id: "cm_2", modelType: "relief" },
        "fork"
      );
      expect(route).toContain("/relief");
      expect(route).toContain("intent=fork");
      expect(route).toContain("modelId=cm_2");
    });
  });
});
