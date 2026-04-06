import fs from "node:fs";
import path from "node:path";
import { collectRoutes, uniqueRoutes } from "./api-docs-utils.mjs";

const ROOT = process.cwd();

function loadOpenApiRoutes() {
  const specPath = path.resolve(ROOT, "public/openapi.json");
  if (!fs.existsSync(specPath)) {
    throw new Error("No se encontró public/openapi.json. Ejecuta primero docs:api:generate.");
  }
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const openApiRoutes = new Set();

  for (const [pathKey, methods] of Object.entries(spec.paths || {})) {
    for (const method of Object.keys(methods || {})) {
      openApiRoutes.add(`${method.toUpperCase()} ${pathKey}`);
    }
  }
  return openApiRoutes;
}

function toOpenApiKey(route) {
  return `${route.method} ${route.openApiPath}`;
}

function run() {
  const sourceRoutes = uniqueRoutes(collectRoutes());
  const sourceKeys = new Set(sourceRoutes.map(toOpenApiKey));
  const openApiKeys = loadOpenApiRoutes();

  const missingInSpec = Array.from(sourceKeys).filter((key) => !openApiKeys.has(key));
  const extraInSpec = Array.from(openApiKeys).filter((key) => !sourceKeys.has(key));

  if (missingInSpec.length || extraInSpec.length) {
    console.error("[docs:parity] Paridad fallida.");
    if (missingInSpec.length) {
      console.error("\nRutas faltantes en OpenAPI:");
      missingInSpec.forEach((key) => console.error(`- ${key}`));
    }
    if (extraInSpec.length) {
      console.error("\nRutas sobrantes en OpenAPI (no detectadas en código):");
      extraInSpec.forEach((key) => console.error(`- ${key}`));
    }
    process.exit(1);
  }

  console.log(`[docs:parity] OK. ${sourceKeys.size} rutas únicas sincronizadas entre código y OpenAPI.`);
}

run();

