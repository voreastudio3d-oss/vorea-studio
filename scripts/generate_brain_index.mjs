import fs from 'fs';
import path from 'path';

// Parse very basic YAML frontmatter since we don't want to install extra dependencies
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  
  const yaml = match[1];
  const metadata = {};
  
  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > -1) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      metadata[key] = value;
    }
  }
  return metadata;
}

function processDirectory(dir, basePath, categories) {
  if (!fs.existsSync(dir)) return;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.git') || entry.name === '.obsidian') continue;
    
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      processDirectory(fullPath, basePath, categories);
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.yml') || entry.name.endsWith('.yaml')) {
      const isMd = entry.name.endsWith('.md');
      const content = fs.readFileSync(fullPath, 'utf8');
      
      let title = entry.name;
      let description = '';
      
      if (isMd) {
        const metadata = parseFrontmatter(content);
        if (metadata.title) title = metadata.title;
        else if (content.startsWith('# ')) {
          title = content.split('\n')[0].replace('# ', '').trim();
        }
        if (metadata.description) description = metadata.description;
      }
      
      // Determine category based on folder
      const relPath = path.relative(basePath, fullPath).replace(/\\/g, '/');
      let category = 'Documentos Sueltos';
      
      if (relPath.startsWith('.agents/rules')) category = 'Reglas de Código (Rules)';
      else if (relPath.startsWith('.agents/workflows')) category = 'Workflows';
      else if (relPath.startsWith('.agents/codex-skills') || relPath.startsWith('.agents/skills')) category = 'Skills & Catalogos';
      else if (relPath.startsWith('.agents/subagents')) category = 'Subagentes Específicos';
      else if (relPath.startsWith('.agents/adapters')) category = 'Adaptadores IA';
      else if (relPath.startsWith('.agents/runtime')) category = 'Estado (Runtime)';
      else if (relPath === 'ai_shared_plan.md' || relPath === 'project_backlog.md' || relPath.startsWith('ai_handoff')) category = 'Plan Maestro y Handoffs';
      else if (!relPath.startsWith('.agents/')) continue; // skip other root files for now to avoid clutter
      
      if (!categories[category]) categories[category] = [];
      categories[category].push({ name: entry.name, title, description, relPath });
    }
  }
}

async function main() {
  const rootDir = path.resolve(process.cwd());
  const categories = {};
  
  // Scans root documents first (Plan, Backlog, Handoffs)
  processDirectory(rootDir, rootDir, categories);
  
  // Sort and build markdown
  const order = [
    'Plan Maestro y Handoffs',
    'Reglas de Código (Rules)',
    'Workflows',
    'Skills & Catalogos',
    'Subagentes Específicos',
    'Adaptadores IA',
    'Estado (Runtime)',
    'Documentos Sueltos'
  ];
  
  let markdown = `# 🧠 Cerebro Colectivo Vorea\n\n`;
  markdown += `Bienvenido al núcleo de conocimiento del proyecto. Obsiian usará este documento como el Sol (nodo central) de tu **Graph View** conectando a los planetas (reglas, flujos, memoria temporal).\n\n`;
  markdown += `_Generado: ${new Date().toISOString().split('T')[0]}_\n\n`;
  
  for (const cat of order) {
    if (!categories[cat] || categories[cat].length === 0) continue;
    
    markdown += `## ${cat}\n\n`;
    for (const file of categories[cat]) {
      // Determine safe Obsidian link target. 
      // Obsidian prefers no extensions, and resolves fuzzy paths from the end.
      const basename = file.name.replace(/\.(md|yml|yaml)$/, '');
      const parentDir = file.relPath.split('/').slice(-2, -1)[0] || '';
      
      // If it's a generic name like SKILL or README, prepend the parent folder to disambiguate
      const isGeneric = ['SKILL', 'README', 'index'].includes(basename);
      const linkTarget = isGeneric && parentDir ? `${parentDir}/${basename}` : basename;

      // Create an Obsidian wikilink using the safe target
      const link = `[[${linkTarget}|${file.name}]]`;
      const descPart = file.description ? `: ${file.description}` : '';
      const titleDisplay = file.title !== file.name ? ` **${file.title}**` : '';
      
      markdown += `- ${link}${titleDisplay}${descPart}\n`;
    }
    markdown += `\n`;
  }
  
  const outPath = path.join(rootDir, '.agents', '🧠_Cerebro_Vorea.md');
  fs.writeFileSync(outPath, markdown, 'utf8');
  console.log('✅ Índice de Cerebro generado en:', outPath);
}

main().catch(console.error);
