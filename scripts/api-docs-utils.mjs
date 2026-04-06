import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const SOURCE_FILES = [
  { file: "server/app.ts", prefix: "" },
  { file: "server/news-routes.ts", prefix: "" },
  { file: "server/paypal-subscriptions.ts", prefix: "/api/subscriptions" },
];

const EXPLICIT_PUBLIC = new Set([
  "GET /api/health",
  "POST /api/auth/signup",
  "POST /api/auth/signin",
  "POST /api/auth/request-reset",
  "POST /api/auth/reset-password",
  "POST /api/auth/refresh",
  "GET /api/auth/social-providers",
  "GET /api/auth/google/config",
  "POST /api/auth/google",
  "GET /api/paypal/client-id",
  "GET /api/community/models",
  "GET /api/community/models/:id",
  "GET /api/community/models/:id/forks",
  "GET /api/community/models/:id/comments",
  "GET /api/community/tags",
  "GET /api/community/users/:id",
  "GET /api/uploads/thumbnail/:id",
  "GET /api/uploads/community-image/:id",
  "GET /api/rewards/:userId",
  "GET /api/rewards/leaderboard",
  "GET /api/content/hero-banner",
  "GET /api/news",
  "GET /api/news/:slug",
  "GET /api/subscriptions/plans",
  "GET /api/subscriptions/client-id",
  "POST /api/subscriptions/webhook",
]);

function readText(filePath) {
  return fs.readFileSync(path.resolve(ROOT, filePath), "utf8");
}

