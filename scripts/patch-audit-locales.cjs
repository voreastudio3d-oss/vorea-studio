const fs = require('fs');
const path = require('path');
const dir = 'e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/locales';

function updateFile(file, updates) {
  const fp = path.join(dir, file);
  if (!fs.existsSync(fp)) return;
  const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
  let changed = false;
  for (const [k, v] of Object.entries(updates)) {
    if (j[k] !== v) {
      j[k] = v;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(fp, JSON.stringify(j, null, 2) + '\n', 'utf8');
    console.log(`Updated ${file}`);
  }
}

const esUpdates = {
  "membership.feat.ai": "Generaciones IA / mes (5 cr simple, 10 cr compleja)",
  "membership.val.organicPro": "Sí (1 cr/deform, 2 cr/export)"
};

const enUpdates = {
  "membership.feat.ai": "AI Generations / month (5 cr simple, 10 cr complex)",
  "membership.val.organicPro": "Yes (1 cr/deform, 2 cr/export)"
};

const ptUpdates = {
  "membership.feat.ai": "Gerações de IA / mês (5 cr simples, 10 cr complexa)",
  "membership.val.organicPro": "Sim (1 cr/deform, 2 cr/export)"
};

const fileMap = {
  'es.json': esUpdates, 'es-AR.json': esUpdates, 'es-MX.json': esUpdates, 'es-UY.json': esUpdates,
  'en.json': enUpdates, 'en-GB.json': enUpdates,
  'pt.json': ptUpdates, 'pt-BR.json': ptUpdates
};

for (const [file, updates] of Object.entries(fileMap)) {
  updateFile(file, updates);
}
console.log('Done mapping locale keys!');
