/**
 * MakerWorld SCAD Extractor — Vorea Studio
 * ─────────────────────────────────────────
 * Extracts open-source parametric SCAD models from MakerWorld (BambuLab)
 * and saves them as a curated library for Vorea Studio users.
 *
 * Usage: node extract-makerworld.mjs [--limit N] [--category CATEGORY]
 *
 * API Endpoints (reverse-engineered):
 *   Listing: makerworld.com/_next/data/{buildId}/{locale}/makerlab/parametricModelMaker.json
 *   Detail:  makerworld.com/api/v1/design-service/design/{designId}
 *   SCAD:    makerworld.com/api/v1/design-service/design/{designId}/model?modelType=scad
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = "https://makerworld.com";
const CATEGORIES = [
  "all", "3d_printer", "art", "education", "fashion",
  "hobby_diy", "household", "miniatures", "props_cosplays", "tools", "toys_games"
];
const OUTPUT_DIR = path.join(__dirname, "public", "scad-library");
const MODELS_DIR = path.join(OUTPUT_DIR, "models");
const INDEX_FILE = path.join(OUTPUT_DIR, "index.json");

const LIMIT_PER_PAGE = 20;
const MAX_PAGES = 10; // max 200 models per category
const DELAY_MS = 1500; // be polite to their servers

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const defaultHeaders = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "es-UY,es;q=0.9,en;q=0.8",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Referer": "https://makerworld.com/es/makerlab/parametricModelMaker",
};

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { headers: defaultHeaders });
    if (!res.ok) {
      console.error(`  ✗ HTTP ${res.status} for ${url.slice(0, 100)}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`  ✗ Fetch error: ${e.message}`);
    return null;
  }
}

// ─── Step 1: Discover Next.js Build ID ─────────────────────────────────────────

async function discoverBuildId() {
  console.log("🔍 Discovering Next.js build ID...");
  try {
    const res = await fetch(BASE_URL + "/es/makerlab/parametricModelMaker?from=makerlab&pageType=home", {
      headers: defaultHeaders,
    });
    const html = await res.text();
    // Extract buildId from __NEXT_DATA__
    const match = html.match(/"buildId"\s*:\s*"([^"]+)"/);
    if (match) {
      console.log(`  ✓ Build ID: ${match[1]}`);
      return match[1];
    }
    // Try _next/static chunk pattern
    const chunkMatch = html.match(/_next\/data\/([^/]+)\//);
    if (chunkMatch) {
      console.log(`  ✓ Build ID (from chunk): ${chunkMatch[1]}`);
      return chunkMatch[1];
    }
    console.error("  ✗ Could not find build ID");
    return null;
  } catch (e) {
    console.error(`  ✗ Error discovering build ID: ${e.message}`);
    return null;
  }
}

// ─── Step 2: Fetch Model Listings ──────────────────────────────────────────────

async function fetchModelListings(buildId) {
  console.log("\n📋 Fetching model listings...");
  const allModels = new Map(); // deduplicate by designId

  // Strategy 1: Try the Next.js data endpoint
  for (const orderBy of ["hotScore", "downloadCount", "collectCount"]) {
    for (let offset = 0; offset < LIMIT_PER_PAGE * MAX_PAGES; offset += LIMIT_PER_PAGE) {
      const url = `${BASE_URL}/_next/data/${buildId}/es/makerlab/parametricModelMaker.json?pageType=search&orderBy=${orderBy}&offset=${offset}&limit=${LIMIT_PER_PAGE}`;
      console.log(`  → Fetching ${orderBy} offset=${offset}...`);

      const data = await fetchJSON(url);
      if (!data) break;

      // Navigate the nested response
      const list =
        data?.pageProps?.designListResp?.list ||
        data?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.list ||
        [];

      if (list.length === 0) {
        console.log(`  ℹ No more results for ${orderBy}`);
        break;
      }

      for (const item of list) {
        if (!allModels.has(item.designId)) {
          allModels.set(item.designId, {
            designId: item.designId,
            title: item.title || item.designTitle || "Untitled",
            author: item.designCreator?.name || item.creatorName || "Unknown",
            cover: item.cover || item.coverUrl || "",
            likeCount: item.likeCount || 0,
            downloadCount: item.downloadCount || 0,
            collectCount: item.collectCount || 0,
            isClosedSource: item.isClosedSource || false,
            category: item.tagName || item.category || "general",
          });
        }
      }

      await sleep(DELAY_MS);
    }
  }

  // Strategy 2: Also try the API endpoint directly
  for (const orderBy of ["hotScore", "downloadCount"]) {
    for (let offset = 0; offset < LIMIT_PER_PAGE * 5; offset += LIMIT_PER_PAGE) {
      const url = `${BASE_URL}/api/v1/design-service/design/parametric?orderBy=${orderBy}&offset=${offset}&limit=${LIMIT_PER_PAGE}`;
      console.log(`  → Trying API endpoint ${orderBy} offset=${offset}...`);

      const data = await fetchJSON(url);
      if (!data?.hits && !data?.list && !data?.designs) break;

      const list = data?.hits || data?.list || data?.designs || [];
      if (list.length === 0) break;

      for (const item of list) {
        const id = item.designId || item.id;
        if (id && !allModels.has(id)) {
          allModels.set(id, {
            designId: id,
            title: item.title || item.designTitle || "Untitled",
            author: item.designCreator?.name || item.creatorName || "Unknown",
            cover: item.cover || item.coverUrl || "",
            likeCount: item.likeCount || 0,
            downloadCount: item.downloadCount || 0,
            collectCount: item.collectCount || 0,
            isClosedSource: item.isClosedSource || false,
            category: item.tagName || item.category || "general",
          });
        }
      }
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n✓ Found ${allModels.size} unique models`);
  return Array.from(allModels.values());
}

// ─── Step 3: Fetch SCAD for Open-Source Models ─────────────────────────────────

async function fetchScadCode(designId) {
  // Try multiple endpoints to get the SCAD source
  const endpoints = [
    `${BASE_URL}/api/v1/design-service/design/${designId}/model?modelType=scad`,
    `${BASE_URL}/api/v1/design-service/design/${designId}/scad`,
  ];

  for (const url of endpoints) {
    const data = await fetchJSON(url);
    if (data?.url) {
      // Got a CDN URL to the .scad file
      try {
        const scadRes = await fetch(data.url, { headers: defaultHeaders });
        if (scadRes.ok) {
          return await scadRes.text();
        }
      } catch (e) {
        console.error(`    ✗ Failed to download SCAD from CDN: ${e.message}`);
      }
    }
    if (data?.content || data?.code) {
      return data.content || data.code;
    }
  }

  return null;
}

async function fetchModelDetail(designId) {
  const url = `${BASE_URL}/api/v1/design-service/design/${designId}`;
  return await fetchJSON(url);
}

// ─── Step 4: Calculate Popularity Score ────────────────────────────────────────

function calculatePopularity(model) {
  // Weighted score: downloads count most, then likes, then collects
  const score = (model.downloadCount * 2) + (model.likeCount * 3) + (model.collectCount * 1);
  if (score > 10000) return 5; // ★★★★★
  if (score > 5000) return 4;  // ★★★★
  if (score > 1000) return 3;  // ★★★
  if (score > 200) return 2;   // ★★
  return 1;                     // ★
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const maxModels = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 999;

  console.log("╔════════════════════════════════════════════════╗");
  console.log("║  MakerWorld SCAD Extractor — Vorea Studio      ║");
  console.log("╚════════════════════════════════════════════════╝\n");

  // Create output directories
  fs.mkdirSync(MODELS_DIR, { recursive: true });

  // Step 1: Get build ID
  const buildId = await discoverBuildId();
  if (!buildId) {
    console.error("❌ Cannot proceed without build ID. The site may have changed.");
    console.log("   Falling back to API-only mode...");
  }

  // Step 2: Fetch listings
  const models = buildId
    ? await fetchModelListings(buildId)
    : [];

  if (models.length === 0) {
    console.log("\n⚠ No models found via Next.js data endpoint.");
    console.log("  This may require authentication. Trying public API fallback...");

    // Try the public makerworld page to scrape design IDs from HTML
    try {
      const res = await fetch(`${BASE_URL}/es/makerlab/parametricModelMaker?from=makerlab&pageType=home`, {
        headers: defaultHeaders,
      });
      const html = await res.text();

      // Extract design IDs from the HTML
      const designIdMatches = [...html.matchAll(/designId["\s:]+(\d+)/g)];
      const scadUrlMatches = [...html.matchAll(/scadUrl[^"]*"([^"]+\.scad[^"]*)"/g)];
      const unikeyMatches = [...html.matchAll(/unikey["\s:]+([a-f0-9-]+)/g)];

      console.log(`  Found ${designIdMatches.length} design IDs from HTML`);
      console.log(`  Found ${scadUrlMatches.length} SCAD URLs from HTML`);
      console.log(`  Found ${unikeyMatches.length} unikeys from HTML`);

      for (const match of designIdMatches) {
        const designId = match[1];
        if (!models.find(m => m.designId === designId)) {
          models.push({
            designId,
            title: `Model ${designId}`,
            author: "Unknown",
            cover: "",
            likeCount: 0,
            downloadCount: 0,
            collectCount: 0,
            isClosedSource: false,
            category: "general",
          });
        }
      }
    } catch (e) {
      console.error(`  ✗ HTML scrape failed: ${e.message}`);
    }
  }

  // Step 3: Process each model
  const library = [];
  let downloaded = 0;

  for (let i = 0; i < Math.min(models.length, maxModels); i++) {
    const model = models[i];
    console.log(`\n[${i + 1}/${Math.min(models.length, maxModels)}] ${model.title} (${model.designId})`);

    // Skip closed source
    if (model.isClosedSource) {
      console.log("  ⤳ Closed source — skipping");
      continue;
    }

    // Fetch detail for richer metadata
    const detail = await fetchModelDetail(model.designId);
    if (detail) {
      model.title = detail.title || detail.designTitle || model.title;
      model.author = detail.designCreator?.name || model.author;
      model.description = detail.summary || detail.description || "";
      model.license = detail.license || "";
      model.likeCount = detail.likeCount || model.likeCount;
      model.downloadCount = detail.downloadCount || model.downloadCount;
    }

    await sleep(500);

    // Fetch SCAD code
    const scadCode = await fetchScadCode(model.designId);
    if (scadCode && scadCode.length > 50) {
      // Save SCAD file
      const safeName = model.title
        .replace(/[^a-zA-Z0-9_\- ]/g, "")
        .replace(/\s+/g, "_")
        .slice(0, 60)
        .toLowerCase();
      const filename = `${safeName}_${model.designId}.scad`;
      const filepath = path.join(MODELS_DIR, filename);

      // Add Vorea header
      const header = [
        `// ═══════════════════════════════════════════════`,
        `// Vorea Studio — SCAD Library`,
        `// Source: MakerWorld (BambuLab)`,
        `// Model: ${model.title}`,
        `// Author: ${model.author}`,
        `// Design ID: ${model.designId}`,
        `// License: ${model.license || "See original"}`,
        `// ═══════════════════════════════════════════════`,
        ``,
      ].join("\n");

      fs.writeFileSync(filepath, header + scadCode, "utf-8");
      console.log(`  ✓ Saved: ${filename} (${(scadCode.length / 1024).toFixed(1)}KB)`);

      library.push({
        id: model.designId,
        filename,
        title: model.title,
        author: model.author,
        description: model.description || "",
        category: model.category || "general",
        cover: model.cover,
        likes: model.likeCount,
        downloads: model.downloadCount,
        collects: model.collectCount,
        popularity: calculatePopularity(model),
        source: "makerworld",
        sourceUrl: `https://makerworld.com/es/models/${model.designId}`,
        extractedAt: new Date().toISOString(),
      });
      downloaded++;
    } else {
      console.log("  ⤳ No SCAD code available (may require auth)");
    }

    await sleep(DELAY_MS);
  }

  // Step 4: Sort by popularity and save index
  library.sort((a, b) => b.popularity - a.popularity || b.downloads - a.downloads);

  // Write index
  fs.writeFileSync(INDEX_FILE, JSON.stringify({
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    source: "MakerWorld (BambuLab)",
    totalModels: library.length,
    models: library,
  }, null, 2), "utf-8");

  console.log("\n╔════════════════════════════════════════════════╗");
  console.log(`║  ✅ Extraction Complete                         ║`);
  console.log(`║  Models found: ${models.length.toString().padEnd(33)}║`);
  console.log(`║  SCAD downloaded: ${downloaded.toString().padEnd(30)}║`);
  console.log(`║  Index saved to: public/scad-library/index.json ║`);
  console.log("╚════════════════════════════════════════════════╝");
}

main().catch(console.error);
