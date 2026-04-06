/**
 * GitHub SCAD Scraper
 * ───────────────────
 * Downloads .scad files from popular GitHub repositories.
 * Uses GitHub's public API (no auth needed for small loads).
 *
 * Usage: node github-scad-scraper.mjs
 *
 * Curated list of repositories with high-quality parametric OpenSCAD models.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'public', 'scad-library', 'models');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Curated repos with SCAD files ───
const REPOS = [
  // Gridfinity ecosystem
  { owner: 'ostat', repo: 'gridfinity-extended-openscad', label: 'Gridfinity Extended' },
  { owner: 'vector76', repo: 'gridfinity_openscad', label: 'Gridfinity OpenSCAD' },
  { owner: 'kennetek', repo: 'gridfinity-rebuilt-openscad', label: 'Gridfinity Rebuilt' },

  // Parametric utilities
  { owner: 'revarbat', repo: 'BOSL2', label: 'BOSL2 Library', maxFiles: 5 },
  { owner: 'UBaer21', repo: 'UB.scad', label: 'UB.scad Utilities' },

  // Model collections
  { owner: 'xenomachina', repo: '3d-models', label: 'Xenomachina Models' },
  { owner: 'tanius', repo: 'openscad-models', label: 'Tanius Models' },
  { owner: 'rcolyer', repo: 'openscad-parameterized', label: 'Parameterized Collection' },
  { owner: 'nbr0wn', repo: 'parapart', label: 'ParaPart Repository' },

  // Functional prints
  { owner: 'rcolyer', repo: 'threads-scad', label: 'Threads Library' },
  { owner: 'JustinSDK', repo: 'dotSCAD', label: 'dotSCAD Library', maxFiles: 5 },

  // Storage & organization
  { owner: 'predict-idlab', repo: 'OpenSCAD-models', label: 'IDLab Models' },
];

// ─── GitHub API helpers ───
async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github.v3+json' },
  });
  if (res.status === 403) {
    console.log('  ⚠️ Rate limited. Waiting 60s...');
    await sleep(60000);
    return fetchJSON(url);
  }
  if (!res.ok) return null;
  return res.json();
}

async function getScadFiles(owner, repo, treePath = '', maxFiles = 20) {
  // Use recursive tree API for efficiency
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
  let tree = await fetchJSON(url);

  // Try 'master' branch if 'main' fails
  if (!tree) {
    const url2 = `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`;
    tree = await fetchJSON(url2);
  }
  if (!tree || !tree.tree) return [];

  // Filter .scad files
  const scadFiles = tree.tree
    .filter(f => f.path.endsWith('.scad') && f.type === 'blob')
    .filter(f => !f.path.includes('test') && !f.path.includes('example') && !f.path.includes('lib/'))
    .sort((a, b) => (b.size || 0) - (a.size || 0)) // Prefer larger files (more features)
    .slice(0, maxFiles);

  return scadFiles;
}

async function downloadFile(owner, repo, filePath) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`;
  let res = await fetch(url);

  // Try master if main fails
  if (!res.ok) {
    const url2 = `https://raw.githubusercontent.com/${owner}/${repo}/master/${filePath}`;
    res = await fetch(url2);
  }

  if (!res.ok) return null;
  return res.text();
}

// ─── SCAD validation ───
function isValidScad(text) {
  if (!text || text.length < 50) return false;
  if (text.includes('JFIF') || text.includes('<html')) return false;
  const keywords = ['module', 'cube', 'cylinder', 'sphere', 'translate', 'rotate',
    'difference', 'union', '$fn', 'linear_extrude', 'polygon', 'polyhedron',
    'square', 'circle', 'scale', 'hull', 'minkowski'];
  return keywords.some(kw => text.includes(kw));
}

// ─── Title from filename ───
function titleFromPath(filePath, repoLabel) {
  const base = path.basename(filePath, '.scad');
  const title = base
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
  return `${title} (${repoLabel})`;
}

// ═════════════════════════════════════════════════════════════════
// Main
// ═════════════════════════════════════════════════════════════════
async function main() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  GitHub SCAD Scraper — Vorea Studio                ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let totalDownloaded = 0;
  let totalSkipped = 0;
  const catalog = [];

  for (const { owner, repo, label, maxFiles } of REPOS) {
    console.log(`\n📦 ${label} (${owner}/${repo}):`);

    const files = await getScadFiles(owner, repo, '', maxFiles || 15);
    if (!files.length) {
      console.log('  ⤳ No SCAD files found or repo inaccessible');
      await sleep(1000);
      continue;
    }

    console.log(`  📋 Found ${files.length} .scad files`);
    let repoDownloads = 0;

    for (const file of files) {
      const safeName = `github-${owner}-${path.basename(file.path)}`
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .toLowerCase();

      // Skip if already exists
      const outPath = path.join(OUTPUT_DIR, safeName);
      if (fs.existsSync(outPath)) {
        console.log(`  ⏭️  ${path.basename(file.path)} (already exists)`);
        totalSkipped++;
        continue;
      }

      const content = await downloadFile(owner, repo, file.path);
      await sleep(500); // Rate limiting

      if (!content || !isValidScad(content)) {
        console.log(`  ❌ ${path.basename(file.path)} — invalid/too small`);
        continue;
      }

      // Check if it's just a library (only module definitions, no actual geometry)
      const hasTopLevel = content.match(/^(?!.*module\b).*(?:cube|cylinder|sphere|translate|rotate|difference|union|linear_extrude)/m);
      const hasModule = content.includes('module');
      if (!hasTopLevel && hasModule) {
        // It's a library file — still useful but mark differently
      }

      fs.writeFileSync(outPath, content, 'utf-8');
      repoDownloads++;
      totalDownloaded++;

      const sizeKB = (content.length / 1024).toFixed(1);
      console.log(`  ✅ ${path.basename(file.path)} (${sizeKB}KB)`);

      catalog.push({
        filename: safeName,
        title: titleFromPath(file.path, label),
        author: owner,
        source: 'github',
        sourceUrl: `https://github.com/${owner}/${repo}/blob/main/${file.path}`,
        repoLabel: label,
        sizeKB: +sizeKB,
      });
    }

    console.log(`  📊 Downloaded: ${repoDownloads}/${files.length}`);
    await sleep(1500); // Be nice to GitHub API
  }

  // Save GitHub-specific catalog
  const catalogPath = path.join(__dirname, 'public', 'scad-library', 'github-catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log(`║  ✅ Complete!                                       ║`);
  console.log(`║  Downloaded: ${String(totalDownloaded).padEnd(38)}║`);
  console.log(`║  Skipped (existing): ${String(totalSkipped).padEnd(30)}║`);
  console.log(`║  Total repos scanned: ${String(REPOS.length).padEnd(29)}║`);
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('\n💡 Run: node rebuild-catalog.js  — to rebuild the full catalog');
}

main().catch(console.error);
