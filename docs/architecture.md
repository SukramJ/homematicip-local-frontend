# Architecture Documentation

This document describes the architecture of the HomematicIP Local Frontend monorepo.

## Overview

The monorepo contains seven npm packages organized in a layered architecture:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          Home Assistant Frontend                             │
│                                                                              │
│  ┌──────────────────┐ ┌────────────────┐ ┌─────────────┐ ┌──────────────┐  │
│  │climate-schedule- │ │ schedule-card  │ │ status-card │ │ config-panel │  │
│  │card              │ │                │ │             │ │              │  │
│  │                  │ │ Switch/Light/  │ │ Health,     │ │ Device       │  │
│  │ Thermostat       │ │ Cover/Valve    │ │ Status,     │ │ config,      │  │
│  │ schedules        │ │ event          │ │ Messages    │ │ paramsets,   │  │
│  │                  │ │ schedules      │ │             │ │ linking      │  │
│  └───────┬──────────┘ └───────┬────────┘ └──────┬──────┘ └──────┬───────┘  │
│          │                    │                  │               │          │
│          └──────┬─────────────┘                  │               │          │
│                 │                                │               │          │
│       ┌─────────▼──────────┐          ┌──────────▼───────┐      │          │
│       │   schedule-ui      │          │   panel-api      │◄─────┘          │
│       │  (shared UI        │          │  (shared WS API  │◄────────────┐   │
│       │   components)      │          │   client)        │             │   │
│       └─────────┬──────────┘          └──────────────────┘             │   │
│                 │                                                      │   │
│       ┌─────────▼──────────┐                                          │   │
│       │   schedule-core    │──────────────────────────────────────────┘   │
│       │  (shared logic,    │                                              │
│       │   types, i18n)     │                                              │
│       └─────────┬──────────┘                                              │
│                 │                                                          │
└─────────────────┼──────────────────────────────────────────────────────────┘
                  │
      ┌───────────▼───────────┐
      │  HomematicIP Local    │
      │  Integration          │
      │  (HA custom component)│
      └───────────────────────┘
```

## Package Responsibilities

### schedule-core

The shared foundation layer. Contains no UI components — only logic, types, and adapters.

| Module          | Responsibility                                                   |
| --------------- | ---------------------------------------------------------------- |
| `models/`       | TypeScript type definitions for climate and device schedule data |
| `utils/`        | Pure functions for time, colors, conversion, validation, history |
| `adapters/`     | WebSocket adapter for Home Assistant communication               |
| `localization/` | Translation strings and formatting utilities                     |

### schedule-ui

Shared Lit web components for schedule editing, used by both cards and the config panel.

| Component                  | Element                         | Purpose                                |
| -------------------------- | ------------------------------- | -------------------------------------- |
| `HmipScheduleGrid`         | `<hmip-schedule-grid>`          | Visual 7-day climate timeline          |
| `HmipScheduleEditor`       | `<hmip-schedule-editor>`        | Climate schedule edit dialog           |
| `HmipDeviceScheduleList`   | `<hmip-device-schedule-list>`   | Device event list with edit/delete/add |
| `HmipDeviceScheduleEditor` | `<hmip-device-schedule-editor>` | Device event editor dialog             |

Components use properties (in) and CustomEvents (out) — no direct API calls.

### panel-api

Shared WebSocket API client library. Provides typed functions for all integration endpoints.

| Module               | Endpoints                                                          |
| -------------------- | ------------------------------------------------------------------ |
| `config-api.ts`      | Device listing, paramsets, sessions, links, schedules, permissions |
| `integration-api.ts` | System health, device statistics, incidents, throttle stats        |
| `ccu-api.ts`         | System info, messages, signal quality, firmware, install mode      |
| `types.ts`           | All shared TypeScript interfaces                                   |

Used by config-panel, status-card, schedule-card, and climate-schedule-card.

### climate-schedule-card

Lovelace card for thermostat schedule editing. Thin wrapper around `@hmip/schedule-ui` components. Uses v2 WebSocket API exclusively via `@hmip/panel-api`.

### schedule-card

Lovelace card for device schedule editing (switches, lights, covers, valves). Thin wrapper around `@hmip/schedule-ui` components. Uses WebSocket API via `@hmip/panel-api`.

### status-card

Three Lovelace monitoring cards bundled in one package:

- **System Health**: Health score, device stats, DC/CS levels, incidents
- **Device Status**: Filterable device problem overview
- **Messages**: Service messages and alarms with acknowledge

### config-panel

Integration config panel for device management. Uses `@hmip/panel-api` for all API communication and `@hmip/schedule-ui` for schedule editing.

## Data Flow

### Reading Schedules

```
HA Entity State
  │
  │  entity.attributes.schedule_data
  │
  ▼
