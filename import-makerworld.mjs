/**
 * Import MakerWorld SCAD Library
 * ─────────────────────────────────────────
 * Processes the JSON downloaded from the Chrome console extractor
 * and saves SCAD files + metadata into public/scad-library/
 *
 * Usage: node import-makerworld.mjs <path-to-json>
 * Example: node import-makerworld.mjs ~/Downloads/makerworld_scad_library_2026-03-17.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "public", "scad-library");
const MODELS_DIR = path.join(OUTPUT_DIR, "models");

function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error("Usage: node import-makerworld.mjs <path-to-json>");
    console.error("Example: node import-makerworld.mjs ~/Downloads/makerworld_scad_library_2026-03-17.json");
    process.exit(1);
  }

  const absPath = path.resolve(jsonPath);
  if (!fs.existsSync(absPath)) {
    console.error(`❌ File not found: ${absPath}`);
    process.exit(1);
  }

  console.log("╔════════════════════════════════════════════════╗");
  console.log("║  MakerWorld SCAD Library Importer               ║");
  console.log("╚════════════════════════════════════════════════╝\n");

  const raw = JSON.parse(fs.readFileSync(absPath, "utf-8"));
  const models = raw.models || [];

  console.log(`📦 Source: ${raw.source}`);
  console.log(`📊 Stats: ${JSON.stringify(raw.stats, null, 0)}`);
  console.log(`📋 Total models in file: ${models.length}\n`);

  // Create output dirs
  fs.mkdirSync(MODELS_DIR, { recursive: true });

  const catalog = [];
  let savedScad = 0;
  let noScad = 0;

  for (const model of models) {
    // Sanitize filename
    const safeName = (model.title || "untitled")
      .replace(/[^a-zA-Z0-9_\- ]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 60)
      .toLowerCase();

    const entry = {
      id: model.id,
      title: model.title,
      author: model.author,
      description: (model.description || "").slice(0, 300),
      category: model.category,
      cover: model.cover,
      likes: model.likes || 0,
      downloads: model.downloads || 0,
      collects: model.collects || 0,
      popularity: model.popularity || 1,
      popularityStars: model.popularityStars || "★☆☆☆☆",
      license: model.license || "",
      source: "makerworld",
      sourceUrl: model.sourceUrl || "",
      hasScad: false,
      scadFile: null,
    };

    // Save SCAD file if available
    if (model.hasScad && model.scadCode) {
      const filename = `${safeName}_${model.id}.scad`;
      const filepath = path.join(MODELS_DIR, filename);

      fs.writeFileSync(filepath, model.scadCode, "utf-8");
      entry.hasScad = true;
      entry.scadFile = filename;
      savedScad++;

      console.log(`  ✅ ${filename} (${(model.scadCode.length / 1024).toFixed(1)}KB) — ${model.popularityStars}`);
    } else {
      noScad++;
    }

    catalog.push(entry);
  }

  // Sort catalog by popularity
  catalog.sort((a, b) => b.popularity - a.popularity || b.downloads - a.downloads);

  // Write catalog index (without the raw SCAD code)
  const indexFile = path.join(OUTPUT_DIR, "index.json");
  fs.writeFileSync(indexFile, JSON.stringify({
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    source: raw.source,
    totalModels: catalog.length,
    withScad: savedScad,
    withoutScad: noScad,
    categories: [...new Set(catalog.map(m => m.category))].filter(Boolean).sort(),
    models: catalog,
  }, null, 2), "utf-8");

  // Write a lightweight catalog for frontend (no heavy fields)
  const lightCatalog = catalog.map(m => ({
    id: m.id,
    title: m.title,
    author: m.author,
    category: m.category,
    cover: m.cover,
    popularity: m.popularity,
    popularityStars: m.popularityStars,
    hasScad: m.hasScad,
    scadFile: m.scadFile,
    downloads: m.downloads,
    likes: m.likes,
  }));

  const lightFile = path.join(OUTPUT_DIR, "catalog.json");
  fs.writeFileSync(lightFile, JSON.stringify(lightCatalog, null, 2), "utf-8");

  console.log("\n╔════════════════════════════════════════════════╗");
  console.log(`║  ✅ Import Complete                              ║`);
  console.log(`║  SCAD files saved: ${String(savedScad).padEnd(29)}║`);
  console.log(`║  Models without SCAD: ${String(noScad).padEnd(26)}║`);
  console.log(`║  Index: public/scad-library/index.json          ║`);
  console.log(`║  Catalog: public/scad-library/catalog.json      ║`);
  console.log("╚════════════════════════════════════════════════╝");
}

main();
