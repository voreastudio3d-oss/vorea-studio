# Arquitectura Global, Escala y Modelado de Costos
**Fecha:** 2026-04-14
**Líder:** Gemini (Antigravity)
**Workflow:** `global_architecture_scale_rule`

## 1. Estado y Resolución del Roadmap

Tras completar con éxito la etapa de monetización (Codex/Claude), el sistema ha demostrado madurez en el flujo crítico (reservation → capture → release). La siguiente preocupación operativa es cómo se comportará la plataforma al enfrentarse al mercado global (Multi-Region), particularmente en los vectores de Storage, Ancho de banda y Costo IA.

## 2. Decisiones de Arquitectura y Configuración Multi-Región

### 2.1. Base de Datos (PostgreSQL en Railway)
- **Timezones:** A nivel código, todas las fechas se están registrando y agregando en `UTC` de manera consistente (`.toISOString()`), garantizando la independencia regional de los reportes.
- **Riesgo:** Una sola instancia en una única región (e.g., us-east) introducirá latencia (~150-250ms) en la validación de créditos (in-path del motor 3D) para usuarios de Europa o Asia.
- **Defensa:** El rate-limit y el chequeo de "circuit breaker" deben apoyarse fuertemente en el KV Store in-memory distribuido. Para una V2, evaluar Redis global o Edge KV.

### 2.2. Costos de Storage y Ancho de Banda (CDN)
- **Aislamiento de Binarios:**
  - Los modelos `SCAD` generados pesan muy poco (~1.5KB promedio). Sin embargo, los `renders 3D` interactivos (.gltf, .obj) y las capturas `.png` de thumbnails pueden promediar ~35KB-100KB por request exitoso.
  - El motor actual ya registra agresivamente en `regionalStorageDailyAggregate` (35KB de payload estimado por hit exitoso).
- **Riesgo Operativo:** Crecimiento exponencial si 10,000 requests/día se ejecutan sostenídamente, resultando en ~350MB/día solo de metadatos de rendering y modelos no-cacheables.
- **Medida adoptada:** Forzar cacheo (CDN-level Cache-Control headers) para las recetas públicas y plantillas base de familias. El _object storage_ (e.g. AWS S3 o R2) pasará a ser OBLIGATORIO antes de abrir tráfico asiático/europeo, dado el costo prohibitivo del egress tradicional.

### 2.3. Control de Costo IA (Gasto API)
- El pipeline híbrido (`ai-studio-pipeline`) ya integra una matriz de rutas (`LaneMatrixEntry` -> Economy, Balanced, Premium) conectada a un termostato de **Forecast Band** (Green, Yellow, Red, Blocked).
- Si el Utilization de la billetera global sube, el router aplica un soft-downgrade (ej: `gpt-4o` -> `gemini-2.5-flash` o `deepseek`) de forma completamente automatizada en base al costo diario.
- Esto nos resguarda fuertemente del abuso, manteniendo la viabilidad del proyecto libre de shocks de facturación.

### 2.4. Mecanismo de Seguridad y Hardening frente Abuso
El Rate-Limit Distribuido, integrado en `server/middleware/rate-limit.ts` (funcionando 100% sobre KV/Postgres para multiregion-readiness) detendrá ráfagas abusivas por IP/Usuario.
Adicionalmente, el Circuit-Breaker Global en el `ai-generation-engine` corta el gasto de todos los LLMs por completo si se supera el presupuesto mensual global.

## 3. Próximo Paso Accionable
1. Empujar los cambios esquemáticos (`npx prisma db push`) al entorno de Railway para asegurar la compatibilidad total (específicamente la tabla de registros regionales).
2. Avanzar sobre `OpenAI / GPT: Estrategia de Mercados, localizaciones y Growth`.
