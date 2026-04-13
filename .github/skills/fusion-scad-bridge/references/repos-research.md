# Repos de Referencia — Fusion 360 → OpenSCAD

Investigación de repos relevantes para el bridge F360→SCAD (2026-04-10).

## 1. zalo/Fusion360GalleryDataset-build123d

**Qué hace:** Dataset de 7,683 modelos CAD paramétricos de F360, reconstruidos como scripts `build123d` (Python).

**Técnica:** Convierte secuencias JSON de reconstrucción F360 → Python con operaciones de sketch + extrude.

**Reusable para Vorea:**
- Patrones de conversión sketch → polígono → extrusión
- Manejo de NURBS via discretización de arcos
- Referencia de operaciones booleanas (difference, union)

**Limitación:** Los constraints paramétricos se pierden — solo se exportan valores finales hardcodeados.

## 2. kellerlabs/homeracker

**Qué hace:** Sistema modular de racks 3D-printable con 15+ módulos customizables en OpenSCAD.

**Técnica:** SCAD paramétrico con BOSL2, Customizer UI, CI/CD de export, dependency manager (`scadm`).

**Reusable para Vorea:**
- Convenciones de Customizer (`/* [Section] */` blocks) para parámetros de usuario
- Pipeline multi-target: STL, PNG, SCAD flattened, MakerWorld
- Tool `scadm` para gestión de dependencias SCAD
- Estándares dimensionales: 15mm base unit, 0.2mm tolerancia, 2mm pared

## 3. SharpCoder/openfusion.scad

**Qué hace:** Librería OpenSCAD mínima (~60 líneas) que replica patrones de Fusion 360.

**Técnica:** Módulos para circular_mirror, hexagon (radio inscrito como F360), quadruple_mirror, splat (array lineal).

**Reusable para Vorea:**
- Convención de hexágono F360 (radio al midpoint del lado, no al vértice)
- Utilities de mirroring que mapean 1:1 a operaciones F360

## 4. openUC2/UC2-Module-Template

**Qué hace:** Templates para módulos ópticos en múltiples CAD (Inventor, OpenSCAD, Fusion 360).

**Técnica:** Mismo diseño en 3 formatos, parámetros de Customizer con rangos, tolerancias para impresión vs inyección.

**Reusable para Vorea:**
- Gestión de tolerancias paramétrica (offset para FDM vs IM)
- Text extrusion para labeling
- Geometría de conectores puzzle parametrizados
- Paradigma multi-CAD template

## 5. mmone/printable-things

**Qué hace:** Colección de componentes 3D-printable con OpenSCAD paramétrico avanzado.

**Técnica:** Perfiles 2D procedurales, cálculos trigonométricos, constraint solving matemático.

**Reusable para Vorea:**
- Generación de geometría 2D procedural antes de extrusión
- Parámetros derivados (calcular geometría desde dimensiones de diseño)
- Consideraciones de fabricación (layer height, extrusion width aware)

## Síntesis: Qué es porteable vs qué no

| Porteable | No porteable (aún) |
|-----------|-------------------|
| User Parameters (valores) | Constraints (coincident, perpendicular) |
| Unidades y conversión | B-Rep / geometría sólida |
| Comentarios y metadata | Assemblies multi-body |
| Operaciones básicas (extrude, revolve) | Sketch profiles complejos |
| Patrones (mirror, array) | NURBS exactas |
| Tolerancias | Timeline/history |
