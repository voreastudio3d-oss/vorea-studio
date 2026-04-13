import { describe, it, expect, beforeEach } from "vitest";
import { useAiStudioStore } from "../ai-studio-store";

describe("ai-studio-store", () => {
  beforeEach(() => {
    const { setState } = useAiStudioStore;
    setState({
      prompt: "",
      selectedFamily: "storage-box",
      quality: "draft",
      parameterOverridesByFamily: {},
    });
  });

  it("has correct default values", () => {
    const state = useAiStudioStore.getState();
    expect(state.prompt).toBe("");
    expect(state.selectedFamily).toBe("storage-box");
    expect(state.quality).toBe("draft");
    expect(state.parameterOverridesByFamily).toEqual({});
  });

  it("setPrompt updates prompt", () => {
    useAiStudioStore.getState().setPrompt("make a box");
    expect(useAiStudioStore.getState().prompt).toBe("make a box");
  });

  it("setSelectedFamily updates selectedFamily", () => {
    useAiStudioStore.getState().setSelectedFamily("lampshade");
    expect(useAiStudioStore.getState().selectedFamily).toBe("lampshade");
  });

  it("setQuality updates quality", () => {
    useAiStudioStore.getState().setQuality("production");
    expect(useAiStudioStore.getState().quality).toBe("production");
  });

  it("setParameterOverridesByFamily with object replaces overrides", () => {
    const overrides = { "storage-box": { width: 100, height: 50 } };
    useAiStudioStore.getState().setParameterOverridesByFamily(overrides);
    expect(useAiStudioStore.getState().parameterOverridesByFamily).toEqual(overrides);
  });

  it("setParameterOverridesByFamily with updater function merges overrides", () => {
    const initial = { "storage-box": { width: 100 } };
    useAiStudioStore.getState().setParameterOverridesByFamily(initial);

    useAiStudioStore.getState().setParameterOverridesByFamily((prev) => ({
      ...prev,
      lampshade: { radius: 40 },
    }));

    const result = useAiStudioStore.getState().parameterOverridesByFamily;
    expect(result["storage-box"]).toEqual({ width: 100 });
    expect(result.lampshade).toEqual({ radius: 40 });
  });

  it("multiple actions compose correctly", () => {
    const { setPrompt, setSelectedFamily, setQuality } = useAiStudioStore.getState();
    setPrompt("parametric vase");
    setSelectedFamily("vase");
    setQuality("balanced");

    const state = useAiStudioStore.getState();
    expect(state.prompt).toBe("parametric vase");
    expect(state.selectedFamily).toBe("vase");
    expect(state.quality).toBe("balanced");
  });
});
