/**
 * Relief Tool — Dedicated page for generating 3D reliefs from images.
 * No SCAD code required. Upload an image, adjust parameters, generate.
 *
 * Vorea Studio — voreastudio.com
 */

import { useRef, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "../nav";
import { registerImage, getImage } from "../engine/image-registry";
import {
  estimatePaletteFromImage,
  generateHeightmapMesh,
  type GapFillMode,
  type HeightmapResult,
} from "../engine/heightmap-generator";
import {
  initScene, resizeScene, disposeScene,
  setGridVisible, setAxesVisible, resetView,
  type ThreeSceneContext, type RenderMode,
} from "../engine/threejs-renderer";
import { exportTo3MF, download3MF, exportToSTL, downloadBlob } from "../engine/threemf-exporter";
import { parseSTL, stlToHeightmap } from "../engine/stl-to-heightmap";
import { extractDepthField } from "../engine/surface-modes/stl-surface";
import { parseSvgToSurface, svgHasVectorContent } from "../engine/surface-modes/svg-path-surface";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { inspectMesh, type MeshHealthReport } from "../engine/mesh-inspector";
import { repairMesh } from "../engine/mesh-repair";
import { CommunityApi } from "../services/api-client";
import {
  getCommunityPublishMode,
  parseCommunityRouteContext,
  type CommunityPublishMode,
} from "../services/community-edit-routing";
import {
  clampGalleryCoverIndex,
  createGalleryItemFromBlob,
  moveGalleryItem,
  resolveGalleryState,
  serializeGalleryItems,
  type EditableGalleryItem,
} from "../services/community-gallery";
import { useAuth } from "../services/auth-context";
import { useI18n } from "../services/i18n-context";
import { consumeProtectedToolAction } from "../services/protected-tool-actions";
import { trackAnalyticsEvent } from "../services/analytics";
import { telemetry, type EngineSnapshot, type MeshHealthSnapshot } from "../services/telemetry-collector";
import { AuthDialog } from "../components/AuthDialog";
import { CommunityGalleryEditor } from "../components/CommunityGalleryEditor";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { ModifierPanel } from "../components/ModifierPanel";
import { displaceGeometry, DEFAULT_MODIFIER, type ModifierConfig } from "../engine/geometry-modifiers";
import { toast } from "sonner";
import * as THREE from "three";
import {
  Mountain,
  Download,
  Upload,
  Layers,
  Settings2,
  Box,
  ImagePlus,
  Palette,
  Ruler,
  Scan,
  Sun,
  Camera,
  RotateCcw,
  Check,
  Cpu,
  Globe,
  Save,
  Trash2,
  ShieldAlert,
  GripVertical,
  Maximize2,
  Minimize2,
  Loader2,
  Grid3x3,
  Axis3D,
  FlipHorizontal2,
  Square,
  Cylinder,
  Hexagon,
  Cone,
  Lock,
  LockOpen,
  FileUp,
  X,
} from "lucide-react";

// ─── Vorea accent ─────────────────────────────────────────────────────────────
const VOREA_GREEN = 0xc6e36c;

// ─── Default plate size (mm) ──────────────────────────────────────────────────
const DEFAULT_SIZE = 100;

type ThreeMfColorMode = "hybrid" | "slic3r-strict" | "split-objects";
type ReliefSurfaceMode = "plane" | "cylinder" | "box" | "polygon" | "lampshade" | "geodesic" | "stl";
type ImageScaleMode = "clamp" | "wrap";

interface ReliefPreset {
  id: string;
  name: string;
  description: string;
  surfaceMode: ReliefSurfaceMode;
  previewImage: string;
  imageScale: number;
  imageScaleMode: ImageScaleMode;
  imageRepeatX: boolean;
  imageRepeatY: boolean;
  gapFillMode: GapFillMode;
  gapFillColor: string;
  subdivisions: number;
  maxHeight: number;
  smoothing: number;
  invert: boolean;
  solid: boolean;
  baseThickness: number;
  colorZones: number;
  threeMfColorMode: ThreeMfColorMode;
  plateWidth: number;
  plateDepth: number;
  lockAspect: boolean;
  cylinderRadius: number;
  cylinderHeight: number;
  cylinderRepeats: number;
  cylinderFlipH: boolean;
  cylinderFlipV: boolean;
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, "");
  const normalized = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return [1, 1, 1];
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function rgb01ToHex(rgb: [number, number, number]): string {
  const toHex = (v: number) => {
    const c = Math.max(0, Math.min(255, Math.round(v * 255)));
    return c.toString(16).padStart(2, "0");
  };
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}

function normalizeGapFillMode(mode: unknown): "edge" | "color-hard" | "color-soft" {
  if (mode === "color-soft" || mode === "white-soft") return "color-soft";
  if (mode === "color-hard" || mode === "color" || mode === "white-hard") return "color-hard";
  return "edge";
}

const PREVIEW_PLANE = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a2238"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="320" height="180" fill="url(#bg)"/>
  <polygon points="46,121 160,82 274,121 160,160" fill="#7ea84f" opacity="0.92"/>
  <polyline points="46,121 160,82 274,121" stroke="#d6f58f" stroke-opacity="0.85" fill="none"/>
  <line x1="160" y1="82" x2="160" y2="160" stroke="#d6f58f" stroke-opacity="0.35"/>
  <text x="20" y="30" font-family="Arial" font-size="16" fill="#d8f4a0">Plano</text>
</svg>`);

const PREVIEW_CYLINDER = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#10203a"/>
      <stop offset="100%" stop-color="#0b1326"/>
    </linearGradient>
    <linearGradient id="cy" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#6f9350"/>
      <stop offset="50%" stop-color="#88b45d"/>
      <stop offset="100%" stop-color="#6a8f4d"/>
    </linearGradient>
  </defs>
  <rect width="320" height="180" fill="url(#bg2)"/>
  <ellipse cx="160" cy="44" rx="92" ry="18" fill="#6a8f4d"/>
  <rect x="68" y="44" width="184" height="96" fill="url(#cy)"/>
  <ellipse cx="160" cy="140" rx="92" ry="18" fill="#6a8f4d"/>
  <text x="20" y="30" font-family="Arial" font-size="16" fill="#d8f4a0">Cilindro</text>
</svg>`);

const RELIEF_PRESETS: ReliefPreset[] = [
  {
    id: "plane-balanced",
    name: "Balanced Plane",
    description: "Balanced quality for flat reliefs. Great starting point.",
    surfaceMode: "plane",
    previewImage: PREVIEW_PLANE,
    imageScale: 1,
    imageScaleMode: "clamp",
    imageRepeatX: true,
    imageRepeatY: true,
    gapFillMode: "color-hard",
    gapFillColor: "#ffffff",
    subdivisions: 600,
    maxHeight: 1.2,
    smoothing: 1,
    invert: true,
    solid: true,
    baseThickness: 2,
    colorZones: 4,
    threeMfColorMode: "hybrid",
    plateWidth: 100,
    plateDepth: 100,
    lockAspect: true,
    cylinderRadius: 140,
    cylinderHeight: 200,
    cylinderRepeats: 4,
    cylinderFlipH: true,
    cylinderFlipV: true,
  },
  {
    id: "plane-detail",
    name: "High-Detail Plane",
    description: "Maximum detail for intricate textures and fine art.",
    surfaceMode: "plane",
    previewImage: PREVIEW_PLANE,
    imageScale: 1,
    imageScaleMode: "clamp",
    imageRepeatX: true,
    imageRepeatY: true,
    gapFillMode: "color-hard",
    gapFillColor: "#ffffff",
    subdivisions: 900,
    maxHeight: 1,
    smoothing: 1,
    invert: true,
    solid: true,
    baseThickness: 2,
    colorZones: 4,
    threeMfColorMode: "hybrid",
    plateWidth: 100,
    plateDepth: 100,
    lockAspect: true,
    cylinderRadius: 140,
    cylinderHeight: 200,
    cylinderRepeats: 4,
    cylinderFlipH: true,
    cylinderFlipV: true,
  },
  {
    id: "cylinder-bambu",
    name: "Bambu Cylinder",
    description: "Optimized for Bambu Lab multicolor printing.",
    surfaceMode: "cylinder",
    previewImage: PREVIEW_CYLINDER,
    imageScale: 1,
    imageScaleMode: "clamp",
    imageRepeatX: true,
    imageRepeatY: true,
    gapFillMode: "color-hard",
    gapFillColor: "#ffffff",
    subdivisions: 750,
    maxHeight: 1,
    smoothing: 1,
    invert: true,
    solid: true,
    baseThickness: 2,
    colorZones: 4,
    threeMfColorMode: "slic3r-strict",
    plateWidth: 100,
    plateDepth: 100,
    lockAspect: true,
    cylinderRadius: 140,
    cylinderHeight: 200,
    cylinderRepeats: 4,
    cylinderFlipH: true,
    cylinderFlipV: true,
  },
  {
    id: "cylinder-wrap-soft",
    name: "Soft Wrap Cylinder",
    description: "Gentle relief on a compact cylindrical surface.",
    surfaceMode: "cylinder",
    previewImage: PREVIEW_CYLINDER,
    imageScale: 1,
    imageScaleMode: "clamp",
    imageRepeatX: true,
    imageRepeatY: true,
    gapFillMode: "color-hard",
    gapFillColor: "#ffffff",
    subdivisions: 650,
    maxHeight: 0.8,
    smoothing: 2,
    invert: true,
    solid: true,
    baseThickness: 2,
    colorZones: 4,
    threeMfColorMode: "slic3r-strict",
    plateWidth: 100,
    plateDepth: 100,
    lockAspect: true,
    cylinderRadius: 120,
    cylinderHeight: 30,
    cylinderRepeats: 3,
    cylinderFlipH: true,
    cylinderFlipV: true,
  },
];

const RECOMMENDED_PRESET_ID = "cylinder-bambu";

// ─── Zoom-to-fit helper ──────────────────────────────────────────────────────

function zoomToFitMesh(ctx: ThreeSceneContext, mesh: THREE.Mesh) {
  const geometry = mesh.geometry;
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  if (!bbox) return;

  const center = new THREE.Vector3();
  bbox.getCenter(center);
  center.y += mesh.position.y;

  const size = new THREE.Vector3();
  bbox.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);

  // Calculate distance so the object fills ~85% of the viewport
  const fov = ctx.camera.fov * (Math.PI / 180);
  const dist = (maxDim / 2) / Math.tan(fov / 2) * 1.15;

  ctx.controls.target.copy(center);
  ctx.camera.position.set(
    center.x + dist * 0.55,
    center.y + dist * 0.4,
    center.z + dist * 0.55
  );
  ctx.camera.lookAt(center);
  ctx.controls.update();
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Relief() {
  const { t } = useI18n();
  const workerRef = useRef<Worker | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // —— Parameters
  const [subdivisions, setSubdivisions] = useState(750);
  const [maxHeight, setMaxHeight]   = useState(1);
  const [smoothing, setSmoothing]   = useState(1);
  const [imageScale, setImageScale] = useState(1);
  const [imageScaleMode, setImageScaleMode] = useState<ImageScaleMode>("clamp");
  const [imageRepeatX, setImageRepeatX] = useState(true);
  const [imageRepeatY, setImageRepeatY] = useState(true);
  const [gapFillMode, setGapFillMode] = useState<GapFillMode>("color-hard");
  const [gapFillColor, setGapFillColor] = useState("#ffffff");
  const [plateWidth, setPlateWidth] = useState(DEFAULT_SIZE);
  const [plateDepth, setPlateDepth] = useState(DEFAULT_SIZE);
  const [lockAspect, setLockAspect] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1); // W/H
  const [surfaceMode, setSurfaceMode] = useState<ReliefSurfaceMode>("cylinder");
  const [cylinderRadius, setCylinderRadius] = useState(140);
  const [cylinderHeight, setCylinderHeight] = useState(200);
  const [cylinderRepeats, setCylinderRepeats] = useState(4);
  const [cylinderFlipH, setCylinderFlipH] = useState(true);
  const [cylinderFlipV, setCylinderFlipV] = useState(true);
  // Box mode
  const [boxHeight, setBoxHeight] = useState(100);
  const [boxCapTop, setBoxCapTop] = useState(true);
  const [boxCapBottom, setBoxCapBottom] = useState(true);
  // Polygon mode
  const [polygonSides, setPolygonSides] = useState(6);
  const [polygonRadius, setPolygonRadius] = useState(40);
  const [polygonHeight, setPolygonHeight] = useState(100);
  const [polygonCapTop, setPolygonCapTop] = useState(true);
  const [polygonCapBottom, setPolygonCapBottom] = useState(true);
  // Lampshade mode
  const [lampshadeRadiusBottom, setLampshadeRadiusBottom] = useState(50);
  const [lampshadeRadiusTop, setLampshadeRadiusTop] = useState(35);
  const [lampshadeHoleRadius, setLampshadeHoleRadius] = useState(25);
  const [lampshadeHeight, setLampshadeHeight] = useState(80);
  const [lampshadeCap, setLampshadeCap] = useState<"top" | "bottom" | "both" | "none">("bottom");
  const [lampshadeSides, setLampshadeSides] = useState(0);
  // Geodesic mode
  const [geodesicRadius, setGeodesicRadius] = useState(50);
  // STL surface mode
  const [stlDepthField, setStlDepthField] = useState<Float32Array | null>(null);
  const [stlNormalField, setStlNormalField] = useState<Float32Array | null>(null);
  const [stlValidMask, setStlValidMask] = useState<Uint8Array | null>(null);
  const [stlSurfaceWidth, setStlSurfaceWidth] = useState(100);
  const [stlSurfaceDepth, setStlSurfaceDepth] = useState(100);
  const [stlSurfaceName, setStlSurfaceName] = useState("");
  const stlSurfaceInputRef = useRef<HTMLInputElement>(null);
  const [stlProcessing, setStlProcessing] = useState(false);
  const [invert, setInvert]         = useState(true);
  const [solid, setSolid]           = useState(true);
  const [baseThickness, setBaseThickness] = useState(2);
  const [colorZones, setColorZones] = useState(4);

  // —— State
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageName, setImageName]     = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [generating, setGenerating]   = useState(false);
  const [result, setResult]           = useState<HeightmapResult | null>(null);
  const [meshHealth, setMeshHealth]   = useState<MeshHealthReport | null>(null);
  const [showGrid, setShowGrid]       = useState(true);
  const [showAxes, setShowAxes]       = useState(true);
  const [renderMode, setRenderMode]   = useState<RenderMode>("smooth");
  const [saving, setSaving]           = useState(false);
  const [authOpen, setAuthOpen]       = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetsModalOpen, setPresetsModalOpen] = useState(false);
  const [saveTitle, setSaveTitle]     = useState("");
  const [pendingSaveStatus, setPendingSaveStatus] = useState<"draft" | "published">("draft");
  const [publishMode, setPublishMode] = useState<CommunityPublishMode>("create");
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [forkedFromModelId, setForkedFromModelId] = useState<string | null>(null);
  const [galleryItems, setGalleryItems] = useState<EditableGalleryItem[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [selectedPaletteIndices, setSelectedPaletteIndices] = useState<number[]>([]);
  const [threeMfColorMode, setThreeMfColorMode] = useState<ThreeMfColorMode>("slic3r-strict");
  const [previewPalette, setPreviewPalette] = useState<Array<[number, number, number]>>([]);
  const [paramsDirty, setParamsDirty] = useState(false);
  const [lightIntensity, setLightIntensity] = useState(1.2);
  const [modifier, setModifier] = useState<ModifierConfig>({ ...DEFAULT_MODIFIER });

  // —— Collapsible sidebar sections
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([1]));  // Only "Image" open initially
  const toggleSection = useCallback((n: number) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }, []);

  // —— Auto-generate & dirty tracking refs
  const hasAutoGenerated = useRef(false);
  const lastGeneratedParamsRef = useRef<string | null>(null);

  const { isLoggedIn, refreshCredits } = useAuth();

  // ─── Diagnostic Hooks for Feedback / BigData ─────────────────────────────────
  useEffect(() => {
    (window as any).__vorea_get_engine_config = () => ({
      version: "1.0-bigdata",
      meshParams: {
        surfaceMode, subdivisions, maxHeight, smoothing, imageScale, imageScaleMode,
        imageRepeatX, imageRepeatY, gapFillMode, gapFillColor, plateWidth, plateDepth,
        lockAspect, aspectRatio, cylinderRadius, cylinderHeight, cylinderRepeats,
        cylinderFlipH, cylinderFlipV, boxHeight, boxCapTop, boxCapBottom, polygonSides,
        polygonRadius, polygonHeight, polygonCapTop, polygonCapBottom, lampshadeRadiusBottom,
        lampshadeRadiusTop, lampshadeHoleRadius, lampshadeHeight, lampshadeCap, lampshadeSides,
        geodesicRadius, invert, solid, baseThickness
      },
      exportParams: {
        colorZones, threeMfColorMode
      },
      health: meshHealth || null
    });
    
    (window as any).__vorea_get_model_snapshot = () => {
      const container = containerRef.current;
      if (!container || !sceneRef.current) return undefined;
      const { renderer, scene, camera } = sceneRef.current;
      // Force a synchronous render pass so the canvas buffer is loaded right now
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/webp', 0.6);
    };
  });

  // —— Refs
  const containerRef  = useRef<HTMLDivElement>(null);
  const sceneRef      = useRef<ThreeSceneContext | null>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const pendingAutoGenerate = useRef(false);
  const [stlAutoGenPending, setStlAutoGenPending] = useState(false);
  const generateRef = useRef<(() => void) | null>(null);
  const currentMeshRef = useRef<THREE.Mesh | null>(null);
  const originalGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const routeInitRef = useRef<string | null>(null);

  useEffect(() => {
    setCoverIndex((prev) => clampGalleryCoverIndex(galleryItems, prev));
  }, [galleryItems, coverIndex]);

  // ─── Auto-generate when STL surface data loads ────────────────────
  useEffect(() => {
    if (stlAutoGenPending && stlDepthField && generateRef.current) {
      setStlAutoGenPending(false);
      setParamsDirty(false);
      setTimeout(() => generateRef.current?.(), 50);
    }
  }, [stlAutoGenPending, stlDepthField]);

  // ─── Init Three.js ────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ctx = initScene(container);
    sceneRef.current = ctx;
    return () => { disposeScene(ctx); sceneRef.current = null; };
  }, []);

  // ─── Deep-link: restore edit/fork context from URL ────────────────
  useEffect(() => {
    const routeContext = parseCommunityRouteContext(searchParams);
    if (!routeContext) {
      routeInitRef.current = null;
      return;
    }

    const routeKey = `${routeContext.intent}:${routeContext.modelId}`;
    if (routeInitRef.current === routeKey) return;
    routeInitRef.current = routeKey;

    let cancelled = false;
    const restoreFromRoute = async () => {
      try {
        const details = await CommunityApi.getModel(routeContext.modelId);
        let reliefConfig = details.reliefConfig;
        if (!reliefConfig) {
          const downloaded = await CommunityApi.downloadModel(routeContext.modelId);
          reliefConfig = downloaded.reliefConfig || undefined;
        }
        if (!reliefConfig) {
          throw new Error(
            routeContext.intent === "edit"
              ? t("relief.loadErrorEdit")
              : t("relief.loadErrorCopy")
          );
        }
        if (cancelled) return;

        const openAsCopy = routeContext.intent === "fork";
        const nextTitle =
          openAsCopy && !details.title.endsWith(t("relief.copySuffix"))
            ? `${details.title}${t("relief.copySuffix")}`
            : details.title;

        setPublishMode(getCommunityPublishMode(routeContext));
        setEditingModelId(openAsCopy ? null : details.id);
        setForkedFromModelId(openAsCopy ? details.id : null);
        setSaveDialogOpen(false);
        setPendingSaveStatus("draft");
        setSaveTitle(nextTitle);
        setImageName(nextTitle);
        setResult(null);
        setParamsDirty(false);
        lastGeneratedParamsRef.current = null;
        hasAutoGenerated.current = false;

        if (currentMeshRef.current) {
          currentMeshRef.current.geometry.dispose();
          (currentMeshRef.current.material as THREE.Material).dispose();
          sceneRef.current?.meshGroup.remove(currentMeshRef.current);
          currentMeshRef.current = null;
        }

        setSubdivisions(reliefConfig.subdivisions ?? 750);
        setMaxHeight(reliefConfig.maxHeight ?? 1);
        setSmoothing(reliefConfig.smoothing ?? 1);
        setImageScale(reliefConfig.imageScale ?? 1);
        setImageScaleMode(reliefConfig.imageScaleMode ?? "clamp");
        setImageRepeatX(reliefConfig.imageRepeatX ?? true);
        setImageRepeatY(reliefConfig.imageRepeatY ?? true);
        setGapFillMode(normalizeGapFillMode(reliefConfig.gapFillMode));
        setGapFillColor(reliefConfig.gapFillColor ?? "#ffffff");
        setPlateWidth(reliefConfig.plateWidth ?? DEFAULT_SIZE);
        setPlateDepth(reliefConfig.plateDepth ?? DEFAULT_SIZE);
        setLockAspect(reliefConfig.lockAspect ?? true);
        setSurfaceMode(reliefConfig.surfaceMode ?? "cylinder");
        setCylinderRadius(reliefConfig.cylinderRadius ?? 140);
        setCylinderHeight(reliefConfig.cylinderHeight ?? 200);
        setCylinderRepeats(reliefConfig.cylinderRepeats ?? 4);
        setCylinderFlipH(reliefConfig.cylinderFlipH ?? true);
        setCylinderFlipV(reliefConfig.cylinderFlipV ?? true);
        setBoxHeight(reliefConfig.boxHeight ?? 100);
        setBoxCapTop(reliefConfig.boxCapTop ?? true);
        setBoxCapBottom(reliefConfig.boxCapBottom ?? true);
        setPolygonSides(reliefConfig.polygonSides ?? 6);
        setPolygonRadius(reliefConfig.polygonRadius ?? 40);
        setPolygonHeight(reliefConfig.polygonHeight ?? 100);
        setPolygonCapTop(reliefConfig.polygonCapTop ?? true);
        setPolygonCapBottom(reliefConfig.polygonCapBottom ?? true);
        setLampshadeRadiusBottom(reliefConfig.lampshadeOuterRadiusBottom ?? 50);
        setLampshadeRadiusTop(reliefConfig.lampshadeOuterRadiusTop ?? 35);
        setLampshadeHoleRadius(reliefConfig.lampshadeHoleRadius ?? 25);
        setLampshadeHeight(reliefConfig.lampshadeHeight ?? 80);
        setLampshadeCap(reliefConfig.lampshadeCap ?? "bottom");
        setLampshadeSides(reliefConfig.lampshadeSides ?? 0);
        setGeodesicRadius(reliefConfig.geodesicRadius ?? 50);
        setThreeMfColorMode(reliefConfig.threeMfColorMode ?? "slic3r-strict");
        setInvert(reliefConfig.invert ?? true);
        setSolid(reliefConfig.solid ?? true);
        setBaseThickness(reliefConfig.baseThickness ?? 2);
        setColorZones(reliefConfig.colorZones ?? 4);

        const gallery = resolveGalleryState(details.media, details.thumbnailUrl);
        setGalleryItems(gallery.items);
        setCoverIndex(gallery.coverIndex);

        if (reliefConfig.imageData) {
          const img = new Image();
          img.onload = () => {
            void registerImage("relief_image", reliefConfig.imageData).then(() => {
              if (cancelled) return;
              setImagePreview(reliefConfig.imageData);
              setImageLoaded(true);
              setAspectRatio(img.width / Math.max(1, img.height));
              pendingAutoGenerate.current = true;
              toast.success(
                openAsCopy
                  ? t("relief.copyReady", { title: details.title })
                  : t("relief.configRestored", { name: details.title })
              );
            });
          };
          img.src = reliefConfig.imageData;
        } else {
          setImagePreview(null);
          setImageLoaded(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          routeInitRef.current = null;
          toast.error(e?.message || t("relief.openError"));
        }
      }
    };

    void restoreFromRoute();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  // ─── Deep-link: auto-apply preset from URL on mount ───────────────
  const presetInitRef = useRef(false);
  useEffect(() => {
    if (presetInitRef.current) return;
    presetInitRef.current = true;
    if (parseCommunityRouteContext(searchParams)) return;
    const presetId = searchParams.get("preset");
    if (presetId) {
      const preset = RELIEF_PRESETS.find((p) => p.id === presetId);
      if (preset) {
        applyPreset(preset);
      }
    }
  }, []); // eslint-disable-line

  // ─── Auto-load Voronoi heightmap from Organic Engine ─────────────
  useEffect(() => {
    const heightmapData = sessionStorage.getItem("vorea_organic_heightmap");
    if (!heightmapData) return;
    sessionStorage.removeItem("vorea_organic_heightmap"); // consume once
    const modeName = sessionStorage.getItem("vorea_organic_heightmap_mode") || "Organic";
    sessionStorage.removeItem("vorea_organic_heightmap_mode");

    (async () => {
      try {
        await registerImage("relief_image", heightmapData);
        const img = new Image();
        img.onload = () => {
          setAspectRatio(img.width / Math.max(1, img.height));
          setImageLoaded(true);
          setImagePreview(heightmapData);
          setImageName(`${modeName} — Organic Engine`);
          setOpenSections(prev => { const n = new Set(prev); n.add(2); return n; });
          pendingAutoGenerate.current = true;
          toast.success(`${modeName} heightmap loaded from Organic Engine`);
        };
        img.src = heightmapData;
      } catch (e) {
        console.error("[Relief] Failed to load Voronoi heightmap:", e);
      }
    })();
  }, []); // eslint-disable-line

  // ─── Resize ───────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resize = () => {
      const ctx = sceneRef.current;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 600;
      if (ctx && w > 0 && h > 0) resizeScene(ctx, w, h);
    };
    resize();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(resize);
      ro.observe(container);
      return () => ro.disconnect();
    }
  }, []);

  // ─── Grid / Axes  ─────────────────────────────────────────────────
  useEffect(() => { const c = sceneRef.current; if (c) setGridVisible(c, showGrid); }, [showGrid]);
  useEffect(() => { const c = sceneRef.current; if (c) setAxesVisible(c, showAxes); }, [showAxes]);
  useEffect(() => {
    if (!result || result.colorZones <= 1 || result.palette.length === 0) {
      setSelectedPaletteIndices([]);
      return;
    }
    setSelectedPaletteIndices(result.palette.map((_, idx) => idx));
  }, [result]);
  useEffect(() => {
    if (!result || result.palette.length === 0 || selectedPaletteIndices.length === 0) return;
    const firstSelected = selectedPaletteIndices.find(
      (idx) => idx >= 0 && idx < result.palette.length
    );
    if (firstSelected == null) return;
    const autoHex = rgb01ToHex(result.palette[firstSelected]).toLowerCase();
    setGapFillColor((prev) => (prev.toLowerCase() === autoHex ? prev : autoHex));
  }, [result, selectedPaletteIndices]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const image = getImage("relief_image");
      if (!image || colorZones <= 1) {
        setPreviewPalette([]);
        return;
      }
      try {
        setPreviewPalette(estimatePaletteFromImage(image, colorZones));
      } catch {
        setPreviewPalette([]);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [imageLoaded, imagePreview, colorZones]);

  // ─── Current params key (for dirty detection) ─────────────────────
  const currentParamsKey = JSON.stringify([
    subdivisions, maxHeight, smoothing, imageScale, imageScaleMode,
    imageRepeatX, imageRepeatY, gapFillMode, gapFillColor,
    plateWidth, plateDepth, surfaceMode,
    cylinderRadius, cylinderHeight, cylinderRepeats, cylinderFlipH, cylinderFlipV,
    invert, solid, baseThickness, colorZones,
    boxHeight, boxCapTop, boxCapBottom,
    polygonSides, polygonRadius, polygonHeight, polygonCapTop, polygonCapBottom,
    lampshadeRadiusBottom, lampshadeRadiusTop, lampshadeHoleRadius,
    lampshadeHeight, lampshadeCap, lampshadeSides,
    geodesicRadius,
    renderMode,
  ]);

  // ─── Auto-generate on first image load ────────────────────────────
  useEffect(() => {
    if (pendingAutoGenerate.current && imageLoaded && !generating && !hasAutoGenerated.current) {
      pendingAutoGenerate.current = false;
      // Small delay so state has propagated (plate sizing, aspect ratio)
      const timer = setTimeout(() => {
        const image = getImage("relief_image");
        if (image && generateRef.current) generateRef.current();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [imageLoaded, generating]);

  // ─── Dirty params detection ───────────────────────────────────────
  useEffect(() => {
    if (!result) return; // No previous generation — nothing to compare
    if (lastGeneratedParamsRef.current === null) return;
    // Suppress dirty detection during STL processing/auto-gen
    if (stlProcessing || stlAutoGenPending) return;
    if (currentParamsKey !== lastGeneratedParamsRef.current) {
      setParamsDirty(true);
    } else {
      setParamsDirty(false);
    }
  }, [currentParamsKey, result, stlProcessing, stlAutoGenPending]);

  // ─── Plate width change (with aspect lock) ────────────────────────
  const handleWidthChange = useCallback((val: number) => {
    setPlateWidth(val);
    if (lockAspect && aspectRatio > 0) setPlateDepth(Math.round(val / aspectRatio));
  }, [lockAspect, aspectRatio]);

  const handleDepthChange = useCallback((val: number) => {
    setPlateDepth(val);
    if (lockAspect && aspectRatio > 0) setPlateWidth(Math.round(val * aspectRatio));
  }, [lockAspect, aspectRatio]);

  const applyPreset = useCallback((preset: ReliefPreset) => {
    setSubdivisions(preset.subdivisions);
    setMaxHeight(preset.maxHeight);
    setSmoothing(preset.smoothing);
    setImageScale(preset.imageScale);
    setImageScaleMode(preset.imageScaleMode);
    setImageRepeatX(preset.imageRepeatX);
    setImageRepeatY(preset.imageRepeatY);
    setGapFillMode(preset.gapFillMode);
    setGapFillColor(preset.gapFillColor);
    setSurfaceMode(preset.surfaceMode);
    setInvert(preset.invert);
    setSolid(preset.solid);
    setBaseThickness(preset.baseThickness);
    setColorZones(preset.colorZones);
    setThreeMfColorMode(preset.threeMfColorMode);
    setPlateWidth(preset.plateWidth);
    setPlateDepth(preset.plateDepth);
    setLockAspect(preset.lockAspect);
    setCylinderRadius(preset.cylinderRadius);
    setCylinderHeight(preset.cylinderHeight);
    setCylinderRepeats(preset.cylinderRepeats);
    setCylinderFlipH(preset.cylinderFlipH);
    setCylinderFlipV(preset.cylinderFlipV);
    setPresetsModalOpen(false);
    // Update URL so the preset is shareable
    setSearchParams({ preset: preset.id });
    toast.success(`Preset applied: ${preset.name}`);
  }, [setSearchParams, t]);

  const restoreRecommendedDefaults = useCallback(() => {
    const preset = RELIEF_PRESETS.find((p) => p.id === RECOMMENDED_PRESET_ID);
    if (!preset) return;
    applyPreset(preset);
  }, [applyPreset]);

  // ─── Image upload ─────────────────────────────────────────────────
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      await registerImage("relief_image", dataUrl);
      // Read image natural dimensions for auto-sizing
      const img = new Image();
      img.onload = () => {
        const imgW = img.naturalWidth, imgH = img.naturalHeight;
        const ratio = imgW / imgH;
        setAspectRatio(ratio);
        // Auto-size plate: keep longest side at DEFAULT_SIZE
        let newW: number, newD: number;
        if (ratio >= 1) {
          newW = DEFAULT_SIZE;
          newD = Math.round(DEFAULT_SIZE / ratio);
        } else {
          newD = DEFAULT_SIZE;
          newW = Math.round(DEFAULT_SIZE * ratio);
        }
        setPlateWidth(newW);
        setPlateDepth(newD);
        setLockAspect(true);
      };
      img.src = dataUrl;
      setImageLoaded(true);
      setImageName(file.name);
      setImagePreview(dataUrl);
      // Auto-open Shape + Dimensions sections when image loaded
      setOpenSections(prev => { const n = new Set(prev); n.add(2); n.add(3); return n; });
      // Schedule auto-generate for first image load
      if (!hasAutoGenerated.current) {
        pendingAutoGenerate.current = true;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  // ─── STL → heightmap import ───────────────────────────────────────
  const stlInputRef = useRef<HTMLInputElement>(null);

  const handleSTLUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    try {
      toast.info("Converting STL to heightmap...");
      const buffer = await file.arrayBuffer();
      const geometry = parseSTL(buffer);
      const dataUrl = stlToHeightmap(geometry, 512);

      await registerImage("relief_image", dataUrl);
      const img = new Image();
      img.onload = () => {
        setAspectRatio(1); // STL heightmaps are square
        setPlateWidth(DEFAULT_SIZE);
        setPlateDepth(DEFAULT_SIZE);
        setLockAspect(true);
      };
      img.src = dataUrl;
      setImageLoaded(true);
      setImageName(`${file.name} (STL heightmap)`);
      setImagePreview(dataUrl);
      setOpenSections(prev => { const n = new Set(prev); n.add(2); n.add(3); return n; });
      if (!hasAutoGenerated.current) {
        pendingAutoGenerate.current = true;
      }
      toast.success(`STL converted to heightmap: ${file.name}`);
    } catch (err: any) {
      toast.error(`Error loading STL: ${err?.message || "Unknown error"}`);
    }
    e.target.value = "";
  }, []);

  // ─── SVG → heightmap import ───────────────────────────────────────
  const svgInputRef = useRef<HTMLInputElement>(null);

  const handleSVGUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    try {
      const svgText = await file.text();

      // Check if SVG has vector shapes — use high-res vector mode
      if (svgHasVectorContent(svgText)) {
        toast.info(t("relief.svg.vectorProcessing", { defaultValue: `Processing vector SVG: ${file.name}...` }));

        const result = await parseSvgToSurface(svgText);

        await registerImage("relief_image", result.heightmapDataUrl);

        const aspect = result.aspect;
        let newW: number, newD: number;
        if (aspect >= 1) { newW = DEFAULT_SIZE; newD = Math.round(DEFAULT_SIZE / aspect); }
        else { newD = DEFAULT_SIZE; newW = Math.round(DEFAULT_SIZE * aspect); }
        setAspectRatio(aspect);
        setPlateWidth(newW);
        setPlateDepth(newD);
        setLockAspect(true);
        setImageLoaded(true);
        setImageName(`${file.name} (SVG vector — ${result.elementCount} shapes)`);
        setImagePreview(result.heightmapDataUrl);
        setOpenSections(prev => { const n = new Set(prev); n.add(2); n.add(3); return n; });
        if (!hasAutoGenerated.current) {
          pendingAutoGenerate.current = true;
        }
        toast.success(t("relief.svg.vectorLoaded", { defaultValue: `SVG vector loaded: ${file.name} (${result.elementCount} shapes, 2048px)` }));
      } else {
        // Fallback: raster SVG (no vector shapes found)
        const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = async () => {
          URL.revokeObjectURL(url);
          const SIZE = 512;
          const canvas = document.createElement("canvas");
          canvas.width = SIZE;
          canvas.height = SIZE;
          const ctx = canvas.getContext("2d")!;

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, SIZE, SIZE);

          const aspect = img.width / img.height;
          let drawW = SIZE, drawH = SIZE;
          if (aspect > 1) { drawH = SIZE / aspect; } else { drawW = SIZE * aspect; }
          const offsetX = (SIZE - drawW) / 2;
          const offsetY = (SIZE - drawH) / 2;
          ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

          const imgData = ctx.getImageData(0, 0, SIZE, SIZE);
          for (let i = 0; i < imgData.data.length; i += 4) {
            const gray = Math.round(
              imgData.data[i] * 0.299 + imgData.data[i + 1] * 0.587 + imgData.data[i + 2] * 0.114
            );
            imgData.data[i] = gray;
            imgData.data[i + 1] = gray;
            imgData.data[i + 2] = gray;
          }
          ctx.putImageData(imgData, 0, 0);

          const dataUrl = canvas.toDataURL("image/png");
          await registerImage("relief_image", dataUrl);

          setAspectRatio(aspect);
          let newW: number, newD: number;
          if (aspect >= 1) { newW = DEFAULT_SIZE; newD = Math.round(DEFAULT_SIZE / aspect); }
          else { newD = DEFAULT_SIZE; newW = Math.round(DEFAULT_SIZE * aspect); }
          setPlateWidth(newW);
          setPlateDepth(newD);
          setLockAspect(true);
          setImageLoaded(true);
          setImageName(`${file.name} (SVG heightmap)`);
          setImagePreview(dataUrl);
          setOpenSections(prev => { const n = new Set(prev); n.add(2); n.add(3); return n; });
          if (!hasAutoGenerated.current) {
            pendingAutoGenerate.current = true;
          }
          toast.success(`SVG converted to heightmap: ${file.name}`);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          toast.error("Error rendering SVG file");
        };
        img.src = url;
      }
    } catch (err: any) {
      toast.error(`Error loading SVG: ${err?.message || "Unknown error"}`);
    }
    e.target.value = "";
  }, []);

  // ─── STL → surface shape import (Web Worker for non-blocking UI) ──
  const stlWorkerRef = useRef<Worker | null>(null);
  const stlRawBufferRef = useRef<ArrayBuffer | null>(null);
  const handleSTLSurfaceUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setStlProcessing(true);
    setSurfaceMode("stl" as any);
    setStlSurfaceName(file.name);

    try {
      const toastId = toast.loading(
        t("relief.stl.processing", { defaultValue: `Processing ${file.name}...` })
      );
      const buffer = await file.arrayBuffer();
      // Store a copy of the raw STL buffer for direct rendering mode
      stlRawBufferRef.current = buffer.slice(0);
      const gridRes = Math.min(subdivisions, 200);

      // Terminate previous worker if still running
      if (stlWorkerRef.current) {
        stlWorkerRef.current.terminate();
        stlWorkerRef.current = null;
      }

      // Spawn Web Worker for off-thread raycasting
      const worker = new Worker(
        new URL("../engine/surface-modes/stl-surface.worker.ts", import.meta.url),
        { type: "module" }
      );
      stlWorkerRef.current = worker;

      await new Promise<void>((resolve, reject) => {
        worker.onmessage = (ev) => {
          const msg = ev.data;

          if (msg.type === "progress") {
            toast.loading(
              t("relief.stl.processing", { defaultValue: `Processing ${file.name}... ${msg.percent}%` }),
              { id: toastId }
            );
            return;
          }

          if (msg.type === "error") {
            toast.error(`Error: ${msg.message}`, { id: toastId });
            reject(new Error(msg.message));
            return;
          }

          if (msg.type === "result") {
            setStlDepthField(msg.depthField);
            setStlNormalField(msg.normalField);
            setStlValidMask(msg.validMask);
            setStlSurfaceWidth(msg.width);
            setStlSurfaceDepth(msg.depth);
            setPlateWidth(Math.round(msg.width));
            setPlateDepth(Math.round(msg.depth));
            toast.success(
              t("relief.stl.loaded", { defaultValue: `STL loaded: ${file.name}` }),
              { id: toastId }
            );
            setStlAutoGenPending(true);
            setParamsDirty(false);
            // Auto-open Shape + Dimensions sections
            setOpenSections(prev => { const n = new Set(prev); n.add(2); n.add(3); return n; });
            resolve();
          }
        };
        worker.onerror = (err) => {
          toast.error(`Worker error: ${err.message}`, { id: toastId });
          reject(err);
        };

        // Send buffer (transferred, not copied)
        worker.postMessage({ stlBuffer: buffer, gridW: gridRes, gridH: gridRes }, [buffer]);
      });
    } catch (err: any) {
      toast.error(`Error loading STL: ${err?.message || "Unknown error"}`);
    } finally {
      setStlProcessing(false);
      stlWorkerRef.current?.terminate();
      stlWorkerRef.current = null;
    }
    e.target.value = "";
  }, [subdivisions, t]);

  // ─── Generate relief ──────────────────────────────────────────────
  const zoomToFit = useCallback(() => {
    const ctx = sceneRef.current;
    const mesh = currentMeshRef.current;
    if (ctx && mesh) zoomToFitMesh(ctx, mesh);
  }, []);

  const cancelGeneration = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setGenerating(false);
  }, []);

  const generate = useCallback(async () => {
    let image = getImage("relief_image");
    let isStlOnly = false;

    if (surfaceMode === "stl" && stlRawBufferRef.current) {
      // ─── Direct STL mode: render original mesh with full fidelity ──
      // Uses cylindrical UV projection + image texture sampling
      const loader = new STLLoader();
      let geo = loader.parse(stlRawBufferRef.current.slice(0));
      // Merge duplicate vertices to create indexed geometry.
      // Critical: without this, displacement moves duplicated vertices independently → gaps.
      geo = mergeVertices(geo, 0.0001);
      geo.computeVertexNormals();

      // ─── Auto-repair: detect and close open edges ──────────────
      const preCheck = inspectMesh(geo);
      if (preCheck.boundaryEdges > 0 || !preCheck.isManifold) {
        try {
          toast(`Reparando mesh (${preCheck.boundaryEdges} bordes abiertos)…`, { icon: "🔧", duration: 3000 });
          const repaired = await repairMesh(geo);
          if (repaired.wasRepaired) {
            geo = repaired.geometry;
            geo.computeVertexNormals();
            toast.success(`Mesh reparado en ${Math.round(repaired.repairTimeMs)}ms`, { duration: 3000 });
          }
        } catch (repairErr) {
          console.warn("Mesh repair failed, using original:", repairErr);
        }
      }

      geo.computeBoundingBox();
      const bbox = geo.boundingBox!;
      const geoSize = new THREE.Vector3();
      bbox.getSize(geoSize);
      const geoCenter = new THREE.Vector3();
      bbox.getCenter(geoCenter);

      // ─── Generate cylindrical UVs with mapping parameters ─────
      const posAttr = geo.attributes.position;
      const normAttr = geo.attributes.normal;
      const vertCount = posAttr.count;
      const uvs = new Float32Array(vertCount * 2);

      // imageScale: for STL, multiply UVs to tile the texture
      const scale = imageScale || 1;
      const repeatX = imageRepeatX ? 2 : 1;
      const repeatY = imageRepeatY ? 2 : 1;
      // Model diagonal for proportional displacement
      const modelDiag = Math.sqrt(geoSize.x ** 2 + geoSize.y ** 2 + geoSize.z ** 2) || 1;

      for (let i = 0; i < vertCount; i++) {
        const x = posAttr.getX(i) - geoCenter.x;
        const z = posAttr.getZ(i) - geoCenter.z;
        const y = posAttr.getY(i);
        // U = angle around Y axis (0..1)
        let u = Math.atan2(z, x) / (2 * Math.PI);
        if (u < 0) u += 1;
        // V = normalized height (0..1)
        const v = geoSize.y > 0 ? (y - bbox.min.y) / geoSize.y : 0.5;

        // Apply scale — multiply to tile the texture
        let su = u * scale * repeatX;
        let sv = v * scale * repeatY;

        // Wrap based on imageScaleMode
        if (imageScaleMode === "wrap") {
          su = ((su % 1) + 1) % 1;
          sv = ((sv % 1) + 1) % 1;
        } else {
          su = Math.max(0, Math.min(1, su));
          sv = Math.max(0, Math.min(1, sv));
        }

        uvs[i * 2] = su;
        uvs[i * 2 + 1] = sv;
      }
      geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

      // ─── Sample image to vertex colors + displacement ──────────
      const image = getImage("relief_image");
      let hasVertexColors = false;
      const paletteMap = new Map<string, [number, number, number]>();

      if (image) {
        const w = image.width, h = image.height, d = image.data;
        const colors = new Float32Array(vertCount * 3);
        // Displacement proportional to model size (maxHeight as % of diagonal)
        const displacementScale = (maxHeight || 0) * modelDiag * 0.005;

        for (let i = 0; i < vertCount; i++) {
          const u = uvs[i * 2];
          const v = uvs[i * 2 + 1];
          const px = Math.max(0, Math.min(w - 1, Math.floor(u * w)));
          const py = Math.max(0, Math.min(h - 1, Math.floor((1 - v) * h)));
          const idx = (py * w + px) * 4;
          let r = d[idx] / 255;
          let g = d[idx + 1] / 255;
          let b = d[idx + 2] / 255;

          // Apply invert
          if (invert) { r = 1 - r; g = 1 - g; b = 1 - b; }

          colors[i * 3] = r;
          colors[i * 3 + 1] = g;
          colors[i * 3 + 2] = b;

          // Apply displacement along normal based on brightness
          if (displacementScale > 0 && normAttr) {
            const brightness = r * 0.299 + g * 0.587 + b * 0.114;
            const disp = brightness * displacementScale;
            const nx = normAttr.getX(i);
            const ny = normAttr.getY(i);
            const nz = normAttr.getZ(i);
            posAttr.setX(i, posAttr.getX(i) + nx * disp);
            posAttr.setY(i, posAttr.getY(i) + ny * disp);
            posAttr.setZ(i, posAttr.getZ(i) + nz * disp);
          }

          // Track palette for color zones
          if (colorZones > 1) {
            const key = `${Math.round(r * 10)},${Math.round(g * 10)},${Math.round(b * 10)}`;
            if (!paletteMap.has(key)) paletteMap.set(key, [r, g, b]);
          }
        }

        // If displacement was applied, recompute normals
        if (displacementScale > 0) {
          posAttr.needsUpdate = true;
          geo.computeVertexNormals();
          geo.computeBoundingBox();
        }

        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        hasVertexColors = true;
      }

      const ctx = sceneRef.current;
      if (ctx) {
        // Remove existing mesh
        if (currentMeshRef.current) {
          currentMeshRef.current.geometry.dispose();
          (currentMeshRef.current.material as THREE.Material).dispose();
          ctx.meshGroup.remove(currentMeshRef.current);
        }
        while (ctx.meshGroup.children.length > 0) ctx.meshGroup.remove(ctx.meshGroup.children[0]);

        // Create material
        let material: THREE.Material;
        if (renderMode === "wireframe") {
          material = new THREE.MeshBasicMaterial({ color: VOREA_GREEN, wireframe: true, transparent: true, opacity: 0.5 });
        } else if (hasVertexColors) {
          material = new THREE.MeshStandardMaterial({
            vertexColors: true, metalness: 0.30, roughness: 0.32,
            flatShading: renderMode === "faceted", side: THREE.DoubleSide,
          });
        } else {
          material = new THREE.MeshStandardMaterial({
            color: VOREA_GREEN, metalness: 0.38, roughness: 0.30,
            flatShading: renderMode === "faceted", side: THREE.DoubleSide,
          });
        }

        // Store original geometry and apply modifier
        originalGeoRef.current = geo;
        const finalGeo = modifier.enabled ? displaceGeometry(geo, modifier) : geo;

        const mesh = new THREE.Mesh(finalGeo, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Center on grid and rest on Y=0
        mesh.position.set(-geoCenter.x, -bbox.min.y, -geoCenter.z);

        ctx.meshGroup.add(mesh);
        currentMeshRef.current = mesh;

        // Build palette from sampled colors
        const palette: [number, number, number][] = paletteMap.size > 0
          ? Array.from(paletteMap.values()).slice(0, colorZones)
          : [];

        // Set result for UI state
        const faceCount = geo.index ? geo.index.count / 3 : (posAttr.count || 0) / 3;
        setResult({
          geometry: geo,
          heightsRef: new Float32Array(0),
          cols: 0,
          gridW: 0,
          gridH: 0,
          faceCount,
          generationTimeMs: 0,
          colorZones: hasVertexColors ? colorZones : 1,
          palette,
        } as any);
        setMeshHealth(inspectMesh(geo));
        lastGeneratedParamsRef.current = currentParamsKey;
        trackAnalyticsEvent("relief_create", { tool: "relief", surface: "stl-direct" });

        zoomToFitMesh(ctx, mesh);
      }
      setGenerating(false);
      setParamsDirty(false);
      return;
    }

    // For STL surface mode with heightmap: allow generating without a heightmap
    // by using a flat white placeholder (no displacement)
    if (!image && surfaceMode === "stl" && stlDepthField) {
      const sz = 64;
      const data = new Uint8ClampedArray(sz * sz * 4);
      data.fill(255); // all white = 0 displacement
      image = new ImageData(data, sz, sz);
      // Force zero maxHeight for pure STL render (no deformation)
      isStlOnly = true;
    }

    if (!image) return;
    setGenerating(true);
    setParamsDirty(false);
    hasAutoGenerated.current = true;

    const options = {
      subdivisions, maxHeight: isStlOnly ? 0 : maxHeight, smoothing, imageScale, imageScaleMode,
      imageRepeatX, imageRepeatY,
      gapFillMode, gapFillColor: hexToRgb01(gapFillColor),
      width: plateWidth, depth: plateDepth,
      surfaceMode, cylinderRadius, cylinderHeight, cylinderRepeats,
      cylinderFlipH, cylinderFlipV,
      invert, solid: surfaceMode === "geodesic" ? false : solid, baseThickness, colorZones,
      boxHeight, boxCapTop, boxCapBottom,
      polygonSides, polygonRadius, polygonHeight, polygonCapTop, polygonCapBottom,
      lampshadeOuterRadiusBottom: lampshadeRadiusBottom,
      lampshadeOuterRadiusTop: lampshadeRadiusTop,
      lampshadeHoleRadius,
      lampshadeHeight, lampshadeCap, lampshadeSides,
      geodesicRadius,
      // STL surface data
      ...(surfaceMode === "stl" && stlDepthField && stlNormalField ? {
        stlDepthField,
        stlNormalField,
        stlValidMask: stlValidMask ?? undefined,
        stlWidth: stlSurfaceWidth,
        stlDepth: stlSurfaceDepth,
      } : {}),
    };

    const handleSuccess = (res: any) => {
      setResult(res);
      const health = res?.geometry ? inspectMesh(res.geometry) : null;
      if (health) setMeshHealth(health);
      trackAnalyticsEvent("relief_create", { tool: "relief", surface: surfaceMode });
      // -- Engine telemetry: capture generation event --
      const engineSnap: EngineSnapshot = {
        surfaceMode, subdivisions, maxHeight, smoothing, colorZones,
        invert, solid, baseThickness, plateWidth, plateDepth,
        cylinderRadius, cylinderHeight, polygonSides, polygonRadius,
        imageScale, imageScaleMode,
      };
      const meshSnap: MeshHealthSnapshot | undefined = health ? {
        meshScore: health.score, meshFaces: health.totalFaces,
        meshVertices: health.totalVertices, boundaryEdges: health.boundaryEdges,
        nonManifoldEdges: health.nonManifoldEdges, meshVolume: health.volumeEstimate,
      } : undefined;
      telemetry.track("generation", {
        engine: engineSnap, mesh: meshSnap,
        generationTimeMs: res?.generationTimeMs,
      });
      // Snapshot current params so we can detect future changes
      lastGeneratedParamsRef.current = currentParamsKey;
      const ctx = sceneRef.current;
      if (ctx) {
        if (currentMeshRef.current) {
          currentMeshRef.current.geometry.dispose();
          (currentMeshRef.current.material as THREE.Material).dispose();
          ctx.meshGroup.remove(currentMeshRef.current);
        }
        while (ctx.meshGroup.children.length > 0) ctx.meshGroup.remove(ctx.meshGroup.children[0]);

        let material: THREE.Material;
        if (renderMode === "wireframe") {
          material = new THREE.MeshBasicMaterial({ color: VOREA_GREEN, wireframe: true, transparent: true, opacity: 0.5 });
        } else if (colorZones > 1) {
          material = new THREE.MeshStandardMaterial({
            vertexColors: true, metalness: 0.35, roughness: 0.28,
            flatShading: renderMode === "faceted", side: THREE.DoubleSide,
          });
        } else {
          material = new THREE.MeshStandardMaterial({
            color: VOREA_GREEN, metalness: 0.38, roughness: 0.30,
            flatShading: renderMode === "faceted", side: THREE.DoubleSide,
          });
        }

        // Store original geometry and apply modifier
        originalGeoRef.current = res.geometry;
        const finalGeo = modifier.enabled ? displaceGeometry(res.geometry, modifier) : res.geometry;

        const mesh = new THREE.Mesh(finalGeo, material);
        mesh.castShadow = true; mesh.receiveShadow = true;
        // Keep model resting on grid plane.
        finalGeo.computeBoundingBox();
        const bbox = finalGeo.boundingBox;
        if (bbox) {
          mesh.position.y += -bbox.min.y;
        }
        ctx.meshGroup.add(mesh);
        currentMeshRef.current = mesh;

        // Auto-zoom to fit object in viewport
        zoomToFitMesh(ctx, mesh);
      }
      setGenerating(false);
    };

    if (subdivisions > 1000) {
      if (workerRef.current) workerRef.current.terminate();

      workerRef.current = new Worker(new URL('../engine/relief-worker.ts', import.meta.url), { type: 'module' });
      workerRef.current.onmessage = (e) => {
        if (e.data.status === "error") {
          console.error("[Relief] Worker error:", e.data.error);
          setGenerating(false);
          return;
        }
        // Reconstruct buffer geometry from array buffers
        const geometry = new THREE.BufferGeometry();
        if (e.data.positions && e.data.positions.length) {
          geometry.setAttribute("position", new THREE.BufferAttribute(e.data.positions, 3));
        }
        if (e.data.normals && e.data.normals.length) {
          geometry.setAttribute("normal", new THREE.BufferAttribute(e.data.normals, 3));
        }
        if (e.data.colors && e.data.colors.length) {
          geometry.setAttribute("color", new THREE.BufferAttribute(e.data.colors, 3));
        }
        
        handleSuccess({
          geometry,
          heightsRef: new Float32Array(), // Mocked (not used heavily downstream by UI)
          cols: e.data.cols,
          gridW: e.data.gridW,
          gridH: e.data.gridH,
          faceCount: e.data.faceCount,
          generationTimeMs: e.data.generationTimeMs,
          colorZones: e.data.colorZones,
          hasVertexColors: e.data.hasVertexColors,
          palette: e.data.palette,
          surfaceMode: e.data.surfaceMode
        });
      };

      workerRef.current.onerror = (err) => {
        console.error("[Relief] Worker critical error:", err.message);
        setGenerating(false);
      };

      workerRef.current.postMessage({
        ...options,
        imageData: image.data,
        imageWidth: image.width,
        imageHeight: image.height,
      });

    } else {
      // Small mesh -> Main thread is fast enough
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            const res = generateHeightmapMesh({ image, ...options });
            handleSuccess(res);
          } catch (err) {
            console.error("[Relief] Generation error:", err);
            setGenerating(false);
          }
        }, 30);
      });
    }
  }, [
    subdivisions,
    maxHeight,
    smoothing,
    imageScale,
    imageScaleMode,
    imageRepeatX,
    imageRepeatY,
    gapFillMode,
    gapFillColor,
    plateWidth,
    plateDepth,
    surfaceMode,
    cylinderRadius,
    cylinderHeight,
    cylinderRepeats,
    cylinderFlipH,
    cylinderFlipV,
    invert,
    solid,
    baseThickness,
    colorZones,
    renderMode,
    // Box
    boxHeight, boxCapTop, boxCapBottom,
    // Polygon
    polygonSides, polygonRadius, polygonHeight, polygonCapTop, polygonCapBottom,
    // Lampshade
    lampshadeRadiusBottom, lampshadeRadiusTop, lampshadeHoleRadius,
    lampshadeHeight, lampshadeCap, lampshadeSides,
    modifier,
  ]);

  // Keep generateRef in sync for auto-generate useEffect
  generateRef.current = generate;

  // ─── Re-apply modifier when config changes ────────────────────────
  useEffect(() => {
    const ctx = sceneRef.current;
    const mesh = currentMeshRef.current;
    const origGeo = originalGeoRef.current;
    if (!ctx || !mesh || !origGeo) return;

    const newGeo = modifier.enabled ? displaceGeometry(origGeo, modifier) : origGeo;
    mesh.geometry.dispose();
    mesh.geometry = newGeo;
    newGeo.computeBoundingBox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modifier]);

  // ─── Export STL ───────────────────────────────────────────────────
  const exportSTL = useCallback(async () => {
    if (!result) return;
    const allowed = await consumeProtectedToolAction({
      isLoggedIn,
      toolId: "relief",
      actionId: "export_stl",
      onAuthRequired: () => setAuthOpen(true),
      authMessage: t("relief.loginToExportSTL", { defaultValue: "Inicia sesión para exportar tu relieve en STL." }),
      onConsumed: refreshCredits,
    });
    if (!allowed) {
      return;
    }
    // Pre-download health warning
    if (meshHealth && meshHealth.score === "not-printable") {
      toast(meshHealth.summary, { icon: "⚠️", duration: 5000 });
    }
    const exportGeo = currentMeshRef.current?.geometry ?? result.geometry;
    const blob = exportToSTL(exportGeo);
    downloadBlob(blob, "relieve-vorea.stl");
    trackAnalyticsEvent("export_stl", { tool: "relief", meshScore: meshHealth?.score });
    // -- Engine telemetry: capture STL export --
    telemetry.track("export_stl", {
      engine: { surfaceMode, subdivisions, maxHeight, exportFormat: "stl" },
      mesh: meshHealth ? {
        meshScore: meshHealth.score, meshFaces: meshHealth.totalFaces,
        meshVertices: meshHealth.totalVertices, boundaryEdges: meshHealth.boundaryEdges,
        nonManifoldEdges: meshHealth.nonManifoldEdges, meshVolume: meshHealth.volumeEstimate,
      } : undefined,
    });
  }, [isLoggedIn, meshHealth, refreshCredits, result, t]);

  // ─── Export 3MF ───────────────────────────────────────────────────
  const export3MF = useCallback(async () => {
    if (!result) return;
    const selectedForExport = selectedPaletteIndices.filter(
      (idx) => idx >= 0 && idx < result.palette.length
    );
    if (result.colorZones > 1 && selectedForExport.length === 0) {
      toast.error(t("relief.exportSelectColors"));
      return;
    }
    const actionId =
      result.colorZones > 1 && threeMfColorMode === "hybrid"
        ? "export_hybrid"
        : "export_3mf";
    const allowed = await consumeProtectedToolAction({
      isLoggedIn,
      toolId: "relief",
      actionId,
      onAuthRequired: () => setAuthOpen(true),
      authMessage: t("relief.loginToExport3MF", { defaultValue: "Inicia sesión para exportar tu relieve en 3MF." }),
      onConsumed: refreshCredits,
    });
    if (!allowed) {
      return;
    }
    const exportGeo3mf = currentMeshRef.current?.geometry ?? result.geometry;
    const blob = exportTo3MF({
      geometry: exportGeo3mf,
      colorZones: result.colorZones,
      zoneColors: result.palette,
      selectedColorIndices: result.colorZones > 1 ? selectedForExport : undefined,
      colorEncodingMode: threeMfColorMode as "hybrid" | "slic3r-strict",
      includeSlic3rMmuSegmentation:
        result.colorZones > 1 && threeMfColorMode !== "split-objects",
      objectName: `Relieve-${imageName.replace(/\.[^.]+$/, "")}`,
    });
    // Pre-download health warning
    if (meshHealth && meshHealth.score === "not-printable") {
      toast(meshHealth.summary, { icon: "⚠️", duration: 5000 });
    }
    download3MF(blob, `relieve-vorea.3mf`);
    trackAnalyticsEvent("export_3mf", { tool: "relief", colorMode: threeMfColorMode, meshScore: meshHealth?.score });
    // -- Engine telemetry: capture 3MF export --
    telemetry.track("export_3mf", {
      engine: {
        surfaceMode, subdivisions, maxHeight, colorZones,
        exportFormat: "3mf", threeMfColorMode,
      },
      mesh: meshHealth ? {
        meshScore: meshHealth.score, meshFaces: meshHealth.totalFaces,
        meshVertices: meshHealth.totalVertices, boundaryEdges: meshHealth.boundaryEdges,
        nonManifoldEdges: meshHealth.nonManifoldEdges, meshVolume: meshHealth.volumeEstimate,
      } : undefined,
    });
  }, [imageName, isLoggedIn, meshHealth, refreshCredits, result, selectedPaletteIndices, t, threeMfColorMode]);

  const togglePaletteColor = useCallback((index: number, checked: boolean) => {
    setSelectedPaletteIndices((prev) => {
      if (checked) {
        if (prev.includes(index)) return prev;
        return [...prev, index].sort((a, b) => a - b);
      }
      return prev.filter((i) => i !== index);
    });
  }, []);

  const selectedPaletteCount = selectedPaletteIndices.length;
  const multiColorResult = !!result && result.colorZones > 1;
  const canExport3MF = !multiColorResult || selectedPaletteCount > 0;
  const paletteForDisplay =
    result?.palette && result.palette.length > 0 ? result.palette : previewPalette;
  const fillPaletteSource =
    result?.palette && result.palette.length > 0
      ? (selectedPaletteIndices.length > 0
          ? selectedPaletteIndices
              .filter((idx) => idx >= 0 && idx < result.palette.length)
              .map((idx) => result.palette[idx])
          : result.palette)
      : paletteForDisplay;
  const fillColorChoices = (() => {
    const seen = new Set<string>();
    const choices: string[] = ["#ffffff"];
    seen.add("#ffffff");
    for (const rgb of fillPaletteSource) {
      const hex = rgb01ToHex(rgb);
      if (!seen.has(hex)) {
        seen.add(hex);
        choices.push(hex);
      }
    }
    return choices;
  })();
  const planePresets = RELIEF_PRESETS.filter((p) => p.surfaceMode === "plane");
  const cylinderPresets = RELIEF_PRESETS.filter((p) => p.surfaceMode === "cylinder");

  const cycleRenderMode = useCallback(() => {
    const modes: RenderMode[] = ["smooth", "faceted", "wireframe"];
    setRenderMode(prev => {
      const next = modes[(modes.indexOf(prev) + 1) % modes.length];
      if (currentMeshRef.current) {
        let mat: THREE.Material;
        if (next === "wireframe") {
          mat = new THREE.MeshBasicMaterial({ color: VOREA_GREEN, wireframe: true, transparent: true, opacity: 0.5 });
        } else if (colorZones > 1) {
          mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.05, roughness: 0.5, flatShading: next === "faceted", side: THREE.DoubleSide });
        } else {
          mat = new THREE.MeshStandardMaterial({ color: VOREA_GREEN, metalness: 0.08, roughness: 0.55, flatShading: next === "faceted", side: THREE.DoubleSide });
        }
        (currentMeshRef.current.material as THREE.Material).dispose();
        currentMeshRef.current.material = mat;
      }
      return next;
    });
  }, [colorZones]);

  const renderModeLabel = renderMode === "smooth" ? "Suavizado" : renderMode === "faceted" ? "Facetado" : "Alambre";

  const captureSceneSnapshotBlob = useCallback(async () => {
    const ctx = sceneRef.current;
    if (!ctx) return null;
    ctx.renderer.render(ctx.scene, ctx.camera);
    const dataUrl = ctx.renderer.domElement.toDataURL("image/jpeg", 0.8);
    return (await fetch(dataUrl)).blob();
  }, []);

  const handleCaptureGalleryPreview = useCallback(async () => {
    const blob = await captureSceneSnapshotBlob();
    if (!blob) return;
    const captured = createGalleryItemFromBlob(blob, "auto_capture");
    setGalleryItems((prev) => {
      const withoutAuto = prev.filter((item) => item.source !== "auto_capture");
      return [captured, ...withoutAuto].slice(0, 10);
    });
    setCoverIndex(0);
  }, [captureSceneSnapshotBlob]);

  const handleAddGalleryImages = useCallback((files: FileList | null) => {
    if (!files) return;
    setGalleryItems((prev) => {
      const next = [...prev];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        if (next.length >= 10) break;
        next.push(createGalleryItemFromBlob(file, "user_upload"));
      }
      return next.slice(0, 10);
    });
  }, []);

  const handleMoveGalleryItem = useCallback((index: number, direction: -1 | 1) => {
    setGalleryItems((prev) => moveGalleryItem(prev, index, direction));
    setCoverIndex((prev) => {
      const target = index + direction;
      if (prev === index) return target;
      if (prev === target) return index;
      return prev;
    });
  }, []);

  const handleRemoveGalleryItem = useCallback((index: number) => {
    setGalleryItems((prev) => prev.filter((_, i) => i !== index));
    if (index < coverIndex) {
      setCoverIndex((prev) => Math.max(0, prev - 1));
    } else if (index === coverIndex && coverIndex > 0) {
      setCoverIndex((prev) => Math.max(0, prev - 1));
    }
  }, [coverIndex]);

  // ─── Save / Publish Relief ────────────────────────────────────────
  const openSaveDialog = useCallback((status: "draft" | "published") => {
    if (!result || !imagePreview) return;
    if (!isLoggedIn) { setAuthOpen(true); return; }
    setSaveTitle(imageName.replace(/\.[^.]+$/, "") || "Relieve 3D");
    setPendingSaveStatus(status);
    setSaveDialogOpen(true);
    if (galleryItems.length === 0) {
      void handleCaptureGalleryPreview();
    }
  }, [result, imagePreview, isLoggedIn, imageName, galleryItems.length, handleCaptureGalleryPreview]);

  const saveRelief = useCallback(async () => {
    if (!result || !imagePreview) return;
    setSaving(true);
    setSaveDialogOpen(false);
    try {
      const fallbackItems =
        galleryItems.length > 0
          ? galleryItems
          : (() => {
            const items: EditableGalleryItem[] = [];
            return items;
          })();

      if (fallbackItems.length === 0) {
        const snapshotBlob = await captureSceneSnapshotBlob();
        if (snapshotBlob) {
          fallbackItems.push(createGalleryItemFromBlob(snapshotBlob, "auto_capture"));
        }
      }

      const { thumbnailUrl, media } = await serializeGalleryItems(fallbackItems, coverIndex);

      // Compress image for storage
      let compressedImage = imagePreview;
      try {
        const img = new Image();
        img.src = imagePreview;
        await new Promise(r => { img.onload = r; });
        const c = document.createElement("canvas");
        const maxDim = 512;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        c.width = img.width * scale;
        c.height = img.height * scale;
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        compressedImage = c.toDataURL("image/jpeg", 0.7);
      } catch { /* keep original */ }

      const reliefConfig = {
        imageData: compressedImage,
        subdivisions, maxHeight, smoothing, imageScale, imageScaleMode,
        imageRepeatX, imageRepeatY,
        gapFillMode, gapFillColor,
        plateWidth, plateDepth, lockAspect,
        surfaceMode, cylinderRadius, cylinderHeight, cylinderRepeats,
        cylinderFlipH, cylinderFlipV,
        boxHeight, boxCapTop, boxCapBottom,
        polygonSides, polygonRadius, polygonHeight, polygonCapTop, polygonCapBottom,
        lampshadeOuterRadiusBottom: lampshadeRadiusBottom,
        lampshadeOuterRadiusTop: lampshadeRadiusTop,
        lampshadeHoleRadius, lampshadeHeight, lampshadeCap, lampshadeSides,
        geodesicRadius,
        threeMfColorMode,
        invert, solid, baseThickness, colorZones,
      };

      let savedModel;
      if (editingModelId) {
        savedModel = await CommunityApi.updateModel(editingModelId, {
          title: saveTitle,
          reliefConfig,
          thumbnailUrl,
          media,
          status: pendingSaveStatus,
        });
      } else {
        savedModel = await CommunityApi.publishModel({
          title: saveTitle,
          modelType: "relief",
          reliefConfig,
          tags: ["relieve", "3d-print"],
          thumbnailUrl,
          media,
          forkedFromId: forkedFromModelId || undefined,
          status: pendingSaveStatus,
        });
      }

      setPublishMode("edit");
      setEditingModelId(savedModel.id);
      setForkedFromModelId(null);
      setSaveTitle(savedModel.title);
      setImageName(savedModel.title);
      const nextGallery = resolveGalleryState(savedModel.media, savedModel.thumbnailUrl);
      setGalleryItems(nextGallery.items);
      setCoverIndex(nextGallery.coverIndex);
      setSearchParams({ intent: "edit", modelId: savedModel.id, preset: null });
      toast.success(pendingSaveStatus === "draft" ? t("relief.publish.draftSaved", { defaultValue: "✅ Proyecto guardado" }) : t("relief.publish.modelPublished", { defaultValue: "🎉 ¡Publicado en la Comunidad!" }));
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    }
    setSaving(false);
  }, [
    result,
    imagePreview,
    saveTitle,
    editingModelId,
    forkedFromModelId,
    galleryItems,
    coverIndex,
    pendingSaveStatus,
    subdivisions,
    maxHeight,
    smoothing,
    imageScale,
    imageScaleMode,
    imageRepeatX,
    imageRepeatY,
    gapFillMode,
    gapFillColor,
    plateWidth,
    plateDepth,
    lockAspect,
    surfaceMode,
    cylinderRadius,
    cylinderHeight,
    cylinderRepeats,
    cylinderFlipH,
    cylinderFlipV,
    boxHeight,
    boxCapTop,
    boxCapBottom,
    polygonSides,
    polygonRadius,
    polygonHeight,
    polygonCapTop,
    polygonCapBottom,
    lampshadeRadiusBottom,
    lampshadeRadiusTop,
    lampshadeHoleRadius,
    lampshadeHeight,
    lampshadeCap,
    lampshadeSides,
    geodesicRadius,
    threeMfColorMode,
    invert,
    solid,
    baseThickness,
    colorZones,
    captureSceneSnapshotBlob,
    setSearchParams,
  ]);

  const saveDraftActionLabel =
    publishMode === "edit"
      ? t("publish.saveChanges")
      : publishMode === "fork"
        ? t("publish.saveForkDraft")
        : t("relief.saveProject");
  const publishActionLabel =
    publishMode === "edit"
      ? t("publish.publishChanges")
      : publishMode === "fork"
        ? t("publish.publishFork")
        : t("publish.titlePublish");
  const saveDialogTitle =
    publishMode === "edit"
      ? t("publish.titleEdit")
      : publishMode === "fork"
        ? t("publish.titleFork")
        : t("publish.titlePublish");
  const saveDialogDescription =
    publishMode === "edit"
      ? pendingSaveStatus === "draft"
        ? t("relief.saveDialogDescEditDraft", { defaultValue: "Se guardarán los cambios en este modelo privado." })
        : t("relief.saveDialogDescEditPublish", { defaultValue: "Se actualizará este modelo existente en la comunidad." })
      : publishMode === "fork"
        ? pendingSaveStatus === "draft"
          ? t("relief.saveDialogDescForkDraft", { defaultValue: "Se guardará una copia privada en tu perfil." })
          : t("relief.saveDialogDescForkPublish", { defaultValue: "Se creará una copia pública en tu perfil." })
        : pendingSaveStatus === "draft"
          ? t("relief.saveDialogDescDraft")
          : t("relief.saveDialogDescPublish");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* ─── Left Panel ───────────────────────────────────────────── */}
        <aside className="w-72 shrink-0 border-r border-[rgba(168,187,238,0.12)] bg-[#0d1117] flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#C6E36C]/10 border border-[#C6E36C]/20 flex items-center justify-center">
                <Mountain className="w-5 h-5 text-[#C6E36C]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">{t("relief.title")}</h2>
                <p className="text-[10px] text-gray-500">{t("relief.subtitle", { defaultValue: "Imagen → relieve imprimible" })}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={restoreRecommendedDefaults}
                className="h-8 rounded-lg bg-[#C6E36C]/12 border border-[#C6E36C]/30 text-[#C6E36C] text-[10px] font-semibold hover:bg-[#C6E36C]/18 transition-colors"
              >
                {t("relief.restoreRecommended")}
              </button>
              <button
                type="button"
                onClick={() => setPresetsModalOpen(true)}
                className="h-8 rounded-lg bg-white/5 border border-[rgba(168,187,238,0.14)] text-gray-300 text-[10px] font-semibold hover:bg-white/10 transition-colors"
              >
                {t("relief.defaultsList")}
              </button>
            </div>

            {/* ─── SECTION 1: IMAGE ─── */}
            <CollapsibleSection
              title={t("relief.section.image")}
              stepNumber={1}
              icon={<ImagePlus className="w-4 h-4" />}
              isOpen={openSections.has(1)}
              onToggle={() => toggleSection(1)}
              isComplete={!!imageLoaded}
            >
            {/* Image upload */}
            <div className="space-y-2">
              <label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{t("relief.image")}</label>
              <div
                className="relative border-2 border-dashed border-[rgba(168,187,238,0.15)] rounded-xl overflow-hidden cursor-pointer hover:border-[#C6E36C]/40 transition-colors group"
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-36 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-xs text-white">{t("relief.changeImage")}</span>
                    </div>
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[9px] text-gray-300 truncate max-w-[90%]">{imageName}</div>
                  </div>
                ) : (
                  <div className="h-28 flex flex-col items-center justify-center gap-2 text-gray-500">
                    <ImagePlus className="w-8 h-8 text-gray-600" />
                    <span className="text-xs">{t("relief.uploadImage")}</span>
                    <span className="text-[9px] text-gray-600">{t("relief.imageInstruction")}</span>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={handleImageUpload} />
              <input ref={stlInputRef} type="file" accept=".stl" className="hidden" onChange={handleSTLUpload} />
              <input ref={svgInputRef} type="file" accept=".svg" className="hidden" onChange={handleSVGUpload} />

              {/* Import helpers */}
              <div className="flex gap-2">
                <button
                  onClick={() => svgInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-purple-500/30 text-[11px] font-medium text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/50 transition-all"
                >
                  <Upload className="w-3 h-3" />
                  Import SVG
                </button>
                <button
                  onClick={() => stlInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-blue-500/30 text-[11px] font-medium text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all"
                >
                  <Upload className="w-3 h-3" />
                  Import STL
                </button>
              </div>

              {/* Invert toggle */}
              <button
                onClick={() => setInvert(v => !v)}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                  invert
                    ? "bg-[#C6E36C]/15 border-[#C6E36C]/40 text-[#C6E36C]"
                    : "bg-white/4 border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-gray-200"
                }`}
              >
                <FlipHorizontal2 className="w-3.5 h-3.5" />
                {invert ? t("relief.invertInverted") : t("relief.invertNormal")}
              </button>
            </div>
            </CollapsibleSection>

            {/* ─── SECTION 2: SHAPE ─── */}
            <CollapsibleSection
              title={t("relief.section.shape")}
              stepNumber={2}
              icon={<Box className="w-4 h-4" />}
              isOpen={openSections.has(2)}
              onToggle={() => toggleSection(2)}
              isComplete={!!imageLoaded}
            >

            {/* Surface mode */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{t("relief.surfaceLabel")}</label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["plane", t("relief.mode.plane"), Square],
                  ["cylinder", t("relief.mode.cylinder"), Cylinder],
                  ["box", t("relief.mode.box"), Box],
                  ["polygon", t("relief.mode.polygon"), Hexagon],
                  ["lampshade", t("relief.mode.lampshade"), Cone],
                  ["geodesic", t("relief.mode.geodesic"), Globe],
                ] as const).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={stlProcessing}
                    onClick={() => { setSurfaceMode(mode); setOpenSections(prev => { const n = new Set(prev); n.add(3); return n; }); }}
                    className={`h-16 flex flex-col items-center justify-center gap-1.5 rounded-xl border transition-all duration-200 ${
                      stlProcessing
                        ? "opacity-40 cursor-not-allowed bg-white/[0.01] border-[rgba(168,187,238,0.06)] text-gray-500"
                        : surfaceMode === mode
                        ? "bg-[#C6E36C]/10 border-[#C6E36C]/40 text-[#C6E36C] shadow-[0_0_12px_rgba(198,227,108,0.1)]"
                        : "bg-white/[0.02] border-[rgba(168,187,238,0.08)] text-gray-400 hover:bg-white/[0.04] hover:text-gray-200 hover:border-[rgba(168,187,238,0.15)]"
                    }`}
                  >
                    <Icon className="w-5 h-5" strokeWidth={surfaceMode === mode ? 2 : 1.5} />
                    <span className="text-[9px] font-medium tracking-wide uppercase">{label}</span>
                  </button>
                ))}
              </div>

              {/* STL Surface — inline file picker replacing a grid button */}
              <input ref={stlSurfaceInputRef} type="file" accept=".stl" className="hidden" onChange={handleSTLSurfaceUpload} />
              <button
                type="button"
                disabled={stlProcessing}
                onClick={() => stlSurfaceInputRef.current?.click()}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all duration-200 ${
                  stlProcessing
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-300 animate-pulse cursor-wait"
                    : surfaceMode === "stl" && stlSurfaceName
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                      : "bg-white/[0.02] border-dashed border-[rgba(168,187,238,0.12)] text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
                }`}
              >
                {stlProcessing ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-medium">{t("relief.stl.processing", { defaultValue: "Processing..." })}</span>
                  </>
                ) : stlSurfaceName ? (
                  <>
                    <FileUp className="w-4 h-4" />
                    <span className="text-xs truncate max-w-[120px]">{stlSurfaceName}</span>
                    <span className="text-[10px] underline text-blue-400">Change</span>
                  </>
                ) : (
                  <>
                    <FileUp className="w-4 h-4" />
                    <span className="text-xs font-medium">STL Surface</span>
                  </>
                )}
              </button>
            </div>

            </CollapsibleSection>

            {/* ─── SECTION 3: DIMENSIONS (hidden for STL surface) ─── */}
            {surfaceMode !== "stl" && (
            <CollapsibleSection
              title={t("relief.section.dimensions")}
              stepNumber={3}
              icon={<Ruler className="w-4 h-4" />}
              isOpen={openSections.has(3)}
              onToggle={() => toggleSection(3)}
            >

            {/* Subdivisions */}
            <ParamSlider
              label={t("relief.subdivisions")}
              value={subdivisions}
              min={50} max={2000} step={10}
              onChange={setSubdivisions}
              hint={`${subdivisions}×${Math.round(subdivisions / (aspectRatio||1))} → ~${(subdivisions * Math.round(subdivisions/(aspectRatio||1)) * 2 / 1000).toFixed(0)}K caras`}
            />

            {/* Max Height */}
            <ParamSlider
              label={t("relief.maxHeight")}
              value={maxHeight}
              min={0.5} max={50} step={0.5}
              onChange={setMaxHeight}
              hint={`${maxHeight} mm`} unit="mm"
            />

            {/* Mode-specific params */}
            {surfaceMode === "plane" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{t("relief.plateSize")}</label>
                  <button
                    onClick={() => setLockAspect(v => !v)}
                    className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-md border transition-colors ${
                      lockAspect
                        ? "bg-[#C6E36C]/15 border-[#C6E36C]/30 text-[#C6E36C]"
                        : "bg-white/4 border-[rgba(168,187,238,0.10)] text-gray-500 hover:text-gray-300"
                    }`}
                    title={lockAspect ? t("relief.lockAspectLocked") : t("relief.lockAspectFree")}
                  >
                    {lockAspect ? <Lock className="w-2.5 h-2.5" /> : <LockOpen className="w-2.5 h-2.5" />}
                    {lockAspect ? t("relief.lockAspectLocked") : t("relief.lockAspectFree")}
                  </button>
                </div>
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <input type="number" value={plateWidth}
                      onChange={e => handleWidthChange(Number(e.target.value) || DEFAULT_SIZE)}
                      className="w-full h-8 px-2 rounded-lg bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] text-sm text-white text-center"
                      min={10} max={500} />
                    <span className="text-[9px] text-gray-600 block text-center mt-0.5">{t("relief.planeWidth")}</span>
                  </div>
                  <span className="text-gray-600 mt-1.5">×</span>
                  <div className="flex-1">
                    <input type="number" value={plateDepth}
                      onChange={e => handleDepthChange(Number(e.target.value) || DEFAULT_SIZE)}
                      className="w-full h-8 px-2 rounded-lg bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] text-sm text-white text-center"
                      min={10} max={500} />
                    <span className="text-[9px] text-gray-600 block text-center mt-0.5">{t("relief.planeDepth")}</span>
                  </div>
                </div>
              </div>
            )}

            {surfaceMode === "cylinder" && (
              <>
                <ParamSlider label={t("relief.cylinderRadius")} value={cylinderRadius}
                  min={10} max={200} step={1} onChange={setCylinderRadius}
                  hint={`${cylinderRadius} mm`} unit="mm" />
                <ParamSlider label={t("relief.cylinderHeight")} value={cylinderHeight}
                  min={20} max={300} step={1} onChange={setCylinderHeight}
                  hint={`${cylinderHeight} mm`} unit="mm" />
              </>
            )}

            {surfaceMode === "box" && (
              <>
                <div className="space-y-2">
                  <label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{t("relief.boxSize")}</label>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <input type="number" value={plateWidth}
                        onChange={e => handleWidthChange(Number(e.target.value) || DEFAULT_SIZE)}
                        className="w-full h-8 px-2 rounded-lg bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] text-sm text-white text-center"
                        min={10} max={500} />
                      <span className="text-[9px] text-gray-600 block text-center mt-0.5">{t("relief.boxWidth")}</span>
                    </div>
                    <span className="text-gray-600 mt-1.5">×</span>
                    <div className="flex-1">
                      <input type="number" value={plateDepth}
                        onChange={e => handleDepthChange(Number(e.target.value) || DEFAULT_SIZE)}
                        className="w-full h-8 px-2 rounded-lg bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] text-sm text-white text-center"
                        min={10} max={500} />
                      <span className="text-[9px] text-gray-600 block text-center mt-0.5">{t("relief.boxDepth")}</span>
                    </div>
                  </div>
                </div>
                <ParamSlider label={t("relief.boxHeight")} value={boxHeight}
                  min={20} max={300} step={1} onChange={setBoxHeight}
                  hint={`${boxHeight} mm`} unit="mm" />
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{t("relief.caps")}</label>
                  <div className="grid grid-cols-2 gap-1">
                    <button type="button" onClick={() => setBoxCapTop(v => !v)}
                      className={`h-7 rounded-md text-[10px] border transition-colors ${
                        boxCapTop ? "bg-[#C6E36C]/15 border-[#C6E36C]/35 text-[#C6E36C]" : "bg-white/5 border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-gray-200"
                      }`}>{t("relief.capTopOnly")} {boxCapTop ? "ON" : "OFF"}</button>
                    <button type="button" onClick={() => setBoxCapBottom(v => !v)}
                      className={`h-7 rounded-md text-[10px] border transition-colors ${
                        boxCapBottom ? "bg-[#C6E36C]/15 border-[#C6E36C]/35 text-[#C6E36C]" : "bg-white/5 border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-gray-200"
                      }`}>{t("relief.capBottomOnly")} {boxCapBottom ? "ON" : "OFF"}</button>
                  </div>
                </div>
              </>
            )}

            {surfaceMode === "polygon" && (
              <>
                <ParamSlider label={t("relief.polygonSides")} value={polygonSides}
                  min={3} max={12} step={1} onChange={setPolygonSides}
                  hint={`${polygonSides}`} />
                <ParamSlider label={t("relief.polygonRadius")} value={polygonRadius}
                  min={10} max={200} step={1} onChange={setPolygonRadius}
                  hint={`${polygonRadius} mm`} unit="mm" />
                <ParamSlider label={t("relief.polygonHeight")} value={polygonHeight}
                  min={20} max={300} step={1} onChange={setPolygonHeight}
                  hint={`${polygonHeight} mm`} unit="mm" />
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{t("relief.caps")}</label>
                  <div className="grid grid-cols-2 gap-1">
                    <button type="button" onClick={() => setPolygonCapTop(v => !v)}
                      className={`h-7 rounded-md text-[10px] border transition-colors ${
                        polygonCapTop ? "bg-[#C6E36C]/15 border-[#C6E36C]/35 text-[#C6E36C]" : "bg-white/5 border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-gray-200"
                      }`}>{t("relief.capTopOnly")} {polygonCapTop ? "ON" : "OFF"}</button>
                    <button type="button" onClick={() => setPolygonCapBottom(v => !v)}
                      className={`h-7 rounded-md text-[10px] border transition-colors ${
                        polygonCapBottom ? "bg-[#C6E36C]/15 border-[#C6E36C]/35 text-[#C6E36C]" : "bg-white/5 border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-gray-200"
                      }`}>{t("relief.capBottomOnly")} {polygonCapBottom ? "ON" : "OFF"}</button>
                  </div>
                </div>
              </>
            )}

            {surfaceMode === "lampshade" && (
              <>
                <ParamSlider label={t("relief.lampshadeRadiusBottom")} value={lampshadeRadiusBottom}
                  min={10} max={200} step={1} onChange={setLampshadeRadiusBottom}
                  hint={`${lampshadeRadiusBottom} mm`} unit="mm" />
                <ParamSlider label={t("relief.lampshadeRadiusTop")} value={lampshadeRadiusTop}
                  min={5} max={200} step={1}
                  onChange={setLampshadeRadiusTop}
                  hint={`${lampshadeRadiusTop} mm`} unit="mm" />
                <ParamSlider label={t("relief.lampshadeHeight")} value={lampshadeHeight}
                  min={20} max={300} step={1} onChange={setLampshadeHeight}
                  hint={`${lampshadeHeight} mm`} unit="mm" />
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{t("relief.lampshadeCap")}</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(["none", "top", "bottom", "both"] as const).map(pos => (
                      <button key={pos} type="button" onClick={() => setLampshadeCap(pos)}
                        className={`h-7 rounded-md text-[9px] border transition-colors ${
                          lampshadeCap === pos ? "bg-[#C6E36C]/15 border-[#C6E36C]/35 text-[#C6E36C]" : "bg-white/5 border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-gray-200"
                        }`}>
                        {t(`relief.cap.${pos}`)}
                      </button>
                    ))}
                  </div>
                </div>
                {lampshadeCap !== "none" && (
                  <ParamSlider label={t("relief.lampshadeHoleRadius")} value={lampshadeHoleRadius}
                    min={2} max={Math.min(lampshadeRadiusBottom, lampshadeRadiusTop) - 2} step={1}
                    onChange={setLampshadeHoleRadius}
                    hint={`${lampshadeHoleRadius} mm`} unit="mm" />
                )}
                <ParamSlider label={t("relief.lampshadeSides")} value={lampshadeSides}
                  min={0} max={12} step={1} onChange={setLampshadeSides}
                  hint={lampshadeSides === 0 ? "Cilíndrico" : `${lampshadeSides}`} />
              </>
            )}

            {/* Geodesic mode params */}
            {surfaceMode === "geodesic" && (
              <>
                <ParamSlider label={t("relief.geodesicRadius")} value={geodesicRadius}
                  min={10} max={200} step={1} onChange={setGeodesicRadius}
                  hint={`${geodesicRadius} mm`} unit="mm" />
              </>
            )}

            {/* Base thickness */}
            {surfaceMode !== "geodesic" && (
              <ParamSlider
                label={surfaceMode === "plane" ? t("relief.baseThickness") : t("relief.wallThickness")}
                value={baseThickness}
                min={0} max={10} step={0.5}
                onChange={setBaseThickness}
                hint={`${baseThickness} mm`} unit="mm"
              />
            )}

            </CollapsibleSection>
            )}

            {/* ─── SECTION 4: IMAGE MAPPING ─── */}
            <CollapsibleSection
              title={t("relief.section.mapping", { defaultValue: "Mapeo de la Imagen" })}
              stepNumber={4}
              icon={<Scan className="w-4 h-4" />}
              isOpen={openSections.has(4)}
              onToggle={() => toggleSection(4)}
              disabled={!imageLoaded}
              isComplete={imageLoaded}
            >

            {surfaceMode === "cylinder" && (
              <>
                <ParamSlider label={t("relief.cylinderRepeats")} value={cylinderRepeats}
                  min={1} max={8} step={1} onChange={setCylinderRepeats}
                  hint={`${cylinderRepeats} vuelta${cylinderRepeats > 1 ? "s" : ""}`} />
                <div className="space-y-1 mb-3">
                  <label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{t("relief.flipImage")}</label>
                  <div className="grid grid-cols-2 gap-1">
                    <button type="button" onClick={() => setCylinderFlipH(v => !v)}
                      className={`h-7 rounded-md text-[10px] border transition-colors ${
                        cylinderFlipH ? "bg-[#C6E36C]/15 border-[#C6E36C]/35 text-[#C6E36C]" : "bg-white/5 border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-gray-200"
                      }`}>{t("relief.cylinderFlipH")} {cylinderFlipH ? "ON" : "OFF"}</button>
                    <button type="button" onClick={() => setCylinderFlipV(v => !v)}
                      className={`h-7 rounded-md text-[10px] border transition-colors ${
                        cylinderFlipV ? "bg-[#C6E36C]/15 border-[#C6E36C]/35 text-[#C6E36C]" : "bg-white/5 border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-gray-200"
                      }`}>{t("relief.cylinderFlipV")} {cylinderFlipV ? "ON" : "OFF"}</button>
                  </div>
                </div>
              </>
            )}

            {/* Smoothing */}
            <ParamSlider
              label={t("relief.smoothing")}
              value={smoothing}
              min={0} max={10} step={1}
              onChange={setSmoothing}
              hint={smoothing === 0 ? t("relief.smoothingNone") : t("relief.smoothingGaussian", { count: smoothing })}
            />

            <ParamSlider
              label={t("relief.imageScale")}
              value={imageScale}
              min={0.5} max={2.5} step={0.05}
              onChange={setImageScale}
            />
            {imageScale !== 1 && (
              <>
                <div className="space-y-1">
              <label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{t("relief.scaleMode")}</label>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setImageScaleMode("clamp")}
                  className={`h-7 rounded-md text-[10px] border transition-colors ${
                    imageScaleMode === "clamp"
                      ? "bg-[#C6E36C]/15 border-[#C6E36C]/35 text-[#C6E36C]"
                      : "bg-white/5 border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {t("relief.scaleMode.clamp")}
                </button>
                <button
                  type="button"
                  onClick={() => setImageScaleMode("wrap")}
                  className={`h-7 rounded-md text-[10px] border transition-colors ${
                    imageScaleMode === "wrap"
                      ? "bg-[#C6E36C]/15 border-[#C6E36C]/35 text-[#C6E36C]"
                      : "bg-white/5 border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {t("relief.scaleMode.wrap")}
                </button>
              </div>
              <p className="text-[9px] text-gray-600">
                {imageScaleMode === "clamp"
                  ? t("relief.scaleMode.clampHint")
                  : t("relief.scaleMode.wrapHint")}
              </p>
              <div className="grid grid-cols-2 gap-1">
                <label
                  className={`h-7 rounded-md border px-2 flex items-center gap-1.5 text-[10px] ${
                    imageScaleMode === "wrap"
                      ? "bg-white/5 border-[rgba(168,187,238,0.12)] text-gray-300"
                      : "bg-white/[0.03] border-[rgba(168,187,238,0.08)] text-gray-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={imageRepeatX}
                    onChange={(e) => setImageRepeatX(e.target.checked)}
                    disabled={imageScaleMode !== "wrap"}
                    className="w-3 h-3 rounded border-black/40 bg-black/40 text-[#C6E36C] focus:ring-[#C6E36C]/20"
                  />
                  Repetir X
                </label>
                <label
                  className={`h-7 rounded-md border px-2 flex items-center gap-1.5 text-[10px] ${
                    imageScaleMode === "wrap"
                      ? "bg-white/5 border-[rgba(168,187,238,0.12)] text-gray-300"
                      : "bg-white/[0.03] border-[rgba(168,187,238,0.08)] text-gray-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={imageRepeatY}
                    onChange={(e) => setImageRepeatY(e.target.checked)}
                    disabled={imageScaleMode !== "wrap"}
                    className="w-3 h-3 rounded border-black/40 bg-black/40 text-[#C6E36C] focus:ring-[#C6E36C]/20"
                  />
                  Repetir Y
                </label>
              </div>
              <p className="text-[9px] text-gray-600">
                {t("relief.repeatHint")}
              </p>
              <div className="space-y-1 pt-1">
                <label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{t("relief.gapFillLabel")}</label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setGapFillMode("edge")}
                    className={`h-7 rounded-md text-[10px] border transition-colors ${
                      gapFillMode === "edge"
                        ? "bg-[#C6E36C]/15 border-[#C6E36C]/35 text-[#C6E36C]"
                        : "bg-white/5 border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {t("relief.gapFill.edge")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGapFillMode("color-hard")}
                    className={`h-7 rounded-md text-[10px] border transition-colors ${
                      gapFillMode === "color-hard" || gapFillMode === "color" || gapFillMode === "white-hard"
                        ? "bg-[#C6E36C]/15 border-[#C6E36C]/35 text-[#C6E36C]"
                        : "bg-white/5 border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {t("relief.gapFill.hard")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGapFillMode("color-soft")}
                    className={`h-7 rounded-md text-[10px] border transition-colors ${
                      gapFillMode === "color-soft" || gapFillMode === "white-soft"
                        ? "bg-[#C6E36C]/15 border-[#C6E36C]/35 text-[#C6E36C]"
                        : "bg-white/5 border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {t("relief.gapFill.soft")}
                  </button>
                </div>
                {gapFillMode !== "edge" && (
                  <div className="space-y-1">
                    <p className="text-[9px] text-gray-600">
                      {t("relief.gapFillColorHint")}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {fillColorChoices.map((hex, idx) => {
                        const active = gapFillColor.toLowerCase() === hex.toLowerCase();
                        return (
                          <button
                            key={`${hex}-${idx}`}
                            type="button"
                            onClick={() => setGapFillColor(hex)}
                            className={`w-6 h-6 rounded border transition-all ${
                              active
                                ? "border-[#C6E36C] ring-1 ring-[#C6E36C]/35"
                                : "border-white/10 hover:border-white/30"
                            }`}
                            style={{ backgroundColor: hex }}
                            title={hex === "#ffffff" ? "Blanco" : `Color ${idx}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
              </>
            )}

            </CollapsibleSection>

            {/* ─── SECTION 5: COLOR & EXPORT ─── */}
            <CollapsibleSection
              title={t("relief.section.color")}
              stepNumber={5}
              icon={<Palette className="w-4 h-4" />}
              isOpen={openSections.has(5)}
              onToggle={() => toggleSection(5)}
              disabled={!imageLoaded}
              isComplete={!!result}
            >

            {/* Color zones */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{t("relief.colorZonesLabel")}</label>
                <span className="text-[10px] text-gray-500">
                  {colorZones === 1 ? t("relief.colorZonesMono") : `${colorZones} ${t("relief.colorZonesMulti")}`}
                </span>
              </div>
              <input
                type="range"
                value={colorZones}
                min={1} max={8} step={1}
                onChange={e => setColorZones(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-[#1a1f36] accent-[#C6E36C] cursor-pointer"
              />
              {colorZones > 1 && (
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setThreeMfColorMode("hybrid")}
                      className={`h-7 rounded-md text-[10px] border transition-colors ${
                        threeMfColorMode === "hybrid"
                          ? "bg-[#C6E36C]/15 border-[#C6E36C]/35 text-[#C6E36C]"
                          : "bg-white/5 border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {t("relief.3mfHybrid")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setThreeMfColorMode("slic3r-strict")}
                      className={`h-7 rounded-md text-[10px] border transition-colors ${
                        threeMfColorMode === "slic3r-strict"
                          ? "bg-[#C6E36C]/15 border-[#C6E36C]/35 text-[#C6E36C]"
                          : "bg-white/5 border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {t("relief.3mfSlic3r")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setThreeMfColorMode("split-objects")}
                      className={`h-7 rounded-md text-[10px] border transition-colors ${
                        threeMfColorMode === "split-objects"
                          ? "bg-[#C6E36C]/15 border-[#C6E36C]/35 text-[#C6E36C]"
                          : "bg-white/5 border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {t("relief.3mfSplit")}
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-600">
                    {threeMfColorMode === "hybrid"
                      ? t("relief.3mfHybridHint")
                      : threeMfColorMode === "slic3r-strict"
                        ? t("relief.3mfSlic3rHint")
                        : t("relief.3mfSplitHint")}
                  </p>
                </div>
              )}
              {/* Swatches: actual palette after generation, generic bars before */}
              <div className="flex flex-col gap-1 mt-3">
                <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium px-1">
                  <span>Capas Inferiores</span>
                  <span>Superiores</span>
                </div>
                <div className="flex gap-1">
                  {colorZones === 1 ? (
                    <div className="flex-1 h-4 rounded-sm bg-[#C6E36C]/70" title="Monocromático" />
                  ) : paletteForDisplay.length > 0 ? (
                    // Palette preview (before generate) or actual palette (after generate)
                    paletteForDisplay.map(([r, g, b], i) => {
                      const canSelectColor = !!result && result.palette.length > 0;
                      const checked = canSelectColor && selectedPaletteIndices.includes(i);
                      return (
                        <label
                          key={i}
                          className={`relative flex-1 h-7 rounded-sm border overflow-hidden cursor-pointer transition-all ${
                            checked ? "border-[#C6E36C]/60 ring-1 ring-[#C6E36C]/30" : "border-white/10"
                          }`}
                          style={{ background: `rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})` }}
                          title={`Color ${i + 1} (Capa ${i + 1})`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => togglePaletteColor(i, e.target.checked)}
                            disabled={!canSelectColor}
                            className="absolute top-1 left-1 w-3 h-3 rounded border-black/40 bg-black/40 text-[#C6E36C] focus:ring-[#C6E36C]/20"
                          />
                          <span className="absolute bottom-0.5 right-1 text-[8px] font-medium text-black/75 drop-shadow-md bg-white/40 px-0.5 rounded-sm">
                            {`L${i + 1}`}
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    // Placeholder before first generation
                    Array.from({ length: colorZones }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 h-4 rounded-sm bg-gray-600/40 border border-white/5"
                        title={t("relief.zoneTitle", { n: i + 1 })}
                      />
                    ))
                  )}
                </div>
              </div>
              {result && result.colorZones > 1 && result.palette.length > 0 && (
                <>
                  <p className="text-[9px] text-[#C6E36C]/80 mt-1">
                    {t("relief.paletteExportable", { selected: selectedPaletteCount, total: result.palette.length })} Para impresión multi-color en AMS, se exportará como partes separadas ordenadas por altura en el 3MF.
                  </p>
                  {selectedPaletteCount === 0 && (
                    <p className="text-[9px] text-amber-300/80">
                      {t("relief.paletteSelectHint")}
                    </p>
                  )}
                </>
              )}
              {colorZones > 1 && !result && (
                <p className="text-[9px] text-gray-500 mt-1">
                  {paletteForDisplay.length > 0
                    ? t("relief.paletteEstimated", { defaultValue: "Preview estimado de capas de color." })
                    : t("relief.paletteOnGenerate", { defaultValue: "Los colores se calcularán al generar." })} Cada capa representará un objeto/filamento en tu slicer (ideal para AMS).
                </p>
              )}
            </div>

            {/* Solid checkbox */}
            {surfaceMode !== "geodesic" && (
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={solid}
                  onChange={e => setSolid(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-[#1a1f36] text-[#C6E36C] focus:ring-[#C6E36C]/30"
                />
                <span className="text-xs text-gray-300 group-hover:text-white transition-colors">{t("relief.solidLabel")}</span>
                <span className="text-[9px] text-gray-600">{t("relief.solidHint")}</span>
              </label>
            )}

            </CollapsibleSection>

            {/* ─── Surface Modifier (Worley / Lattice) ─── */}
            <div className="mt-3">
              <ModifierPanel config={modifier} onChange={setModifier} />
            </div>
          </div>
        </aside>

        {/* ─── Viewport ─────────────────────────────────────────────── */}
        <div className="flex-1 relative min-h-0 overflow-hidden" ref={containerRef} onContextMenu={e => e.preventDefault()}>

          {/* Idle overlay */}
          {!result && !generating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0f1320]/90 z-10">
              <div className="w-16 h-16 rounded-2xl bg-[#C6E36C]/10 border border-[#C6E36C]/20 flex items-center justify-center">
                <Mountain className="w-8 h-8 text-[#C6E36C]/60" />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-1">{t("relief.idleTitle")}</p>
                <p className="text-[11px] text-gray-600 max-w-64">
                  {t("relief.idleDesc")}
                </p>
              </div>
            </div>
          )}

          {/* Stale/Dirty overlay removed — Generate button pulses via relief-generate-attention class */}

          {/* STL Processing overlay */}
          {stlProcessing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0f1320]/70 backdrop-blur-sm z-10 transition-all">
              <div className="relative">
                <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-200 font-medium mb-1">
                  {t("relief.stl.processing", { defaultValue: "Processing STL..." })}
                </p>
                <p className="text-[10px] text-gray-400 mt-1 max-w-56 leading-tight">
                  {t("relief.stl.processingHint", { defaultValue: "The model will appear automatically when ready." })}
                </p>
              </div>
            </div>
          )}

          {/* Generating overlay */}
          {generating && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0f1320]/80 backdrop-blur-sm z-10 transition-all ${subdivisions > 1000 ? "bg-[#0d1117]/90" : ""}`}>
              <div className="relative">
                <Loader2 className="w-10 h-10 text-[#C6E36C] animate-spin" />
                {subdivisions > 1000 && <div className="absolute inset-0 flex items-center justify-center"><div className="w-2 h-2 bg-[#C6E36C] rounded-full animate-pulse" /></div>}
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-200 font-medium mb-1">
                  {subdivisions > 1000 ? t("relief.generating") : t("relief.generating")}
                </p>
                <p className="text-[11px] text-[#C6E36C]">{t("relief.subdivisionsCount", { count: subdivisions })}</p>
                {subdivisions > 1000 && (
                  <p className="text-[10px] text-gray-400 mt-2 max-w-56 leading-tight">
                    {t("relief.bgGeneration")}
                  </p>
                )}
              </div>
              {subdivisions > 1000 && (
                <button
                  onClick={cancelGeneration}
                  className="mt-4 px-6 py-2 rounded-full border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/10 transition-colors"
                >
                  {t("relief.cancelProcess")}
                </button>
              )}
            </div>
          )}

          {/* Experimental badge — bottom-right corner */}
          <div className="absolute bottom-3 right-3 z-10 flex flex-col items-end gap-1 max-w-[220px] group">
            <div className="bg-amber-500/20 border border-amber-500/30 backdrop-blur-md rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-lg">
              <span className="text-amber-400 text-[10px] font-bold tracking-wider uppercase">
                {t("relief.experimental.badge")}
              </span>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[#0f1320]/95 border border-amber-500/20 backdrop-blur-md rounded-lg px-3 py-2 shadow-xl">
              <p className="text-[10px] text-gray-300 leading-snug mb-1">
                {t("relief.experimental.tooltip")}
              </p>
              <p className="text-[9px] text-amber-400/80 leading-snug mb-1.5">
                {t("relief.experimental.creditHint")}
              </p>
              <a
                href="/membership"
                className="text-[10px] text-[#C6E36C] hover:text-[#d4ef88] underline underline-offset-2 font-medium transition-colors"
              >
                {t("relief.experimental.upgradeLink")} →
              </a>
            </div>
          </div>

          {/* Viewport controls */}
          {result && !generating && (
            <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
              <button onClick={cycleRenderMode}
                className="h-7 px-2 rounded-lg bg-[#C6E36C]/15 text-[#C6E36C] border border-[#C6E36C]/25 flex items-center justify-center gap-1 hover:bg-[#C6E36C]/25 transition-colors text-[9px] font-semibold"
                title={`Modo: ${renderModeLabel}`}>
                <Box className="w-3 h-3" />
                <span className="hidden sm:inline">{renderModeLabel}</span>
              </button>
              <button onClick={() => setShowGrid(v => !v)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${showGrid ? "bg-[#C6E36C]/20 text-[#C6E36C] border border-[#C6E36C]/30" : "bg-[#1a1f36]/90 text-gray-500 border border-[rgba(168,187,238,0.12)]"}`}
                title="Grid"><Grid3x3 className="w-3.5 h-3.5" /></button>
              <button onClick={() => setShowAxes(v => !v)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${showAxes ? "bg-[#C6E36C]/20 text-[#C6E36C] border border-[#C6E36C]/30" : "bg-[#1a1f36]/90 text-gray-500 border border-[rgba(168,187,238,0.12)]"}`}
                title="Ejes"><Axis3D className="w-3.5 h-3.5" /></button>
              <button onClick={zoomToFit}
                className="w-7 h-7 rounded-lg bg-[#1a1f36]/90 text-gray-500 border border-[rgba(168,187,238,0.12)] flex items-center justify-center hover:text-[#C6E36C] hover:border-[#C6E36C]/30 transition-colors"
                title="Zoom al objeto"><Maximize2 className="w-3.5 h-3.5" /></button>
              <button onClick={() => { const c = sceneRef.current; if (c) resetView(c); }}
                className="w-7 h-7 rounded-lg bg-[#1a1f36]/90 text-gray-500 border border-[rgba(168,187,238,0.12)] flex items-center justify-center hover:text-gray-300 transition-colors"
                title="Reset vista"><RotateCcw className="w-3.5 h-3.5" /></button>
              {/* Light intensity slider */}
              <div className="mt-1 flex flex-col items-center gap-1" title={`Luz: ${Math.round(lightIntensity * 100)}%`}>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={lightIntensity}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setLightIntensity(v);
                    const ctx = sceneRef.current;
                    if (ctx) ctx.orbitLight.intensity = v;
                  }}
                  className="w-7 h-20 accent-amber-400 cursor-pointer"
                  style={{ writingMode: "vertical-lr", direction: "rtl" }}
                />
              </div>
            </div>
          )}

          {/* Stats */}
          {result && !generating && (
            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
              <span className="px-2 py-1 rounded-lg bg-[#1a1f36]/90 backdrop-blur text-[9px] text-gray-500 border border-[rgba(168,187,238,0.08)]">
                <Cpu className="w-3 h-3 inline mr-1" />
                {Math.round(result.generationTimeMs)}ms · {(result.faceCount/1000).toFixed(0)}K caras · {result.gridW}×{result.gridH}
              </span>
              {meshHealth && (
                <span className={`px-2 py-1 rounded-lg backdrop-blur text-[9px] font-medium border ${
                  meshHealth.score === "printable"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                    : meshHealth.score === "warnings"
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                    : "bg-red-500/15 text-red-400 border-red-500/20"
                }`} title={meshHealth.summary}>
                  {meshHealth.score === "printable" ? "🟢" : meshHealth.score === "warnings" ? "🟡" : "🔴"}
                  {" "}{meshHealth.score === "printable" ? "Sólido" : meshHealth.summary}
                </span>
              )}
            </div>
          )}
          {result && !generating && (
            <div className="absolute bottom-3 right-3 text-[9px] text-gray-600 select-none z-10">
              Orbitar · Click derecho pan · Scroll zoom
            </div>
          )}
        </div>
      </div>

      {/* ─── Bottom Action Bar ────────────────────────────────────────── */}
      <div className="shrink-0 h-14 glass border-t border-[rgba(168,187,238,0.10)] backdrop-blur-md flex items-center justify-center gap-3">
        {/* Stats pill (small screens: hidden) */}
        {result && !generating && (
          <div className="text-[9px] text-gray-500 mr-2 hidden md:flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            {Math.round(result.generationTimeMs)}ms · {(result.faceCount/1000).toFixed(0)}K caras
            {meshHealth && (
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[8px] font-semibold ${
                meshHealth.score === "printable"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : meshHealth.score === "warnings"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-red-500/20 text-red-400"
              }`} title={meshHealth.summary}>
                {meshHealth.score === "printable" ? "🟢" : meshHealth.score === "warnings" ? "🟡" : "🔴"}
              </span>
            )}
          </div>
        )}

        {/* Generate */}
        <button
          onClick={generate}
          disabled={!imageLoaded || generating || stlProcessing}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl bg-[#C6E36C] text-[#0d1117] font-semibold text-sm hover:bg-[#d4ed7a] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#C6E36C]/20 ${paramsDirty && !generating && !stlProcessing ? "relief-generate-attention" : ""}`}
        >
          {generating ? <><Loader2 className="w-4 h-4 animate-spin" />{t("relief.generating")}</> : <><Mountain className="w-4 h-4" />{t("relief.generate")}</>}
        </button>

        {/* Export — both always visible after generation */}
        {result && !generating && (
          <>
            <button
              onClick={exportSTL}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-[rgba(168,187,238,0.15)] text-gray-300 hover:bg-white/10 hover:text-white transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              {t("relief.downloadSTL")}
            </button>
            <button
              onClick={export3MF}
              disabled={!canExport3MF}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-colors ${
                multiColorResult
                  ? "bg-violet-500/15 border-violet-400/30 text-violet-300 hover:bg-violet-500/25"
                  : "bg-white/5 border-[rgba(168,187,238,0.15)] text-gray-300 hover:bg-white/10 hover:text-white"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={!canExport3MF ? t("relief.exportSelectColors") : t("relief.export3mfTitle")}
            >
              <Download className="w-4 h-4" />
              {t("relief.download3MF")}
            </button>
           </>
        )}

        {/* Save / Publish — after generation */}
        {result && !generating && (
          <>
            <div className="w-px h-6 bg-[rgba(168,187,238,0.15)]" />
            <button
              onClick={() => openSaveDialog("draft")}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-[rgba(168,187,238,0.15)] text-gray-300 hover:bg-white/10 hover:text-white transition-colors text-sm disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saveDraftActionLabel}
            </button>
            <button
              onClick={() => openSaveDialog("published")}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors text-sm disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {publishActionLabel}
            </button>
          </>
        )}
      </div>

      {/* Presets modal */}
      {presetsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={() => setPresetsModalOpen(false)}>
          <div
            className="bg-gradient-to-b from-[#1a1f38] to-[#12162a] border border-[rgba(168,187,238,0.12)] rounded-2xl w-full max-w-3xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(168,187,238,0.08)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#C6E36C]/15 border border-[#C6E36C]/20 flex items-center justify-center">
                  <Cpu className="w-4.5 h-4.5 text-[#C6E36C]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{t("relief.presetsTitle") !== "relief.presetsTitle" ? t("relief.presetsTitle") : "Recommended Defaults"}</h3>
                  <p className="text-[11px] text-gray-500">
                    {t("relief.presetsDesc") !== "relief.presetsDesc" ? t("relief.presetsDesc") : "Pre-configured presets for quick start. Includes surface, quality, and export settings."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPresetsModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ─── Body ─── */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
              {/* Plane presets */}
              {planePresets.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Square className="w-3.5 h-3.5 text-[#C6E36C]" />
                    <h4 className="text-xs font-semibold text-[#C6E36C] uppercase tracking-widest">{t("relief.mode.plane")}</h4>
                    <span className="ml-auto text-[9px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">{planePresets.length} presets</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {planePresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="group rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0d1220]/80 overflow-hidden text-left hover:border-[#C6E36C]/30 hover:shadow-[0_0_20px_rgba(198,227,108,0.06)] transition-all duration-300"
                      >
                        <div className="relative overflow-hidden">
                          <img src={preset.previewImage} alt={preset.name} className="w-full h-24 object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1220] via-transparent to-transparent" />
                          {preset.id === RECOMMENDED_PRESET_ID && (
                            <span className="absolute top-2 right-2 text-[8px] font-bold uppercase tracking-wider bg-[#C6E36C] text-[#0d1117] px-2 py-0.5 rounded-full">
                              ★ Recommended
                            </span>
                          )}
                        </div>
                        <div className="px-3.5 pb-3 pt-1">
                          <p className="text-sm font-semibold text-white group-hover:text-[#C6E36C] transition-colors">{preset.name}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{preset.description}</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="inline-flex items-center gap-1 text-[9px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                              <Grid3x3 className="w-2.5 h-2.5" /> {preset.subdivisions}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[9px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                              ↕ {preset.maxHeight}mm
                            </span>
                            <span className="inline-flex items-center gap-1 text-[9px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                              🎨 {preset.colorZones} colors
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cylinder presets */}
              {cylinderPresets.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Cylinder className="w-3.5 h-3.5 text-[#C6E36C]" />
                    <h4 className="text-xs font-semibold text-[#C6E36C] uppercase tracking-widest">{t("relief.mode.cylinder")}</h4>
                    <span className="ml-auto text-[9px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">{cylinderPresets.length} presets</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {cylinderPresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="group rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0d1220]/80 overflow-hidden text-left hover:border-[#C6E36C]/30 hover:shadow-[0_0_20px_rgba(198,227,108,0.06)] transition-all duration-300"
                      >
                        <div className="relative overflow-hidden">
                          <img src={preset.previewImage} alt={preset.name} className="w-full h-24 object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1220] via-transparent to-transparent" />
                          {preset.id === RECOMMENDED_PRESET_ID && (
                            <span className="absolute top-2 right-2 text-[8px] font-bold uppercase tracking-wider bg-[#C6E36C] text-[#0d1117] px-2 py-0.5 rounded-full">
                              ★ Recommended
                            </span>
                          )}
                        </div>
                        <div className="px-3.5 pb-3 pt-1">
                          <p className="text-sm font-semibold text-white group-hover:text-[#C6E36C] transition-colors">{preset.name}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{preset.description}</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="inline-flex items-center gap-1 text-[9px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                              R {preset.cylinderRadius}mm
                            </span>
                            <span className="inline-flex items-center gap-1 text-[9px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                              H {preset.cylinderHeight}mm
                            </span>
                            <span className="inline-flex items-center gap-1 text-[9px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                              ×{preset.cylinderRepeats} rep
                            </span>
                            <span className="inline-flex items-center gap-1 text-[9px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                              <Grid3x3 className="w-2.5 h-2.5" /> {preset.subdivisions}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ─── Footer ─── */}
            <div className="px-6 py-3 border-t border-[rgba(168,187,238,0.06)] flex items-center justify-between">
              <p className="text-[10px] text-gray-600">Click a preset to apply it instantly</p>
              <button
                onClick={() => setPresetsModalOpen(false)}
                className="px-4 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
              >
                {t("relief.close") !== "relief.close" ? t("relief.close") : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth dialog */}
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />

      {/* Save dialog with title editing */}
      {saveDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1f36] border border-[rgba(168,187,238,0.15)] rounded-2xl p-6 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-1">
              {saveDialogTitle}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {saveDialogDescription}
            </p>
            <label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{t("relief.saveDialogModelName")}</label>
            <input
              autoFocus
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveTitle.trim() && saveRelief()}
              className="w-full mt-1 mb-4 px-3 py-2 rounded-lg bg-[#0d1117] border border-[rgba(168,187,238,0.12)] text-white text-sm focus:outline-none focus:border-[#C6E36C]/50"
              placeholder={t("relief.saveDialogPlaceholder")}
            />
            <div className="mb-5">
              <CommunityGalleryEditor
                items={galleryItems}
                coverIndex={coverIndex}
                previewUrl={galleryItems[coverIndex]?.previewUrl ?? null}
                onFilesSelected={handleAddGalleryImages}
                onCapture={() => void handleCaptureGalleryPreview()}
                onSetCover={setCoverIndex}
                onMove={handleMoveGalleryItem}
                onRemove={handleRemoveGalleryItem}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setSaveDialogOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
              >
                {t("relief.cancel")}
              </button>
              <button
                onClick={saveRelief}
                disabled={!saveTitle.trim() || saving}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 ${
                  pendingSaveStatus === "published"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/30"
                    : "bg-[#C6E36C]/15 text-[#C6E36C] border border-[#C6E36C]/30 hover:bg-[#C6E36C]/25"
                }`}
              >
                {saving ? t("relief.saving") : pendingSaveStatus === "draft" ? saveDraftActionLabel : publishActionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Slider component ─────────────────────────────────────────────────────────

function ParamSlider({ label, value, min, max, step, onChange, hint, unit }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; hint?: string; unit?: string;
}) {
  const [localValue, setLocalValue] = useState(value);

  // Sync incoming prop changes (e.g. from preset buttons)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced push back to parent
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [localValue, value, onChange]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number" value={localValue}
            onChange={e => setLocalValue(Number(e.target.value))}
            className="w-16 h-6 px-1.5 rounded bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] text-[11px] text-white text-right"
            min={min} max={max} step={step}
          />
          {unit && <span className="text-[9px] text-gray-600">{unit}</span>}
        </div>
      </div>
      <input
        type="range" value={localValue} min={min} max={max} step={step}
        onChange={e => setLocalValue(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-[#1a1f36] accent-[#C6E36C] cursor-pointer shadow-sm"
      />
      {hint && <p className="text-[9px] text-gray-600 font-medium">{hint}</p>}
    </div>
  );
}
