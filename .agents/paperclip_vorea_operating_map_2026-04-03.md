# Paperclip x Vorea - Mapa Operativo

_Generado: 2026-04-03_

## Estado actual

- Paperclip local disponible en `http://localhost:3100`
- Company en Paperclip: `Vorea Studio Parametric 3D`
- Goal principal: `Escalar Vorea Studio Parametric 3D con Paperclip`
- Subobjetivo inicial de equipo: `Impulsar marketing y crecimiento inicial de usuarios`
- Proyecto real conectado: `Vorea Parametrics 3D`
- Primer agente/CEO creado: `Cerebro Vorea CEO`
- Guia operativa para el board: `.agents/paperclip_vorea_operator_guide_2026-04-03.md`

## Identificadores Paperclip

- `companyId`: `d8196ad8-1c25-4715-a6cf-927860a2ef4b`
- `goalId`: `dd30abbf-3613-44b6-9aa1-3f9159b9a884`
- `projectId`: `92b22cea-e605-4803-81ab-17cf651d2cd6`
- `workspaceId`: `b858cce0-ef36-4446-9cd3-4b0fecf7c165`
- `agentId`: `97a16235-07b6-46f9-8602-fbd767a4d223`

## Repo real conectado

- Sitio: `https://voreastudio3d.com/`
- Repo local: `E:\__Vorea-Studio\__3D_parametrics\Vorea-Paramentrics-3D`
- Repo montado dentro del contenedor Paperclip: `/projects/vorea`
- Repo remoto: `https://github.com/martin-daguerre-pyxis/Vorea-Paramentrics-3D.git`
- Rama base actual: `develop`
- Cerebro operativo: `E:\__Vorea-Studio\__3D_parametrics\Vorea-Paramentrics-3D\.agents\🧠_Cerebro_Vorea.md`

## Mapa de puertos

- `3100` -> Paperclip board + API local en Docker
- `5173` -> frontend dev de Vorea (Vite)
- `3001` -> API local de Vorea
- `5432` -> PostgreSQL local de Vorea
- `5050` -> pgAdmin de Vorea

## Resultado de compatibilidad

- No hay choque actual entre Paperclip y Vorea.
- Paperclip usa `3100`, mientras Vorea reserva `5173` y `3001`.
- La base de Paperclip no esta expuesta al host, por lo que no compite con el `5432` de Vorea.
- Si algun dia `3100` hiciera falta para otra app, mover solo el puerto host de Paperclip, por ejemplo a `3200:3100`.

## Configuracion del proyecto en Paperclip

- Proyecto: `Vorea Parametrics 3D`
- Estado: `in_progress`
- Workspace principal:
  - `sourceType`: `local_path`
  - `cwd`: `/projects/vorea`
  - `repoUrl`: `https://github.com/martin-daguerre-pyxis/Vorea-Paramentrics-3D.git`
  - `repoRef`: `develop`
  - `defaultRef`: `develop`
  - `setupCommand`: `npm install`

## Configuracion del CEO inicial

- Nombre: `Cerebro Vorea CEO`
- Rol: `ceo`
- Adapter: `codex_local`
- Modelo: `gpt-5.4`
- `cwd`: `E:\__Vorea-Studio\__3D_parametrics\Vorea-Paramentrics-3D`
- `instructionsFilePath`: `E:\__Vorea-Studio\__3D_parametrics\Vorea-Paramentrics-3D\.agents\🧠_Cerebro_Vorea.md`
- `search`: `true`
- `dangerouslyBypassApprovalsAndSandbox`: `true`
- Heartbeat automatico: `disabled`

## Primera capa de equipo creada

- `Cerebro Vorea CEO` -> `97a16235-07b6-46f9-8602-fbd767a4d223`
- `Vorea CTO` -> `ab97e69d-6a04-452a-9f51-bd91a812cd79`
- `Vorea CMO` -> `b8d1d33d-d27f-4fc8-9567-442ca6881c8a`
- `Vorea Researcher` -> `76cf2aef-960b-4c2c-8043-2d5790b1ac4f`

Relaciones:

- `Vorea CTO` reporta a `Cerebro Vorea CEO`
- `Vorea CMO` reporta a `Cerebro Vorea CEO`
- `Vorea Researcher` reporta a `Cerebro Vorea CEO`

## Segunda capa tecnica creada

- `Vorea AI Studio Engineer` -> `567406a4-1c2e-4898-bb32-a543877ce7f3`
- `Vorea Monetization Engineer` -> `f2ac9908-6557-4e09-8307-51783e073789`
- `Vorea Relief Engineer` -> `e58a672c-8b22-4a1c-a675-c9306ea2cd0f`

Relaciones:

- Los tres reportan a `Vorea CTO`
- Fueron creados con instrucciones gestionadas dentro de Paperclip para que el modo Docker no dependa de paths Windows del host

## Issues semilla creados en Paperclip

