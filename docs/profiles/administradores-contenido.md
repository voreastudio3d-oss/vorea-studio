# Guía por Perfil — Administradores de Contenido

## Objetivo

Gestionar calidad, seguridad editorial y visibilidad de contenido en Comunidad con criterios claros de moderación.

## Tablero operativo

1. Listado global de modelos: `/api/admin/community/models`.
2. Curación y featured: `/api/community/models/:id/feature`.
3. Limpieza y mantenimiento: `/api/admin/community/cleanup`.
4. Banner y contenidos editoriales: `/api/content/hero-banner`.

## Protocolo de moderación

1. Verificar cumplimiento de políticas antes de destacar o mantener público.
2. En reportes o conflictos, priorizar evidencia (comentarios, descargas, historial).
3. Aplicar acciones consistentes y trazables para evitar arbitrariedad.

## Monitoreo de salud

1. Revisar reportes de uso/revenue (`/api/admin/reports/*`).
2. Controlar señales de abuso en promociones, rewards y telemetría.
3. Mantener límites de imagen, créditos y budget de IA alineados al negocio.
   - El **Dashboard** principal cuenta con una tarjeta de "Uso Presupuesto IA" equipada con un indicador visual (Circuit Breaker) que alerta inmediatamente (en rojo) si el uso real supera el límite base configurado, deteniendo temporalmente el motor de generación.

## Seguridad operacional

1. Operar con cuentas superadmin controladas.
2. No compartir claves ni secretos fuera de Vault (`/api/vault/keys*`).
3. Auditar cambios de configuración (planes, límites, promociones, presupuestos).
