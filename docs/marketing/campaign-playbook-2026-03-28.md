# Playbook de Campañas 2026-03-28

## Objetivo

Diseñar una base de campañas de marketing y publicidad para Vorea Studio que aproveche las landings ya existentes y que sea segura respecto a pricing, créditos y features hoy visibles en producto.

## Supuestos tomados desde el repo

- Vorea Studio ya tiene landings específicas para `makers`, `ai-creators` y `education`:
  - `/for/makers`
  - `/for/ai-creators`
  - `/for/education`
- El producto se posiciona como una plataforma de creación 3D desde navegador con flujo paramétrico, IA, relieve, orgánico, exportación y comunidad.
- En la configuración actual de negocio, `Pro` figura con `USD 12/mes` y existe `Studio Pro`.
- La app ya emite eventos GA4 útiles para marketing:
  - `landing_view`
  - `landing_cta_click`
  - `sign_up_start`
  - `pricing_plan_click`
  - `open_tool`

## Posicionamiento recomendado

La promesa central no debería ser "software 3D genérico", sino:

> Crea modelos 3D listos para iterar, exportar y compartir desde el navegador, sin depender de un CAD pesado.

Sub-posicionamientos por vertical:

- Makers: "Diseña piezas imprimibles más rápido."
- AI creators: "Pasa de prompt a modelo editable."
- Educación: "Lleva diseño 3D paramétrico al aula sin instalación."

## Arquitectura de campañas

| Campaña | Público | Promesa | Landing | CTA principal |
|---|---|---|---|---|
| Makers Performance | makers, hobbyistas, impresión 3D, Etsy/modders | Diseña piezas imprimibles sin CAD pesado | `/for/makers` | `Probar gratis` |
| AI Creators | creadores visuales, makers curiosos, audiencia IA | Convierte ideas en modelos 3D editables | `/for/ai-creators` | `Abrir AI Studio` |
| Education Lead Gen | docentes STEM, academias, talleres maker | Enseña 3D paramétrico desde el navegador | `/for/education` | `Ver planes` o `Solicitar demo` |
| Retargeting Conversion | visitas a `/plans`, `/ai-studio`, `/for/*` sin alta | Vuelve y termina tu primer modelo | `/plans` o landing visitada | `Empezar ahora` |

## Campaña 1: Makers Performance

### Mensaje

Vorea Studio ayuda a makers y usuarios de impresión 3D a crear piezas paramétricas, relieves y variaciones sin instalar herramientas pesadas.

### Oferta

- Entrada con plan `Free`
- Upgrade a `Pro` para desbloquear flujo más frecuente, más formatos y uso más intenso

### Canales

- Meta e Instagram para descubrimiento visual
- Reels y shorts para demostración "antes/después"
- Google Search para intención alta

### Hooks publicitarios

- "Pasa de idea a pieza imprimible sin abrir un CAD pesado."
- "Diseña, ajusta y exporta en minutos desde el navegador."
- "Tu próximo modelo 3D no tiene que empezar en cero."

### Copy corto

**Título**
Diseña piezas 3D más rápido

**Texto**
Modelado paramétrico, relieve, orgánico e IA en una sola app web. Empieza gratis y exporta cuando tu diseño esté listo.

### Copy medio

**Título**
De idea a STL sin fricción

**Texto**
Vorea Studio reúne herramientas paramétricas, relieve, orgánico y generación asistida por IA para makers que quieren iterar rápido. Sin instalación, con flujo directo a exportación y comunidad.

### Guion de video corto

1. Problema: "Abrir un CAD pesado para una pieza simple te frena."
2. Demo: abrir Vorea, ajustar parámetros, ver el resultado.
3. Prueba social: mostrar exportación o vista lista para imprimir.
4. CTA: "Pruébalo gratis en Vorea Studio."

### Piezas Canva recomendadas

- 1 pieza cuadrada de adquisición
- 1 pieza vertical para story/reel cover
- 1 carrusel de 4 slides:
  - Slide 1: idea
  - Slide 2: ajuste de parámetros
  - Slide 3: resultado/exportación
  - Slide 4: CTA

