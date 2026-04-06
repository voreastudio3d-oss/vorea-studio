# 🛑 WORKFLOW OBLIGATORIO: Validación de Cambios

---
description: Pipeline de validación antes de consolidar código en las ramas principales.
---

## Cuándo usar este workflow
Toda vez que un Agente IA (o un humano) haya terminado de escribir código en una feature branch y se disponga a dar la tarea por completada o preparar un Pull Request / pre-commit.

## 📝 1. Checklist de Calidad
1. **Compilación y Build:**
   > ¿Se ha ejecutado el motor de validación local (ej. Vite, Next build, o TSC) para asegurar que no hay errores de sintaxis o tipo?
2. **Linting y Formateo:**
   > Verifica que no haya dead code o dependencias sin usar. Usa `npm run lint` o equivalente.
3. **Control de Rutas/APIs:**
   > Si has creado endpoints, ¿están protegidos por Middleware de Auth?
   > Si has creado vistas, ¿resuelven correctamente en el enrutamiento?
4. **Verificación de Seguridad (No Secrets):**
   > ¡Asegúrate de NO comitear claves API o secretos! Todo debe manejarse mediante variables de entorno `.env`.

// turbo
## 🛠️ 2. Pruebas Automáticas
- Ejecuta los tests del proyecto. El código NO puede empujarse al repositorio remoto si el set de pruebas está roto por cambios que has introducido.

## 🤝 3. Documentación y Handoff
1. ¿Modificaste la base de datos? Asegúrate de haber generado las migraciones y no solo haber hecho "push" al esquema.
2. Actualiza el archivo `handoff/ai_handoff_[fecha].md` correspondiente de tu sesión documentando tus cambios arquitectónicos si aplica.
