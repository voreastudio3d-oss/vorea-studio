const fs = require('fs');
const path = require('path');
const locales = ['en', 'es', 'pt'];
const dir = path.join(__dirname, '..', 'src', 'app', 'locales');

for (const l of locales) {
  const file = path.join(dir, `${l}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  
  const bench = data.benchmark;
  if (bench && typeof bench === 'object' && !Array.isArray(bench)) {
    for (const [k, v] of Object.entries(bench)) {
      data[`benchmark.${k}`] = v;
    }
    delete data.benchmark;
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(`Fixed ${l}.json`);
  } else {
    console.log(`${l}.json already flat or missing benchmark object`);
  }
}