- `EMP-1` -> `BG-301: Integrar motor IA real en AI Studio` -> asignado a `Vorea CTO`
- `EMP-2` -> `AI Studio CMS: mover familias y presets a base de datos` -> asignado a `Vorea CTO`
- `EMP-3` -> `BG-006/007/008: certificar monetizacion end-to-end fuera de local` -> asignado a `Vorea CTO`
- `EMP-4` -> `BG-109/110: cerrar bloque Relief y QA de export 3MF` -> asignado a `Vorea CTO`
- `EMP-5` -> `Objetivo inicial: marketing y crecimiento de usuarios (BG-114/116)` -> asignado a `Vorea CMO`
- `EMP-6` -> `BG-117.3: formalizar FODA y roadmap de 6 meses` -> asignado a `Vorea Researcher`

## Objetivos iniciales priorizados

- Marketing y crecimiento de usuarios ya esta explicitado como frente inicial dentro de Paperclip.
- El `Vorea CMO` tiene ownership directo del subobjetivo `Impulsar marketing y crecimiento inicial de usuarios`.
- `EMP-5` quedo elevado a prioridad `critical` para que el frente comercial comparta prioridad inicial con los bloques tecnicos mas urgentes.

## Paquete documental de marketing ya existente

- `docs/marketing/public-site-review-2026-03-28.md`
- `docs/marketing/pre-launch-copy-fixes-2026-03-28.md`
- `docs/marketing/campaign-playbook-2026-03-28.md`
- `docs/marketing/ad-copy-sets-2026-03-28.md`
- `docs/marketing/canva-briefs-final-2026-03-28.md`
- `docs/marketing/README.md`

Estos documentos ya quedaron asumidos como base operativa del frente comercial dentro de Paperclip.

## Desglose tactico del frente de growth

- `EMP-7` -> `Definir verdad comercial y copy final antes de pautar`
- `EMP-8` -> `Preparar primera ola de campañas por vertical`
- `EMP-9` -> `Preparar assets Canva y dashboard semanal de adquisicion`

Los tres cuelgan de `EMP-5` y quedan asignados al `Vorea CMO`.

## Nuevos subissues tecnicos sembrados

- `EMP-10` -> `AI Studio: preparar contrato de integracion del motor IA y primer spike tecnico`
- `EMP-11` -> `Monetizacion: auditar gaps de checkout, creditos y ledger para certificacion`
- `EMP-12` -> `Relief y 3MF: preparar matriz de QA y casos de slicer reales`

Los tres quedaron creados como backlog bajo `EMP-1`, `EMP-3` y `EMP-4`, sin autoasignacion todavia, para evitar ejecuciones fallidas mientras falta credencial del runner.

## Rutinas semanales preparadas

- `724bd343-cba7-4230-84b9-0420ff9b3396` -> `Weekly growth review and next actions`
- `822f1cfe-7e1b-4678-8900-10d20bfaea8d` -> `Weekly technical execution review`

Triggers:

- `bbe3695e-8984-4716-b993-339ca1c7c325` -> lunes 09:00 `America/Montevideo`
- `5024e24b-abb3-4035-bd60-6f51f76abd79` -> lunes 10:00 `America/Montevideo`

Las dos rutinas quedaron en `paused` para que no disparen ejecuciones automaticas antes de dejar autenticado el runner de Codex.

## Estado real del runner en Docker

- Se corrigio el fallo de permisos en `/paperclip/instances/default/data/run-logs`.
- Se migro CEO, CTO, CMO y Researcher a instrucciones gestionadas por Paperclip y `cwd` neutral para evitar errores por paths Windows dentro del contenedor.
- Se sembraron `auth.json` y `config.toml` de la sesion local `.codex` dentro del contenedor Paperclip.
- Una prueba `codex exec` y un wake manual del `Vorea CMO` ya confirman que el flujo Paperclip -> Codex vuelve a ejecutar y generar logs dentro del contenedor.
- El patron recomendado sigue siendo operar por issues/proyecto dentro del board `EMP`, no por wakeups manuales sin contexto de issue.

## Decisiones operativas

- El CEO usa el `🧠_Cerebro_Vorea.md` como instruccion central para mantener continuidad con el sistema de memoria del repo.
- El repo esta conectado como proyecto real, no como demo ni path ficticio.
- La prioridad inmediata de Paperclip sobre Vorea es coordinar backlog, ejecucion tecnica y direccion de producto/comercial sobre el repo vivo y el sitio productivo.
- Dentro de esa prioridad inmediata, marketing y crecimiento de usuarios quedaron reconocidos como uno de los objetivos iniciales explicitamente priorizados.

## Siguiente capa sugerida

- Crear agentes subordinados por dominio:
  - CTO / engineer para plataforma, backend y AI Studio
  - CMO para growth, contenidos y monetizacion
  - Researcher para competencia, tendencias 3D y discovery de producto
- Convertir los siguientes bloques del `project_backlog.md` en routines o issues recurrentes dentro de Paperclip para seguimiento continuo.
- Cuando el CTO necesite capacidad de ejecucion paralela, crear ingenieros subordinados por slice: monetizacion, Relief y AI Studio.
