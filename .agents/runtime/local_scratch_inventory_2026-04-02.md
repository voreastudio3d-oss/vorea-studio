# Inventario local de archivos scratch — 2026-04-02

## Propósito

Dejar trazabilidad explícita sobre archivos locales que hoy existen en el workspace pero no forman parte del flujo canónico ni de los commits de `develop`.

## Estado actual

### Borradores o notas locales no canónicas

- `Auditoría de abuso y hardening operativo para Vorea Studio.md`
- `lista de consultas.md`
- `llm_analysis.md`

Uso recomendado:

- conservar solo como notas de trabajo o referencia histórica;
- no tomarlas como fuente de verdad por encima de:
  - `security_abuse_audit_2026-04-01.md`
  - `documentation_cutoff_2026-04-01.md`
  - `global_readiness_status_2026-04-02.md`

### Scripts locales de prueba aún no promovidos a tooling oficial

- `scripts/test-ai-providers.ts`
- `scripts/test-single-ai-model.ts`

Uso recomendado:

- mantenerlos locales mientras sigan siendo utilidades de benchmark/manual;
- promoverlos al repo canónico solo si pasan a formar parte de un workflow repetible y documentado.

### Artefactos transitorios de depuración o test

- `preflight_error.txt`
- `test_dump_governance.txt`
- `test_results.json`
- `test_results.tap`
- `test_results.txt`

Decisión:

- estos artefactos se consideran ruido operativo local;
- quedan ignorados por `.gitignore` para evitar commits accidentales futuros.

## Criterio práctico

Si un archivo:

1. no tiene enlace desde `🧠_Cerebro_Vorea.md`,
2. no está citado como documento canónico en `runtime/README.md`,
3. o no participa de un workflow repetible del repo,

entonces debe tratarse como scratch local hasta que se promueva explícitamente.
