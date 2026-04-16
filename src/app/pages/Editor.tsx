/**
 * Editor – Full SCAD code editor with live 3D preview, parameter customizer,
 * GCode generation, and export tools. Uses the real CSG engine.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useHistory } from "../hooks/useHistory";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ScadCustomizer } from "../components/ScadCustomizer";
import { ScadViewport, type ScadViewportHandle } from "../components/ScadViewport";
import { PublishDialog } from "../components/PublishDialog";
import { GCodePanel } from "../components/GCodePanel";
import { AuthDialog } from "../components/AuthDialog";
import { useModel, DEFAULT_SOURCE } from "../services/model-context";
import { useAuth } from "../services/auth-context";
import {
  CommunityApi,
  AiQuickFixApi,
  type CommunityModelMedia,
  type CommunityModelResponse,
} from "../services/api-client";
import {
  getCommunityPublishMode,
  parseCommunityRouteContext,
  type CommunityPublishMode,
} from "../services/community-edit-routing";
import { consumeProtectedToolAction } from "../services/protected-tool-actions";
import { trackAnalyticsEvent } from "../services/analytics";
import { useNavigate, useSearchParams } from "../nav";
import { parseScad, regenerateScad } from "../services/scad-parser";
import type { ScadParseResult } from "../services/scad-parser";
import type { SerializedMesh, SerializedImage } from "../engine/mesh-data";
import { GCodeCollectionService } from "../services/storage";
import { toast } from "sonner";
import { fireReward } from "../services/reward-triggers";
import { validateScad, diagnosticsSummary } from "../services/scad-validator";
import { ScadDiagnosticsPanel } from "../components/ScadDiagnosticsPanel";
import {
  Settings2,
  Layers,
  Play,
  Code2,
  Upload,
  FilePlus,
  Save,
  FolderOpen,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileCode2,
  Box,
  Printer,
  ArrowRight,
  Globe,
  FileUp,
  ImagePlus,
  Undo2,
  Redo2,
} from "lucide-react";

// ─── Built-in templates ───────────────────────────────────────────────────────

import { GRIDFINITY_BASE_SCAD } from "../models/gridfinity-base";
import { CABLE_CLIP_SCAD } from "../models/cable-clip";
import { ROUNDED_BOX_SCAD } from "../models/rounded-box";
import { PHONE_STAND_SCAD } from "../models/phone-stand";
import { DRAWER_ORGANIZER_TRAY_SCAD } from "../models/drawer-organizer-tray";
import { PLANTER_DRIP_SYSTEM_SCAD } from "../models/planter-drip-system";
import { LAMP_SHADE_KIT_SCAD } from "../models/lamp-shade-kit";
import { TEXT_KEYCHAIN_TAG_SCAD } from "../models/text-keychain-tag";
import { NAMEPLATE_PRO_SCAD } from "../models/nameplate-pro";
import { PEG_LABEL_SYSTEM_SCAD } from "../models/peg-label-system";
import { THREADED_JAR_SCAD } from "../models/threaded-jar";

const TEMPLATES = [
  { id: "gridfinity", name: "Gridfinity Base", source: GRIDFINITY_BASE_SCAD },
  { id: "cable", name: "Cable Clip", source: CABLE_CLIP_SCAD },
  { id: "box", name: "Rounded Box", source: ROUNDED_BOX_SCAD },
  { id: "drawer-tray", name: "Drawer Organizer Tray", source: DRAWER_ORGANIZER_TRAY_SCAD },
  { id: "planter-drip", name: "Planter Drip System", source: PLANTER_DRIP_SYSTEM_SCAD },
  { id: "lamp-shade-kit", name: "Lamp Shade Kit", source: LAMP_SHADE_KIT_SCAD },
  { id: "text-keychain-tag", name: "Text Keychain Tag", source: TEXT_KEYCHAIN_TAG_SCAD },
  { id: "nameplate-pro", name: "Nameplate Pro", source: NAMEPLATE_PRO_SCAD },
  { id: "peg-label-system", name: "Peg Label System", source: PEG_LABEL_SYSTEM_SCAD },
  { id: "threaded-jar", name: "Threaded Jar", source: THREADED_JAR_SCAD },
  { id: "phone", name: "Phone Stand", source: PHONE_STAND_SCAD },
];

// ─── Collapsible panel ────────────────────────────────────────────────────────

function Panel({
  open,
  side,
  width,
  children,
}: {
  open: boolean;
  side: "left" | "right";
  width: number;
  children: React.ReactNode;
}) {
  return (
    <aside
      style={{
        width: open ? width : 0,
        minWidth: 0,
        overflow: "hidden",
        transition: "width 0.28s cubic-bezier(.4,0,.2,1)",
        borderLeft:
          side === "right"
            ? "1px solid rgba(168,187,238,0.12)"
            : undefined,
        borderRight:
          side === "left"
            ? "1px solid rgba(168,187,238,0.12)"
            : undefined,
        flexShrink: 0,
      }}
      className="h-full glass flex flex-col"
    >
      <div style={{ width, minWidth: width }} className="h-full flex flex-col">
        {children}
      </div>
    </aside>
  );
}

// ─── State persistence helpers ────────────────────────────────────────────────

function getEditorStateKey(modelId?: string | null) {
  return modelId ? `vorea_editor_state_${modelId}` : "vorea_editor_state_scratchpad";
}

type CommunityEditMeta = {
  id: string;
  tags?: string[];
  media?: CommunityModelMedia[];
  thumbnailUrl?: string | null;
  status?: string;
};

function toCommunityEditMeta(model: CommunityModelResponse): CommunityEditMeta {
  return {
    id: model.id,
    tags: model.tags,
    media: model.media,
    thumbnailUrl: model.thumbnailUrl,
    status: model.status,
  };
}

function saveEditorState(key: string, source: string, title: string, paramValues: Record<string, unknown>) {
  try {
    localStorage.setItem(key, JSON.stringify({ source, title, paramValues, savedAt: Date.now() }));
  } catch (_e) { /* quota exceeded — ignore */ }
}

