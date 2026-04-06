# Playwright CLI (`pwcli`) — guía operativa

## Qué es

`pwcli` es un alias local de PowerShell que apunta al wrapper de Playwright CLI instalado por Codex.

Su objetivo es automatizar un navegador real desde terminal para:

- navegar páginas;
- abrir modales;
- capturar snapshots del DOM;
- hacer clicks, fills y presses;
- validar smoke tests visuales y funcionales;
- depurar flujos web sin escribir una suite completa de Playwright Test.

## Qué hace

`pwcli` ejecuta internamente el wrapper:

- `C:\Users\marti\.codex\skills\playwright\scripts\playwright_cli.ps1`

Ese wrapper invoca:

- `npx --yes --package @playwright/cli playwright-cli`

En otras palabras:

- no es un comando del producto Vorea para clientes;
- es una herramienta interna de trabajo para desarrollo, QA y soporte técnico.

## Quién lo usa

Está pensado para:

- desarrolladores;
- QA manual o técnico;
- soporte interno cuando necesite reproducir un flujo;
- agentes IA que trabajan sobre el repo y necesitan validar UI real.

No está pensado para usuarios finales del sitio.

## Cómo se usa

### Requisitos

- `node`
- `npm`
- `npx`
- Playwright Chromium instalado, por ejemplo:

```powershell
npx playwright install chromium
```

### Alias disponible

El alias persistente vive en el perfil local de PowerShell:

- `C:\Users\marti\OneDrive\Documentos\PowerShell\Microsoft.PowerShell_profile.ps1`

Definición:

```powershell
function pwcli {
  & 'C:\Users\marti\.codex\skills\playwright\scripts\playwright_cli.ps1' @args
}
```

### Flujo típico

```powershell
pwcli open https://voreastudio3d.com/es --session demo
pwcli snapshot --session demo
pwcli click e35 --session demo
pwcli close --session demo
```

## Qué significa cada paso

### `open`

Abre un navegador real y navega a la URL.

```powershell
pwcli open https://voreastudio3d.com/es --session demo
```

### `snapshot`

Captura un mapa estructurado del DOM y devuelve referencias estables como `e35`, `e50`, etc.

```powershell
pwcli snapshot --session demo
```

Estas referencias permiten interactuar con elementos sin inspección manual del HTML.

### `click e35`

Hace click sobre el elemento identificado en el último snapshot.

```powershell
pwcli click e35 --session demo
```

Por ejemplo, si `e35` era el botón `Ingresar`, el comando abre el modal de autenticación.

### `close`

Cierra la sesión del navegador asociada a ese nombre.

```powershell
pwcli close --session demo
```

## Buenas prácticas

1. Usar siempre `snapshot` antes de referenciar IDs como `e35`.
2. Repetir `snapshot` después de cambios grandes de UI o navegación.
3. Usar nombres de sesión claros:
   - `landing-smoke`
   - `auth-regression`
   - `profile-guest`
4. Cerrar sesiones al terminar para evitar ruido.

## Casos recomendados en Vorea

- smoke del landing;
- validación del modal de auth;
- gating guest/authenticated;
- validación de cambios en hero, profile, admin y checkout;
- revisión rápida después de deploy.

## Qué no reemplaza

`pwcli` no reemplaza:

- tests de integración backend;
- tests unitarios;
- políticas de seguridad;
- revisión manual de negocio;
- una suite E2E formal cuando se necesite cobertura repetible en CI.

Es una herramienta de validación rápida y operativa.

## Ejemplo real en Vorea

```powershell
pwcli open https://voreastudio3d.com/es --session demo
pwcli snapshot --session demo
pwcli click e35 --session demo
pwcli snapshot --session demo
pwcli close --session demo
```

Esto sirve para:

- abrir la home en español;
- ubicar el botón `Ingresar`;
- abrir el auth dialog;
- confirmar qué providers sociales están visibles;
- cerrar la sesión del navegador.
