import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  QualityProfile,
} from "../engine/instruction-spec";

export interface AiStudioState {
  prompt: string;
  selectedFamily: string;
  quality: QualityProfile;
  parameterOverridesByFamily: Record<string, Record<string, number | boolean | string>>;

  // Actions
  setPrompt: (prompt: string) => void;
  setSelectedFamily: (family: string) => void;
  setQuality: (quality: QualityProfile) => void;
  setParameterOverridesByFamily: (
    updater:
      | Record<string, Record<string, number | boolean | string>>
      | ((prev: Record<string, Record<string, number | boolean | string>>) => Record<string, Record<string, number | boolean | string>>)
  ) => void;
}

export const useAiStudioStore = create<AiStudioState>()(
  persist(
    (set) => ({
      prompt: "",
      selectedFamily: "storage-box",
      quality: "draft",
      parameterOverridesByFamily: {},

      setPrompt: (prompt) => set({ prompt }),
      setSelectedFamily: (selectedFamily) => set({ selectedFamily }),
      setQuality: (quality) => set({ quality }),
      setParameterOverridesByFamily: (updater) =>
        set((state) => ({
          parameterOverridesByFamily:
            typeof updater === "function" ? updater(state.parameterOverridesByFamily) : updater,
        })),
    }),
    {
      name: "vorea-ai-studio-workspace",
    }
  )
);
