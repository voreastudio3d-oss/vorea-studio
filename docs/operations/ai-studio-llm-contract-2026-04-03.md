# AI Studio LLM Contract

## Objetivo

Definir el contrato técnico mínimo para cerrar el tramo `prompt -> spec/instrucción -> salida usable en Editor` dentro de AI Studio, sin abrir refactors amplios.

## Entrada canónica

Ruta: `POST /api/ai-studio/generate`

Payload esperado:

```json
{
  "prompt": "string (3-4000 chars)",
  "engine": "fdm | organic",
  "familySlug": "string",
  "quality": "draft | final",
  "parameterOverrides": {
    "width": 120,
    "label_text": "CLIENTE"
  }
}
```

Reglas de validación de entrada:

- `prompt` obligatorio, sanitizado y acotado.
- `familySlug` obligatorio.
- `parameterOverrides` debe ser un objeto plano.
- máximo `25` overrides por request.
- auth obligatoria.
- rate limit por IP y por usuario.
- chequeo previo de presupuesto y créditos.

## Normalización server-side

El backend ya no debe depender de un spec “inventado” por el cliente. La fuente de verdad queda en la normalización server-side:

1. sanitizar prompt
2. resolver familia pedida vs familia resuelta
3. normalizar overrides contra schema real de la familia
4. producir warnings y risk flags
5. decidir routing provider/model
6. ejecutar generación LLM
7. construir el contrato de salida para el Editor

Campos canónicos del bloque `contract.normalized`:

- `prompt`
- `requestedFamilySlug`
- `resolvedFamilySlug`
- `familyDisplayName`
- `intent`
- `warnings`
- `riskFlags`
- `parameterOverrides`

## Salida canónica

La respuesta exitosa ahora debe contener:

```json
{
  "success": true,
  "result": {
    "modelName": "string",
    "scadCode": "string",
    "parameters": []
  },
  "contract": {
    "normalized": {
      "prompt": "string",
      "requestedFamilySlug": "string",
      "resolvedFamilySlug": "string",
      "familyDisplayName": "string",
      "intent": "string",
      "warnings": [],
      "riskFlags": [],
      "parameterOverrides": {}
    },
    "editor": {
      "spec": {}
    }
  },
  "usage": {},
  "routing": {}
}
```

## Criterios de validación del spike

Se considera válido si:

- el frontend consume `contract.editor.spec` en vez de fabricar un spec sintético local;
- el historial guarda `familyHint` y `parameterOverrides` ya normalizados por backend;
- la familia resuelta puede diferir de la pedida sin perder trazabilidad;
- los warnings de normalización sobreviven hasta el spec que usa el Editor;
- la respuesta sigue devolviendo `result`, `usage` y `routing` para compatibilidad del flujo actual.

## Spike implementado

Cambios entregados en este slice:

- helper server-side para construir `contract.normalized` y `contract.editor.spec`;
- merge de schema real + parámetros devueltos por el LLM para producir un `InstructionSpecV1` usable;
- `POST /api/ai-studio/generate` ahora devuelve `contract`;
- `src/app/pages/AIStudio.tsx` dejó de reconstruir un spec local ad hoc y consume el contrato del backend.

## Riesgos abiertos

- el runner de tests del workspace está roto por dependencias faltantes de `vitest`;
- el `tsconfig` global del repo referencia `vitest/globals`, pero ese type lib no está resolviendo en esta instalación;
- este spike asegura el contrato hasta el Editor, pero no agrega todavía una capa formal de `editor state` con `traceId`, warnings visibles en UI o replay detallado de routing.
