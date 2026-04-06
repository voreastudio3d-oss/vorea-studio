const fs = require('fs');
const content = fs.readFileSync('server/app.ts', 'utf8');

// Simple parser to find all app.VERB("route", async (c) => { ... })
// and check if they contain getUserId or isSuperAdmin before the response.

const lines = content.split('\n');
let insideRoute = false;
let currentRoute = "";
let hasAuthCheck = false;
let routeLine = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detect route start
  const routeMatch = line.match(/^app\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/);
  if (routeMatch) {
    insideRoute = true;
    currentRoute = `${routeMatch[1].toUpperCase()} ${routeMatch[2]}`;
    hasAuthCheck = false;
    routeLine = i + 1;
    continue;
  }
  
  if (insideRoute) {
    if (line.includes('getUserId') || line.includes('isSuperAdmin') || line.includes('role === "superadmin"') || line.includes('requireAuth')) {
      hasAuthCheck = true;
    }
    
    // Naive end of block detection
    if (line.startsWith('});')) {
      if (!hasAuthCheck) {
        console.log(`[Unprotected] Line ${routeLine}: ${currentRoute}`);
      }
      insideRoute = false;
    }
  }
}
