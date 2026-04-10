# Family Mapping — F360 Parameters → Vorea Templates

## Mapeo por tipo de parámetro

Cuando un archivo `.scad` de F360 llega a Vorea, estos patrones de nombres de parámetros indican una familia:

### Storage / Organizers
| Parámetro F360 | Familia Vorea | Template |
|---------------|--------------|---------|
| `largo_base`, `ancho_base`, `alto_pared`, `grosor_pared` | `vorea-storage-bin` | `drawer-organizer-tray` |
| `divisiones_x`, `divisiones_y`, `largo_celda` | gridfinity | `gridfinity` template |
| `diametro_agujero`, `spacing` | pegboard | futuro |

### Stands / Docks
| Parámetro F360 | Familia Vorea | Template |
|---------------|--------------|---------|
| `ancho_telefono`, `angulo_inclinacion`, `grosor_base` | `vorea-phone-stand` | `phone-dock-pro` |
| `ancho_tablet`, `alto_soporte` | tablet-stand | futuro |

### Hooks / Clips
| Parámetro F360 | Familia Vorea | Template |
|---------------|--------------|---------|
| `diametro_tubo`, `espesor_clip`, `apertura` | `vorea-cable-clip` | `cable-dock-strip` |
| `profundidad_gancho`, `ancho_gancho`, `radio_pared` | `vorea-wall-hook` | `wall-hook-plus` |

### Containers / Vases
| Parámetro F360 | Familia Vorea | Template |
|---------------|--------------|---------|
| `diametro_base`, `diametro_top`, `altura`, `grosor` | `vorea-spiral-vase` | `vase-wave-plus` |
| `diametro_tapa`, `paso_rosca`, `profundidad` | threaded-jar | `threaded-jar` |

### Nameplates / Labels
| Parámetro F360 | Familia Vorea | Template |
|---------------|--------------|---------|
| `largo_placa`, `alto_placa`, `profundidad_texto` | `vorea-nameplate` | `nameplate-pro` |

### Planters
| Parámetro F360 | Familia Vorea | Template |
|---------------|--------------|---------|
| `diametro_maceta`, `alto_soporte`, `drenaje` | `vorea-Soporte_para_macetas` | `planter-drip-system` |

## Heurística de detección automática

```
SI params contienen "largo" + "ancho" + "alto" + "pared" → storage family
SI params contienen "angulo" + "inclinacion" + "base" → stand family
SI params contienen "diametro" + ("clip" | "tubo" | "gancho") → hook/clip family
SI params contienen "diametro" + "altura" + "grosor" + NO "pared" → vase/container family
SI params contienen "rosca" | "paso" | "tapa" → threaded container
SI params contienen "texto" | "placa" | "label" → nameplate family
SI params contienen "maceta" | "drenaje" | "planter" → planter family
DEFAULT → generic parametric (usar parámetros como variables libres)
```

## Técnica SCAD recomendada por familia

| Familia | OpenSCAD nativo | BOSL2 |
|---------|---------------|-------|
| Storage | `cube`, `difference` | `cuboid`, attachments |
| Stand | `hull`, `linear_extrude` | `skin()`, `edge_profile` |
| Hook/Clip | `hull`, `rotate_extrude` | `hooks`, `joiners` |
| Vase | `rotate_extrude` | `skin()`, `offset_sweep` |
| Threaded | `cylinder`, `difference` | `threading` |
| Nameplate | `linear_extrude`, `text` | `textures` |
| Planter | `cylinder`, `difference` | `tube`, `cuboid` |
