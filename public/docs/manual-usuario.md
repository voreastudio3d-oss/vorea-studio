# Manual de Ayuda para Usuarios — Vorea Studio

## 1. Primeros pasos

1. Crear cuenta o iniciar sesión.
2. Completar perfil básico.
3. Elegir flujo de creación (Editor, Parametric, AI, Organic, Comunidad).
4. Algunas herramientas pueden explorarse en modo trial, pero las acciones que guardan, publican o consumen recursos quedan asociadas a tu cuenta.

## 2. Crear y publicar un modelo

1. Diseñar o importar modelo.
2. Guardar cambios y validar preview.
3. Cargar imagen principal y galería.
4. Publicar en Comunidad y agregar tags.

### 2.1 AI Studio paramétrico

1. Elegir motor `FDM` u `Organic` y la familia base.
2. Ajustar sliders paramétricos y regenerar hasta conseguir una variante útil.
3. Guardar `recipes` reutilizables y revisar el historial de generaciones para recuperar SCAD previos.
4. Usar `Reaplicar` sobre una entrada del historial para restaurarla como base editable sin lanzar una generación nueva.
5. La generación real en `AI Studio` requiere sesión iniciada.
6. Con sesión iniciada, `recipes` e historial AI se sincronizan con la cuenta; en modo guest solo se conserva el estado local permitido por el navegador.

### 2.2 Relief multicolor y exportación 3MF

1. Para un relieve plano rápido, usar el preset `Plano balanceado`.
2. Para cilindros pensados para Orca/Bambu, usar `Cilindro Bambu/Orca`.
3. Si se exporta en multi-color:
   - `Híbrido` prioriza compatibilidad 3MF general.
   - `Bambu/Orca estricto` prioriza segmentación tipo slic3rpe.
   - `Partes por color` funciona como fallback separando el modelo en objetos por capa.
4. Antes de descargar el 3MF, revisar qué capas están activas en la paleta exportable.
5. Si el slicer no respeta bien la segmentación, reexportar en `Partes por color`.

## 3. Interacción en Comunidad

1. Explorar modelos por tipo/tags.
2. Ver detalle del modelo.
3. Dar like, comentar y descargar (cuando aplique).

## 4. Créditos y pagos

1. Las compras y suscripciones se procesan con **PayPal**.
2. Comprar packs de créditos desde Membership/Profile.
3. Gestionar suscripción activa desde el perfil.
4. Tras volver de PayPal, la app limpia la URL automáticamente y te devuelve al perfil con el resultado del flujo.

## 4.1 Perfil y privacidad

1. `/perfil` es una zona privada: si no tienes sesión iniciada, Vorea te pedirá acceso antes de mostrar datos personales.
2. `/gcode-collection` también es privada y está pensada para archivos listos para imprimir vinculados a tu cuenta.
3. Al cerrar sesión, Vorea limpia el estado local sensible del navegador para reducir exposición accidental en equipos compartidos.

## 4.2 Navegación y enlaces

1. Las páginas principales ya usan URLs limpias y compartibles, por ejemplo:
   - `/ai-studio`
   - `/perfil`
   - `/modelo/:id/:slug`
   - `/user/:id/:slug/modelos`
2. Si abres un enlace viejo con `/#/...`, Vorea lo corrige automáticamente a la ruta nueva.

## 5. Problemas comunes

1. No puedo comentar/likear:
   - Confirmar sesión iniciada.
   - Verificar que el modelo esté publicado.
2. Falló un pago:
   - Revisar ventana de PayPal y reintentar.
   - Contactar soporte con fecha y correo de cuenta.
3. No veo mi modelo:
   - Revisar si quedó en borrador.
   - Confirmar que no haya sido moderado.

## 6. Contacto y soporte

1. El formulario de `/contacto` ya envía consultas reales al equipo.
2. Después de enviar el mensaje, verás una referencia para seguimiento.
3. Incluye: usuario/email, URL del modelo o página y pasos para reproducir el problema.

## 6.1 Colaboradores

1. La página `/colaboradores` ya existe como espacio público para reconocer apoyo voluntario al proyecto.
2. El programa ya permite aportes únicos con PayPal, insignias por nivel acumulado y visibilidad pública opcional.
3. Los montos exactos no se muestran en el muro público; solo nivel, mensaje y presencia pública si el usuario lo consiente.
4. Los flujos cancelados en PayPal no se cobran.
5. Si un usuario detecta un cargo duplicado o incorrecto, debe contactar al equipo con su `orderId` para revisión caso a caso.

## 7. Glosario rápido

- Borrador: modelo privado aún no público.
- Publicado: modelo visible para la comunidad.
- Créditos: saldo para acciones premium.
- Featured: contenido destacado por moderación.