function getLineNumber(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function normalizePath(prefix, localPath) {
  if (!prefix) return localPath;
  return `${prefix}${localPath}`;
}

function splitTopLevelArgs(argsText) {
  const args = [];
  let current = "";
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let inString = false;
  let stringChar = "";
  let escaped = false;

  for (let i = 0; i < argsText.length; i += 1) {
    const ch = argsText[i];

    if (inString) {
      current += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === stringChar) {
        inString = false;
        stringChar = "";
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }

    if (ch === "(") depthParen += 1;
    else if (ch === ")") depthParen -= 1;
    else if (ch === "{") depthBrace += 1;
    else if (ch === "}") depthBrace -= 1;
    else if (ch === "[") depthBracket += 1;
    else if (ch === "]") depthBracket -= 1;

    if (ch === "," && depthParen === 0 && depthBrace === 0 && depthBracket === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim()) args.push(current.trim());
  return args;
}

function parseErrorCodes(block) {
  const codes = new Set();
  const callRegex = /return\s+c\.(?:json|text|body)\(([\s\S]*?)\);\s*/g;
  let callMatch = callRegex.exec(block);

  while (callMatch) {
    const argsText = callMatch[1];
    const args = splitTopLevelArgs(argsText);
    if (args.length >= 2) {
      const secondArg = args[1];
      const codeMatch = secondArg.match(/(\d{3})/g) || [];
      for (const codeText of codeMatch) {
        const codeNum = Number(codeText);
        if (Number.isFinite(codeNum) && codeNum >= 200 && codeNum <= 599) {
          codes.add(codeText);
        }
      }
    }
    callMatch = callRegex.exec(block);
  }

  if (/catch\s*\(/.test(block)) codes.add("500");
  return Array.from(codes).sort();
}

function detectDependencies(block, pathValue) {
  const deps = new Set();
  if (/kv\./.test(block)) deps.add("kv");
  if (/prisma\./.test(block)) deps.add("prisma");
  if (/supabase/i.test(block)) deps.add("supabase");
  if (/PAYPAL_|paypal|billing\/subscriptions|checkout\/orders/i.test(block) || pathValue.includes("/paypal") || pathValue.includes("/subscriptions")) {
    deps.add("paypal");
  }
  if (/fetch\(/.test(block) && !deps.has("paypal")) deps.add("external_http");
  return Array.from(deps).sort();
}

function inferAuthPolicy(route) {
  const key = `${route.method.toUpperCase()} ${route.path}`;
  const block = route.block;

  if (EXPLICIT_PUBLIC.has(key)) return "public";

  if (route.path.startsWith("/api/admin") || route.path.startsWith("/api/vault")) {
    return "superadmin";
  }

  if (/isSuperAdmin\(c\)/.test(block) && /return c\.json\([^,]+,\s*403\)/.test(block)) {
    return "superadmin";
  }

  if (/NEWS_CRON_SECRET|x-news-cron-secret/i.test(block) && /401|403/.test(block)) {
    return "internal_secret";
  }

  const userMatch = block.match(/const\s+([A-Za-z0-9_]+)\s*=\s*await\s+getUserId\(c\)/);
  if (userMatch) {
    const varName = userMatch[1];
    const requiredRegex = new RegExp(`if\\s*\\(\\s*!${varName}\\s*\\)\\s*return\\s+c\\.json\\([^,]+,\\s*401\\)`);
    if (requiredRegex.test(block)) return "authenticated";
    return "optional-auth";
  }

  if (/requireSupabaseAuth\(c\)/.test(block)) return "authenticated";

  if (/Bearer|Authorization|JWT|token/i.test(block) && /401/.test(block)) {
    return "authenticated";
  }

  return "public";
}

function inferRole(authPolicy) {
  if (authPolicy === "superadmin") return "superadmin";
  if (authPolicy === "internal_secret") return "internal_job";
  if (authPolicy === "authenticated") return "authenticated_user";
  if (authPolicy === "optional-auth") return "public_or_authenticated";
  return "public";
}

function inferTag(pathValue) {
  if (pathValue.startsWith("/api/auth")) return "Auth";
  if (pathValue.startsWith("/api/admin/community")) return "Admin Community";
  if (pathValue.startsWith("/api/admin")) return "Admin";
  if (pathValue.startsWith("/api/community")) return "Community";
  if (pathValue.startsWith("/api/paypal")) return "PayPal Orders";
  if (pathValue.startsWith("/api/subscriptions")) return "PayPal Subscriptions";
  if (pathValue.startsWith("/api/credits")) return "Credits";
  if (pathValue.startsWith("/api/rewards")) return "Rewards";
  if (pathValue.startsWith("/api/uploads")) return "Uploads";
  if (pathValue.startsWith("/api/gcode")) return "GCode";
  if (pathValue.startsWith("/api/feedback")) return "Feedback";
  if (pathValue.startsWith("/api/promotions")) return "Promotions";
  if (pathValue.startsWith("/api/ai")) return "AI";
  if (pathValue.startsWith("/api/vault")) return "Vault";
  if (pathValue.startsWith("/api/content")) return "Content";
  if (pathValue.startsWith("/api/internal/news")) return "Internal News";
  if (pathValue.startsWith("/api/news")) return "News";
  if (pathValue.startsWith("/api/tool-actions")) return "Tool Actions";
  if (pathValue.startsWith("/api/activity")) return "Activity";
  if (pathValue.startsWith("/api/telemetry")) return "Telemetry";
  if (pathValue.startsWith("/api/health")) return "Health";
  return "Misc";
}

function inferStatus(routeKey, duplicatesMap) {
  if ((duplicatesMap.get(routeKey) || 0) > 1) return "duplicated_definition";
  return "active";
}

function toOpenApiPath(routePath) {
  return routePath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function makeOperationId(method, openApiPath) {
  const clean = openApiPath
    .replace(/[{}]/g, "")
    .replace(/\/+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${method.toLowerCase()}_${clean || "root"}`;
}

export function collectRoutes() {
  const all = [];

  for (const source of SOURCE_FILES) {
    const filePath = source.file;
    const text = readText(filePath);
    const routeRegex = /\b(?:app|newsApp)\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g;
    const matches = [];
    let match = routeRegex.exec(text);
    while (match) {
      matches.push({
        method: match[1].toUpperCase(),
        localPath: match[2],
        index: match.index,
      });
      match = routeRegex.exec(text);
    }

    for (let i = 0; i < matches.length; i += 1) {
      const current = matches[i];
      const next = matches[i + 1];
      const blockEnd = next ? next.index : text.length;
      const block = text.slice(current.index, blockEnd);
      const routePath = normalizePath(source.prefix, current.localPath);
      all.push({
        method: current.method,
        path: routePath,
        openApiPath: toOpenApiPath(routePath),
        operationId: makeOperationId(current.method, toOpenApiPath(routePath)),
        file: filePath,
        line: getLineNumber(text, current.index),
        block,
      });
    }
  }

  const duplicatesMap = new Map();
  for (const route of all) {
    const key = `${route.method} ${route.path}`;
    duplicatesMap.set(key, (duplicatesMap.get(key) || 0) + 1);
  }

  return all
    .map((route) => {
      const routeKey = `${route.method} ${route.path}`;
      const authPolicy = inferAuthPolicy(route);
      return {
        ...route,
        routeKey,
        authPolicy,
        role: inferRole(authPolicy),
        tag: inferTag(route.path),
        dependencies: detectDependencies(route.block, route.path),
        errorCodes: parseErrorCodes(route.block),
        status: inferStatus(routeKey, duplicatesMap),
        duplicates: duplicatesMap.get(routeKey) || 1,
      };
    })
    .sort((a, b) => {
      const pathCmp = a.path.localeCompare(b.path);
      if (pathCmp !== 0) return pathCmp;
      return a.method.localeCompare(b.method);
    });
}

export function uniqueRoutes(routes) {
  const firstSeen = new Map();
  for (const route of routes) {
    if (!firstSeen.has(route.routeKey)) firstSeen.set(route.routeKey, route);
  }
  return Array.from(firstSeen.values());
}

export function listDuplicates(routes) {
  const grouped = new Map();
  for (const route of routes) {
    const list = grouped.get(route.routeKey) || [];
    list.push(route);
    grouped.set(route.routeKey, list);
  }
  return Array.from(grouped.entries())
    .filter(([, list]) => list.length > 1)
    .map(([routeKey, list]) => ({ routeKey, list }));
}

export function writeFile(relativePath, content) {
  const fullPath = path.resolve(ROOT, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}
