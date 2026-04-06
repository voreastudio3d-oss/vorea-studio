import { beforeEach, describe, expect, it } from "vitest";
import { clearSensitiveLocalStateOnLogout } from "../session-cleanup";

describe("clearSensitiveLocalStateOnLogout", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("removes sensitive local and session storage keys", () => {
    localStorage.setItem("vorea_user", "{}");
    localStorage.setItem("vorea_auth", "token");
    localStorage.setItem("vorea_models", "[]");
    localStorage.setItem("vorea_gcode_collection", "[]");
    localStorage.setItem("vorea_compilation_logs", "[]");
    localStorage.setItem("vorea_ai_studio_recipes:guest", "[]");
    localStorage.setItem("vorea_ai_studio_history:guest", "[]");
    localStorage.setItem("keep_me", "1");
    sessionStorage.setItem("vorea_current_model", "model_1");
    sessionStorage.setItem("vorea_credit_order", "order_1");

    clearSensitiveLocalStateOnLogout();

    expect(localStorage.getItem("vorea_user")).toBeNull();
    expect(localStorage.getItem("vorea_auth")).toBeNull();
    expect(localStorage.getItem("vorea_models")).toBeNull();
    expect(localStorage.getItem("vorea_gcode_collection")).toBeNull();
    expect(localStorage.getItem("vorea_compilation_logs")).toBeNull();
    expect(localStorage.getItem("vorea_ai_studio_recipes:guest")).toBeNull();
    expect(localStorage.getItem("vorea_ai_studio_history:guest")).toBeNull();
    expect(localStorage.getItem("keep_me")).toBe("1");
    expect(sessionStorage.getItem("vorea_current_model")).toBeNull();
    expect(sessionStorage.getItem("vorea_credit_order")).toBeNull();
  });
});
