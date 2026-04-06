import fs from "node:fs";
import path from "node:path";
import { collectRoutes, listDuplicates, uniqueRoutes, writeFile } from "./api-docs-utils.mjs";

const ROOT = process.cwd();

function loadStripeMentions() {
  const localeFiles = [
    "src/app/locales/es.json",
    "src/app/locales/en.json",
    "src/app/locales/pt.json",
  ];
  const mentions = [];
  for (const filePath of localeFiles) {
    const text = fs.readFileSync(path.resolve(ROOT, filePath), "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/stripe/i.test(line)) {
        mentions.push({ filePath, line: index + 1, text: line.trim() });
      }
    });
  }
  return mentions;
}

function makeSummary(method, routePath) {
  if (method === "GET" && routePath.endsWith("s")) return `Listar ${routePath}`;
  if (method === "GET") return `Obtener ${routePath}`;
  if (method === "POST") return `Crear/ejecutar ${routePath}`;
  if (method === "PUT") return `Actualizar ${routePath}`;
  if (method === "PATCH") return `Parcial ${routePath}`;
  if (method === "DELETE") return `Eliminar ${routePath}`;
  return `${method} ${routePath}`;
}

function successCode(method) {
  if (method === "POST") return "200";
  if (method === "DELETE") return "200";
  return "200";
}

function codeDescription(code) {
  if (code === "200") return "Respuesta exitosa";
  if (code === "201") return "Creado";
  if (code === "400") return "Solicitud inválida";
  if (code === "401") return "Autenticación requerida";
  if (code === "403") return "Sin permisos suficientes";
  if (code === "404") return "Recurso no encontrado";
  if (code === "409") return "Conflicto";
  if (code === "429") return "Rate limit";
  if (code === "500") return "Error interno";
  if (code === "503") return "Servicio no disponible";
  return `HTTP ${code}`;
}

function responseForCode(code) {
  const schemaRef = code.startsWith("2")
    ? "#/components/schemas/GenericSuccess"
    : "#/components/schemas/GenericError";
  return {
    description: codeDescription(code),
    content: {
      "application/json": {
        schema: { $ref: schemaRef },
      },
    },
  };
}

function bodyExample(route) {
  const key = `${route.method} ${route.path}`;
  const examples = {
    "POST /api/auth/signup": { email: "dev@vorea.studio", password: "********", name: "Dev User" },
    "POST /api/auth/signin": { email: "dev@vorea.studio", password: "********" },
    "POST /api/paypal/create-order": { packId: "pack_pro_50", price: 9.99 },
    "POST /api/paypal/capture-order": { orderId: "5O190127TN364715T", packId: "pack_pro_50" },
    "POST /api/subscriptions/create": { tier: "pro", billing: "monthly" },
    "POST /api/community/models": {
      title: "Engranaje Paramétrico",
      description: "Modelo listo para impresión 3D.",
      modelType: "parametric",
      scadCode: "module gear() { ... }",
      tags: ["gear", "parametric"],
    },
    "PUT /api/community/models/:id": {
      title: "Engranaje Paramétrico v2",
      status: "published",
    },
    "POST /api/community/models/:id/comments": {
      body: "Excelente modelo, gracias por compartir.",
    },
  };
  return examples[key] || { note: "Consultar contrato detallado en matriz operativa." };
}

function buildOperation(route) {
  const parameters = [];
  const paramRegex = /:([A-Za-z0-9_]+)/g;
  let match = paramRegex.exec(route.path);
  while (match) {
    parameters.push({
      name: match[1],
      in: "path",
      required: true,
      schema: { type: "string" },
      description: `Parámetro de ruta: ${match[1]}`,
    });
    match = paramRegex.exec(route.path);
  }

  const operation = {
    operationId: route.operationId,
    tags: [route.tag],
    summary: makeSummary(route.method, route.path),
    description: [
      `Endpoint real detectado en \`${route.file}:${route.line}\`.`,
      `Política de acceso: **${route.authPolicy}**.`,
      `Dependencias primarias: ${route.dependencies.length ? route.dependencies.join(", ") : "ninguna explícita"}.`,
      route.status === "duplicated_definition" ? "Advertencia: existe definición duplicada para este método/path en código." : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    parameters,
    responses: {},
    "x-vorea-meta": {
      authPolicy: route.authPolicy,
      role: route.role,
      status: route.status,
      dependencies: route.dependencies,
      source: `${route.file}:${route.line}`,
    },
  };

  if (route.authPolicy === "authenticated" || route.authPolicy === "superadmin") {
    operation.security = [{ BearerAuth: [] }];
  }

  if (route.method === "POST" || route.method === "PUT" || route.method === "PATCH") {
    operation.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            additionalProperties: true,
          },
          example: bodyExample(route),
        },
      },
    };
  }

  const codes = new Set(route.errorCodes);
  codes.add(successCode(route.method));
  if (route.authPolicy === "authenticated") codes.add("401");
  if (route.authPolicy === "superadmin") {
    codes.add("401");
    codes.add("403");
  }
  if (!codes.has("500")) codes.add("500");

  for (const code of Array.from(codes).sort()) {
    operation.responses[code] = responseForCode(code);
  }

  return operation;
}

