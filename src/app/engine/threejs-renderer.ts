/**
 * Three.js WebGL Renderer for Vorea Studio
 * Replaces Canvas 2D painter's algorithm with real WebGL rendering,
 * PBR materials, smooth normals, and proper lighting.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { RenderableMesh } from "./mesh-data";
import type { CSG } from "./csg";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RenderMode = "smooth" | "faceted" | "wireframe";
export type TransformMode = "translate" | "rotate" | "scale";

export interface ThreeSceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  transformControls: TransformControls;
  meshGroup: THREE.Group;
  gridHelper: THREE.GridHelper;
  axesHelper: THREE.AxesHelper;
  orbitLight: THREE.PointLight;
  animFrameId: number;
  disposed: boolean;
  selectedMesh: THREE.Mesh | null;
  selectionOutline: THREE.LineSegments | null;
}

// ─── Vorea Studio Colors ──────────────────────────────────────────────────────

const BG_COLOR = 0x0f1320;
const VOREA_GREEN = 0xc6e36c;
const GRID_COLOR = 0x2a3040;
const GRID_CENTER_COLOR = 0x3a4050;

// ─── Scene Initialization ─────────────────────────────────────────────────────

export function initScene(container: HTMLElement): ThreeSceneContext {
  const w = container.clientWidth || 800;
  const h = container.clientHeight || 600;

  // Renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(BG_COLOR);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 2.0;
  container.appendChild(renderer.domElement);

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG_COLOR);
  scene.fog = new THREE.FogExp2(BG_COLOR, 0.0018);

  // Camera
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
  camera.position.set(80, 60, 80);
  camera.lookAt(0, 0, 0);

  // Orbit Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 5;
  controls.maxDistance = 500;
  controls.target.set(0, 0, 0);
  controls.update();

  // ─── Lighting ─────────────────────────────────────────────────────────

  // Ambient (soft fill)
  const ambient = new THREE.AmbientLight(0xffffff, 0.68);
  scene.add(ambient);

  // Hemisphere (sky/ground variation)
  const hemi = new THREE.HemisphereLight(0xa6c9ff, 0x4a4437, 0.75);
  scene.add(hemi);

  // Key light (warm, upper-right-front)
  const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.15);
  keyLight.position.set(60, 80, 40);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 300;
  keyLight.shadow.camera.left = -80;
  keyLight.shadow.camera.right = 80;
  keyLight.shadow.camera.top = 80;
  keyLight.shadow.camera.bottom = -80;
  scene.add(keyLight);

  // Fill light (cool, side/back)
  const fillLight = new THREE.DirectionalLight(0xcce0ff, 0.62);
  fillLight.position.set(-50, 45, -70);
  scene.add(fillLight);

  // Rim light (backlight for edge separation)
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.44);
  rimLight.position.set(0, 25, -90);
  scene.add(rimLight);

  // Zenith light (top-down) to avoid dark plateaus.
  const zenithLight = new THREE.DirectionalLight(0xffffff, 0.88);
  zenithLight.position.set(0, 130, 0);
  scene.add(zenithLight);

  // Underfill light (from below) to softly open dark undersides without flattening contrast.
  const underLight = new THREE.DirectionalLight(0xb8ccff, 0.3);
  underLight.position.set(0, -80, 0);
  scene.add(underLight);

  // Side point fills for cylindrical/curved surfaces.
  const pointFillA = new THREE.PointLight(0xf3f7ff, 0.4, 620, 2);
  pointFillA.position.set(95, 42, 35);
  scene.add(pointFillA);

  const pointFillB = new THREE.PointLight(0xe6f0ff, 0.34, 620, 2);
  pointFillB.position.set(-95, 30, -20);
  scene.add(pointFillB);

  const pointFillFront = new THREE.PointLight(0xffffff, 0.24, 560, 2);
  pointFillFront.position.set(0, 34, 120);
  scene.add(pointFillFront);

  const pointFillBack = new THREE.PointLight(0xdbe8ff, 0.22, 560, 2);
  pointFillBack.position.set(0, 26, -120);
  scene.add(pointFillBack);

  // Camera-attached soft headlight to avoid near-black faces while orbiting.
  const headLight = new THREE.PointLight(0xffffff, 0.22, 0, 2);
  headLight.position.set(0, 0, 0);
  camera.add(headLight);
  scene.add(camera);

  // Slow-orbiting accent light to reveal surface detail.
  const orbitLight = new THREE.PointLight(0xfff0d4, 1.2, 600, 1.2);
  orbitLight.position.set(120, 50, 0);
  scene.add(orbitLight);

  // ─── Grid ───────────────────────────────────────────────────────────

  const gridHelper = new THREE.GridHelper(200, 20, GRID_CENTER_COLOR, GRID_COLOR);
  (gridHelper.material as THREE.Material).opacity = 0.4;
  (gridHelper.material as THREE.Material).transparent = true;
  scene.add(gridHelper);

  // ─── Axes ───────────────────────────────────────────────────────────

  const axesHelper = new THREE.AxesHelper(50);
  scene.add(axesHelper);

  // ─── Ground plane (shadow receiver) ─────────────────────────────────

  const groundGeo = new THREE.PlaneGeometry(400, 400);
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.08 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  scene.add(ground);

  // ─── Mesh Group ─────────────────────────────────────────────────────

  const meshGroup = new THREE.Group();
  scene.add(meshGroup);

  // ─── Transform Controls (for object manipulation) ──────────────────

  const transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setSize(0.8);
  transformControls.visible = false;
  transformControls.enabled = false;
  scene.add(transformControls.getHelper());

  // Disable orbit while dragging transform handle
  transformControls.addEventListener("dragging-changed", (event) => {
    controls.enabled = !event.value;
  });

  // ─── Animation Loop ─────────────────────────────────────────────────

  const ctx: ThreeSceneContext = {
    renderer,
    scene,
    camera,
    controls,
    transformControls,
    meshGroup,
    gridHelper,
    axesHelper,
    orbitLight,
    animFrameId: 0,
    disposed: false,
    selectedMesh: null,
    selectionOutline: null,
  };

  function animate() {
    if (ctx.disposed) return;
    ctx.animFrameId = requestAnimationFrame(animate);

    // Orbit accent light around the scene target (~8s per revolution)
    const t = performance.now() * 0.001;
    const r = 120;
    const target = controls.target;
    orbitLight.position.set(
      target.x + Math.cos(t * 0.8) * r,
      target.y + 50,
      target.z + Math.sin(t * 0.8) * r
    );

    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return ctx;
}

// ─── Resize ───────────────────────────────────────────────────────────────────

export function resizeScene(ctx: ThreeSceneContext, w: number, h: number) {
  if (w <= 0 || h <= 0) return;
  ctx.camera.aspect = w / h;
  ctx.camera.updateProjectionMatrix();
  ctx.renderer.setSize(w, h);
}

// ─── Update Mesh ──────────────────────────────────────────────────────────────

type AnyMesh = CSG | RenderableMesh;

export function updateMesh(
  ctx: ThreeSceneContext,
  csg: AnyMesh,
  mode: RenderMode = "smooth",
  autoCenter: boolean = true
) {
  // Deselect before clearing (removes outline + gizmo references)
  deselectMesh(ctx);

  // Clear existing mesh
  while (ctx.meshGroup.children.length > 0) {
    const child = ctx.meshGroup.children[0];
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material.dispose();
      }
    }
    ctx.meshGroup.remove(child);
  }

  const polygons = csg.toPolygons();
  if (!polygons || polygons.length === 0) return;

  // ─── Convert CSG polygons to BufferGeometry ─────────────────────────
  // Each CSG polygon can have N vertices; triangulate by fan
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  let hasAnyColor = false;

  for (const poly of polygons) {
    const verts = poly.vertices;
    if (verts.length < 3) continue;

    // Check for per-polygon color (from SVG paths or color() calls)
    const polyColor = (poly as any).color as [number, number, number] | undefined;
    if (polyColor) hasAnyColor = true;

    // Fan triangulation: v0, v1, v2; v0, v2, v3; ...
    for (let i = 1; i < verts.length - 1; i++) {
      const v0 = verts[0];
      const v1 = verts[i];
      const v2 = verts[i + 1];

      // Positions (swap Y/Z: SCAD uses Z-up, Three.js uses Y-up)
      positions.push(v0.pos.x, v0.pos.z, v0.pos.y);
      positions.push(v1.pos.x, v1.pos.z, v1.pos.y);
      positions.push(v2.pos.x, v2.pos.z, v2.pos.y);

      if (mode === "smooth") {
        // Use vertex normals for smooth shading
        normals.push(v0.normal.x, v0.normal.z, v0.normal.y);
        normals.push(v1.normal.x, v1.normal.z, v1.normal.y);
        normals.push(v2.normal.x, v2.normal.z, v2.normal.y);
      } else {
        // Face normal for faceted look
        const faceNormal = poly.plane.normal;
        normals.push(faceNormal.x, faceNormal.z, faceNormal.y);
        normals.push(faceNormal.x, faceNormal.z, faceNormal.y);
        normals.push(faceNormal.x, faceNormal.z, faceNormal.y);
      }

      // Vertex colors (3 vertices per triangle, same color for all)
      if (polyColor) {
        for (let j = 0; j < 3; j++) {
          colors.push(polyColor[0], polyColor[1], polyColor[2]);
        }
      } else {
        // Default VOREA_GREEN as linear RGB (0xc6e36c → ~0.776, 0.890, 0.424)
        for (let j = 0; j < 3; j++) {
          colors.push(0.776, 0.890, 0.424);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  if (hasAnyColor) {
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  }

  if (mode === "smooth") {
    // Recompute smooth normals by averaging
    geometry.computeVertexNormals();
  }

  // ─── Material based on render mode ──────────────────────────────────

  let material: THREE.Material;

  if (mode === "wireframe") {
    material = new THREE.MeshBasicMaterial({
      color: hasAnyColor ? 0xffffff : VOREA_GREEN,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
      vertexColors: hasAnyColor,
    });
  } else {
    material = new THREE.MeshStandardMaterial({
      color: hasAnyColor ? 0xffffff : VOREA_GREEN,
      metalness: 0.08,
      roughness: 0.55,
      flatShading: mode === "faceted",
      side: THREE.DoubleSide,
      vertexColors: hasAnyColor,
    });
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Keep models resting on the grid plane (y = 0) instead of intersecting it.
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  let worldCenter = new THREE.Vector3();
  if (bbox) {
    const lift = -bbox.min.y;
    mesh.position.y += lift;
    worldCenter.set(
      (bbox.min.x + bbox.max.x) * 0.5,
      (bbox.min.y + bbox.max.y) * 0.5 + lift,
      (bbox.min.z + bbox.max.z) * 0.5
    );
  }
  ctx.meshGroup.add(mesh);

  // ─── Auto-center camera on model (only on first compile) ────────────

  if (autoCenter) {
    const bbox = geometry.boundingBox;
    if (bbox) {
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const dist = maxDim * 2.5;

      ctx.controls.target.copy(worldCenter);
      ctx.camera.position.set(
        worldCenter.x + dist * 0.6,
        worldCenter.y + dist * 0.5,
        worldCenter.z + dist * 0.6
      );
      ctx.camera.lookAt(worldCenter);
      ctx.controls.update();
    }
  }
}

// ─── Render Mode ──────────────────────────────────────────────────────────────

export function setRenderMode(ctx: ThreeSceneContext, csg: AnyMesh, mode: RenderMode) {
  updateMesh(ctx, csg, mode, false);
}

// ─── Visibility Toggles ──────────────────────────────────────────────────────

export function setGridVisible(ctx: ThreeSceneContext, visible: boolean) {
  ctx.gridHelper.visible = visible;
}

export function setAxesVisible(ctx: ThreeSceneContext, visible: boolean) {
  ctx.axesHelper.visible = visible;
}

// ─── Camera Presets ───────────────────────────────────────────────────────────

export function setCameraPreset(ctx: ThreeSceneContext, preset: "top" | "front" | "side" | "iso") {
  const target = ctx.controls.target.clone();
  const dist = ctx.camera.position.distanceTo(target);

  switch (preset) {
    case "top":
      ctx.camera.position.set(target.x, target.y + dist, target.z);
      break;
    case "front":
      ctx.camera.position.set(target.x, target.y, target.z + dist);
      break;
    case "side":
      ctx.camera.position.set(target.x + dist, target.y, target.z);
      break;
    case "iso":
      ctx.camera.position.set(
        target.x + dist * 0.6,
        target.y + dist * 0.5,
        target.z + dist * 0.6
      );
      break;
  }
  ctx.camera.lookAt(target);
  ctx.controls.update();
}

// ─── Reset View ───────────────────────────────────────────────────────────────

export function resetView(ctx: ThreeSceneContext) {
  setCameraPreset(ctx, "iso");
}

// ─── Object Selection ─────────────────────────────────────────────────────────

const _raycaster = new THREE.Raycaster();
const _mouse = new THREE.Vector2();

/** Raycast click into the scene and select/deselect the mesh under the cursor. */
export function handleClick(ctx: ThreeSceneContext, event: MouseEvent): boolean {
  const rect = ctx.renderer.domElement.getBoundingClientRect();
  _mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  _mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  _raycaster.setFromCamera(_mouse, ctx.camera);
  const hits = _raycaster.intersectObject(ctx.meshGroup, true);

  if (hits.length > 0) {
    const hitMesh = hits[0].object as THREE.Mesh;
    if (ctx.selectedMesh === hitMesh) return true; // already selected
    selectMesh(ctx, hitMesh);
    return true;
  } else {
    deselectMesh(ctx);
    return false;
  }
}

