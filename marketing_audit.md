# Auditoría: Marketing vs Lógica de Negocio

> [!IMPORTANT]
> **Estado 2026-04-01: parcialmente vigente.**
> Este documento sigue siendo útil como auditoría de copy/promesa comercial, pero varias alertas ya fueron resueltas y no deben leerse como deuda activa sin revalidación.
>
> **Resuelto desde esta auditoría:**
> - packs renombrados de “Exportaciones” a `Pack Starter / Pack Pro / Pack Studio`
> - `monthlyCredits.FREE` unificado en `6`
> - `Profile.tsx` ya lee la asignación mensual desde `monthlyCredits` del servidor
>
> **Todavía útil como backlog/copy audit:**
> - wording ambiguo tipo `Exportaciones GCode ilimitadas`
> - mensajes comerciales que no explicitan consumo de créditos en herramientas como Organic/MakerWorld
> - necesidad de revisar promesas comerciales contra `DEFAULT_TOOL_CREDITS` antes de tocar pricing o planes
>
> Fuente de verdad operativa: `server/app.ts`, `src/app/services/business-config.ts`, `src/app/pages/Profile.tsx`

**Vorea Studio — Créditos, Planes y Promociones**
**Fecha:** 2026-03-18 | **Autor:** Antigravity AI

---

## Resumen Ejecutivo

Se auditaron **6 fuentes** de texto orientado al usuario contra la matriz de costos real en `DEFAULT_TOOL_CREDITS` del servidor. Se encontraron **11 inconsistencias**, de las cuales **3 son críticas** (podrían generar reclamos de usuarios) y **8 son mejorables**.

---

## 🔴 Hallazgos Críticos

### 1. Credit Packs: "Exportaciones" ≠ Créditos