Card Component (card.ts)
  │
  │  Reads attributes from hass.states[entityId]
  │
  ▼
Converter (schedule-core/utils/converters.ts)
  │
  │  parseSimpleWeekdaySchedule() → TimeBlock[] (climate)
  │  scheduleToUIEntries()        → SimpleScheduleEntryUI[] (device)
  │
  ▼
UI Rendering (schedule-ui components)
```

### Writing Schedules

```
User Edit Action
  │
  ▼
Card Component (card.ts)
  │
  │  Validates changes
  │  Converts to backend format
  │
  ▼
panel-api functions
  │
  │  hass.callWS({type: "homematicip_local/config/..."})
  │
  ▼
HomematicIP Local Integration
  │
  │  Sends to CCU/device via XML-RPC
  │
  ▼
Homematic Device
```

### State Update Cycle

```
Device State Change
  │
  ▼
CCU → XML-RPC callback → HA Integration → HA State Update
  │
  ▼
hass.states[entityId] updated
  │
  ▼
Lit reactive property triggers re-render
  │
  ▼
Card displays new schedule data
```

## Climate Schedule Model

### Period-Based Format (v2)

A base temperature plus deviation periods. Only periods differing from the base are stored.

```
base_temperature: 18°C
periods:
  - starttime: "06:00", endtime: "22:00", temperature: 21°C

→ 00:00-06:00 at 18°C (implicit base)
→ 06:00-22:00 at 21°C (explicit period)
→ 22:00-24:00 at 18°C (implicit base)
```

### Internal Representation

Periods are normalized to `TimeBlock[]` for the card UI:

```typescript
interface TimeBlock {
  startTime: string; // "HH:MM"
  startMinutes: number; // 0-1440
  endTime: string; // "HH:MM"
  endMinutes: number; // 0-1440
  temperature: number; // Temperature in °C
  slot: number; // Sequential index
}
```

### Conversion Pipeline

```
Backend (SimpleWeekdayData)
         │
         ▼
  parseSimpleWeekdaySchedule()
         │
         ▼
   TimeBlock[]
         │
    ┌────┴──────────────┐
    ▼                    ▼
Display (fill gaps   Save (remove base-temp
 with base temp)     blocks, merge adjacent)
    │                    │
    ▼                    ▼
fillGapsWithBase...  timeBlocksToSimpleWeekdayData()
                         │
                         ▼
                  Backend format for
                  WebSocket call
```

## Device Schedule Model

### Event-Based Design

Unlike climate schedules (continuous time blocks), device schedules use discrete **events**:

```
Event 1: Mon-Fri at 06:30, switch ON,  channels [1]
Event 2: Mon-Fri at 22:00, switch OFF, channels [1]
Event 3: Sat-Sun at 08:00, switch ON,  channels [1]
```

### Domain-Specific Behavior

| Domain   | Level Type          | Has Level 2 | Has Duration | Has Ramp Time |
| -------- | ------------------- | ----------- | ------------ | ------------- |
| `switch` | Binary (on/off)     | No          | Yes          | No            |
| `light`  | Percentage (0-100%) | No          | Yes          | Yes           |
| `cover`  | Percentage (0-100%) | Yes (slat)  | No           | No            |
| `valve`  | Percentage (0-100%) | No          | Yes          | No            |

### Condition Types

| Condition               | Description                                   |
| ----------------------- | --------------------------------------------- |
| `fixed_time`            | Exact time (HH:MM)                            |
| `astro`                 | Sunrise or sunset (with offset)               |
| `fixed_if_before_astro` | Fixed time, but only if before sunrise/sunset |
| `astro_if_before_fixed` | Astro time, but only if before fixed time     |
| `fixed_if_after_astro`  | Fixed time, but only if after sunrise/sunset  |
| `astro_if_after_fixed`  | Astro time, but only if after fixed time      |
| `earliest`              | Whichever comes first: fixed or astro         |
| `latest`                | Whichever comes last: fixed or astro          |

## Build Architecture

### Build Pipeline

```
schedule-core/src/ → tsc → dist/ (with declarations)
                              ↓
