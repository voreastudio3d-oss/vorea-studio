import { describe, expect, it } from "vitest";
import {
  getRouteAccessLevel,
  getVisibleToolNavItems,
  isToolRouteActive,
  TOOL_NAV_ITEMS,
} from "../../route-access";

describe("route access policy", () => {
  it("classifies public, trial, auth and superadmin routes explicitly", () => {
    expect(getRouteAccessLevel("/")).toBe("public");
    expect(getRouteAccessLevel("/news/demo")).toBe("public");
    expect(getRouteAccessLevel("/ai-studio")).toBe("trial");
    expect(getRouteAccessLevel("/profile")).toBe("auth");
    expect(getRouteAccessLevel("/admin")).toBe("superadmin");
  });

  it("filters tool nav items by auth and role", () => {
    const guest = getVisibleToolNavItems({ isLoggedIn: false, isSuperAdmin: false });
    expect(guest.some((item) => item.route === "/gcode-collection")).toBe(false);

    const member = getVisibleToolNavItems({ isLoggedIn: true, isSuperAdmin: false });
    expect(member.some((item) => item.route === "/gcode-collection")).toBe(true);

    const superadmin = getVisibleToolNavItems({ isLoggedIn: true, isSuperAdmin: true });
    expect(superadmin.some((item) => item.route === "/gcode-collection")).toBe(true);
  });

  it("marks the studio tool active for /studio paths only", () => {
    const studioItem = TOOL_NAV_ITEMS.find((item) => item.route.includes("/studio"))!;
    expect(isToolRouteActive(studioItem, "/studio")).toBe(true);
    expect(isToolRouteActive(studioItem, "/parametric")).toBe(false);
  });
});
