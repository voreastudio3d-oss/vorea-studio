# 🗄️ WORKFLOW OBLIGATORIO: Migraciones y Pipeline de DB

---
description: pipeline bloqueante para modificaciones la base de datos (Ej: Prisma, TypeORM).
---

## 🛑 El problema de los cambios silenciosos
Las acciones destructivas sobre la base de datos o el uso de comandos rápidos para "sincronizar" esquemas en desarrollo rompen el entorno productivo porque no dejan rastro que pueda automatizarse en CI/CD.

## Pipeline Aprobado 
*(Adaptar según ORM usado, este ejemplo asume Prisma)*

### 1. Desarrollo Local
Cuando modifiques el archivo de esquema o los modelos:
`prisma migrate dev --name "nombre_descriptivo"`
**(NUNCA USES `prisma db push` a menos que estés prototipando en blanco sin historial)**.

### 2. Generación de Artefactos DB
1. Verifica que en tu carpeta de migraciones se ha creado una nueva carpeta con fecha y `migration.sql`.
2. Ese archivo de migración es TRASCENDENTAL y **siempre** debe ser incluido en los git commits.

### 3. CI/CD y Producción
Los entornos de desarrollo/producción aplicarán únicamente las migraciones validadas ejecutando un equivalente a:
`prisma migrate deploy`

Si hay un fallo de *Schema Drift* (discordancia en la base de datos de producción), debes pedir intervención humana para auditar o usar `migrate resolve --applied`. No realices resoluciones forzosas que borren datos (ej: `migrate reset` está prohíbido en Prod).
