Diseña un sistema completo de UI/UX para "Codex Parametric 3D", una web app de diseño paramétrico 3D profesional de la marca Vorea Studio. La aplicación permite diseñar modelos 3D paramétricos con código SCAD, aplicar deformaciones orgánicas (Voronoi, relieve de imagen, SVG wrap), generar meshes con IA, producir G-code non-planar para impresión 3D, y publicar diseños en una comunidad tipo MakerWorld.

IDENTIDAD VISUAL
Marca: Vorea Studio · Parametric 3D
Logo: Wordmark horizontal "VOREA STUDIO3D" + badge "CODEX BETA"
Tema principal: Dark mode premium (#0d1117 fondo base)
Color accent: Verde lima (#C6E36C) para CTAs, highlights, sliders activos
Colores de tier: Free=gris muted, Pro=#60a5fa (azul), Studio=#C6E36C (accent verde)
Tipografía: Inter o Outfit para UI, JetBrains Mono para código/variables
Bordes: border-radius 10-14px, bordes sutiles con rgba(168,187,238,0.12)
Glassmorphism: backdrop-filter blur(16px) en cards y modales
Gradientes: lineal de #0d1117 → #1a1f36 para fondos, radial para hero sections
Scrollbar personalizada: 6px de ancho, thumb #3a4555, hover accent
Micro-animaciones: hover glow, card lift, shimmer loading, transitions suaves 0.25s
VISTAS PRINCIPALES (4 páginas)
1. LANDING PAGE (#landing)
Hero section con título en gradiente ("El Garage Paramétrico del Futuro")
Eyebrow text: "Vorea Studio · Parametric 3D"
Subtítulo descriptivo de la plataforma
2 CTAs principales: "Entrar al Editor" (primario, verde accent) y "Explorar Comunidad" (secundario, outline)
Grid de 4 feature cards con glassmorphism:
🔧 Diseño Paramétrico — Parámetros SCAD con Customizer
🌀 Deformación Orgánica — Voronoi, relieve, SVG wrap
✨ Inteligencia Artificial — Text-to-3D con OpenAI
🖨️ MakerWorld Ready — Lint, gates y exportación directa
Background: gradiente radial animado sutil
2. EDITOR PRINCIPAL (#editor)
Layout de 3 columnas con header sticky y paneles colapsables:

Header global (h: 48px):

Logo wordmark a la izquierda
Navegación: Inicio | Studio | Comunidad
Derecha: botón Google Login, selector de idioma (ES-LA / EN-US), avatar del usuario
Panel Izquierdo (aside, 260px, colapsable):

Selector de modo de trabajo (chip con ícono + nombre del journey actual)
Formulario de Parámetros: campos con label + slider + valor numérico, select dropdowns, checkboxes. Cada parámetro tiene un botón "i" que abre un modal de info
Preset chips: chips horizontales scrolleables para configuraciones rápidas (ej: "Voronoi Suave", "Relieve HD")
Hint de optimización: un banner discreto sugiriendo valores preview
Área Central (flex-grow):

Barra de título: "RENDER Y VISTA PREVIA"
Visor 3D interactivo: Three.js con controles orbit, fondo gris oscuro, grid, modelo renderizado en wireframe o solid
Toolbar del visor: chips de backend (WASM/Server), tiempo de render, botón de re-render (pulsa verde cuando hay cambios pendientes)
Estado vacío: ícono geométrico animado + "SIN MODELO RENDERIZADO"
Visor de G-code (alternativo): visualización del toolpath con progress slider
Panel Derecho (aside, 300px, colapsable):

Herramientas Contextuales (cambia según el step del journey):
Exportar STL / SCAD / Preset JSON
Gate de publicación: selector GA/BETA, botones "Cargar flags" / "Validar publicación"
AI Wizard: prompt textual para text-to-3D, selector de tipo (generar mesh / deformar)
Deformaciones: sliders de strength/density/seed, selector de proyección (cilindro/esfera)
G-code: parámetros de impresión non-planar
Stack de resultados: texto monospace mostrando resultados de lint, validación, etc.
3. EXPLORAR COMUNIDAD (#explore)
Título: "Comunidad MakerWorld" + subtítulo
Search bar: input con placeholder "Buscar modelos o autores..."
Grid responsiva de model cards (3 columnas desktop, 1 mobile):
Cover image con overlay gradient en bottom
Badge "Beta" para EXPERIMENTAL_MESH
Título, autor, stats (❤️ likes, ⬇️ downloads)
Hover: glow accent + lift + zoom imagen
Skeleton loading: 6 cards con shimmer animation durante la carga
Empty state: ícono 🔍 + "No se encontraron modelos"
4. MI PERFIL (#profile)
Header de perfil: avatar con ring gradiente (accent → azul), nombre, stats row
Stats row: 3 columnas — Modelos | Likes | Descargas (número + label)
Grid de modelos propios: mismas cards que explore pero con opciones de edición
Empty state: 📦 + "No has publicado ningún modelo todavía"
MODALES Y OVERLAYS (5 tipos)
Modal de Perfil de Usuario (tabs)
3 tabs: Perfil | Suscripción | Vault BYOK

Tab Perfil: avatar, nombre, email, tier badge, botón logout
Tab Suscripción:
Toggle pill: MENSUAL | ANUAL (−30%)
3 cards de planes lado a lado:
Free: $0, lista de features básicas, botón "Plan Actual" (disabled)
Pro: $15/mes o $126/año, badge "7 DÍAS GRATIS", features premium, botón PayPal
Studio: $29/mes o $244/año, badge "7 DÍAS GRATIS", features completas, botón PayPal
Los precios anuales muestran precio tachado + precio con descuento
Tab Vault BYOK: formulario para ingresar API keys de OpenAI/servicios IA propios, encriptados AES-256-GCM. Selector de modo (Usar key Vorea / Traer tu propia key)
Alert de dev mode si no hay membresía
Modal de Info de Parámetro
Header: eyebrow "PARÁMETRO", nombre del parámetro en accent, variable name en monospace dim
Body: descripción textual, rango (Mín/Paso/Máx)
Footer: botón "Entendido" en accent
Modal de Reporte de Lint
Lista de errores/warnings con ícono y contador
Estilo terminal/monospace
Modal de Journey Map
Grid de objetivos disponibles: MakerWorld, Deformación, IA, G-code
Steps secuenciales con estado: ⬜ pendiente, 🟡 activo, ✅ completado
Modal de Selección de Modo
Cards grandes para cada objetivo de trabajo con ícono y descripción
SISTEMA DE JOURNEY (modos de trabajo)
El editor adapta sus paneles según el journey seleccionado:

Journey	Steps
MakerWorld	Configurar params → Render → Lint → Exportar SCAD → Publicar
Deformación	Subir mesh → Elegir preset → Aplicar deformación → Exportar STL
IA Generativa	Escribir prompt → Generar mesh → Deformar (opcional) → Exportar
G-code	Render modelo → Configurar non-planar → Generar G-code → Previsualizar
El panel derecho cambia sus herramientas contextuales según el step activo.

COMPONENTES DE UI REUTILIZABLES
Componente	Descripción
Button primary	Fondo accent (#C6E36C), texto oscuro, hover opacity 0.88, border-radius 10px
Button secondary	Border accent, fondo transparente, hover fill sutil
Slider	Track oscuro, thumb accent, valor numérico a la derecha
Select dropdown	Background oscuro, border sutil, opciones con hover highlight
Checkbox	Custom styled, accent color cuando activo
Input text	Background #1a1f36, border 1px rgba, focus border accent
Chip/Badge	Pill shape, variantes: BETA (naranja), tier (coloreado), deform preset
Card	Glassmorphism, borde rgba, hover glow accent, transition 0.25s
Toast	Fixed bottom-center, background verde translúcido, auto-dismiss 3.5s
Skeleton loader	Shimmer gradient animation left-to-right, border-radius matching
Accordion panel	Colapsable con ícono ▸/▾, smooth height transition
Scrollbar	6px width, thumb #3a4555, hover thumb accent, track transparente
RESPONSIVE BREAKPOINTS
Viewport	Comportamiento
Desktop (>1200px)	3 columnas, paneles expandidos, grid 3 cols
Tablet (768-1200px)	Paneles colapsados por defecto, grid 2 cols
Mobile (<768px)	Layout stacked, panels como drawer, grid 1 col
ESTADOS Y FEEDBACK
Loading: skeleton shimmer en cards/datos, spinner en render
Empty: ícono + texto explicativo + CTA contextual
Error: toast rojo translúcido, mensaje descriptivo
Success: toast verde, auto-dismiss
Hover: glow border accent, card lift 4px
Active/Selected: borde accent sólido, background más claro
Disabled: opacity 0.4, cursor not-allowed
FLUJO DE MONETIZACIÓN
Free User → Click "Upgrade" en cualquier feature gate
  → Modal de Suscripción → Toggle mensual/anual
  → Click plan Pro o Studio → Redirect a PayPal checkout
  → Webhook confirma → Tier actualizado → Features desbloqueadas
Features gated:

Pro: G-code non-planar, deformaciones, export STL
Studio: Todo Pro + IA mesh generation, publicación comunidad, soporte prioritario
i18n
La app soporta dos idiomas con selector en el header:

Español (Latinoamérica) — idioma por defecto
English (US)
Todos los textos de la UI, tooltips, y placeholders están internacionalizados.

NOTAS PARA EL DISEÑADOR
La estética debe sentirse premium y profesional, como herramientas de ingeniería (Fusion 360, Onshape) pero con la frescura visual de productos como Linear o Vercel
El dark mode es obligatorio — no hay light mode
El visor 3D central es el foco principal de la experiencia — debe dominar el viewport
Los paneles laterales son herramientas de soporte, no deben competir visualmente con el visor
La marca Vorea Studio debe estar presente pero no invasiva
Los modales deben tener animación de entrada (scale + opacity) y backdrop blur
El accent verde lima (#C6E36C) es el color diferenciador de la marca