function buildOpenApiSpec(routes) {
  const unique = uniqueRoutes(routes);
  const tags = Array.from(new Set(unique.map((route) => route.tag)))
    .sort()
    .map((name) => ({ name }));

  const paths = {};
  for (const route of unique) {
    if (!paths[route.openApiPath]) paths[route.openApiPath] = {};
    paths[route.openApiPath][route.method.toLowerCase()] = buildOperation(route);
  }

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Vorea Studio API",
      version: "2026-03-19",
      summary: "API backend completa de Vorea Studio (inventario generado automáticamente).",
      description:
        "Especificación OpenAPI generada a partir de rutas reales del backend. PayPal es la pasarela operativa actual.",
    },
    servers: [
      { url: "http://localhost:5173", description: "Frontend local" },
      { url: "http://localhost:3001", description: "API server local" },
    ],
    tags,
    paths,
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        GenericSuccess: {
          type: "object",
          additionalProperties: true,
          description: "Respuesta JSON exitosa (forma varía por endpoint).",
        },
        GenericError: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
          },
          additionalProperties: true,
          description: "Respuesta JSON de error.",
        },
      },
    },
    "x-quickstarts": [
      {
        id: "auth",
        title: "Quickstart Auth",
        steps: [
          "POST /api/auth/signup para crear usuario.",
          "POST /api/auth/signin para obtener JWT.",
          "Usar Authorization: Bearer <token> en endpoints autenticados.",
        ],
      },
      {
        id: "community",
        title: "Quickstart Comunidad/Modelos",
        steps: [
          "POST /api/uploads/community-image para cargar imágenes.",
          "POST /api/community/models para publicar/borrador.",
          "GET /api/community/models y GET /api/community/models/{id} para explorar.",
        ],
      },
      {
        id: "monetization",
        title: "Quickstart Monetización (PayPal)",
        steps: [
          "POST /api/paypal/create-order para orden de créditos.",
          "POST /api/paypal/capture-order para confirmar pago.",
          "POST /api/subscriptions/create y POST /api/subscriptions/webhook para suscripciones.",
        ],
      },
      {
        id: "admin",
        title: "Quickstart Admin",
        steps: [
          "GET /api/admin/check para validar permisos.",
          "GET /api/admin/community/models para moderación global.",
          "GET /api/admin/reports/revenue y /usage para monitoreo.",
        ],
      },
    ],
  };

  return spec;
}

function buildMatrixMarkdown(routes, duplicates) {
  const header = [
    "# Inventario Operativo de Endpoints",
    "",
    `Generado: ${new Date().toISOString()}`,
    "",
    `Total definiciones detectadas: **${routes.length}**`,
    `Total únicos (method+path): **${uniqueRoutes(routes).length}**`,
    `Definiciones duplicadas detectadas: **${duplicates.length}**`,
    "",
    "| Método | Path | Auth | Rol | Estado | Dependencias | Errores | Origen |",
    "|---|---|---|---|---|---|---|---|",
  ];

  const rows = routes.map((route) => {
    const deps = route.dependencies.length ? route.dependencies.join(", ") : "—";
    const errors = route.errorCodes.length ? route.errorCodes.join(", ") : "—";
    return `| ${route.method} | \`${route.path}\` | ${route.authPolicy} | ${route.role} | ${route.status} | ${deps} | ${errors} | \`${route.file}:${route.line}\` |`;
  });

  return `${header.concat(rows).join("\n")}\n`;
}

