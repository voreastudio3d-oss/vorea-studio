/**
 * i18n Locale Sync Validation Script
 * Compares all locale files against es.json as source of truth.
 * Exit code 1 if any gaps found (usable in CI).
 *
 * Usage: node scripts/i18n-sync-check.mjs
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, "../src/app/locales");

const files = readdirSync(localesDir).filter((f) => f.endsWith(".json"));
const reference = "es.json";

function readJSON(name) {
  return JSON.parse(readFileSync(resolve(localesDir, name), "utf-8"));
}

function flatKeys(obj) {
  const result = [];
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      for (const childKey of flatKeys(value)) {
        result.push(key + "." + childKey);
      }
    } else {
      result.push(key);
    }
  }
  return result;
}

const esData = readJSON(reference);
const esKeys = new Set(flatKeys(esData));

let hasErrors = false;

console.log(`\n📋 i18n Sync Check — reference: ${reference} (${esKeys.size} keys)\n`);

// Only check main locales, not regional variants
const mainLocales = files.filter(
  (f) => f !== reference && !f.includes("-") // skip es-AR, en-GB, pt-BR etc.
);

for (const file of mainLocales) {
  const data = readJSON(file);
  const keys = new Set(flatKeys(data));

  const missing = [...esKeys].filter((k) => !keys.has(k));
  const orphan = [...keys].filter((k) => !esKeys.has(k));
  const empty = [...keys].filter((k) => {
    // Check for empty string values in flat keys
    const val = data[k];
    return typeof val === "string" && val.trim() === "";
  });

  const status = missing.length === 0 ? "✅" : "❌";
  console.log(`${status} ${file}: ${keys.size} keys`);

  if (missing.length > 0) {
    console.log(`   ⚠️  Missing ${missing.length} keys:`);
    missing.slice(0, 10).forEach((k) => console.log(`      - ${k}`));
    if (missing.length > 10) console.log(`      ... and ${missing.length - 10} more`);
    hasErrors = true;
  }

  if (orphan.length > 0) {
    console.log(`   ℹ️  ${orphan.length} extra keys (not in ${reference})`);
  }

  if (empty.length > 0) {
    console.log(`   ⚠️  ${empty.length} empty values`);
    empty.slice(0, 5).forEach((k) => console.log(`      - ${k}`));
    hasErrors = true;
  }
}

console.log("");

if (hasErrors) {
  console.log("❌ Sync check FAILED — fix the issues above.");
  process.exit(1);
} else {
  console.log("✅ All locales in sync!");
  process.exit(0);
}