/** Select a specific mesh and attach transform gizmo + outline. */
export function selectMesh(ctx: ThreeSceneContext, mesh: THREE.Mesh) {
  deselectMesh(ctx); // clear previous

  ctx.selectedMesh = mesh;

  // Create selection outline
  const edges = new THREE.EdgesGeometry(mesh.geometry, 15);
  const outline = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 })
  );
  outline.position.copy(mesh.position);
  outline.rotation.copy(mesh.rotation);
  outline.scale.copy(mesh.scale);
  ctx.meshGroup.add(outline);
  ctx.selectionOutline = outline;

  // Attach transform controls
  ctx.transformControls.attach(mesh);
  ctx.transformControls.visible = true;
  ctx.transformControls.enabled = true;
}

/** Deselect the current mesh, remove outline and transform gizmo. */
export function deselectMesh(ctx: ThreeSceneContext) {
  if (ctx.selectionOutline) {
    ctx.selectionOutline.geometry.dispose();
    (ctx.selectionOutline.material as THREE.Material).dispose();
    ctx.meshGroup.remove(ctx.selectionOutline);
    ctx.selectionOutline = null;
  }
  if (ctx.selectedMesh) {
    ctx.transformControls.detach();
    ctx.transformControls.visible = false;
    ctx.transformControls.enabled = false;
    ctx.selectedMesh = null;
  }
}