function buildInconsistenciesMarkdown(routes, duplicates, stripeMentions) {
  const lines = [
    "# Inconsistencias Detectadas en API/Producto",
    "",
    `Generado: ${new Date().toISOString()}`,
    "",
    "## 1) Definiciones duplicadas de rutas",
  ];

  if (!duplicates.length) {
    lines.push("", "No se detectaron rutas duplicadas por método/path.");
  } else {
    for (const dup of duplicates) {
      lines.push("", `- **${dup.routeKey}**`);
      for (const item of dup.list) {
        lines.push(`  - \`${item.file}:${item.line}\``);
      }
      lines.push("  - Recomendación: mantener una sola definición canónica para evitar comportamiento ambiguo.");
    }
  }

  lines.push("", "## 2) Mensajería Stripe vs backend real", "");
  if (!stripeMentions.length) {
    lines.push("No se detectaron menciones a Stripe en locales revisados.");
  } else {
    lines.push("Se detectaron menciones a Stripe en UI, pero backend operativo actual es PayPal:");
    for (const mention of stripeMentions) {
      lines.push(`- \`${mention.filePath}:${mention.line}\` → ${mention.text}`);
    }
    lines.push("", "Recomendación: alinear copy a PayPal (actual) y dejar Stripe solo como roadmap.");
  }

  lines.push("", "## 3) Estado de pasarela de pagos", "");
  lines.push("- Implementado en backend: **PayPal** (orders + subscriptions + webhook firmado).");
  lines.push("- No implementado en backend: **Stripe**.");

  const allTags = Array.from(new Set(routes.map((route) => route.tag))).sort();
  lines.push("", "## 4) Cobertura por dominio", "");
  lines.push(`Dominios detectados: ${allTags.join(", ")}`);

  return `${lines.join("\n")}\n`;
}

function buildInventoryJson(routes, duplicates, stripeMentions) {
  return {
    generatedAt: new Date().toISOString(),
    totals: {
      routeDefinitions: routes.length,
      uniqueRoutes: uniqueRoutes(routes).length,
      duplicatedDefinitions: duplicates.length,
    },
    routes: routes.map((route) => ({
      method: route.method,
      path: route.path,
      authPolicy: route.authPolicy,
      role: route.role,
      status: route.status,
      tag: route.tag,
      dependencies: route.dependencies,
      errorCodes: route.errorCodes,
      source: `${route.file}:${route.line}`,
      duplicates: route.duplicates,
    })),
    inconsistencies: {
      duplicateRoutes: duplicates.map((dup) => ({
        routeKey: dup.routeKey,
        sources: dup.list.map((item) => `${item.file}:${item.line}`),
      })),
      stripeMentions,
      paymentGatewayState: {
        paypalImplemented: true,
        stripeImplemented: false,
      },
    },
  };
}

function run() {
  const routes = collectRoutes();
  const duplicates = listDuplicates(routes);
  const stripeMentions = loadStripeMentions();

  const openapi = buildOpenApiSpec(routes);
  const matrix = buildMatrixMarkdown(routes, duplicates);
  const inconsistencies = buildInconsistenciesMarkdown(routes, duplicates, stripeMentions);
  const inventory = buildInventoryJson(routes, duplicates, stripeMentions);

  writeFile("public/openapi.json", `${JSON.stringify(openapi, null, 2)}\n`);
  writeFile("docs/api/endpoint-matrix.md", matrix);
  writeFile("docs/api/inconsistencies.md", inconsistencies);
  writeFile("docs/api/endpoint-inventory.json", `${JSON.stringify(inventory, null, 2)}\n`);
  writeFile("public/docs/api/endpoint-matrix.md", matrix);
  writeFile("public/docs/api/inconsistencies.md", inconsistencies);
  writeFile("public/docs/api/endpoint-inventory.json", `${JSON.stringify(inventory, null, 2)}\n`);

  console.log(`[docs] routes: ${routes.length}`);
  console.log(`[docs] unique: ${uniqueRoutes(routes).length}`);
  console.log(`[docs] duplicates: ${duplicates.length}`);
  console.log("[docs] wrote OpenAPI + matrix + inconsistencies + inventory (repo + public/docs/api)");
}

run();
