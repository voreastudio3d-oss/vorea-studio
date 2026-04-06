/**
 * AI Studio v1 - Parametric Instruction Pipeline
 *
 * Flow:
 * Prompt -> InstructionSpecV1 -> SCAD -> Editor compile (draft/final profile)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { useNavigate } from "../nav";
import { useModel } from "../services/model-context";
import { useAuth } from "../services/auth-context";
import { useI18n } from "../services/i18n-context";
import { AiStudioHistoryApi, AiStudioRecipesApi, AiStudioCMSApi, AiStudioGenerateApi, type AiStudioFamilyApiRecord, type AiStudioPresetApiRecord } from "../services/api-client";
import {
  AiStudioHistory,
  type AiStudioHistoryEntry,
} from "../services/ai-studio-history";
import { AiStudioRecipes, type AiStudioRecipe } from "../services/ai-studio-recipes";
import { AuthDialog } from "../components/AuthDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "../components/ui/dialog";
import { trackAnalyticsEvent } from "../services/analytics";
import { toast } from "sonner";
import { fireReward } from "../services/reward-triggers";
import type {
  InstructionSpecV1,
  ParametricParameter,
  ParametricFamily,
  ParametricEngine,
  QualityProfile,
} from "../engine/instruction-spec";
import { PARAMETRIC_FAMILIES } from "../engine/instruction-spec";
import { runParametricPipeline } from "../engine/pipeline";
import { buildParameterBlueprint } from "../engine/spec-builder";
import { validateFdmSpec } from "../engine/validation";
import { useAiStudioStore } from "../store/ai-studio-store";
import {
  estimateCompilePreview,
  type CompilePreviewResult,
} from "../engine/compile-preview";
import {
  Sparkles,
  Cpu,
  Send,
  Loader2,
  ExternalLink,
  Wand2,
  Zap,
  Layers3,
  Save,
  Upload,
  Download,
  Trash2,
  RotateCcw,
  X,
  Wrench,
  Leaf,
  BookOpen,
  Info,
  History,
  Box,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface GenerationResult {
  id: string;
  prompt: string;
  engine: ParametricEngine;
  quality: QualityProfile;
  status: "generating" | "done" | "error";
  timestamp: string;
  createdAt: string;
  updatedAt?: string;
  familyHint?: ParametricFamily;
  parameterOverrides?: Record<string, number | string | boolean>;
  spec?: InstructionSpecV1;
  scadCode?: string;
  modelName?: string;
  validation?: ReturnType<typeof validateFdmSpec>;
  compilePreview?: CompilePreviewResult;
  error?: string;
}

interface EditableHistorySource {
  id: string;
  modelName: string;
  timestamp: string;
  familyHint: ParametricFamily;
}

interface PromptPreset {
  label: string;
  prompt: string;
  engine: ParametricEngine;
  quality: QualityProfile;
  familyHint: ParametricFamily;
}

const EXAMPLES: Record<ParametricEngine, string[]> = {
  fdm: [
    "studio.ai.example.fdm.1",
    "studio.ai.example.fdm.2",
    "studio.ai.example.fdm.3",
  ],
  organic: [
    "studio.ai.example.org.1",
    "studio.ai.example.org.2",
    "studio.ai.example.org.3",
  ],
};

function getStringOverrideLimit(family: string, parameter: ParametricParameter): number {
  if (parameter.type !== "string") return 24;
  if (parameter.name !== "label_text") return 24;

  switch (family) {
    case "text-keychain-tag":
      return 28;
    case "nameplate-pro":
      return 42;
    case "peg-label-system":
      return 34;
    default:
      return 24;
  }
}

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatHistoryTimestamp(dateLike: string): string {
  return new Date(dateLike).toLocaleTimeString("es-LA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSameLocalDay(dateLike: string, now: Date): boolean {
  const value = new Date(dateLike);
  return (
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate()
  );
}

function mapHistoryEntryToGenerationResult(entry: AiStudioHistoryEntry): GenerationResult {
  return {
    id: entry.id,
    prompt: entry.prompt,
    engine: entry.engine,
    quality: entry.quality,
    status: "done",
    timestamp: formatHistoryTimestamp(entry.updatedAt),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    familyHint: entry.familyHint,
    parameterOverrides: entry.parameterOverrides,
    spec: entry.spec,
    scadCode: entry.scadCode,
    modelName: entry.modelName,
    validation: entry.validation,
    compilePreview: entry.compilePreview,
  };
}

export function AIStudio() {
  const navigate = useNavigate();
  const model = useModel();
  const { isLoggedIn, user } = useAuth();
  const { t, locale } = useI18n();

  const engine: ParametricEngine = "fdm";
  const {
    prompt,
    setPrompt,
    selectedFamily,
    setSelectedFamily,
    quality,
    setQuality,
    parameterOverridesByFamily,
    setParameterOverridesByFamily,
  } = useAiStudioStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState("");
  const [history, setHistory] = useState<GenerationResult[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const regenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generatingMsgTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const [savedRecipes, setSavedRecipes] = useState<AiStudioRecipe[]>([]);
  const [recipesOpen, setRecipesOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [editingHistorySource, setEditingHistorySource] = useState<EditableHistorySource | null>(null);

  const tier = user?.tier ?? "FREE";
  const dailyLimit = tier === "STUDIO PRO" ? Infinity : tier === "PRO" ? 20 : 5;
  const todayCount = history.filter(
    (entry) => entry.status === "done" && isSameLocalDay(entry.createdAt, new Date())
  ).length;
  const canGenerate = isLoggedIn && todayCount < dailyLimit;

  const [serverFamilies, setServerFamilies] = useState<AiStudioFamilyApiRecord[]>([]);
  const [serverPresets, setServerPresets] = useState<AiStudioPresetApiRecord[]>([]);

  const getFamilyLabel = useCallback((slug: string) => {
    return serverFamilies.find((f) => f.slug === slug)?.nameEs || slug;
  }, [serverFamilies]);

  useEffect(() => {
    let active = true;
    Promise.all([
      AiStudioCMSApi.getFamilies(),
      AiStudioCMSApi.getPresets()
    ]).then(([fams, pres]) => {
      if (active) {
        setServerFamilies(fams);
        setServerPresets(pres);
      }
    });
    return () => { active = false; };
  }, []);

  const activeExamples = useMemo(() => EXAMPLES[engine], [engine]);
  const activePresets = useMemo(
    () => serverPresets.filter((preset) => {
      const parent = serverFamilies.find(f => f.id === preset.familyId);
      return parent?.engine === engine;
    }).map((preset): PromptPreset => {
       const parent = serverFamilies.find(f => f.id === preset.familyId)!;
       const isEn = locale.startsWith("en");
       return {
         label: isEn ? preset.labelEn : preset.labelEs,
         prompt: isEn ? preset.promptEn : preset.promptEs,
         engine: parent.engine as ParametricEngine,
         quality: "draft",
         familyHint: parent.slug
       };
    }),
    [serverPresets, serverFamilies, engine, locale]
  );
  const activeFamilies = useMemo(
    () => serverFamilies.filter((f) => f.engine === engine).map(f => f.slug),
    [serverFamilies, engine]
  );
  const useRemoteRecipes = isLoggedIn;
  const useRemoteHistory = isLoggedIn;
  const recipeOwnerKey = user?.id || "guest";
  const historyOwnerKey = user?.id || "guest";
  const selectedFamilyKey = `${engine}:${selectedFamily}`;
  const selectedOverrides = parameterOverridesByFamily[selectedFamilyKey] || {};
  const parameterControls = useMemo(() => {
    const familyRecord = serverFamilies.find((f) => f.slug === selectedFamily);
    if (!familyRecord || !familyRecord.parameters) return [];

    if (Array.isArray(familyRecord.parameters)) {
      return familyRecord.parameters.filter((p: any) => p.name !== "quality_level").map((p: any) => ({
        ...p,
        defaultValue: p.defaultValue ?? p.default
      })) as ParametricParameter[];
    }

    return Object.entries(familyRecord.parameters)
      .filter(([name]) => name !== "quality_level")
      .map(([name, schema]: [string, any]) => ({
        name,
        ...schema,
        defaultValue: schema.defaultValue ?? schema.default,
      })) as ParametricParameter[];
  }, [serverFamilies, selectedFamily]);
  const latestEntryForSelection = useMemo(
    () =>
      history.find(
        (entry) => entry.status === "done" && entry.engine === engine && entry.spec?.family === selectedFamily
      ),
    [engine, history, selectedFamily]
  );
  const selectedRecipe = useMemo(
    () => savedRecipes.find((recipe) => recipe.id === selectedRecipeId) || null,
    [savedRecipes, selectedRecipeId]
  );

  const loadRecipes = useCallback(async (): Promise<AiStudioRecipe[]> => {
    if (useRemoteRecipes) {
      try {
        return (await AiStudioRecipesApi.list()) as unknown as AiStudioRecipe[];
      } catch {
        return AiStudioRecipes.list(recipeOwnerKey);
      }
    }
    return AiStudioRecipes.list(recipeOwnerKey);
  }, [recipeOwnerKey, useRemoteRecipes]);

  const loadHistory = useCallback(async (): Promise<GenerationResult[]> => {
    if (useRemoteHistory) {
      try {
        const entries = await AiStudioHistoryApi.list();
        return entries.map((entry) =>
          mapHistoryEntryToGenerationResult(entry as unknown as AiStudioHistoryEntry)
        );
      } catch {
        return AiStudioHistory.list(historyOwnerKey).map(mapHistoryEntryToGenerationResult);
      }
    }
    return AiStudioHistory.list(historyOwnerKey).map(mapHistoryEntryToGenerationResult);
  }, [historyOwnerKey, useRemoteHistory]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const recipes = await loadRecipes();
      if (cancelled) return;
      setSavedRecipes(recipes);
      setSelectedRecipeId((prev) => {
        if (prev && recipes.some((recipe) => recipe.id === prev)) return prev;
        return recipes[0]?.id || "";
      });
      setRecipeName((prev) => {
        if (prev.trim()) return prev;
        return recipes[0]?.name || "";
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRecipes]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const entries = await loadHistory();
      if (cancelled) return;
      setHistory(entries);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadHistory]);

  const buildRecipePayload = useCallback(() => {
    const fallbackPrompt = latestEntryForSelection?.prompt || "";
    return {
      name: recipeName.trim() || `${getFamilyLabel(selectedFamily)} Recipe`,
      prompt: (prompt.trim() || fallbackPrompt).trim(),
      engine,
      quality,
      familyHint: selectedFamily,
      parameterOverrides: selectedOverrides,
    };
  }, [
    engine,
    latestEntryForSelection?.prompt,
    prompt,
    quality,
    recipeName,
    selectedFamily,
    selectedOverrides,
  ]);

  const applyRecipe = useCallback((recipe: AiStudioRecipe, options?: { silent?: boolean }) => {
    setQuality(recipe.quality);
    setSelectedFamily(recipe.familyHint);
    setPrompt(recipe.prompt);
    const targetKey = `${recipe.engine}:${recipe.familyHint}`;
    setParameterOverridesByFamily((prev) => ({
      ...prev,
      [targetKey]: recipe.parameterOverrides || {},
    }));
    setSelectedRecipeId(recipe.id);
    setRecipeName(recipe.name);
    setEditingHistorySource(null);
    if (!options?.silent) {
      toast.success(t("studio.ai.toast.recipeLoaded", { name: recipe.name }));
    }
  }, [t]);

  const refreshRecipes = useCallback(async () => {
    const recipes = await loadRecipes();
    setSavedRecipes(recipes);
    if (selectedRecipeId && !recipes.some((recipe) => recipe.id === selectedRecipeId)) {
      setSelectedRecipeId(recipes[0]?.id || "");
    }
  }, [loadRecipes, selectedRecipeId]);

  const persistHistoryEntry = useCallback(
    async (entry: GenerationResult) => {
      if (
        entry.status !== "done" ||
        !entry.spec ||
        !entry.scadCode ||
        !entry.modelName ||
        !entry.validation ||
        !entry.compilePreview
      ) {
        return;
      }

      const payload = {
        id: entry.id,
        prompt: entry.prompt,
        engine: entry.engine,
        quality: entry.quality,
        modelName: entry.modelName,
        scadCode: entry.scadCode,
        familyHint: entry.familyHint,
        parameterOverrides: entry.parameterOverrides,
        spec: entry.spec,
        validation: entry.validation,
        compilePreview: entry.compilePreview,
      };

      try {
        if (useRemoteHistory) {
          await AiStudioHistoryApi.save(payload);
        } else {
          AiStudioHistory.save(historyOwnerKey, payload, entry.id);
        }
      } catch (error: any) {
        toast.warning(error?.message || t("studio.ai.toast.historySyncFailed"));
      }
    },
    [historyOwnerKey, useRemoteHistory, t]
  );

  const handleDeleteHistoryEntry = useCallback(
    async (entry: GenerationResult) => {
      try {
        if (entry.status === "done") {
          if (useRemoteHistory) {
            await AiStudioHistoryApi.remove(entry.id);
          } else {
            AiStudioHistory.remove(historyOwnerKey, entry.id);
          }
        }

        setHistory((prev) => prev.filter((item) => item.id !== entry.id));
        toast.success(t("studio.ai.toast.historyEntryDeleted"));
      } catch (error: any) {
        toast.error(error?.message || t("studio.ai.toast.historyEntryDeleteFailed"));
      }
    },
    [historyOwnerKey, useRemoteHistory, t]
  );

  const handleSaveRecipe = useCallback(async () => {
    try {
      const payload = buildRecipePayload();
      if (!payload.prompt) {
        toast.error(t("studio.ai.toast.recipeNeedsPrompt"));
        return;
      }
      const saved = useRemoteRecipes
        ? ((await AiStudioRecipesApi.save({
            ...payload,
            id: selectedRecipeId || undefined,
          })) as unknown as AiStudioRecipe)
        : AiStudioRecipes.save(recipeOwnerKey, payload, selectedRecipeId || undefined);
      await refreshRecipes();
      setSelectedRecipeId(saved.id);
      setRecipeName(saved.name);
      toast.success(t("studio.ai.toast.recipeSaved", { name: saved.name }));
    } catch (error: any) {
      toast.error(error?.message || t("studio.ai.toast.recipeSaveFailed"));
    }
  }, [buildRecipePayload, recipeOwnerKey, refreshRecipes, selectedRecipeId, useRemoteRecipes, t]);

  const handleDeleteRecipe = useCallback(async () => {
    try {
      if (!selectedRecipe) {
        toast.error(t("studio.ai.toast.recipeDeleteSelect"));
        return;
      }
      if (useRemoteRecipes) {
        await AiStudioRecipesApi.remove(selectedRecipe.id);
      } else {
        AiStudioRecipes.remove(recipeOwnerKey, selectedRecipe.id);
      }
      await refreshRecipes();
      setSelectedRecipeId("");
      toast.success(t("studio.ai.toast.recipeDeleted", { name: selectedRecipe.name }));
    } catch (error: any) {
      toast.error(error?.message || t("studio.ai.toast.recipeDeleteFailed"));
    }
  }, [recipeOwnerKey, refreshRecipes, selectedRecipe, useRemoteRecipes, t]);

  const handleExportRecipe = useCallback(async () => {
    const payload = selectedRecipe
      ? {
          name: selectedRecipe.name,
          prompt: selectedRecipe.prompt,
          engine: selectedRecipe.engine,
          quality: selectedRecipe.quality,
          familyHint: selectedRecipe.familyHint,
          parameterOverrides: selectedRecipe.parameterOverrides,
        }
      : buildRecipePayload();

    if (!payload.prompt) {
      toast.error(t("studio.ai.toast.recipeExportEmpty"));
      return;
    }

    const json = AiStudioRecipes.toExportJson(payload);
    const fileName = `${payload.engine}-${payload.familyHint}-recipe.json`;

    try {
      await navigator.clipboard.writeText(json);
      toast.success(t("studio.ai.toast.recipeCopied"));
    } catch {
      // ignore clipboard issues
    }

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [buildRecipePayload, selectedRecipe]);

  const handleImportRecipe = useCallback(async (file: File) => {
    try {
      const raw = await file.text();
      const parsed = AiStudioRecipes.parseFromJson(raw);
      if (!parsed) {
        toast.error(t("studio.ai.toast.recipeInvalid"));
        return;
      }
      const saved = useRemoteRecipes
        ? ((await AiStudioRecipesApi.save(parsed)) as unknown as AiStudioRecipe)
        : AiStudioRecipes.save(recipeOwnerKey, parsed);
      await refreshRecipes();
      applyRecipe(saved);
    } catch (error: any) {
      toast.error(error?.message || t("studio.ai.toast.recipeImportFailed"));
    }
  }, [applyRecipe, recipeOwnerKey, refreshRecipes, useRemoteRecipes, t]);

  const runGeneration = useCallback(
    async (
      text: string,
      options?: {
        replaceEntryId?: string;
        clearPrompt?: boolean;
        silentSuccess?: boolean;
        overrides?: Record<string, number | string | boolean>;
        engine?: ParametricEngine;
        quality?: QualityProfile;
        familyHint?: ParametricFamily;
      }
    ) => {
      if (!text || isGenerating) return;

      if (!isLoggedIn) {
        setAuthOpen(true);
        return;
      }

      if (!options?.replaceEntryId && !canGenerate) {
        toast.error(t("studio.ai.toast.dailyLimitReached"));
        return;
      }

      const id = options?.replaceEntryId || nextId();
      const existingEntry = options?.replaceEntryId
        ? history.find((entry) => entry.id === options.replaceEntryId)
        : undefined;
      const effectiveEngine = options?.engine ?? engine;
      const effectiveQuality = options?.quality ?? quality;
      const effectiveFamily = options?.familyHint ?? selectedFamily;
      const effectiveOverrides = { ...(options?.overrides ?? selectedOverrides) };
      const nowIso = new Date().toISOString();
      const pending: GenerationResult = {
        id,
        prompt: text,
        engine: effectiveEngine,
        quality: effectiveQuality,
        status: "generating",
        timestamp: formatHistoryTimestamp(nowIso),
        createdAt: existingEntry?.createdAt || nowIso,
        updatedAt: nowIso,
        familyHint: effectiveFamily,
        parameterOverrides: effectiveOverrides,
      };

      setIsGenerating(true);
      if (options?.clearPrompt) setPrompt("");
      setHistory((prev) =>
        options?.replaceEntryId ? prev.map((entry) => (entry.id === id ? { ...entry, ...pending } : entry)) : [pending, ...prev]
      );

      // Progressive loading messages
      const loadingMessages = [
        "Analizando tu idea...",
        "Generando geometría paramétrica...",
        "Construyendo código SCAD...",
        "Validando modelo 3D...",
        "Optimizando para impresión FDM...",
      ];
      let msgIndex = 0;
      setGeneratingMessage(loadingMessages[0]);
      if (generatingMsgTimerRef.current) clearInterval(generatingMsgTimerRef.current);
      generatingMsgTimerRef.current = setInterval(() => {
        msgIndex = Math.min(msgIndex + 1, loadingMessages.length - 1);
        setGeneratingMessage(loadingMessages[msgIndex]);
      }, 2500);

      try {
        // ── Try LLM backend first ──────────────────────────────────
        const llmResponse = await AiStudioGenerateApi.generate({
          prompt: text,
          engine: effectiveEngine,
          familySlug: effectiveFamily,
          quality: effectiveQuality,
          parameterOverrides: Object.keys(effectiveOverrides).length > 0 ? effectiveOverrides : undefined,
        });

        const llmResult = llmResponse.result;
        const resolvedFamily = llmResponse.contract.normalized.resolvedFamilySlug as ParametricFamily;
        const resolvedOverrides = llmResponse.contract.normalized.parameterOverrides;
        const editorSpec = llmResponse.contract.editor.spec;
        const validation = validateFdmSpec(editorSpec);
        const compilePreview = estimateCompilePreview(llmResult.scadCode, effectiveQuality);
        const completed: GenerationResult = {
          ...pending,
          status: "done",
          spec: editorSpec,
          modelName: llmResult.modelName,
          scadCode: llmResult.scadCode,
          validation,
          compilePreview,
          updatedAt: new Date().toISOString(),
          familyHint: resolvedFamily,
          parameterOverrides: resolvedOverrides,
        };

        setHistory((prev) =>
          prev.map((entry) =>
            entry.id === id ? completed : entry
          )
        );
        void persistHistoryEntry(completed);
        setEditingHistorySource(null);

        if (!options?.silentSuccess) {
          if (!validation.valid) {
            toast.warning(t("studio.ai.toast.validationWarnings"));
          } else if (compilePreview.level === "heavy") {
            toast.warning(t("studio.ai.toast.heavyCompile"));
          } else {
            const creditsMsg = llmResponse.usage.creditsConsumed > 0
              ? ` (${llmResponse.usage.creditsConsumed} créditos)`
              : "";
            toast.success(t("studio.ai.toast.modelGenerated", { name: llmResult.modelName }) + creditsMsg);
            fireReward("ai_generation");
            trackAnalyticsEvent("ai_generate", {
              tool: "ai_studio",
              engine: effectiveEngine,
              family: resolvedFamily,
              quality: effectiveQuality,
              source: "llm",
            });
          }
        }
      } catch (llmError: any) {
        // ── Fallback to local pipeline if LLM fails ──────────────────
        console.warn("[AIStudio] LLM generation failed, falling back to local pipeline:", llmError.message);

        try {
          const result = runParametricPipeline({
            prompt: text,
            engine: effectiveEngine,
            qualityProfile: effectiveQuality,
            familyHint: effectiveFamily,
            parameterOverrides: effectiveOverrides,
            scadTemplate: serverFamilies.find(f => f.slug === effectiveFamily)?.scadTemplate || undefined,
            parametersBlueprint: serverFamilies.find(f => f.slug === effectiveFamily)?.parameters as any || undefined,
          });

          const validation = validateFdmSpec(result.spec);
          const compilePreview = estimateCompilePreview(result.output.scad, effectiveQuality);
          const completed: GenerationResult = {
            ...pending,
            status: "done",
            spec: result.spec,
            modelName: result.output.modelName,
            scadCode: result.output.scad,
            validation,
            compilePreview,
            updatedAt: new Date().toISOString(),
            familyHint: effectiveFamily,
            parameterOverrides: effectiveOverrides,
          };

          setHistory((prev) =>
            prev.map((entry) =>
              entry.id === id ? completed : entry
            )
          );
          void persistHistoryEntry(completed);
          setEditingHistorySource(null);

          if (!options?.silentSuccess) {
            toast.info(`Generado con pipeline local (IA no disponible: ${llmError.message})`);
            fireReward("ai_generation");
            trackAnalyticsEvent("ai_generate", { tool: "ai_studio", engine: effectiveEngine, family: effectiveFamily, quality: effectiveQuality, source: "local" });
          }
        } catch (localError: any) {
          const message = localError?.message || t("studio.ai.toast.generateError");
          setHistory((prev) =>
            prev.map((entry) =>
              entry.id === id ? { ...entry, status: "error", error: message } : entry
            )
          );
          toast.error(message);
        }
      } finally {
        setIsGenerating(false);
        setGeneratingMessage("");
        if (generatingMsgTimerRef.current) {
          clearInterval(generatingMsgTimerRef.current);
          generatingMsgTimerRef.current = null;
        }
      }
    },
    [
      canGenerate,
      engine,
      isGenerating,
      isLoggedIn,
      quality,
      selectedFamily,
      selectedOverrides,
      persistHistoryEntry,
      history,
      serverFamilies,
      t
    ]
  );

  const handleLoadAndGenerateRecipe = useCallback(() => {
    if (!selectedRecipe) {
      toast.error(t("studio.ai.toast.recipeLoadGenerateSelect"));
      return;
    }
    applyRecipe(selectedRecipe, { silent: true });
    runGeneration(selectedRecipe.prompt, {
      overrides: selectedRecipe.parameterOverrides,
      engine: selectedRecipe.engine,
      quality: selectedRecipe.quality,
      familyHint: selectedRecipe.familyHint,
    });
  }, [applyRecipe, runGeneration, selectedRecipe]);

  const handleGenerate = useCallback(() => {
    const text = prompt.trim();
    if (!text) return;
    runGeneration(text, { clearPrompt: true });
  }, [prompt, runGeneration]);

  const handleReapplyHistoryEntry = useCallback((entry: GenerationResult) => {
    if (entry.status !== "done" || !entry.familyHint) return;
    const targetKey = `${entry.engine}:${entry.familyHint}`;
    const overrides = { ...(entry.parameterOverrides || {}) };

    setQuality(entry.quality);
    setPrompt(entry.prompt);
    setSelectedFamily(entry.familyHint!);
    setParameterOverridesByFamily((prev) => ({
      ...prev,
      [targetKey]: overrides,
    }));
    setEditingHistorySource({
      id: entry.id,
      modelName: entry.modelName || "Modelo Parametrico",
      timestamp: entry.timestamp,
      familyHint: entry.familyHint,
    });
    toast.success(t("studio.ai.toast.historyRestored"));
  }, [t]);

  const triggerAutoRegeneration = useCallback(
    (overrides: Record<string, number | string | boolean>) => {
      if (!latestEntryForSelection || isGenerating || editingHistorySource) return;
      if (regenTimerRef.current) {
        clearTimeout(regenTimerRef.current);
      }
      regenTimerRef.current = setTimeout(() => {
        runGeneration(latestEntryForSelection.prompt, {
          replaceEntryId: latestEntryForSelection.id,
          silentSuccess: true,
          overrides,
        });
      }, 280);
    },
    [editingHistorySource, isGenerating, latestEntryForSelection, runGeneration]
  );

  const updateNumericOverride = useCallback(
    (parameter: ParametricParameter, rawValue: string) => {
      const value = Number(rawValue);
      if (!Number.isFinite(value)) return;
      const min = typeof parameter.min === "number" ? parameter.min : value;
      const max = typeof parameter.max === "number" ? parameter.max : value;
      const clamped = Math.min(max, Math.max(min, value));
      const nextOverrides = {
        ...selectedOverrides,
        [parameter.name]: clamped,
      };
      setParameterOverridesByFamily((prev) => ({
        ...prev,
        [selectedFamilyKey]: nextOverrides,
      }));
      triggerAutoRegeneration(nextOverrides);
    },
    [selectedFamilyKey, selectedOverrides, triggerAutoRegeneration]
  );

  const updateStringOverride = useCallback(
    (parameter: ParametricParameter, rawValue: string) => {
      const stringLimit = getStringOverrideLimit(selectedFamily, parameter);
      const nextOverrides = {
        ...selectedOverrides,
        [parameter.name]: rawValue.replace(/\r?\n/g, " ").slice(0, stringLimit),
      };
      setParameterOverridesByFamily((prev) => ({
        ...prev,
        [selectedFamilyKey]: nextOverrides,
      }));
      triggerAutoRegeneration(nextOverrides);
    },
    [selectedFamily, selectedFamilyKey, selectedOverrides, triggerAutoRegeneration]
  );

  const updateBooleanOverride = useCallback(
    (parameter: ParametricParameter, checked: boolean) => {
      const nextOverrides = {
        ...selectedOverrides,
        [parameter.name]: checked,
      };
      setParameterOverridesByFamily((prev) => ({
        ...prev,
        [selectedFamilyKey]: nextOverrides,
      }));
      triggerAutoRegeneration(nextOverrides);
    },
    [selectedFamilyKey, selectedOverrides, triggerAutoRegeneration]
  );

  const resetFamilyOverrides = useCallback(() => {
    setParameterOverridesByFamily((prev) => {
      const next = { ...prev };
      delete next[selectedFamilyKey];
      return next;
    });
    triggerAutoRegeneration({});
  }, [selectedFamilyKey, triggerAutoRegeneration]);

  const handleOpenInEditor = useCallback(
    (entry: GenerationResult) => {
      if (!entry.scadCode) return;
      model.setScadSource(entry.scadCode, entry.modelName || t("studio.ai.fallback.modelName"));
      if (entry.parameterOverrides) {
        model.setParamValues(entry.parameterOverrides as Record<string, number | boolean | string | number[]>);
      }
      navigate("/studio");
      toast.success(t("studio.ai.toast.modelLoaded"));
    },
    [model, navigate, t]
  );

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-[#111318]">
      {/* HEADER */}
      <div className="border-b border-[rgba(168,187,238,0.12)] bg-[#1A1C23]">
        <div className="max-w-[1600px] w-full mx-auto px-6 py-8 flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-4">
            AI Studio - FDM
          </h1>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-[rgba(0,0,0,0.3)] rounded-full p-1 border border-[rgba(255,255,255,0.05)]">
              {(["draft", "final"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setQuality(value)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    quality === value
                      ? "bg-purple-500/20 text-purple-300 shadow-sm"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {value === "draft" ? "Draft Quality" : "Final Quality"}
                </button>
              ))}
            </div>

            <div className="bg-[#59A123]/20 border border-[#80E220]/50 shadow-[0_0_20px_rgba(128,226,32,0.4)] px-4 py-2 rounded-xl text-[#80E220] font-black tracking-wide flex items-center gap-2">
              <Zap className="w-5 h-5" /> +15 XP
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-10 px-4 bg-[rgba(26,31,54,0.6)] border-[rgba(168,187,238,0.15)] text-gray-400 hover:text-white hover:bg-[rgba(168,187,238,0.05)] transition-colors gap-2"
                onClick={() => setRecipesOpen(true)}
              >
                <BookOpen className="w-4 h-4 text-[#80E220]" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 bg-[rgba(26,31,54,0.6)] border-[rgba(168,187,238,0.15)] text-gray-400 hover:text-white"
                onClick={() => setPipelineOpen(true)}
              >
                <Info className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-8 flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
          
          {/* LEFT COLUMN: 8/12 */}
          <div className="lg:col-span-8 flex flex-col gap-10">
            
            {/* Modelos base */}
            <div className="rounded-3xl border border-[rgba(168,187,238,0.12)] bg-[rgba(30,34,45,0.6)] p-6 backdrop-blur-sm">
              <div className="flex gap-4">
                <div className="flex-1 mb-4 border-b border-[rgba(255,255,255,0.05)] pb-4">
                  <h3 className="text-sm font-bold text-white mb-1">Vorea FDM Engine</h3>
                  <p className="text-[11px] text-gray-400">Motor paramétrico de precisión estructurado para impresión 3D</p>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 bg-[rgba(0,0,0,0.3)] px-2 py-1 rounded">Experimental</span>
                </div>
              </div>

              <p className="text-base text-white mb-4">Modelos base para la IA:</p>
              <div className="relative flex items-center gap-2">
                <button className="h-24 w-10 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] rounded-2xl flex items-center justify-center border border-[rgba(255,255,255,0.1)] text-white shrink-0">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                
                <div className="flex-1 overflow-x-auto flex gap-4 hide-scrollbar snap-x pb-2">
                  {activeFamilies.map((family) => {
                    const familyRecord = serverFamilies.find(f => f.slug === family);
                    return (
                    <div
                      key={family}
                      onClick={() => {
                        setSelectedFamily(family as ParametricFamily);
                        setParameterOverridesByFamily({
                          ...parameterOverridesByFamily,
                          [`${engine}:${family}`]: {}
                        });
                        setSelectedRecipeId("");
                        
                        // Autofill default prompt for the family to avoid empty input validation
                        const firstPreset = activePresets.find(p => p.familyHint === family);
                        if (firstPreset) {
                          setPrompt(t(firstPreset.prompt));
                        } else {
                          const desc = locale.startsWith('en') ? familyRecord?.descriptionEn : familyRecord?.descriptionEs;
                          setPrompt(desc || "");
                        }
                      }}
                      className={`relative shrink-0 w-28 h-28 rounded-2xl cursor-pointer transition-all border-4 snap-center overflow-hidden group ${
                        selectedFamily === family 
                          ? "border-[#80E220] scale-105 shadow-[0_0_20px_rgba(128,226,32,0.3)]" 
                          : "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.2)]"
                      }`}
                    >
                      {/* Optional Background Image */}
                      {familyRecord?.imageUrl && (
                        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-110">
                           <img src={familyRecord.imageUrl} alt={family} className="w-full h-full object-cover opacity-60" />
                           <div className="absolute inset-0 bg-gradient-to-t from-[#0C101A] to-transparent opacity-80" />
                        </div>
                      )}

                      <div className="relative z-10 w-full h-full bg-[rgba(255,255,255,0.02)] rounded-xl flex flex-col items-center justify-center p-2 text-center text-shadow-sm">
                        {!familyRecord?.imageUrl && (
                          <Box className={`w-8 h-8 mb-2 ${selectedFamily === family ? "text-[#80E220]" : "text-gray-500"}`} />
                        )}
                        <span className={`text-[12px] font-semibold leading-tight mt-auto drop-shadow-lg ${selectedFamily === family ? "text-[#80E220]" : "text-white"}`}>{t(getFamilyLabel(family))}</span>
                      </div>
                    </div>
                  )})}
                </div>

                <button className="h-24 w-10 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] rounded-2xl flex items-center justify-center border border-[rgba(255,255,255,0.1)] text-white shrink-0">
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Genera con IA */}
            <div>
              <h2 className="text-3xl font-bold text-white mb-4">Genera con IA</h2>
              <div className="rounded-[2rem] border border-[rgba(168,187,238,0.12)] bg-[#161923] p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#80E220]/5 to-transparent pointer-events-none" />
                
                <div className="relative z-10">
                  <div className="mb-6 flex flex-wrap gap-2 items-center">
                    <span className="text-[12px] font-bold text-[#161923] bg-[#80E220] px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(128,226,32,0.4)]">
                      {t(getFamilyLabel(selectedFamily))}
                    </span>
                    {parameterControls.map(p => {
                      const val = selectedOverrides[p.name] ?? p.defaultValue;
                      if (typeof val === "boolean" && !val) return null;
                      return (
                        <span key={p.name} className="flex items-center gap-1.5 text-[11px] font-mono text-gray-300 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] px-3 py-1.5 rounded-full hover:border-[#80E220]/50 transition-colors">
                          <span className="text-gray-500">{p.name}:</span>
                          <span className="text-white font-bold">{typeof val === "boolean" ? "Yes" : val}</span>
                        </span>
                      )
                    })}
                  </div>
                  
                  <p className="text-[13px] text-[#A8BBEE] mb-4 italic">
                    {t("studio.ai.prompt.injectionInfo", { defaultValue: "✨ Describe los detalles o grabados adicionales encima de tus medidas base." })}
                  </p>

                  <div className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#0C0E14] focus-within:border-[#80E220]/50 focus-within:shadow-[0_0_30px_rgba(128,226,32,0.15)] transition-all p-2 relative">
                    
                    {editingHistorySource && (
                      <div className="mb-2 flex items-start justify-between gap-3 rounded-xl border border-[#55d2ff]/25 bg-[#55d2ff]/10 p-3 mx-2 mt-2">
                        <div>
                          <p className="text-xs font-medium text-[#a7e9ff] flex items-center gap-1.5">
                            <RotateCcw className="w-3.5 h-3.5" /> Restaurando Historial
                          </p>
                          <p className="mt-0.5 text-[10px] text-gray-400">
                            {editingHistorySource.modelName}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingHistorySource(null)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(0,0,0,0.3)] text-gray-300 hover:text-white hover:bg-[rgba(255,255,255,0.1)]"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    <textarea
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleGenerate();
                        }
                      }}
                      autoFocus
                      placeholder="Gancho utilitario reforzado para taller con agujeros para tornillo..."
                      className="w-full bg-transparent p-5 text-white text-lg outline-none resize-none min-h-[140px] placeholder:text-gray-600 font-medium"
                    />
                    
                    <div className="flex justify-between items-center px-4 pb-3">
                      <span className="text-[11px] text-gray-500 flex items-center gap-2">
                         <Info className="w-4 h-4" /> Presiona <kbd className="bg-[rgba(255,255,255,0.1)] px-1.5 py-0.5 rounded text-gray-300">Enter</kbd> para generar, <kbd className="bg-[rgba(255,255,255,0.1)] px-1.5 py-0.5 rounded text-gray-300">Shift+Enter</kbd> para salto.
                      </span>
                      <Button
                        size="lg"
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim() || !canGenerate}
                        className="h-14 px-10 rounded-full font-bold bg-[#D4FB79] text-[#161923] hover:bg-[#80E220] shadow-[0_0_20px_rgba(212,251,121,0.2)] hover:shadow-[0_0_30px_rgba(128,226,32,0.5)] transition-all flex items-center gap-3 text-base"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                        Generar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Historial de Generaciones (Merged List/Grid) */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Historial de Generaciones</h2>
                <Badge className="bg-[#1a1f36] text-gray-400 border-[rgba(168,187,238,0.15)]">
                  {history.filter((h) => h.status === "done").length} modelos
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {history.length === 0 ? (
                  <div className="md:col-span-2 rounded-3xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.01)] border-dashed py-20 text-center flex flex-col items-center">
                    <Sparkles className="w-8 h-8 text-gray-600 mb-3" />
                    <span className="text-gray-500 text-sm">{t("studio.ai.history.empty")}</span>
                    <p className="text-[10px] text-gray-600 mt-2 max-w-[200px]">Empieza creando un modelo a la izquierda y aparecerá aquí.</p>
                  </div>
                ) : (
                  history.map((entry) => (
                    <div
                      key={entry.id}
                      className={`rounded-2xl border transition-all animate-in fade-in flex flex-col ${
                        entry.status === "error"
                          ? "border-red-900/30 bg-red-950/10"
                          : "border-[rgba(168,187,238,0.12)] bg-[rgba(30,34,45,0.4)] hover:border-[#80E220]/40 group"
                      }`}
                    >
                      <div className="p-4 flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-white">
                                {entry.modelName || t("studio.ai.fallback.modelName")}
                              </span>
                              <span className="text-[9px] text-gray-500">{entry.timestamp}</span>
                            </div>
                            <p className="text-[11px] text-[#A8BBEE] italic line-clamp-2">"{entry.prompt}"</p>
                          </div>
                          <div className="flex gap-1 ml-2">
                            {entry.status === "generating" && (
                              <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 text-[#80E220] animate-spin" />
                                {generatingMessage && (
                                  <span className="text-[10px] text-[#80E220]/80 animate-pulse">{generatingMessage}</span>
                                )}
                              </div>
                            )}
                            {entry.status === "done" && (
                              <button
                                onClick={() => handleDeleteHistoryEntry(entry)}
                                className="p-1 rounded-md text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {entry.status === "done" && entry.scadCode && (
                          <div className="mt-3 space-y-2">
                            <div className="flex flex-wrap gap-1.5">
                              <Badge className="bg-[rgba(0,0,0,0.3)] text-gray-400 border-[rgba(255,255,255,0.05)] text-[9px] px-1.5 py-0">
                                {t(entry.familyHint || entry.spec?.family || "none")}
                              </Badge>
                              {entry.spec?.warnings.map((warning, index) => (
                                <Badge
                                  key={index}
                                  className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px] px-1.5 py-0 inline-flex"
                                >
                                  {warning}
                                </Badge>
                              ))}
                            </div>

                            {entry.validation && !entry.validation.valid && (
                              <div className="text-[10px] text-amber-400 flex items-center gap-1">
                                ⚠️ Problema estructural detectado
                              </div>
                            )}
                          </div>
                        )}

                        {entry.status === "error" && (
                          <div className="mt-3 text-[11px] text-red-400 bg-red-950/30 p-2 rounded border border-red-900/30">
                            Error: {entry.error}
                          </div>
                        )}
                      </div>

                      {entry.status === "done" && entry.scadCode && (
                        <div className="p-3 border-t border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.2)] rounded-b-2xl flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 h-8 text-[11px] font-semibold bg-[#80E220] text-[#161923] hover:bg-[#D4FB79] shadow-none flex items-center justify-center gap-2"
                            onClick={() => handleOpenInEditor(entry)}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {t("studio.ai.btn.openStudio")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-8 h-8 p-0 text-gray-400 hover:text-white bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] shrink-0"
                            onClick={() => handleReapplyHistoryEntry(entry)}
                            title={t("studio.ai.btn.reapply")}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: 4/12 Sidebar */}
          <div className="lg:col-span-4 h-full">
            <div className="bg-[#1C202B] rounded-3xl border border-[rgba(168,187,238,0.1)] p-6 sticky top-6 max-h-[calc(100vh-40px)] flex flex-col shadow-2xl overflow-y-auto custom-scrollbar">
              <h3 className="text-xl font-bold text-white mb-2 leading-tight">Parámetros de familia: <span className="text-gray-400 font-normal">{t(getFamilyLabel(selectedFamily))}</span></h3>
              
              <div className="mb-6 mt-4 flex flex-col gap-2">
                 <p className="text-base font-medium text-white mb-1">Presets rápidos:</p>
                 <div className="relative flex items-center gap-2">
                  <button className="h-20 w-8 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] rounded-xl flex items-center justify-center border border-[rgba(255,255,255,0.1)] text-white shrink-0">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex overflow-x-auto gap-3 pb-2 hide-scrollbar snap-x flex-1">
                      {activePresets.filter(p => p.familyHint === selectedFamily).slice(0, 4).map(preset => (
                        <div onClick={() => {
                            setQuality(preset.quality);
                            setSelectedFamily(preset.familyHint);
                            setPrompt(t(preset.prompt));
                          }} 
                          key={preset.label} 
                          className="shrink-0 w-24 h-24 rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] hover:border-[#80E220] hover:bg-[rgba(128,226,32,0.05)] cursor-pointer flex flex-col items-center justify-center p-2 text-center transition-all group snap-center">
                            <Zap className="w-6 h-6 text-gray-500 mb-2 group-hover:text-[#80E220]" />
                            <span className="text-[9px] text-gray-400 group-hover:text-white leading-tight px-1 font-medium">{t(preset.label)}</span>
                        </div>
                      ))}
                      {/* Default presets if empty for family */}
                      {activePresets.filter(p => p.familyHint === selectedFamily).length === 0 && (
                        <div className="text-xs text-gray-500 italic p-4 text-center w-full">No hay presets rápidos.</div>
                      )}
                  </div>
                  <button className="h-20 w-8 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] rounded-xl flex items-center justify-center border border-[rgba(255,255,255,0.1)] text-white shrink-0">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-6 pt-4 border-t border-[rgba(255,255,255,0.05)]">
                <Box className="w-4 h-4 text-gray-500" />
                <span className="text-[11px] font-semibold text-[#80E220] uppercase tracking-wider">Ajustes manuales</span>
              </div>

              {/* Scrollable list of parameters */}
              <div className="flex-1 space-y-6 flex flex-col pr-1">
                {parameterControls.map((parameter, idx) => {
                    const isLast = idx === parameterControls.length - 1;
                    if (parameter.type === "number") {
                      const value = Number(selectedOverrides[parameter.name] ?? parameter.defaultValue);
                      return (
                        <div key={parameter.name} className={`flex flex-col gap-2 ${isLast ? 'mb-4' : ''}`}>
                          <div className="flex justify-between items-end">
                            <span className="text-sm font-medium text-gray-300">{parameter.name}</span>
                            <span className="text-[10px] font-bold text-[#161923] bg-[#80E220] px-2 py-0.5 rounded shadow-[0_0_10px_rgba(128,226,32,0.3)]">{value}</span>
                          </div>
                          <input
                            type="range"
                            min={parameter.min}
                            max={parameter.max}
                            step={parameter.step ?? 1}
                            value={value}
                            onChange={(event) => updateNumericOverride(parameter, event.target.value)}
                            className="w-full accent-[#80E220] h-2 bg-[rgba(0,0,0,0.3)] rounded-full appearance-none outline-none border border-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.05)] cursor-pointer"
                          />
                          <span className="text-[10px] text-gray-500 leading-tight">{parameter.description}</span>
                        </div>
                      );
                    }
                    
                    if (parameter.type === "bool") {
                      const checked = Boolean(selectedOverrides[parameter.name] ?? parameter.defaultValue);
                      return (
                        <div key={parameter.name} className={`flex justify-between items-center py-2 ${isLast ? 'mb-4' : ''}`}>
                            <div className="flex flex-col gap-1 pr-4">
                              <span className="text-sm font-medium text-gray-300">{parameter.name}</span>
                              <span className="text-[10px] text-gray-500 leading-tight">{parameter.description}</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => updateBooleanOverride(parameter, event.target.checked)}
                              className="h-6 w-6 accent-[#80E220] rounded-md bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] form-checkbox cursor-pointer"
                            />
                        </div>
                      )
                    }

                    const value = String(selectedOverrides[parameter.name] ?? parameter.defaultValue ?? "");
                    return (
                      <div key={parameter.name} className={`flex flex-col gap-2 ${isLast ? 'mb-4' : ''}`}>
                          <div className="flex justify-between items-end">
                            <span className="text-sm font-medium text-gray-300">{parameter.name}</span>
                          </div>
                          <input
                            type="text"
                            value={value}
                            onChange={(event) => updateStringOverride(parameter, event.target.value)}
                            className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] focus:border-[#80E220]/50 outline-none text-white text-sm px-4 py-3 rounded-xl transition-all placeholder:text-gray-600"
                            placeholder={"Texto para... " + parameter.name}
                          />
                          <span className="text-[10px] text-gray-500">{parameter.description}</span>
                      </div>
                    )
                })}
              </div>

              <div className="mt-2 pt-4 border-t border-[rgba(255,255,255,0.05)] shrink-0">
                <button onClick={resetFamilyOverrides} className="w-full text-sm font-semibold text-gray-500 hover:text-white bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] py-3 rounded-xl transition-all">
                    Restablecer Valores Iniciales
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />

      {/* Recipes Dialog (Cloud Vault) */}
      <Dialog open={recipesOpen} onOpenChange={setRecipesOpen}>
        <DialogContent className="sm:max-w-xl bg-[rgba(15,20,36,0.95)] border border-[#C6E36C]/20 shadow-[0_0_50px_rgba(198,227,108,0.1)] backdrop-blur-2xl">
          <DialogHeader className="border-b border-[rgba(168,187,238,0.1)] pb-4 mb-2">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-[#C6E36C] uppercase tracking-wider text-sm">
                <Cpu className="w-4 h-4 text-[#C6E36C]" />
                Vorea Cloud Vault
              </DialogTitle>
              {useRemoteRecipes ? (
                <Badge className="bg-[#C6E36C]/10 text-[#C6E36C] border border-[#C6E36C]/30 flex items-center gap-1.5 text-[10px] px-2 py-0.5 shadow-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C6E36C] animate-pulse" /> Sincronizado
                </Badge>
              ) : (
                <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center gap-1.5 text-[10px] px-2 py-0.5 shadow-none">
                  Local Mode (Inicia sesión)
                </Badge>
              )}
            </div>
            <DialogDescription className="text-[11px] text-gray-400 mt-1.5">
              Guarda tus medidas y prompts maestros. Al iniciar sesión, se sincronizarán automáticamente con la nube en tu cuenta de Vorea.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <input
                value={recipeName}
                onChange={(event) => setRecipeName(event.target.value)}
                placeholder={t("studio.ai.recipes.placeholder")}
                className="flex-1 h-10 rounded-xl border border-[rgba(168,187,238,0.2)] bg-[rgba(11,15,28,0.6)] px-3 text-sm text-white outline-none focus:border-[#C6E36C]/40"
              />
              <Button size="sm" className="h-10 px-4 bg-[rgba(255,255,255,0.05)] text-white hover:bg-[rgba(255,255,255,0.1)] gap-2" onClick={handleSaveRecipe}>
                <Save className="w-4 h-4 text-[#C6E36C]" /> {t("studio.ai.btn.save")}
              </Button>
            </div>
            
            <div className="rounded-xl border border-[rgba(168,187,238,0.1)] bg-[rgba(0,0,0,0.2)] p-2 h-64 overflow-y-auto">
              {savedRecipes.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-500 italic">No tienes recetas guardadas.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {savedRecipes.map(recipe => (
                    <div key={recipe.id} className="p-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-lg flex items-center justify-between hover:bg-[rgba(255,255,255,0.05)]">
                      <div>
                        <p className="text-sm font-medium text-white">{recipe.name}</p>
                        <p className="text-[10px] text-gray-400">{recipe.engine.toUpperCase()} · {t(getFamilyLabel(recipe.familyHint))}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { applyRecipe(recipe); setRecipesOpen(false); }} className="h-8 shadow-none gap-2 bg-[#C6E36C]/10 text-[#C6E36C] hover:bg-[#C6E36C]/20 hover:text-[#C6E36C]">
                          <Upload className="w-3.5 h-3.5" /> {t("studio.ai.btn.load")}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-400/10" onClick={() => { setSelectedRecipeId(recipe.id); setTimeout(handleDeleteRecipe, 0); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pipeline Technical Info Dialog */}
      <Dialog open={pipelineOpen} onOpenChange={setPipelineOpen}>
        <DialogContent className="sm:max-w-md bg-[rgba(15,20,36,0.95)] border-[rgba(168,187,238,0.2)] backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-400" />
              {t("studio.ai.info.pipelineTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ol className="space-y-3 text-sm text-gray-300 ml-4 list-decimal">
              <li className="pl-1">{t("studio.ai.info.step1")}</li>
              <li className="pl-1">{t("studio.ai.info.step2")}</li>
              <li className="pl-1">{t("studio.ai.info.step3")}</li>
              <li className="pl-1">{t("studio.ai.info.step4")}</li>
            </ol>
            <div className="mt-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <h4 className="text-sm font-medium text-purple-300 mb-2 flex items-center gap-2"><Cpu className="w-4 h-4" /> {t("studio.ai.info.qualityTitle")}</h4>
              <p className="text-xs text-purple-200/70 mb-1">{t("studio.ai.info.draftDesc")}</p>
              <p className="text-xs text-purple-200/70">{t("studio.ai.info.finalDesc")}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

