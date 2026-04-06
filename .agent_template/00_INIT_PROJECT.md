# 🚀 INICIALIZACIÓN DE PROYECTO (AI BOOTSTRAP)

> **Propietario:** Pyxis

> [!WARNING]
> **INSTRUCCIÓN ESTRICTA PARA LA IA:** Eres la primera IA en acceder a este repositorio. Tu objetivo inmediato NO es escribir código, sino configurar el entorno conversacional, de arquitectura y de gobernanza para ti y para las IAs subsecuentes.
> DEBES leer este documento por completo, presentar el formulario que sigue al Usuario y ESPERAR su respuesta antes de continuar.

¡Bienvenido al nuevo proyecto, Agente! Este es el **Día 1**.
Para garantizar que el ecosistema se mantenga mantenible, robusto y alineado con los estándares del usuario, necesitamos levantar un Cerebro Central (`🧠_Cerebro.md`) y establecer el stack tecnológico.

Por favor, saluda al usuario, indícale que estás en el proceso de inicialización del proyecto, y preséntale el siguiente cuestionario estructurado (paso a paso, o todo junto si prefieres, pero asegúrate de obtener las respuestas):

---

## 📝 Formulario de Bootstrapping del Proyecto

### 1. Funcionalidad Core
- **¿Cuál es el propósito principal o core loop de la aplicación?** (Ej: "Un SaaS B2B para clínicas dentales", "Un e-commerce de productos", etc.)
- **¿Existe algún MVP ya definido o estamos empezando 100% desde cero?**

### 2. Stack Tecnológico & Arquitectura
- **Frontend:** (Ej: React, Next.js, Vue, Svelte, plain HTML/JS)
- **Backend/API:** (Ej: Node/Express, Python/FastAPI, Serverless, SSR)
- **Base de Datos & ORM:** (Ej: PostgreSQL + Prisma, MongoDB + Mongoose, Supabase, Firebase)

### 3. Autenticación & Reglas de Negocio
- **Auth:** ¿Qué usaremos para la autenticación? (Ej: Auth0, Supabase Auth, JWT + Passport, Auth.js)
- **Roles:** ¿Tendremos diferentes tipos de usuarios (Ej: Admin, Moderador, Guest, Pro)?
- **Monetización (si aplica):** (Ej: Stripe Checkout, Subscripciones, No aplica)

### 4. Preferencias de UX/UI
- **Design System:** (Ej: TailwindCSS, Material UI, Shadcn, Custom CSS Modules)
- **Estética:** (Ej: ¿Es minimalista, "glassmorphism", vibrante, dark-mode por defecto, formal/B2B?) -> **Nota para la IA:** Toda respuesta aquí debe mapearse luego a design tokens; sin hardcodear variables hexadecimales directamente en los componentes.

### 5. Configuración de IA y Especialización
- ¿Habrá múltiples modelos interactuando en este repo? (Ej: Gemini para diseño conceptual, Claude para código lógico complejo).
- ¿Necesitas que configure alguna restricción especial de comandos bloqueados o auto-aprobar comandos de lint/format?

---

## ⏭️ Siguientes pasos (Instrucciones internas para la IA, no mostrar al usuario directamente)

Una vez que el usuario responda, tu tarea es:
1. Tomar `🧠_Cerebro_Seed.md` (presente en esta misma carpeta).
2. Renombrarlo o copiarlo a la raíz de la carpeta `.agents/` como `🧠_Cerebro_Project.md` o similar, llenando los datos del proyecto basados en las respuestas del usuario.
3. Asegurarte de que todos los workflows provistos en `workflows/` estén referenciados en ese nuevo cerebro.
4. Generar el `current_block.yaml` inicial para definir el Sprint 1 (Ej: "Setup del repositorio base y estructura de carpetas").
5. Una vez configurado esto, el proyecto se considera formalmente inicializado bajo la gobernanza estructurada.
