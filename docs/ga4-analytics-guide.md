# GA4 Analytics Guide — Vorea Studio

**GA4 Property:** `G-23WBNB1753`

## Excluded Routes (No Analytics)

| Route | Reason |
|-------|--------|
| `/admin` | Internal admin panel |
| `/docs` | Internal documentation |
| `/feedback-admin` | Internal feedback review |

Logic in `src/app/services/analytics.ts` → `isInternalRoute()`.

## Event Dictionary

### Core Events (Router-Level)

| Event | Params | When |
|-------|--------|------|
| `open_tool` | `tool`, `surface`, `auth_state`, `route` | User navigates to any tool route |
| `page_view` | `page_path`, `page_title` | Every route change (auto) |

### Tool-Specific Events

| Event | tool | When |
|-------|------|------|
| `landing_view` | `landing` | Home page mount |
| `landing_cta_click` | `landing` | Hero CTA click (existing in MakerLanding/EducationLanding) |
| `export_stl` | `studio` / `relief` / `makerworld` | STL export |
| `export_obj` | `studio` / `makerworld` | OBJ export |
| `export_scad` | `studio` / `makerworld` | SCAD export |
| `export_3mf` | `relief` | 3MF export |
| `relief_create` | `relief` | Relief surface generated |
| `organic_deform` | `organic` | Organic deformation applied |
| `ai_generate` | `ai_studio` | AI model generation |
| `makerworld_lint` | `makerworld` | Lint check completed (`pass`, `fail`, `warn` counts) |
| `gcode_download` | `gcode` | GCode file downloaded |
| `gcode_delete` | `gcode` | GCode file deleted |
| `gcode_copy` | `gcode` | GCode copied |
| `model_open` | `explore` | Community model opened |
| `model_like` | `explore` | Community model liked |
| `pricing_plan_click` | `pricing` | Plan card clicked (`plan`, `billing`) |

### Conversion & Auth Events

| Event | method | When |
|-------|--------|------|
| `sign_up_start` | — | Auth modal opens from pricing |
| `sign_up_complete` | `email` / `register` / `google` | Login/registration success |
| `subscription_success` | — | PayPal subscription completed |
| `credit_purchase_success` | — | Credit pack purchased |

### Legacy Events (Maintained for GA4 history)

| Event | Maps to |
|-------|---------|
| `open_editor` | `open_tool { tool: "studio" }` |
| `open_ai_studio` | `open_tool { tool: "ai_studio" }` |
| `view_pricing` | `open_tool { tool: "pricing" }` |

## Standard Payload Shape

All events follow this shape where applicable:

```json
{
  "tool": "studio|organic|ai_studio|relief|makerworld|community|gcode|pricing|profile|news|landing|auth",
  "surface": "editor|explore|collection|conversion|account|content|landing",
  "auth_state": "authenticated|anonymous",
  "route": "/current-path"
}
```

## Internal Traffic Filter (Manual Step)

> [!IMPORTANT]
> This requires manual configuration in the GA4 Admin console.

1. Go to **GA4 Admin** → **Data Streams** → select stream
2. Click **Configure tag settings** → **Define internal traffic**
3. Add rule:
   - Name: `Vorea Team`
   - IP addresses: Add team IPs

## How to Read the Baseline

1. **GA4 → Reports → Realtime**: See events in real-time
2. **GA4 → Explore → Free-form**:
   - Rows: `event_name`
   - Values: `event_count`
   - Filter: Exclude `page_view` for action focus
3. **Key funnels**:
   - `open_tool` → `export_*` (activation)
   - `view_pricing` → `sign_up_start` → `sign_up_complete` → `subscription_success` (monetization)
   - `landing_view` → `open_tool` (conversion from landing)