function loadEditorState(key: string): { source: string; title: string; paramValues: Record<string, unknown> } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.source && typeof parsed.source === "string") return parsed;
  } catch (_e) { /* ignore parse errors */ }
  return null;
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export function Editor() {
  const navigate = useNavigate();
  const model = useModel();
  const { isLoggedIn, refreshCredits } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState<"params" | "gcode" | "export">(
    "params"
  );
  const [projectTitle, setProjectTitle] = useState(model.modelName);
  const [editingTitle, setEditingTitle] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [localSource, setLocalSource] = useState(model.scadSource);
  const history = useHistory({ source: model.scadSource, paramValues: model.paramValues });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const viewportRef = useRef<ScadViewportHandle>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishMode, setPublishMode] = useState<CommunityPublishMode>("create");
  const [communityModelId, setCommunityModelId] = useState<string | null>(null);
  const [communityEditMeta, setCommunityEditMeta] = useState<CommunityEditMeta | null>(null);
  const [loadedSvgs, setLoadedSvgs] = useState<Record<string, string>>({});
  const [loadedImages, setLoadedImages] = useState<Record<string, SerializedImage>>({});
  const svgInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const consumeStudioAction = useCallback((actionId: string, authMessage: string, deniedMessage?: string) => {
    return consumeProtectedToolAction({
      isLoggedIn,
      toolId: "studio",
      actionId,
      onAuthRequired: () => setAuthOpen(true),
      authMessage,
      deniedMessage,
      onConsumed: refreshCredits,
    });
  }, [isLoggedIn, refreshCredits]);

  // ─── Deep-link: load route or template from URL ─────────────────────
  const initializedRef = useRef<string | null>(null);
  const restoredLocalStateRef = useRef(false);
  useEffect(() => {
    const routeContext = parseCommunityRouteContext(searchParams);
    const templateId = searchParams.get("template");
    const libId = searchParams.get("lib");
    const bootstrapKey = routeContext
      ? `${routeContext.intent}:${routeContext.modelId}`
      : templateId
        ? `template:${templateId}`
        : libId
          ? `lib:${libId}`
          : "create";

    if (initializedRef.current === bootstrapKey) return;
    initializedRef.current = bootstrapKey;

    let cancelled = false;
    const bootstrap = async () => {
      if (routeContext) {
        try {
          const details = await CommunityApi.getModel(routeContext.modelId);
          let source = details.scadSource;
          if (!source) {
            const downloaded = await CommunityApi.downloadModel(routeContext.modelId);
            source = downloaded.scadSource;
          }
          if (!source.trim()) {
            throw new Error(
              routeContext.intent === "edit"
                ? "No se pudo cargar el modelo para editar"
                : "No se pudo cargar el modelo para crear la copia"
            );
          }
          if (cancelled) return;

          const nextTitle =
            routeContext.intent === "fork" && !/\(copia\)$/i.test(details.title)
              ? `${details.title} (copia)`
              : details.title;

          setPublishMode(getCommunityPublishMode(routeContext));
          setCommunityModelId(routeContext.intent === "edit" ? details.id : null);
          setCommunityEditMeta(routeContext.intent === "edit" ? toCommunityEditMeta(details) : null);
          setProjectTitle(nextTitle);
          setLocalSource(source);
          model.setScadSource(
            source,
            nextTitle,
            routeContext.intent === "fork"
              ? {
                forkedFromId: details.id,
                forkedFromTitle: details.title,
                forkedFromAuthor: details.authorUsername,
              }
              : null
          );
          prevSourceRef.current = source;
          return;
        } catch (e: any) {
          if (!cancelled) {
            initializedRef.current = null;
            toast.error(e?.message || "No se pudo abrir el modelo");
          }
          return;
        }
      }

      if (templateId) {
        const tmpl = TEMPLATES.find((t) => t.id === templateId);
        if (tmpl) {
          setPublishMode("create");
          setCommunityModelId(null);
          setCommunityEditMeta(null);
          setLocalSource(tmpl.source);
          setProjectTitle(tmpl.name);
          model.setScadSource(tmpl.source, tmpl.name, null);
          prevSourceRef.current = tmpl.source;
          return;
        }
      }

      // ─── lib: SCAD Library model from MakerWorld ──────────────────
      if (libId) {
        let scadCode: string | null = null;
        let modelTitle = "Modelo SCAD";
        try {
          // Try sessionStorage cache first (set by ScadLibrary on same navigation)
          const stored = sessionStorage.getItem("vorea_import_scad");
          if (stored) {
            const data = JSON.parse(stored) as { name: string; code: string; sourceId: string };
            if (data.sourceId === libId) {
              scadCode = data.code;
              modelTitle = data.name;
              sessionStorage.removeItem("vorea_import_scad");
            }
          }
          // Fallback: fetch from catalog (bookmarked / shared URL)
          if (!scadCode) {
            const catRes = await fetch("/scad-library/catalog.json");
            if (catRes.ok) {
              const catalog = await catRes.json() as Array<{ id: string; title: string; hasScad: boolean; scadFile: string | null }>;
              const entry = catalog.find((m) => m.id === libId);
              if (entry?.hasScad && entry.scadFile) {
                modelTitle = entry.title;
                const scadRes = await fetch(`/scad-library/models/${entry.scadFile}`);
                if (scadRes.ok) scadCode = await scadRes.text();
              }
            }
          }
          if (scadCode && !cancelled) {
            setPublishMode("create");
            setCommunityModelId(null);
            setCommunityEditMeta(null);
            setLocalSource(scadCode);
            setProjectTitle(modelTitle);
            model.setScadSource(scadCode, modelTitle, null);
            prevSourceRef.current = scadCode;
          } else if (!cancelled) {
            toast.error("No se pudo cargar el modelo de la biblioteca");
          }
        } catch {
          if (!cancelled) toast.error("Error al cargar el modelo de la biblioteca");
        }
        return;
      }

      if (restoredLocalStateRef.current) return;
      restoredLocalStateRef.current = true;

      // Si el modelo ya fue provisto por otra vista (ej. AI Studio), preservamos ese contexto
      if (model.scadSource !== DEFAULT_SOURCE) return;

      const stateKey = getEditorStateKey(null);
      const saved = loadEditorState(stateKey);
      if (saved && saved.source !== model.scadSource) {
        setPublishMode("create");
        setCommunityModelId(null);
        setCommunityEditMeta(null);
        setLocalSource(saved.source);
        setProjectTitle(saved.title);
        model.setScadSource(saved.source, saved.title, null);
        prevSourceRef.current = saved.source;
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [model, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Auto-save editor state to localStorage ─────────────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stateKey = getEditorStateKey(communityModelId || searchParams.get("template"));
  
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveEditorState(stateKey, localSource, projectTitle, model.paramValues);
    }, 2000);
    return () => clearTimeout(saveTimerRef.current);
  }, [stateKey, localSource, projectTitle, model.paramValues]);

  // Sync from model context when source changes externally
  const prevSourceRef = useRef(model.scadSource);
  useEffect(() => {
    if (model.scadSource !== prevSourceRef.current) {
      prevSourceRef.current = model.scadSource;
      setLocalSource(model.scadSource);
      setProjectTitle(model.modelName);
    }
  }, [model.scadSource, model.modelName]);

  // Parse SCAD for parameters
  const parseResult: ScadParseResult = useMemo(
    () => parseScad(localSource),
    [localSource]
  );

  // Init param values from parse result when source changes
  const prevParseRef = useRef<string>("");
  useEffect(() => {
    const fp = parseResult.params.map((p) => p.name).join(",");
    if (fp !== prevParseRef.current) {
      prevParseRef.current = fp;
      const init: Record<string, number | boolean | string | number[]> = {};
      parseResult.params.forEach((p) => {
        // Keep existing value if parameter name matches
        if (model.paramValues[p.name] !== undefined) {
          init[p.name] = model.paramValues[p.name];
        } else {
          init[p.name] = Array.isArray(p.value) ? [...p.value] : p.value;
        }
      });
      model.setParamValues(init);
    }
  }, [parseResult]); // eslint-disable-line

  // Apply code changes to model context (debounced)
  const applyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setLocalSource(newCode);
      history.push({ source: newCode, paramValues: model.paramValues });
      clearTimeout(applyTimerRef.current);
      applyTimerRef.current = setTimeout(() => {
        model.setScadSource(
          newCode,
          projectTitle,
          publishMode === "fork" ? model.forkMeta : null
        );
        prevSourceRef.current = newCode;
      }, 600);
    },
    [model, projectTitle, publishMode, history]
  );

  // Apply immediately
  const applyCode = useCallback(() => {
    clearTimeout(applyTimerRef.current);
    model.setScadSource(
      localSource,
      projectTitle,
      publishMode === "fork" ? model.forkMeta : null
    );
    prevSourceRef.current = localSource;
  }, [model, localSource, projectTitle, publishMode]);

  const handleParamChange = useCallback(
    (name: string, value: number | boolean | string | number[]) => {
      model.setParam(name, value);
      history.push({ source: localSource, paramValues: { ...model.paramValues, [name]: value } }, true);
    },
    [model, localSource, history]
  );

  // ─── Undo / Redo handlers ───────────────────────────────────────────
  const handleUndo = useCallback(() => {
    const snap = history.undo();
    if (!snap) return;
    setLocalSource(snap.source);
    prevSourceRef.current = snap.source;
    clearTimeout(applyTimerRef.current);
    model.setScadSource(snap.source, projectTitle, publishMode === "fork" ? model.forkMeta : null);
    model.setParamValues(snap.paramValues as Record<string, number | boolean | string | number[]>);
  }, [history, model, projectTitle, publishMode]);

  const handleRedo = useCallback(() => {
    const snap = history.redo();
    if (!snap) return;
    setLocalSource(snap.source);
    prevSourceRef.current = snap.source;
    clearTimeout(applyTimerRef.current);
    model.setScadSource(snap.source, projectTitle, publishMode === "fork" ? model.forkMeta : null);
    model.setParamValues(snap.paramValues as Record<string, number | boolean | string | number[]>);
  }, [history, model, projectTitle, publishMode]);

  const handleResetAll = useCallback(() => {
    const init: Record<string, number | boolean | string | number[]> = {};
    parseResult.params.forEach((p) => {
      init[p.name] = Array.isArray(p.defaultValue)
        ? [...p.defaultValue]
        : p.defaultValue;
    });
    model.setParamValues(init);
    toast.success("Parametros restablecidos");
  }, [parseResult, model]);

  // Load template
  const loadTemplate = useCallback(
    (t: (typeof TEMPLATES)[number]) => {
      setPublishMode("create");
      setCommunityModelId(null);
      setLocalSource(t.source);
      setProjectTitle(t.name);
      setCommunityEditMeta(null);
      model.setScadSource(t.source, t.name, null);
      prevSourceRef.current = t.source;
      setShowTemplates(false);
      // Update URL so the template is shareable
      setSearchParams({ template: t.id, intent: null, modelId: null });
      toast.success(`Template "${t.name}" cargado`);
    },
    [model, setSearchParams]
  );

  // File upload
  const handleFileUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".scad,.txt";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const fileName = file.name.replace(/\.(scad|txt)$/, "");
        setPublishMode("create");
        setCommunityModelId(null);
        setLocalSource(text);
        setProjectTitle(fileName);
        setCommunityEditMeta(null);
        model.setScadSource(text, fileName, null);
        prevSourceRef.current = text;
        setSearchParams({ template: null, intent: null, modelId: null });
        const parsed = parseScad(text);
        toast.success(
          `"${fileName}" cargado - ${parsed.params.length} parametros`
        );
      };
      reader.readAsText(file);
    };
    input.click();
  }, [model, setSearchParams]);

  // ─── Insert text at cursor position in textarea ───────────────────
  const insertAtCursor = useCallback((text: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      // Fallback: append at end
      const newSource = localSource + "\n" + text;
      setLocalSource(newSource);
      model.setScadSource(newSource, projectTitle, communityModelId);
      prevSourceRef.current = newSource;
      return;
    }
    const start = ta.selectionStart;
    const before = localSource.slice(0, start);
    const after = localSource.slice(start);
    // Add newline if cursor is not at line start
    const prefix = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
    const newSource = before + prefix + text + "\n" + after;
    setLocalSource(newSource);
    model.setScadSource(newSource, projectTitle, communityModelId);
    prevSourceRef.current = newSource;
    // Move cursor after inserted text
    requestAnimationFrame(() => {
      const pos = start + prefix.length + text.length + 1;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }, [localSource, model, projectTitle, communityModelId]);

  // ─── SVG upload → register + insert import() ─────────────────────
  const handleSvgImport = useCallback(() => {
    svgInputRef.current?.click();
  }, []);

  const handleSvgFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".svg")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        const name = file.name.toLowerCase();
        setLoadedSvgs(prev => ({ ...prev, [name]: text }));
        insertAtCursor(`import("${file.name}");`);
        toast.success(`SVG "${file.name}" cargado e insertado`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [insertAtCursor]);

  // ─── Image upload → register + insert surface() ──────────────────
  const handleImageImport = useCallback(() => {
    imgInputRef.current?.click();
  }, []);

  const handleImageFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        const { registerImage } = await import("../engine/image-registry");
        const decoded = await registerImage("surface_image", dataUrl);
        // Store serialized image data for worker transfer
        setLoadedImages((prev) => ({
          ...prev,
          surface_image: {
            width: decoded.width,
            height: decoded.height,
            data: decoded.data.buffer as ArrayBuffer,
          },
        }));
        insertAtCursor(`surface("surface_image", width=100, height=100);`);
        toast.success(`Imagen "${file.name}" cargada e insertada`);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [insertAtCursor]);

  // Copy code
  const handleCopy = useCallback(() => {
    try {
      const liveCode = regenerateScad(localSource, model.paramValues);
      const textarea = document.createElement("textarea");
      textarea.value = liveCode;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.success("Codigo copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }, [localSource, model.paramValues]);

  // Download .scad
  const handleDownload = useCallback(() => {
    void (async () => {
      const allowed = await consumeStudioAction(
        "download_scad",
        "Inicia sesión para descargar tu proyecto SCAD.",
        "Tu plan no incluye la descarga de SCAD."
      );
      if (!allowed) return;
      const liveCode = regenerateScad(localSource, model.paramValues);
      const blob = new Blob([liveCode], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(projectTitle || "model").replace(/\s+/g, "_")}.scad`;
      a.click();
      URL.revokeObjectURL(url);
      trackAnalyticsEvent("export_scad", { tool: "studio", title: projectTitle });
      toast.success("Archivo .scad descargado");
      fireReward("export_gcode");
    })();
  }, [consumeStudioAction, localSource, model.paramValues, projectTitle]);

  // Export STL (text format)
  const handleExportSTL = useCallback(() => {
    void (async () => {
      if (!model.compiledMesh) {
        toast.error("Compila el modelo primero");
        return;
      }
      const allowed = await consumeStudioAction(
        "download_stl",
        "Inicia sesión para exportar tu modelo en STL."
      );
      if (!allowed) return;
      const polys = model.compiledMesh.polygons;
      let stl = "solid vorea_model\n";
      for (const poly of polys) {
        const vs = poly.vertices;
        if (vs.length < 3) continue;
        // Triangulate polygon fan
        for (let i = 1; i < vs.length - 1; i++) {
          stl += `  facet normal ${poly.planeNx} ${poly.planeNy} ${poly.planeNz}\n`;
          stl += "    outer loop\n";
          stl += `      vertex ${vs[0].px} ${vs[0].py} ${vs[0].pz}\n`;
          stl += `      vertex ${vs[i].px} ${vs[i].py} ${vs[i].pz}\n`;
          stl += `      vertex ${vs[i + 1].px} ${vs[i + 1].py} ${vs[i + 1].pz}\n`;
          stl += "    endloop\n";
          stl += "  endfacet\n";
        }
      }
      stl += "endsolid vorea_model\n";
      const blob = new Blob([stl], { type: "application/sla" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(projectTitle || "model").replace(/\s+/g, "_")}.stl`;
      a.click();
      URL.revokeObjectURL(url);
      trackAnalyticsEvent("export_stl", { tool: "studio", title: projectTitle });
      toast.success("STL exportado");
      fireReward("export_stl");
    })();
  }, [consumeStudioAction, model.compiledMesh, projectTitle]);

  // Export OBJ
  const handleExportOBJ = useCallback(() => {
    void (async () => {
      if (!model.compiledMesh) {
        toast.error("Compila el modelo primero");
        return;
      }
      const allowed = await consumeStudioAction(
        "download_obj",
        "Inicia sesión para exportar tu modelo en OBJ."
      );
      if (!allowed) return;
      const polys = model.compiledMesh.polygons;
      let obj = "# Vorea Studio OBJ Export\n";
      let vIdx = 1;
      for (const poly of polys) {
        for (const v of poly.vertices) {
          obj += `v ${v.px} ${v.py} ${v.pz}\n`;
        }
      }
      for (const poly of polys) {
        const indices: number[] = [];
        for (let i = 0; i < poly.vertices.length; i++) {
          indices.push(vIdx++);
        }
        obj += `f ${indices.join(" ")}\n`;
      }
      const blob = new Blob([obj], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(projectTitle || "model").replace(/\s+/g, "_")}.obj`;
      a.click();
      URL.revokeObjectURL(url);
      trackAnalyticsEvent("export_obj", { tool: "studio", title: projectTitle });
      toast.success("OBJ exportado");
      fireReward("export_stl");
    })();
  }, [consumeStudioAction, model.compiledMesh, projectTitle]);

  const handleOpenPublishDialog = useCallback(() => {
    if (!model.compiledMesh) return;
    if (!isLoggedIn) {
      toast("Inicia sesión para guardar o publicar tu modelo en la comunidad.");
      setAuthOpen(true);
      return;
    }
    setPublishOpen(true);
  }, [isLoggedIn, model.compiledMesh]);

  const lineCount = localSource.split("\n").length;

  // ─── SCAD Validator & Quick Fix ────────────────────────
  const scadDiagnostics = useMemo(() => validateScad(localSource), [localSource]);
  const diagSummary = useMemo(() => diagnosticsSummary(scadDiagnostics), [scadDiagnostics]);

  const handleQuickFix = useCallback(async (diagnostic: any) => {
    const errorMsg = diagnostic.message;
    setIsFixing(true);
    const toastId = toast.loading("Vorea Quick Fix analizando...");
    try {
      const fixedCode = await AiQuickFixApi.generateFix(localSource, errorMsg);
      if (fixedCode) {
        setLocalSource(fixedCode);
        model.setScadSource(fixedCode, model.modelName, model.forkMeta);
        toast.dismiss(toastId);
        toast.success("Código reparado por IA");
        fireReward("quick_fix_used");
      }
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error(e.message || "Error al aplicar Quick Fix");
    } finally {
      setIsFixing(false);
    }
  }, [localSource, model]);

  const handleNavigateToLine = useCallback((line: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const lines = localSource.split("\n");
    let charIdx = 0;
    for (let i = 0; i < Math.min(line - 1, lines.length); i++) {
      charIdx += lines[i].length + 1;
    }
    ta.focus();
    ta.setSelectionRange(charIdx, charIdx + (lines[line - 1]?.length || 0));
    // Scroll to line
    const lineHeight = 18; // approx leading-relaxed 11px
    ta.scrollTop = Math.max(0, (line - 3) * lineHeight);
  }, [localSource]);
  const publishActionLabel =
    publishMode === "edit"
      ? "Actualizar modelo"
      : publishMode === "fork"
        ? "Crear copia"
        : "Publicar modelo";

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0d1117] min-h-0">
      {/* ─── Left Panel: Code Editor ─────────────────────────────────────── */}
      <Panel open={leftOpen} side="left" width={380}>
        <div className="p-3 border-b border-[rgba(168,187,238,0.12)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-[#C6E36C]" />
            <span className="text-sm font-semibold">Codigo SCAD</span>
            <span className="text-[9px] text-gray-500 bg-[#0d1117] px-1.5 py-0.5 rounded font-mono">
              {lineCount} lineas
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleUndo}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              title="Deshacer (Ctrl+Z)"
              disabled={!history.canUndo()}
            >
              <Undo2 className="w-3 h-3" />
            </button>
            <button
              onClick={handleRedo}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              title="Rehacer (Ctrl+Shift+Z)"
              disabled={!history.canRedo()}
            >
              <Redo2 className="w-3 h-3" />
            </button>
            <div className="w-px h-4 bg-[rgba(168,187,238,0.12)]" />
            <button
              onClick={handleCopy}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
              title="Copiar"
            >
              <Copy className="w-3 h-3" />
            </button>
            <button
              onClick={handleDownload}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
              title="Descargar .scad"
            >
              <Download className="w-3 h-3" />
            </button>
            <button
              onClick={handleFileUpload}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
              title="Cargar archivo"
            >
              <Upload className="w-3 h-3" />
            </button>
            <div className="w-px h-4 bg-[rgba(168,187,238,0.12)]" />
            <button
              onClick={handleSvgImport}
              className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                Object.keys(loadedSvgs).length > 0
                  ? "bg-[#C6E36C]/20 text-[#C6E36C]"
                  : "hover:bg-white/10 text-gray-500 hover:text-gray-300"
              }`}
              title={Object.keys(loadedSvgs).length > 0
                ? `SVG: ${Object.keys(loadedSvgs).join(", ")}`
                : "Importar SVG (inserta import() en cursor)"}
            >
              <FileUp className="w-3 h-3" />
            </button>
            <button
              onClick={handleImageImport}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
              title="Importar imagen (inserta surface() en cursor)"
            >
              <ImagePlus className="w-3 h-3" />
            </button>
          </div>
          {/* Hidden file inputs for SVG and image import */}
          <input
            ref={svgInputRef}
            type="file"
            accept=".svg,image/svg+xml"
            className="hidden"
            onChange={handleSvgFileChange}
          />
          <input
            ref={imgInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={handleImageFileChange}
          />
        </div>

        {/* Template selector */}
        <div className="px-3 py-2 border-b border-[rgba(168,187,238,0.08)]">
          <button
            className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-200 transition-colors"
            onClick={() => setShowTemplates(!showTemplates)}
          >
            <span className="flex items-center gap-1.5">
              <FileCode2 className="w-3 h-3" />
              Templates
            </span>
            {showTemplates ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
          {showTemplates && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => loadTemplate(t)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-[#1a1f36] text-gray-400 border border-[rgba(168,187,238,0.08)] hover:border-[#C6E36C]/30 hover:text-gray-200 transition-all"
                >
                  <Box className="w-2.5 h-2.5" />
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Code textarea */}
        <div className="flex-1 relative overflow-hidden">
          <textarea
            ref={textareaRef}
            value={localSource}
            onChange={(e) => handleCodeChange(e.target.value)}
            onBlur={applyCode}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
              } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
                e.preventDefault();
                handleRedo();
              }
            }}
            spellCheck={false}
            className="w-full h-full bg-[#0a0e17] text-gray-300 text-[11px] font-mono leading-relaxed p-3 outline-none resize-none"
            style={{ tabSize: 2 }}
          />
        </div>

        {/* SCAD Diagnostics Panel */}
        <ScadDiagnosticsPanel
          diagnostics={scadDiagnostics}
          isFixing={isFixing}
          onNavigateToLine={handleNavigateToLine}
          onQuickFixRequested={handleQuickFix}
        />

        {/* Bottom actions */}
        <div className="px-3 py-2 border-t border-[rgba(168,187,238,0.12)] flex items-center gap-2">
          <Button
            size="sm"
            className="text-[10px] h-7 gap-1"
            onClick={applyCode}
          >
            <Play className="w-3 h-3" /> Aplicar
          </Button>
          <span className="text-[9px] text-gray-600 ml-auto flex items-center gap-2">
            {diagSummary.errors > 0 && (
              <span className="text-red-400">{diagSummary.errors} error{diagSummary.errors > 1 ? "es" : ""}</span>
            )}
            {diagSummary.warnings > 0 && (
              <span className="text-amber-400">{diagSummary.warnings} warning{diagSummary.warnings > 1 ? "s" : ""}</span>
            )}
            {diagSummary.errors === 0 && diagSummary.warnings === 0 && (
              <span className="text-green-400/60">✓</span>
            )}
            {parseResult.params.length} parametros detectados
          </span>
        </div>
      </Panel>

      {/* ─── Main Area: 3D Viewport ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col relative min-h-0 min-w-0">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-4 z-10 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md bg-[#1a1f36]/80 backdrop-blur"
              onClick={() => setLeftOpen(!leftOpen)}
              title={leftOpen ? "Ocultar codigo" : "Mostrar codigo"}
            >
              <Code2 className="w-4 h-4" />
            </Button>

            {/* Project title */}
            <div className="bg-[#1a1f36]/80 backdrop-blur rounded-md h-8 flex items-center border border-[rgba(168,187,238,0.12)] overflow-hidden">
              {editingTitle ? (
                <div className="flex items-center">
                  <input
                    autoFocus
                    className="bg-transparent text-xs text-white px-3 h-8 w-40 outline-none"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setEditingTitle(false);
                        model.setModelName(projectTitle);
                      }
                    }}
                  />
                  <button
                    className="px-2 h-8 hover:bg-white/10 transition-colors"
                    onClick={() => {
                      setEditingTitle(false);
                      model.setModelName(projectTitle);
                    }}
                  >
                    <Check className="w-3.5 h-3.5 text-[#C6E36C]" />
                  </button>
                </div>
              ) : (
                <button
                  className="px-3 h-8 flex items-center gap-2 hover:bg-white/5 transition-colors"
                  onClick={() => setEditingTitle(true)}
                >
                  <span className="text-xs font-semibold tracking-wide text-gray-300 max-w-[160px] truncate">
                    {projectTitle}
                  </span>
                </button>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md bg-[#1a1f36]/80 backdrop-blur"
              onClick={() => {
                setPublishMode("create");
                setCommunityModelId(null);
                model.setScadSource(
                  `// Nuevo proyecto\n$fn = 32;\n\ncube([20, 20, 20], center=true);\n`,
                  "Sin titulo",
                  null
                );
                setProjectTitle("Sin titulo");
                setCommunityEditMeta(null);
                setSearchParams({ template: null, intent: null, modelId: null });
                toast("Nuevo proyecto");
              }}
              title="Nuevo"
            >
              <FilePlus className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md bg-[#1a1f36]/80 backdrop-blur"
              onClick={() => setRightOpen(!rightOpen)}
              title={rightOpen ? "Ocultar panel" : "Mostrar panel"}
            >
              <Layers className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 3D Viewport */}
        <div className="flex-1 bg-[#0f1320] min-h-0">
          <ScadViewport
            ref={viewportRef}
            source={localSource}
            values={model.paramValues}
            onMeshReady={model.setCompiledMesh}
            svgs={loadedSvgs}
            images={loadedImages}
          />
        </div>

        {/* Bottom toolbar: Navigate to MakerWorld */}
        {model.compiledMesh && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto flex items-center gap-2 bg-[#1a1f36]/80 backdrop-blur border border-[rgba(168,187,238,0.12)] rounded-full px-3 py-1.5">
            <button
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] text-gray-400 hover:text-[#C6E36C] hover:bg-[#C6E36C]/10 transition-all"
              onClick={() => navigate("/makerworld")}
            >
              <Printer className="w-3 h-3" />
              Lint & Exportar
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* ─── Right Panel: Parameters / GCode / Export ─────────────────────── */}
      <Panel open={rightOpen} side="right" width={310}>
        {/* Tab headers */}
        <div className="flex border-b border-[rgba(168,187,238,0.12)]">
          {(
            [
              { key: "params", label: "Parametros", icon: Settings2 },
              { key: "gcode", label: "GCode", icon: Printer },
              { key: "export", label: "Exportar", icon: Download },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] transition-colors ${
                rightTab === tab.key
                  ? "text-[#C6E36C] border-b-2 border-[#C6E36C]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              onClick={() => setRightTab(tab.key)}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Parameters tab */}
          {rightTab === "params" && (
            <div className="p-3">
              {parseResult.params.length > 0 ? (
                <ScadCustomizer
                  parseResult={parseResult}
                  values={model.paramValues}
                  onChange={handleParamChange}
                  onResetAll={handleResetAll}
                />
              ) : (
                <div className="text-center py-8">
                  <Settings2 className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">
                    No se detectaron parametros editables
                  </p>
                  <p className="text-[10px] text-gray-600 mt-1">
                    Agrega comentarios tipo{" "}
                    <code className="text-[#C6E36C]">// [min:max]</code>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* GCode tab */}
          {rightTab === "gcode" && (
            <div className="p-3">
              <GCodePanel
                mesh={model.compiledMesh}
                modelName={projectTitle}
                onSaveToCollection={(gcode, name) => {
                  if (!isLoggedIn) {
                    toast("Inicia sesión para guardar GCode en tu colección privada.");
                    setAuthOpen(true);
                    return;
                  }
                  GCodeCollectionService.add(name, gcode, {
                    layerHeight: 0.2,
                    source: projectTitle,
                  });
                }}
              />
            </div>
          )}

          {/* Export tab */}
          {rightTab === "export" && (
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-400 mb-2">Exportar modelo</p>

              <button
                onClick={handleExportSTL}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#1a1f36] border border-[rgba(168,187,238,0.08)] hover:border-[#C6E36C]/30 transition-all text-left"
              >
                <div>
                  <span className="text-xs text-white font-mono">.STL</span>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Standard Tessellation
                  </p>
                </div>
                <Download className="w-3.5 h-3.5 text-gray-500" />
              </button>

              <button
                onClick={handleExportOBJ}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#1a1f36] border border-[rgba(168,187,238,0.08)] hover:border-[#C6E36C]/30 transition-all text-left"
              >
                <div>
                  <span className="text-xs text-white font-mono">.OBJ</span>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Wavefront Object
                  </p>
                </div>
                <Download className="w-3.5 h-3.5 text-gray-500" />
              </button>

              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#1a1f36] border border-[rgba(168,187,238,0.08)] hover:border-[#C6E36C]/30 transition-all text-left"
              >
                <div>
                  <span className="text-xs text-white font-mono">.SCAD</span>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    OpenSCAD Source
                  </p>
                </div>
                <Download className="w-3.5 h-3.5 text-gray-500" />
              </button>

              {!model.compiledMesh && (
                <p className="text-[10px] text-amber-400/70 text-center mt-4">
                  Compila el modelo primero para exportar STL/OBJ
                </p>
              )}

              {/* Navigate to MakerWorld */}
              <div className="mt-6 pt-4 border-t border-[rgba(168,187,238,0.08)]">
                <p className="text-xs text-gray-400 mb-2">Publicacion</p>
                <Button
                  className="w-full gap-2 text-xs mb-2"
                  variant="secondary"
                  onClick={handleOpenPublishDialog}
                  disabled={!model.compiledMesh}
                >
                  <Globe className="w-3.5 h-3.5" />
                  {publishActionLabel}
                </Button>
                <Button
                  className="w-full gap-2 text-xs"
                  onClick={() => navigate("/makerworld")}
                  disabled={!model.compiledMesh}
                >
                  <Printer className="w-3.5 h-3.5" />
                  Lint & Publicar
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Publish to Community Dialog */}
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        sceneCtx={viewportRef.current?.getSceneCtx() ?? null}
        mode={publishMode}
        modelId={communityModelId}
        forkedFromId={model.forkMeta?.forkedFromId}
        forkedFromTitle={model.forkMeta?.forkedFromTitle}
        forkedFromAuthor={model.forkMeta?.forkedFromAuthor}
        editModel={communityEditMeta}
        onEditSaved={(savedModel: CommunityModelResponse) => {
          setPublishMode("edit");
          setCommunityModelId(savedModel.id);
          setCommunityEditMeta(toCommunityEditMeta(savedModel));
          setProjectTitle(savedModel.title);
          model.setModelName(savedModel.title);
          model.clearForkMeta();
          setSearchParams({ template: null, intent: "edit", modelId: savedModel.id });
        }}
      />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