/** Set the transform gizmo mode. */
export function setTransformMode(ctx: ThreeSceneContext, mode: TransformMode) {
  ctx.transformControls.setMode(mode);
}

/** Get the current transform gizmo mode. */
export function getTransformMode(ctx: ThreeSceneContext): TransformMode {
  return ctx.transformControls.getMode() as TransformMode;
}

// ─── Dispose ──────────────────────────────────────────────────────────────────

export function disposeScene(ctx: ThreeSceneContext) {
  ctx.disposed = true;
  cancelAnimationFrame(ctx.animFrameId);
  deselectMesh(ctx);
  ctx.transformControls.dispose();
  ctx.controls.dispose();

  // Dispose meshes
  while (ctx.meshGroup.children.length > 0) {
    const child = ctx.meshGroup.children[0];
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material.dispose();
      }
    }
    ctx.meshGroup.remove(child);
  }

  ctx.renderer.dispose();
  ctx.renderer.domElement.remove();
}

// ─── Face Count ───────────────────────────────────────────────────────────────

export function getFaceCount(csg: AnyMesh): number {
  const polys = csg.toPolygons();
  return polys ? polys.length : 0;
}

// ─── Thumbnail Capture ────────────────────────────────────────────────────────

/**
 * Capture a snapshot of the current scene for use as a thumbnail.
 * Temporarily resizes the renderer, hides helpers, renders one frame,
 * then restores everything.
 * @returns WebP Blob at 800×600, or null if renderer unavailable.
 */
