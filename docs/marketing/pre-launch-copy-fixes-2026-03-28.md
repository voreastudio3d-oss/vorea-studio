# Correcciones de Copy Antes de Lanzar Campañas

## Resumen

Antes de invertir en tráfico pago, conviene corregir cuatro frentes:

1. Precios inconsistentes entre landings verticales y `/plans`
2. Límites/beneficios inconsistentes entre landings verticales y `/plans`
3. Claim de `colaboración` en membresías
4. `<title>` y metadatos genéricos en rutas `/for/*` cuando el cliente hidrata

## Regla de decisión

Si hoy `/plans` y `business-config` son la fuente de verdad comercial, entonces las landings verticales deben alinearse a:

- `Pro = USD 12/mes`
- `Free = 1 generación IA por mes`
- `Pro = 20 generaciones IA por mes`
- evitar `ilimitado` salvo en aquello que realmente sea cierto

Si la verdad comercial real va a ser la de las landings, entonces hay que corregir `/plans` y la configuración antes de pautar. Mientras eso no ocurra, para campañas usar mensajes no cuantitativos.

## P0: Precio de Pro inconsistente

### Dónde aparece

- [MakerLanding.tsx](E:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/pages/MakerLanding.tsx): línea 277
- [AICreatorsLanding.tsx](E:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/pages/AICreatorsLanding.tsx): línea 118
- [EducationLanding.tsx](E:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/pages/EducationLanding.tsx): línea 136
- [business-config.ts](E:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/services/business-config.ts): línea 54

### Copy actual

- Makers: `$4/mo`
- AI creators: `$4/mes`
- Education: `$4/mes`
- Configuración de negocio: `price: 12`

### Riesgo

El usuario entra por anuncio, ve `USD 4`, hace clic en `Ver planes`, y encuentra `USD 12`.

### Reemplazo recomendado si `/plans` sigue siendo la verdad

- Makers: cambiar `$4/mo` por `$12/mo`
- AI creators: cambiar `$4/mes` por `$12/mes`
- Education: cambiar `$4/mes` por `$12/mes`

### Reemplazo recomendado si todavía no quieres fijar precio en las landings

- Sustituir el bloque de precio por una etiqueta neutral:
  - `Planes flexibles`
  - `Ver opciones`
  - `Desde Free`

## P0: Beneficios cuantitativos inconsistentes en las landings

### Dónde aparece

- [es.json](E:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/locales/es.json): líneas 104-106, 151-153, 192-194
- [en.json](E:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/locales/en.json): líneas 104-106, 151-153, 192-194
- [business-config.ts](E:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/services/business-config.ts): líneas 51, 55, 71

### Copy actual en español

- `makers.pricing.freeDesc`: `Hasta 5 generaciones/día + exports básicos`
- `makers.pricing.proDesc`: `Generaciones ilimitadas + todos los formatos`
- `education.pricing.freeDesc`: `Hasta 5 generaciones/día + exportaciones básicas`
- `education.pricing.proDesc`: `Generaciones ilimitadas + todos los formatos`
- `aiCreators.pricing.freeDesc`: `5 generaciones/día + exportaciones básicas`
- `aiCreators.pricing.proDesc`: `Generaciones ilimitadas + todos los formatos`

### Lo que hoy comunica `/plans`

- Free: `1 generación IA por mes`
- Pro: `20 generaciones IA por mes`
- Free: `STL`
- Pro: `STL, OBJ, 3MF`

### Reemplazo recomendado si `/plans` sigue siendo la verdad

- `makers.pricing.freeDesc`
  - `Acceso gratuito al editor y exportación STL`
- `makers.pricing.proDesc`
  - `Más formatos, herramientas avanzadas y mayor capacidad mensual`
- `education.pricing.freeDesc`
  - `Entrada gratuita para explorar el flujo educativo y la exportación básica`
- `education.pricing.proDesc`
  - `Más formatos y herramientas avanzadas para trabajo continuo`
- `aiCreators.pricing.freeDesc`
  - `Probá AI Studio y exportación básica con una cuenta gratuita`
- `aiCreators.pricing.proDesc`
  - `Más capacidad mensual y más formatos para iterar mejor`

### Reemplazo recomendado si quieres mantener las landings más aspiracionales

Sin tocar números:

- `Empezá gratis y desbloqueá más capacidad cuando lo necesites`
- `Más formatos y herramientas avanzadas para creadores frecuentes`

## P1: Claim de colaboración en la página de planes

### Dónde aparece

- [es.json](E:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/locales/es.json): línea 564
- [en.json](E:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/locales/en.json): línea 527
- Renderizado en [Membership.tsx](E:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/pages/Membership.tsx): línea 318

### Copy actual

- Español: `Desbloquea todo el potencial de Vorea Studio. Desde prototipado básico hasta producción profesional con IA y colaboración.`
- Inglés: `Unlock the full potential of Vorea Studio. From basic prototyping to professional production with AI and collaboration.`

### Riesgo

`colaboración` sugiere una capacidad de trabajo en equipo que no conviene vender si no está madura o visible para usuarios.

### Reemplazo recomendado

- Español:
  - `Desbloquea todo el potencial de Vorea Studio. Desde prototipado básico hasta producción profesional con IA y herramientas avanzadas.`
- Inglés:
  - `Unlock the full potential of Vorea Studio. From basic prototyping to professional production with AI and advanced tools.`

## P1: Títulos dinámicos genéricos en las landings `/for/*`

### Evidencia

La versión pública responde con títulos específicos por HTML inicial, pero una vez renderizado en cliente, Playwright observó el título genérico:

- `Vorea Studio | 3D paramétrico, comunidad y AI Studio`

en:

- `/for/makers`
- `/for/ai-creators`
- `/for/education`

### Causa probable

- [route-head.ts](E:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/route-head.ts) no contempla rutas `/for/*`

### Riesgo

- previews menos específicas
- peor consistencia SEO
- menor match mensaje-anuncio-landing

### Títulos recomendados

- `/for/makers`
  - `Diseño paramétrico 3D para makers | Vorea Studio`
- `/for/ai-creators`
  - `Generación de modelos 3D con IA | Vorea Studio`
- `/for/education`
  - `Diseño 3D paramétrico para educación | Vorea Studio`

### Descripciones recomendadas

- `/for/makers`
  - `Creá, personalizá y exportá modelos 3D listos para imprimir desde el navegador.`
- `/for/ai-creators`
  - `Describe lo que necesitás y convertí tu idea en un modelo 3D editable con AI Studio.`
- `/for/education`
  - `Enseñá geometría, diseño y pensamiento computacional con modelado 3D paramétrico en navegador.`

## Orden de corrección sugerido

1. Unificar precio y beneficios entre landings y `/plans`
2. Quitar `colaboración` del hero de membresías
3. Agregar metadatos específicos para `/for/makers`, `/for/ai-creators` y `/for/education`
4. Recién entonces lanzar campañas con precio o beneficios cuantitativos

## Mensajes seguros para usar mientras tanto

- `Diseño 3D paramétrico desde el navegador`
- `Empieza gratis`
- `De prompt a modelo 3D`
- `Exporta cuando tu diseño esté listo`
- `Sin instalar software`
