import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appPath = path.resolve(__dirname, '../server/app.ts');

let code = fs.readFileSync(appPath, 'utf8');

// 1. Add import rateLimiter
if (!code.includes('import { rateLimiter } from "./middleware/rate-limit.js";')) {
  code = code.replace(
    /import \{ Hono \} from "hono";/,
    'import { Hono } from "hono";\nimport { rateLimiter } from "./middleware/rate-limit.js";'
  );
}

// 2. Add app.use middlewares right after app.use("*", logger(console.log));
const middlewares = `
// ─── Rate Limiting Middlewares (BG-206) ───────────────────────────────────────
app.use("/api/feedback/ai-review", rateLimiter({ windowMs: 60 * 1000, maxRequests: 5 }));
app.use("/api/ai/quick-fix", rateLimiter({ windowMs: 60 * 1000, maxRequests: 10 }));
app.use("/api/auth/*", rateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 20 }));
app.use("/api/*", rateLimiter({ windowMs: 5 * 60 * 1000, maxRequests: 150 }));
`;

if (!code.includes('Rate Limiting Middlewares')) {
  code = code.replace(
    /\/\/ Enable logger\napp\.use\("\*", logger\(console\.log\)\);/,
    `// Enable logger\napp.use("*", logger(console.log));\n${middlewares}`
  );
}

// 3. Remove inline definition of rateLimit
code = code.replace(
  /\/\/ ─── LOW-1 FIX: In-memory rate limiter ────────────────────────────────────────[\s\S]*?\/\/ Clean up stale entries every 5 minutes[\s\S]*?setInterval\(\(\) => \{[\s\S]*?\}, 5 \* 60 \* 1000\);/g,
  '// ─── Rate limiting was moved to global middleware ──────────────────────────'
);

// 4. Remove all inline usages
// They look like:
// const ip = c.req.header("x-forwarded-for") || "unknown";
// if (rateLimit(`signup:${ip}`, 5, 15 * 60 * 1000)) { ... }
code = code.replace(
  /[ \t]*\/\/[^\n]*Rate limit[^\n]*\n[ \t]*const ip = c\.req\.header\("x-forwarded-for"\) \|\| "unknown";\n[ \t]*if \(rateLimit\([\s\S]*?\}\n/g,
  ''
);
code = code.replace(
  /[ \t]*const ip = c\.req\.header\("x-forwarded-for"\) \|\| "unknown";\n[ \t]*if \(rateLimit\([\s\S]*?\}\n/g,
  ''
);
code = code.replace(
  /[ \t]*\/\/[^\n]*rateLimit\(ip\)\.[^\n]*\n/g,
  ''
);
code = code.replace(
  /[ \t]*\/\/[^\n]*rate limiting[^\n]*\n/g,
  ''
);

fs.writeFileSync(appPath, code);
console.log('App.ts updated successfully with unified rate limiting!');
