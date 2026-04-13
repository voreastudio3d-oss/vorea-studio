"""
Fusion360_to_VoreaSCAD.py — Exportador de User Parameters de Fusion 360 a OpenSCAD
Para uso con VoreaStudio3D (voreastudio3d.com)

Instalación:
  1. En Fusion 360: Utilities > Scripts and Add-ins (Shift+S)
  2. Create → Python → Nombre: ExportToSCAD
  3. Pegar este script, guardar
  4. Ejecutar: seleccionar destino → genera .scad + .json

Convierte cm internos de F360 a mm (estándar slicer/OpenSCAD).
Incluye factor de escala para ajustar a cama de impresión.
Genera archivo .json sidecar con metadata tipada para ingesta automática.
"""

import adsk.core, adsk.fusion, traceback, json, os
from datetime import datetime

def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface
        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            ui.messageBox('No hay un diseño activo.')
            return

        # --- Factor de escala ---
        (escala_str, cancelled) = ui.inputBox(
            'Factor de escala (1.0 = real, 0.5 = mitad):',
            'VoreaStudio3D Exporter', '1.0'
        )
        if cancelled:
            return
        try:
            escala_impresion = float(escala_str)
        except ValueError:
            ui.messageBox('Error: Ingresa un número válido.')
            return

        user_params = design.userParameters

        # --- Generar .scad ---
        scad_lines = [
            '// ═══════════════════════════════════════════════════════════',
            '// Exportado por VoreaStudio3D — Fusion 360 Bridge',
            f'// Fecha: {datetime.now().strftime("%Y-%m-%d %H:%M")}',
            f'// Diseño: {design.rootComponent.name}',
            f'// Escala: {escala_impresion} | Unidades: mm',
            f'// Parámetros: {user_params.count}',
            '// ═══════════════════════════════════════════════════════════',
            '',
        ]

        # Metadata para JSON sidecar
        params_meta = []

        for param in user_params:
            unit_type = param.unit if param.unit else 'unitless'
            comment = param.comment if param.comment else ''

            # Conversión inteligente por tipo de unidad
            if unit_type in ('cm', 'mm', 'in', 'm'):
                # Distancias: F360 API siempre en cm → convertir a mm
                valor_mm = (param.value * 10) * escala_impresion
                scad_val = f'{valor_mm:.3f}'
                output_unit = 'mm'
            elif unit_type in ('deg', 'rad'):
                # Ángulos: F360 API en radianes internos, .value ya en la unidad del param
                scad_val = f'{param.value:.3f}'
                output_unit = unit_type
            else:
                # Sin unidad (contadores, ratios, etc.)
                scad_val = f'{param.value:.3f}'
                output_unit = 'unitless'

            line = f'{param.name} = {scad_val}; // [{output_unit}] {comment}'
            scad_lines.append(line)

            params_meta.append({
                'name': param.name,
                'value': float(scad_val),
                'original_value': param.value,
                'unit': output_unit,
                'original_unit': unit_type,
                'comment': comment,
                'expression': param.expression if param.expression else None,
                'scale': escala_impresion,
            })

        scad_lines.append('')
        scad_lines.append(f'// Uso: include <{design.rootComponent.name}_params.scad>')
        scad_lines.append('// Luego usa las variables directamente en tu diseño OpenSCAD.')

        # --- Diálogo de guardado ---
        file_dialog = ui.createFileDialog()
        file_dialog.filter = 'OpenSCAD Files (*.scad)'
        file_dialog.title = 'Guardar parámetros para VoreaStudio3D'

        if file_dialog.showSave() != adsk.core.DialogResults.DialogOK:
            return

        scad_path = file_dialog.filename
        json_path = os.path.splitext(scad_path)[0] + '.json'

        # Escribir .scad
        with open(scad_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(scad_lines))

        # Escribir .json sidecar
        metadata = {
            'vorea_version': '1.0',
            'source': 'fusion360',
            'design_name': design.rootComponent.name,
            'export_date': datetime.now().isoformat(),
            'scale_factor': escala_impresion,
            'parameter_count': user_params.count,
            'parameters': params_meta,
        }
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        ui.messageBox(
            f'Exportación exitosa:\n'
            f'• {user_params.count} parámetros\n'
            f'• SCAD: {os.path.basename(scad_path)}\n'
            f'• JSON: {os.path.basename(json_path)}\n'
            f'• Escala: {escala_impresion}x'
        )

    except Exception:
        if ui:
            ui.messageBox(f'Error:\n{traceback.format_exc()}')