| Archivo | Texto actual | Problema |
|---|---|---|
| [app.ts:1558](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/server/app.ts#L1557-L1561) | `"10 Exportaciones"`, `"30 Exportaciones"`, `"100 Exportaciones"` | **Engañoso** |
| [business-config.ts:64](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/services/business-config.ts#L63-L67) | Mismos nombres | **Duplicado del engaño** |

**Realidad según `DEFAULT_TOOL_CREDITS`:**

| Lo que el usuario puede hacer con 10 créditos | Cantidad real |
|---|---|
| Exportar STL | 10 ✅ (1 cr c/u) |
| Exportar OBJ o 3MF | **5** (2 cr c/u) |
| Exportar SCAD | **3** (3 cr c/u) |
| Generación IA simple | **2** (5 cr c/u) |
| Generación IA compleja | **1** (10 cr c/u) |
| Fork de modelo | 10 (1 cr c/u) |
| Organic deform | 10 (1 cr c/u) |
| Organic export mesh | **5** (2 cr c/u) |

> [!CAUTION]
> El nombre "Exportaciones" es **falso para todo excepto STL**. Un usuario que compre "10 Exportaciones" y exporte OBJ recibirá solo 5 exportaciones. Esto es un riesgo legal.

**Corrección:** Renombrar a `"Pack Starter (10 cr)"`, `"Pack Pro (30 cr)"`, `"Pack Studio (100 cr)"`

---

### 2. Contradicción FREE_LIMIT vs monthlyCredits

| Fuente | Valor | Ubicación |
|---|---|---|
| [FREE_LIMIT](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/services/storage.ts#410-414) hardcoded | **6** | [app.ts:670](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/server/app.ts#L670) |
| `monthlyCredits.FREE` | **10** | [app.ts:1579](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/server/app.ts#L1579) |
| `freeExportLimit` | **6** | [app.ts:1564](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/server/app.ts#L1564) |
| Plan FREE features | `"6 exportaciones GCode gratis"` | [business-config.ts:51](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/services/business-config.ts#L51) |

> [!WARNING]
> Hay **dos sistemas de créditos coexistiendo**: el viejo `FREE_LIMIT=6` que usa `/credits/consume`, y el nuevo `monthlyCredits=10`. El endpoint consume del viejo, mientras que [generatePlanFeatures()](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/server/app.ts#1680-1709) lee del nuevo y mostraría "10 créditos/mes" al usuario. **El usuario vería 10 pero solo podría usar 6.**

**Corrección:** Unificar a un solo sistema. Si FREE = 6, `monthlyCredits.FREE` debe ser 6.

---

### 3. Profile card muestra asignación hardcoded

| Archivo | Línea | Problema |
|---|---|---|
| [Profile.tsx](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/pages/Profile.tsx) | Card "Asignación mensual" | `FREE=6, PRO=200, STUDIO PRO=500` hardcoded |

> [!WARNING]
> Estos valores deberían venir de `monthlyCredits` del servidor, no estar hardcodeados. Además, los 200 y 500 para PRO/STUDIO PRO son irrelevantes porque esos tiers no consumen créditos (pasan gratis por el endpoint consume).

---

## 🟡 Hallazgos Mejorables

### 4. Tabla comparativa: "Generaciones IA / día" simplifica costos

| Fila | FREE | PRO | STUDIO PRO |
|---|---|---|---|
| **Se muestra** | 1 | 20 | Ilimitadas |
| **Realidad** | 1 simple (5 cr) | 20 simples (5 cr c/u) o 10 complejas (10 cr c/u) | Sin límite |

**Problema:** No se aclara que "simple" y "compleja" tienen costos diferentes. Un PRO que haga 20 generaciones complejas gastaría 200 cr/día.

---

### 5. Tabla comparativa: "Deformaciones orgánicas" como Sí/No

| Fila | FREE | PRO | STUDIO PRO |
|---|---|---|---|
| **Se muestra** | — | Sí | Sí |
| **Realidad** | Bloqueado (null limit) | 1 cr/deform, ilimitadas | 1 cr/deform, ilimitadas |
| **Export mesh** | Bloqueado | 2 cr, 10/mes | 2 cr, ilimitadas |

**Problema:** No dice que **consume créditos**. El usuario asume que "Sí" = gratis.

---

### 6. Tabla comparativa: "MakerWorld publish" como Sí/No

| Fila | FREE | PRO | STUDIO PRO |
|---|---|---|---|
| **Se muestra** | — | Sí | Sí |
| **Realidad** | Bloqueado | 3 cr/publish, ilimitadas | 3 cr/publish, ilimitadas |

**Problema:** Mismo que #5. "Sí" no implica gratis — cuesta 3 créditos.

---

### 7. Plan feature: "Exportación STL básica" (FREE)

**Se muestra:** `"Exportación STL básica"` (hardcoded en DEFAULT_PLANS)
**Realidad:** STL cuesta 1 crédito + FREE tiene límite de 5/mes según `DEFAULT_TOOL_CREDITS` → `download_stl: { creditCost: 1, limits: { free: 5 } }`
**Problema:** Se dice 5 en el tool credits pero 6 en [FREE_LIMIT](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/services/storage.ts#410-414). ¿Es 5 o 6?

---

### 8. Plan feature: "Exportaciones GCode ilimitadas" (PRO y STUDIO PRO)

**Se muestra en tarjeta PRO y STUDIO PRO.**
**Realidad en `DEFAULT_TOOL_CREDITS`:**
- GCode export: 1 cr, FREE=6 total, PRO=ilimitado, STUDIO PRO=ilimitado ✅
- GCode edit no-lineal: 3 cr, PRO=10/mes ❌
- GCode deform live: 3 cr, PRO=5/mes ❌

**Problema:** "GCode ilimitadas" es cierto solo para export básico. Edición no-lineal y deformación PRO tienen **límites de 5-10/mes**.

---

### 9. Plan feature: "API access" (STUDIO PRO)

**Se muestra como feature de Studio Pro.**
**Realidad:** No existe ningún sistema de API keys público ni documentación de API. Es una **feature fantasma** que no está implementada.

---

### 10. Plan feature: "Colaboración en equipo" (STUDIO PRO)

**Se muestra como feature de Studio Pro.**
**Realidad:** No existe ningún sistema de equipos, invitaciones, o colaboración implementado. **Feature fantasma.**

---

### 11. Plan feature: "Analytics avanzados" (STUDIO PRO)

**Se muestra en `DEFAULT_PLANS` feature list.**
**Realidad:** No existe un panel de analytics para usuarios. El ActivityTab es solo para SuperAdmin. **Feature fantasma.**

---

## Resumen de Acciones Requeridas

| # | Acción | Severidad | Archivos |
|---|---|---|---|
| 1 | Renombrar packs de "Exportaciones" a "Créditos" | 🔴 Crítica | [app.ts](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/server/app.ts), [business-config.ts](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/services/business-config.ts) |
| 2 | Unificar FREE_LIMIT con monthlyCredits.FREE | 🔴 Crítica | [app.ts](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/server/app.ts) |
| 3 | Profile card: leer monthlyCredits del servidor | 🔴 Crítica | [Profile.tsx](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/pages/Profile.tsx) |
| 4 | Tabla: aclarar costos variables en IA | ✅ Resuelto | `locales/*.json` |
| 5 | Tabla: indicar que Organic consume créditos | ✅ Resuelto | `locales/*.json` |
| 6 | Tabla: indicar que MakerWorld consume créditos | ✅ Resuelto | (El copy original ya lo decía) |
| 7 | Resolver contradicción STL limit 5 vs 6 | 🟡 Mejora | `app.ts` |
| 8 | Aclarar "GCode ilimitadas" vs limitaciones | 🟡 Mejora | `business-config.ts` |
| 9 | Remover "API access" hasta implementar | ✅ Resuelto | No estaba en `DEFAULT_PLANS` |
| 10 | Remover "Colaboración en equipo" hasta implementar | ✅ Resuelto | No estaba en `DEFAULT_PLANS` |
| 11 | Remover "Analytics avanzados" hasta implementar | ✅ Resuelto | No estaba en `DEFAULT_PLANS` |
