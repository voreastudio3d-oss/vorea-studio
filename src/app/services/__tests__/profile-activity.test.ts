import { describe, expect, it } from "vitest";

import { formatActivityAge, getActivityLabel, getActivityTimestamp } from "../../profile-activity";

describe("profile activity helpers", () => {
  it("uses legacy and current timestamp fields", () => {
    expect(getActivityTimestamp({ at: "2026-03-23T17:00:00.000Z" })).toBe("2026-03-23T17:00:00.000Z");
    expect(getActivityTimestamp({ timestamp: "2026-03-23T17:00:00.000Z" })).toBe("2026-03-23T17:00:00.000Z");
    expect(getActivityTimestamp({ createdAt: "2026-03-23T17:00:00.000Z" })).toBe("2026-03-23T17:00:00.000Z");
    expect(getActivityTimestamp({})).toBeNull();
  });

  it("formats relative ages without NaN", () => {
    const now = new Date("2026-03-23T18:00:00.000Z").getTime();
    expect(formatActivityAge("2026-03-23T17:59:45.000Z", now)).toBe("0m");
    expect(formatActivityAge("2026-03-23T17:30:00.000Z", now)).toBe("30m");
    expect(formatActivityAge("2026-03-23T15:00:00.000Z", now)).toBe("3h");
    expect(formatActivityAge("2026-03-21T18:00:00.000Z", now)).toBe("2d");
    expect(formatActivityAge(null, now)).toBe("—");
    expect(formatActivityAge("nope", now)).toBe("—");
  });

  it("humanizes recent activity labels", () => {
    expect(getActivityLabel("community_image_uploaded")).toBe("Imagen de comunidad");
    expect(getActivityLabel("ai_history_saved")).toBe("Historial IA guardado");
    expect(getActivityLabel("unexpected_action")).toBe("Unexpected Action");
  });
});
