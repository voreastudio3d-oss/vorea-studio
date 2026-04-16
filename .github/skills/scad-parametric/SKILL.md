---
name: scad-parametric
description: "Use when: creating or editing parametric SCAD models, product families, relief/surface workflows, 3D engine code, FDM export, slicer integration, Three.js preview, or any file in src/app/parametric/, src/app/engine/, public/scad-library/. Covers both surface/geometry work and product family design."
---

# SCAD Parametric Pipeline

Consolidated skill for Vorea's parametric 3D pipeline: from prompt to SCAD to fabrication output.

## When to Use

- Creating or extending parametric SCAD models (vases, organizers, lamp shades, etc.)
- Surface deformation, relief, heightmap, or `surface()` workflows
- Three.js/WebGL preview and rendering code
- Export pipeline: STL, 3MF, GCODE
- Product family design for the Studio catalog
- Working with BOSL2 library patterns

## Pipeline Architecture

```
Prompt → InstructionSpecV1 → SCAD → CSG → Three.js preview → Export (STL/3MF/GCODE)
```

### Key Files

| Area | Files |
|------|-------|
| Pipeline core | `src/app/parametric/pipeline.ts`, `instruction-spec.ts`, `spec-builder.ts`, `validation.ts` |
| SCAD generators | `src/app/parametric/generators/fdm-utility.ts`, `organic-decorative.ts` |
| Engine (CSG/render) | `src/app/engine/scad-interpreter.ts`, `csg.ts`, `threejs-renderer.ts`, `mesh-renderer.ts` |
| Relief/surface | `src/app/engine/heightmap-generator.ts`, `relief-worker.ts`, `image-registry.ts`, `surface-modes/*` |
| Export | `src/app/engine/threemf-exporter.ts`, `slicer.ts`, `fullcontrol.ts` |
| SCAD library | `public/scad-library/models/*` |
| Pages | `src/app/pages/Editor.tsx`, `Relief.tsx`, `Organic.tsx`, `AIStudio.tsx` |

### Verified Capabilities

- **Input formats**: PNG, JPG, JPEG, WEBP (raster for relief)
- **Output formats**: SCAD (source), STL, 3MF, GCODE
- **SCAD features**: `surface()` with browser-side image registry, CSG operations
- **Product families**: `fdm` (storage-box, phone-stand, utility-hook) and `organic` (vase-wave, lamp-shell, decorative-tower)
- **Built-in templates**: gridfinity, cable, box, phone

## Routing Guide

Match user intent to the right subsystem:

| Intent | Target |
|--------|--------|
| "parametric vase/lamp/organizer" | `src/app/parametric/generators/*` |
| "wood grain/texture/heightmap/relief" | `src/app/engine/heightmap-generator.ts`, `relief-worker.ts`, `Relief.tsx` |
| "voronoi/lattice/perforated" | New parametric generator or engine extension |
| "STL/3MF/GCODE export" | `threemf-exporter.ts`, `slicer.ts` |
| "preview/render" | `threejs-renderer.ts`, `mesh-renderer.ts` |
| "new product family for Studio" | `src/app/parametric/generators/*` + `public/scad-library/models/*` |

## Product Family Design Criteria

New families should meet at least 3 of:

1. **Useful immediately** — organizer, stand, holder, planter, jar, lamp
2. **Visibly parametric** — size, slots, angles, text, patterns
3. **FDM-friendly** — few pieces, minimal supports, reasonable tolerances
4. **Preview-ready** — clear Three.js representation

## Conventions

- Validate changes: `pnpm test && pnpm typecheck`
- SCAD library models go in `public/scad-library/models/<model-name>/`
- Parametric generators export a function returning SCAD string
- Use existing `InstructionSpecV1` interface for pipeline integration

## Related Resources

- [Existing surface skill](./../../../.agents/codex-skills/vorea-parametric-scad-surface/SKILL.md) — detailed surface/relief reference
- [Existing products skill](./../../../.agents/codex-skills/vorea-parametric-scad-products/SKILL.md) — product family roadmap and wave planning
- [Fusion-SCAD bridge](../fusion-scad-bridge/SKILL.md) — Fusion 360 to OpenSCAD conversion
