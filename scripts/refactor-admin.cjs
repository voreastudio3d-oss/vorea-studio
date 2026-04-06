const fs = require('fs');
let content = fs.readFileSync('server/app.ts', 'utf8');

// Regex to find: app.VERB("/api/admin/...", async (c) => { \n try { \n const { ok, userId } = await isSuperAdmin(c); \n if (!ok) { return ... }
// or similar variations.
// Some use `const { ok } = await isSuperAdmin(c);`
// Some use `const { ok, userId: adminId } = await isSuperAdmin(c);`

const lines = content.split('\n');
let modified = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Look for route definitions that start with /api/admin/
  const match = line.match(/^(app\.(get|post|put|delete|patch))\(['"](\/api\/admin\/[^'"]+)['"]\s*,\s*async\s*\(\s*c\s*\)\s*=>\s*\{/);
  
  if (match) {
    // Found an admin route. Check the next few lines for isSuperAdmin
    let j = i + 1;
    let foundSuperAdmin = false;
    let tryBlockLines = 0;
    let blockStartIdx = -1;
    let blockEndIdx = -1;
    
    // Look ahead a few lines
    while (j < i + 15 && j < lines.length) {
      if (lines[j].includes('await isSuperAdmin(c)')) {
        blockStartIdx = j;
        foundSuperAdmin = true;
        
        // Find the if (!ok) block
        if (lines[j+1].includes('if (!ok)')) {
          if (lines[j+1].includes('}')) blockEndIdx = j + 1;
          else if (lines[j+2].includes('}')) blockEndIdx = j + 2;
          else if (lines[j+3].includes('}')) blockEndIdx = j + 3;
          else if (lines[j+4].includes('}')) blockEndIdx = j + 4;
        }
        break;
      }
      j++;
    }
    
    if (foundSuperAdmin && blockStartIdx !== -1 && blockEndIdx !== -1) {
      // Replace the route line to include requireSuperAdmin
      const verb = match[1]; // app.get
      const route = match[3]; // /api/admin/...
      lines[i] = `${verb}("${route}", requireSuperAdmin, async (c) => {`;
      
      // We see if they extracted `userId` or `adminId` from isSuperAdmin
      const extractLine = lines[blockStartIdx];
      let injectedCtx = "";
      if (extractLine.includes('userId')) {
        if (extractLine.includes('userId: adminId')) {
           injectedCtx = "    const adminId = c.get('userId') as string;";
        } else {
           injectedCtx = "    const userId = c.get('userId') as string;";
        }
      }
      
      // Delete the block
      for (let d = blockStartIdx; d <= blockEndIdx; d++) {
        lines[d] = ""; // remove
      }
      
      if (injectedCtx) {
        lines[blockStartIdx] = injectedCtx;
      }
      modified = true;
    }
  }
}

if (modified) {
  fs.writeFileSync('server/app.ts', lines.filter(l => l !== "").join('\n'));
  console.log("Refactoring applied to server/app.ts");
} else {
  console.log("No matches found or no modifications made.");
}
