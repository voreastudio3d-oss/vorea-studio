/**
 * STL-to-Heightmap Converter — Projects an STL mesh orthographically
 * to produce a grayscale depth map suitable for the Relief tool.
 *
 * Vorea Studio — voreastudio.com
 */

import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

/**
 * Parse an STL file (binary or ASCII) and return a BufferGeometry.
 */
export function parseSTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  const loader = new STLLoader();
  return loader.parse(buffer);
}

/**
 * Convert an STL geometry into a grayscale heightmap by orthographic
 * projection from above (top-down view along -Y axis).
 *
 * @param geometry - STL BufferGeometry
 * @param size     - Output image resolution (square), default 512
 * @returns Data URL of the grayscale PNG heightmap
 */
export function stlToHeightmap(geometry: THREE.BufferGeometry, size = 512): string {
  // Set up offscreen renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    preserveDrawingBuffer: true,
    alpha: true,
  });
  renderer.setSize(size, size);
  renderer.setClearColor(0x000000, 1);

  // Center and scale the mesh to fit the viewport
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);

  const bboxSize = new THREE.Vector3();
  bbox.getSize(bboxSize);
  const maxDim = Math.max(bboxSize.x, bboxSize.z) || 1;
  const heightDim = bboxSize.y || 1;

  // Custom depth shader: maps Y position to brightness
  // White = highest point, Black = lowest point
  const depthMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      varying float vDepth;
      uniform float minY;
      uniform float rangeY;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // Normalize Y to 0..1 (bottom → top)
        vDepth = clamp((position.y - minY) / rangeY, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      varying float vDepth;
      void main() {
        gl_FragColor = vec4(vec3(vDepth), 1.0);
      }
    `,
    uniforms: {
      minY: { value: -heightDim / 2 },
      rangeY: { value: heightDim },
    },
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, depthMaterial);
  const scene = new THREE.Scene();
  scene.add(mesh);

  // Orthographic camera looking down
  const halfSize = maxDim / 2 * 1.05; // 5% padding
  const camera = new THREE.OrthographicCamera(
    -halfSize, halfSize,
    halfSize, -halfSize,
    0.1, heightDim * 2
  );
  camera.position.set(0, heightDim, 0);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);

  // Extract canvas data URL
  const dataUrl = renderer.domElement.toDataURL("image/png");

  // Cleanup
  renderer.dispose();
  depthMaterial.dispose();
  geometry.dispose();

  return dataUrl;
}