## Campaña 2: AI Creators

### Mensaje

El producto no se vende como "IA mágica", sino como un flujo útil: idea, generación, ajuste, exportación.

### Oferta

- Empieza en `Free`
- Llevar a `Pro` a quienes ya entienden el valor del flujo prompt -> edición -> exportación

### Canales

- Instagram y Meta para creatividad visual
- Shorts/Reels para demostrar velocidad
- Comunidades de makers/IA para contenido orgánico y patrocinado

### Hooks publicitarios

- "Describe tu objeto y conviértelo en un modelo 3D editable."
- "De prompt a modelo 3D en un flujo real, no solo una imagen bonita."
- "Genera, corrige y exporta sin salir del navegador."

### Copy corto

**Título**
De prompt a modelo 3D

**Texto**
Usa IA para iniciar tu diseño y sigue editándolo dentro de Vorea Studio. Menos bloqueo creativo, más iteración real.

### Copy medio

**Título**
La IA sirve más cuando puedes editar el resultado

**Texto**
Vorea Studio convierte el momento "tengo una idea" en un flujo útil: prompt, generación, ajustes, exportación y publicación. Ideal para prototipos, decoración, gaming y objetos imprimibles.

### Piezas Canva recomendadas

- 1 reel cover con texto grande: `Prompt -> 3D -> Export`
- 1 pieza square con mockup de interfaz
- 1 story vertical con CTA directo a `/for/ai-creators`

## Campaña 3: Education Lead Gen

### Mensaje

La propuesta educativa debe vender facilidad de adopción, no complejidad técnica.

### Oferta

- Contenido educativo gratuito
- Demo con caso de uso de aula
- Plan `Pro` como siguiente escalón

### Canales

- LinkedIn Ads para docentes, coordinadores y centros
- Email outbound a instituciones
- Documento descargable o presentación breve como lead magnet

### Hooks publicitarios

- "Lleva diseño 3D paramétrico al aula sin instalar software."
- "Más práctica STEM, menos fricción técnica."
- "Una forma más accesible de enseñar diseño, geometría y prototipado."

### Copy corto

**Título**
3D paramétrico para educación

**Texto**
Vorea Studio permite enseñar modelado 3D, IA aplicada y exportación desde el navegador. Menos setup, más tiempo de aprendizaje.

### Copy medio

**Título**
Una puerta de entrada moderna al diseño 3D en el aula

**Texto**
Usa Vorea Studio para introducir pensamiento paramétrico, creación asistida por IA y prototipado sin exigir instalación local. Perfecto para talleres maker, STEM y laboratorios digitales.

### Lead magnet sugerido

- PDF breve: `Guía de 3 clases para introducir diseño 3D paramétrico`
- Deck corto en Canva para outreach institucional

## Campaña 4: Retargeting Conversion

### Audiencias

- Visitó `/plans` pero no inició alta
- Visitó `/for/makers`, `/for/ai-creators` o `/for/education` y no volvió
- Abrió una herramienta (`open_tool`) pero no avanzó a pricing o sign up

### Mensaje

Retargeting debe enfocarse en continuidad, no en explicar todo el producto otra vez.

### Hooks

- "Tu próximo modelo 3D ya estaba a un clic."
- "Vuelve a terminar tu primer diseño."
- "Empieza gratis y desbloquea más cuando lo necesites."

### Copy

**Título**
Retoma tu diseño

**Texto**
Vorea Studio ya tiene listo tu camino: crear, ajustar, exportar. Vuelve, termina tu primer modelo y decide después si quieres subir de plan.

## Dirección creativa para Canva

### Sistema visual base

- Fondo principal: `#0d1117`
- Acento principal: `#C6E36C`
- Acentos secundarios por vertical:
  - Makers: `#22d3ee`
  - AI creators: `#a78bfa` y `#f59e0b`
  - Education: `#6C63FF` y `#00C9A7`

### Estilo

- Interfaces reales del producto como prueba visual
- Mockups con foco en transformación: idea -> ajuste -> resultado
- Tipografía fuerte y pocas palabras por pieza
- No saturar con demasiadas features en un solo creativo