export async function captureSnapshot(
  ctx: ThreeSceneContext,
  width = 800,
  height = 600
): Promise<Blob | null> {
  if (ctx.disposed) return null;

  // Save current state
  const prevW = ctx.renderer.domElement.width;
  const prevH = ctx.renderer.domElement.height;
  const prevGrid = ctx.gridHelper.visible;
  const prevAxes = ctx.axesHelper.visible;
  const prevAspect = ctx.camera.aspect;

  try {
    // Hide helpers for a clean thumbnail
    ctx.gridHelper.visible = false;
    ctx.axesHelper.visible = false;

    // Resize to thumbnail dimensions
    ctx.camera.aspect = width / height;
    ctx.camera.updateProjectionMatrix();
    ctx.renderer.setSize(width, height);

    // Render one frame
    ctx.renderer.render(ctx.scene, ctx.camera);

    // Capture canvas as blob
    return await new Promise<Blob | null>((resolve) => {
      ctx.renderer.domElement.toBlob(
        (blob) => resolve(blob),
        "image/webp",
        0.85
      );
    });
  } finally {
    // Restore everything
    ctx.gridHelper.visible = prevGrid;
    ctx.axesHelper.visible = prevAxes;
    ctx.camera.aspect = prevAspect;
    ctx.camera.updateProjectionMatrix();
    ctx.renderer.setSize(prevW / (ctx.renderer.getPixelRatio()), prevH / (ctx.renderer.getPixelRatio()));
  }
}