schedule-ui/src/   → tsc → dist/ (with declarations)
                              ↓
panel-api/src/     → tsc → dist/ (with declarations)
                              ↓
<card>/src/        → Rollup → dist/*.js (single bundled ES module)
config-panel/src/  → Rollup → dist/*.js (single bundled ES module)
```

### Build Order

1. `@hmip/schedule-core` — no dependencies
2. `@hmip/schedule-ui` + `@hmip/panel-api` — depend on core (can build in parallel)
3. All cards + config-panel — depend on ui/core/panel-api (can build in parallel)

### Rollup Configuration

All card/panel packages use the same Rollup config pattern:

- **ES module format** — required by Home Assistant
- **All dependencies bundled** — no externals, fully self-contained
- **Console statements dropped** — cleaner production output
- **Terser minification** with 2-pass compression

## Deployment Architecture

### Integration-Bundled Delivery

All frontend packages are deployed to the integration's `frontend/` directory and registered automatically on startup.

```
homematicip-local-frontend (monorepo)
        │
        │  npm run deploy:integration
        │
        ▼
homematicip_local/custom_components/homematicip_local/frontend/
├── homematic-config.js                        ← Config panel
├── homematicip-local-climate-schedule-card.js  ← Climate card
├── homematicip-local-schedule-card.js          ← Schedule card
└── homematicip-local-status-card.js            ← Status cards
```

### Registration Mechanism

The integration's `panel.py` handles registration:

- **Config panel**: Registered via `panel_custom.async_register_panel()` (sidebar entry)
- **Lovelace cards**: Registered via `frontend.add_extra_js_url()` (loaded on every page)
- **Cache busting**: MD5 hash of file content appended to URL
- **Idempotent**: `HassKey` guards prevent duplicate registration

### Migration from HACS

Cards use the same custom element names as the previous standalone HACS versions. On load:

1. Check if element is already registered (`customElements.get()`)
2. If yes: skip registration, log deprecation warning with removal instructions
3. If no: register normally

This allows both versions to coexist during the transition period.

### CI/CD Workflows

**CI** (push/PR to `main`/`devel`):

```
npm ci → lint → type-check → test → build
```

**Release** (tag push):

```
Tag: climate-v*, schedule-v*, config-panel-v*, status-card-v*
  → Build → Test → Create GitHub release with artifact
```

## Testing Architecture

```
jest.config.js (root)
  │
  │  projects: ["<rootDir>/packages/schedule-core"]
  │
  ▼
packages/schedule-core/src/**/*.test.ts
```

Tests are co-located with source files in `schedule-core`. UI and card packages rely on `schedule-core` being well-tested. 208 tests covering time utilities, color mapping, converters, validation, device helpers, history, and localization.

## Localization Architecture

```
schedule-core/localization/
├── types.ts          # ScheduleTranslations interface
├── en.ts             # English translations
├── de.ts             # German translations
└── index.ts          # getTranslations(), formatString(), getDomainLabel()

<card>/localization.ts   # Card-specific UI strings
status-card/localization.ts  # Status card translations
config-panel/translations/   # Panel translations (JSON-based)
```

**Language resolution** (in card components):

1. Explicit `language` in card config
2. `hass.locale?.language` or `hass.language`
3. `hass.config.language`
4. Fallback: `"en"`

Supported languages: English and German.