### Formatos base

- Cuadrado 1:1 para feed y reutilización general
- Horizontal 1.91:1 para campañas profesionales y banners
- Vertical 9:16 para stories y reels

Nota: `1200x1200` y `1200x628` están alineados con las recomendaciones oficiales actuales de LinkedIn para single image ads. `1080x1920` es una implementación práctica estándar del formato vertical `9:16` para stories/reels.

## Producción mínima en Canva

Crear primero 1 master por vertical y luego adaptar:

1. Maker master
2. AI creator master
3. Education master

De cada master, derivar:

- 1 post square
- 1 story vertical
- 1 portada de reel
- 1 variante con CTA a pricing

## Prompts de brief para Canva

### Brief 1: Makers

"Diseño publicitario para Vorea Studio dirigido a makers e impresión 3D. Estética oscura, técnica y premium. Fondo negro azulado, acento verde lima y cian. Mostrar interfaz o mockup de una herramienta 3D y un mensaje corto: 'Diseña piezas 3D más rápido'. CTA: 'Probar gratis'."

### Brief 2: AI Creators

"Diseño publicitario para Vorea Studio dirigido a creadores con IA. Estética futurista pero limpia. Fondo oscuro, degradados violeta y ámbar. Mensaje central: 'De prompt a modelo 3D'. Mostrar secuencia visual prompt -> objeto -> exportación. CTA: 'Abrir AI Studio'."

### Brief 3: Education

"Diseño publicitario para Vorea Studio para docentes y educación STEM. Estética clara, confiable y tecnológica. Fondo oscuro con acentos violeta y turquesa. Mensaje central: '3D paramétrico para educación'. Enfatizar navegador, facilidad de uso y aprendizaje práctico. CTA: 'Ver planes'."

## Medición recomendada

### Objetivos por etapa

- Awareness:
  - CTR
  - video hold rate
  - landing views
- Consideración:
  - `landing_cta_click`
  - `sign_up_start`
  - `open_tool`
- Conversión:
  - `pricing_plan_click`
  - alta completada
  - upgrade a `Pro`

### Convención UTM sugerida

`utm_source={platform}&utm_medium=paid-social&utm_campaign={vertical}_{objective}_{country}&utm_content={creative-name}`

Ejemplos:

- `utm_campaign=makers_acq_latam`
- `utm_campaign=ai_creators_retargeting`
- `utm_campaign=education_leads`

## Guardrails de claims

Basado en la auditoría de marketing del repo:

- Sí decir:
  - "Empieza gratis"
  - "Modelado 3D desde navegador"
  - "Flujo paramétrico, IA, relieve y orgánico"
  - "Exportación disponible según plan"
- Evitar decir:
  - "Exportaciones ilimitadas" sin aclarar el contexto exacto
  - "10 exportaciones" cuando en realidad el sistema trabaja por créditos
  - "API access", "colaboración en equipo" o "analytics avanzados" como promesa general si no están implementados
  - "Todo ilimitado" para `Pro`

## Siguiente ejecución recomendada

1. Lanzar primero Makers + Retargeting
2. Ejecutar AI Creators como segunda ola
3. Tratar Education como campaña separada con creatividad y landing más consultiva
4. Producir primero 3 masters en Canva y luego redimensionar por canal

## Fuentes operativas

- Repo local:
  - `src/app/pages/MakerLanding.tsx`
  - `src/app/pages/AICreatorsLanding.tsx`
  - `src/app/pages/EducationLanding.tsx`
  - `src/app/pages/Membership.tsx`
  - `src/app/services/business-config.ts`
  - `marketing_audit.md`
  - `src/app/services/analytics.ts`
- Referencias externas validadas el 2026-03-28:
  - LinkedIn Single Image Ads: https://business.linkedin.com/advertise/ads/sponsored-content/single-image-ads-specs
  - LinkedIn Help, single image ads: https://www.linkedin.com/help/lms/answer/a420758
  - Nota operativa: para placements verticales de Meta/Instagram, revalidar en Ads Manager antes de lanzar porque parte de la ayuda pública redirige a login.
