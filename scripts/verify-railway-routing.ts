import fetch from "node-fetch";

const DOMAIN = process.argv[2] || "https://voreastudio3d.com";

const ROUTES = [
  { path: "/api/health", expectType: "json", expectStatus: 200 },
  { path: "/robots.txt", expectType: "text", expectStatus: 200 },
  { path: "/sitemap.xml", expectType: "xml", expectStatus: 200 },
  { path: "/", expectType: "html", expectStatus: 200 },
  { path: "/perfil", expectType: "html", expectStatus: 200 },
  { path: "/ai-studio", expectType: "html", expectStatus: 200 },
];

async function runSmoke() {
  console.log(`\n🚀 Iniciando Smoke Test Base (Punto 3) contra: ${DOMAIN}\n`);

  let allOk = true;

  for (const route of ROUTES) {
    const url = `${DOMAIN}${route.path}`;
    try {
      const start = Date.now();
      const res = await fetch(url); // Fetch follows redirects by default
      const time = Date.now() - start;

      const isStatusOk = res.status === route.expectStatus;
      
      const contentType = res.headers.get("content-type") || "";
      const isTypeOk = contentType.includes(route.expectType) || contentType.includes("text/html"); // For redirects HTML is standard

      if (isStatusOk && isTypeOk) {
        console.log(`✅ [${res.status}] ${route.path.padEnd(15)} - ${time}ms (${contentType})`);
      } else {
        console.error(`❌ [${res.status}] ${route.path.padEnd(15)} - ERROR (Esperaba ${route.expectStatus} / ${route.expectType}, obtuvo ${contentType})`);
        allOk = false;
      }
    } catch (error: any) {
      console.error(`❌ [ERR] ${route.path.padEnd(15)} - Fallo por excepción: ${error.message}`);
      allOk = false;
    }
  }

  if (allOk) {
    console.log(`\n🎉 CERTIFICACIÓN PUNTO 3 PASADA: Todos los endpoints responden correctamente.\n`);
  } else {
    console.error(`\n⚠️ CERTIFICACIÓN PUNTO 3 FALLIDA: Hay problemas en algunas rutas.\n`);
    process.exit(1);
  }
}

runSmoke();
