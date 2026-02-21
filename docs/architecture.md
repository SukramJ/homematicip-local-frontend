# Architecture Documentation

This document describes the architecture of the HomematicIP Local Frontend monorepo.

## Overview

The monorepo contains four npm packages organized in a layered architecture:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          Home Assistant Frontend                              │
│                                                                               │
│  ┌─────────────────────┐  ┌───────────────────┐  ┌────────────────────────┐  │
│  │ climate-schedule-card│  │   schedule-card   │  │     config-panel       │  │
│  │ (Lovelace card)      │  │   (Lovelace card) │  │  (Integration panel)   │  │
│  │                      │  │                   │  │                        │  │
│  │ Thermostat schedules │  │ Switch/Light/     │  │  Device configuration, │  │
│  │ with temperature     │  │ Cover/Valve       │  │  paramset editing,     │  │
│  │ blocks               │  │ event schedules   │  │  device linking        │  │
│  └──────────┬───────────┘  └─────────┬─────────┘  └───────────┬────────────┘  │
│             │                        │                         │              │
│             └────────────┬───────────┘─────────────────────────┘              │
│                          │                                                    │
│               ┌──────────▼──────────┐                                        │
│               │   schedule-core     │                                        │
│               │   (shared library)  │                                        │
│               │                     │                                        │
│               │  Types, Utils,      │                                        │
│               │  Adapters, i18n     │                                        │
│               └──────────┬──────────┘                                        │
│                          │                                                    │
└──────────────────────────┼────────────────────────────────────────────────────┘
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

**Modules:**

| Module          | Responsibility                                                   |
| --------------- | ---------------------------------------------------------------- |
| `models/`       | TypeScript type definitions for climate and device schedule data |
| `utils/`        | Pure functions for time, colors, conversion, validation, history |
| `adapters/`     | Abstractions over Home Assistant communication                   |
| `localization/` | Translation strings and formatting utilities                     |

### climate-schedule-card

A Lit web component that renders weekly thermostat schedules as color-coded temperature blocks with inline editing.

**Responsibilities:**

- Render week view with 7 rows of color-coded time blocks
- Profile selection and switching
- Inline editor for modifying time slots and temperatures
- Copy/paste schedules between weekdays
- Undo/redo for edit operations
- Import/export schedules as JSON

### schedule-card

A Lit web component that renders event-based device schedules for switches, lights, covers, and valves.

**Responsibilities:**

- Render schedule events in a table view
- Category-specific editing UI (binary for switches, percentage for dimmers, position + slat for covers)
- Support for astronomical triggers (sunrise/sunset with offsets)
- Duration and ramp time configuration
- Multi-channel target selection

### config-panel

A Lit web component that provides the integration's built-in configuration panel for device management, paramset editing, and device linking.

**Responsibilities:**

- Device list with search and interface grouping
- Device detail view with maintenance status and channel list
- Channel paramset (MASTER) editing with save/discard/reset
- Device schedule editing
- Device link management (list, configure, add, remove)
- Change history view

**Deployment:** Unlike card packages, the config panel is deployed directly to the integration's `frontend/` directory (not via HACS).

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
  │  parseWeekdaySchedule()      → TimeBlock[] (climate v1)
  │  parseSimpleWeekdaySchedule() → TimeBlock[] (climate v2)
  │  scheduleToUIEntries()        → SimpleScheduleEntryUI[] (device)
  │
  ▼
UI Rendering (Lit templates)
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
Adapter (schedule-core/adapters/)
  │
  │  ServiceAdapter: hass.callService("homematicip_local", ...)
  │  WebSocketAdapter: hass.callWS({type: "homematicip_local/config/..."})
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

## Adapter Architecture

The adapter pattern decouples cards from the specific Home Assistant communication method.

```
┌─────────────────────────────────┐
│     ClimateScheduleAdapter      │ ◄── Interface
│     DeviceScheduleAdapter       │
└────────┬───────────────┬────────┘
         │               │
┌────────▼────────┐ ┌───▼──────────────┐
│ ServiceAdapter  │ │ WebSocketAdapter  │
│                 │ │                   │
│ hass.callService│ │ hass.callWS       │
│ (HACS cards)    │ │ (config panel)    │
└─────────────────┘ └───────────────────┘
```

**Why two adapters?**

- **Service adapters** use standard HA service calls (`hass.callService`). This is the standard approach for HACS-installed Lovelace cards that operate through the frontend.
- **WebSocket adapters** use the WebSocket API (`hass.callWS`). This is used by the HomematicIP Local integration's built-in config panel, which communicates directly via the WebSocket connection.

Both adapters implement the same interface, so card components can work with either without code changes.

## Climate Schedule Model

### Two API Versions

The HomematicIP Local integration supports two schedule data formats:

**v1 (Legacy — Slot-based)**

13 fixed time slots per weekday. Each slot defines an `ENDTIME` and `TEMPERATURE`. The device fills time from the previous slot's end to this slot's end with the given temperature.

```
Slot 1: ENDTIME="06:00", TEMP=18°C  → 00:00-06:00 at 18°C
Slot 2: ENDTIME="08:00", TEMP=22°C  → 06:00-08:00 at 22°C
...
Slot 13: ENDTIME="24:00", TEMP=18°C → last slot always ends at 24:00
```

**v2 (Simple — Period-based)**

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

Both formats are normalized to `TimeBlock[]` for the card UI:

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
Backend v1 (WeekdayData)     Backend v2 (SimpleWeekdayData)
         │                              │
         ▼                              ▼
  parseWeekdaySchedule()     parseSimpleWeekdaySchedule()
         │                              │
         └──────────┬───────────────────┘
                    ▼
              TimeBlock[]
                    │
         ┌──────────┴────────────┐
         ▼                       ▼
  Display (fill gaps       Save (remove base-temp
   with base temp)          blocks, merge adjacent)
         │                       │
         ▼                       ▼
  fillGapsWithBase...    timeBlocksToSimpleWeekdayData()
                         timeBlocksToWeekdayData()
                                 │
                                 ▼
                         Backend format for
                         service call
```

### Block Operations

| Operation | Function                          | Purpose                                       |
| --------- | --------------------------------- | --------------------------------------------- |
| Parse v1  | `parseWeekdaySchedule()`          | Convert 13-slot format to TimeBlock[]         |
| Parse v2  | `parseSimpleWeekdaySchedule()`    | Convert period format to TimeBlock[]          |
| Merge     | `mergeConsecutiveBlocks()`        | Combine adjacent blocks with same temperature |
| Fill gaps | `fillGapsWithBaseTemperature()`   | Add base-temp blocks for display              |
| Insert    | `insertBlockWithSplitting()`      | Add new block, splitting overlapping ones     |
| Sort      | `sortBlocksChronologically()`     | Order by start time                           |
| Base temp | `calculateBaseTemperature()`      | Find temperature covering most time           |
| To v1     | `timeBlocksToWeekdayData()`       | Convert back to 13-slot format                |
| To v2     | `timeBlocksToSimpleWeekdayData()` | Convert back to period format                 |

## Device Schedule Model

### Event-Based Design

Unlike climate schedules (which divide 24 hours into continuous time blocks), device schedules use discrete **events**. Each event fires at a specific time and triggers an action.

```
Event 1: Mon-Fri at 06:30, switch ON,  channels [1]
Event 2: Mon-Fri at 22:00, switch OFF, channels [1]
Event 3: Sat-Sun at 08:00, switch ON,  channels [1]
Event 4: Sat-Sun at 23:00, switch OFF, channels [1]
```

### Domain-Specific Behavior

The `DOMAIN_FIELD_CONFIG` constant defines how the UI adapts per device type:

| Domain   | Level Type          | Has Level 2 | Has Duration | Has Ramp Time |
| -------- | ------------------- | ----------- | ------------ | ------------- |
| `switch` | Binary (on/off)     | No          | Yes          | No            |
| `light`  | Percentage (0-100%) | No          | Yes          | Yes           |
| `cover`  | Percentage (0-100%) | Yes (slat)  | No           | No            |
| `valve`  | Percentage (0-100%) | No          | Yes          | No            |

### Condition Types

Events can be triggered by:

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

## Component Architecture

### Lit Web Components

Both cards follow the same Lit component pattern:

```typescript
@customElement("homematicip-local-<type>-card")
export class HomematicScheduleCard extends LitElement {
  // Public properties (set by Home Assistant)
  @property() hass!: HomeAssistant;

  // Internal state (triggers re-render)
  @state() _config?: CardConfig;
  @state() _scheduleData?: ScheduleData;
  @state() _isLoading: boolean = false;

  // Card lifecycle
  setConfig(config: CardConfig): void { ... }
  static getConfigElement(): HTMLElement { ... }
  static getStubConfig(hass: HomeAssistant): CardConfig { ... }

  // Lit lifecycle
  updated(changedProperties: PropertyValues): void { ... }
  render(): TemplateResult { ... }
  static styles = css`...`;
}
```

### Editor Components

Each card has a visual configuration editor:

```typescript
@customElement("homematicip-local-<type>-card-editor")
export class HomematicScheduleCardEditor extends LitElement {
  @property() hass!: HomeAssistant;
  @state() _config?: CardConfig;

  setConfig(config: CardConfig): void { ... }

  // Fires config-changed event on user input
  _valueChanged(event: CustomEvent): void {
    fireEvent(this, "config-changed", { config: newConfig });
  }
}
```

### State Management

Cards use Lit's reactive property system:

1. `hass` property updates trigger schedule data refresh
2. Schedule data parsed into internal state (`_scheduleData`, `_editingBlocks`, etc.)
3. User edits modify internal state
4. Save action converts state back to backend format and calls adapter

No external state management library is used.

## Localization Architecture

```
schedule-core/localization/
├── types.ts          # ScheduleTranslations interface
├── en.ts             # English translations (implements ScheduleTranslations)
├── de.ts             # German translations (implements ScheduleTranslations)
└── index.ts          # getTranslations(), formatString(), getDomainLabel()

card/localization.ts  # Card-specific UI strings (extends core translations)
```

**Language resolution** (in card components):

1. Explicit `language` in card config
2. `hass.locale?.language`
3. `hass.language`
4. `hass.config.language`
5. Fallback: `"en"`

Unsupported languages fall back to English.

## Build Architecture

### Build Pipeline

```
packages/schedule-core/src/**/*.ts
         │
         │  tsc (TypeScript compiler)
         │
         ▼
packages/schedule-core/dist/
├── index.js + index.d.ts
├── models/*.js + *.d.ts
├── utils/*.js + *.d.ts
├── adapters/*.js + *.d.ts
└── localization/*.js + *.d.ts
         │
         │  Referenced by card packages via npm workspace
         │
         ▼
packages/<card>/src/card.ts
         │
         │  Rollup (resolve → typescript → commonjs → terser)
         │
         ▼
packages/<card>/dist/homematicip-local-<type>-card.js
  (single bundled + minified ES module)
```

### Build Order

Build order is enforced by npm workspace dependency resolution:

1. `@hmip/schedule-core` — must build first (all other packages depend on it)
2. `@hmip/climate-schedule-card` — can build in parallel with other consumer packages
3. `@hmip/schedule-card` — can build in parallel with other consumer packages
4. `@hmip/config-panel` — can build in parallel with other consumer packages

The root `npm run build` command runs `npm run build --workspaces --if-present`, which respects dependency order.

### Rollup Configuration

Both card packages use nearly identical Rollup configs:

```javascript
{
  input: "src/card.ts",
  output: {
    file: "dist/homematicip-local-<type>-card.js",
    format: "es",
    sourcemap: false,
  },
  plugins: [
    replace({ "process.env.NODE_ENV": JSON.stringify("production") }),
    resolve({ browser: true }),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.json" }),
    json(),
    terser({ compress: { drop_console: true, passes: 2 } }),
  ],
}
```

Key decisions:

- **ES module format** — required by Home Assistant's custom element loader
- **No source maps** — not needed in production
- **Console statements dropped** — cleaner production output
- **All dependencies bundled** — no externals, card is fully self-contained

## Validation Architecture

### Climate Schedule Validation

Multi-level validation with localized error messages:

```
validateTimeBlocks(blocks, minTemp, maxTemp)
  → Checks: start < end, non-zero duration, temperature range

validateWeekdayData(weekdayData)
  → Checks: 13 slots, sequential keys, time ordering, last slot = "24:00"

validateSimpleWeekdayData(simpleData, minTemp, maxTemp)
  → Checks: valid periods, no overlaps, temperature range

validateProfileData(profileData)
  → Checks: all 7 weekdays present, each weekday valid

validateSimpleProfileData(simpleData)
  → Checks: all 7 weekdays present, each weekday valid
```

Validation messages use typed keys (`ClimateValidationMessageKey`) that map to localized strings in both EN and DE.

### Device Schedule Validation

```
validateEntry(entry, domain)
  → Checks: valid weekdays, valid time, valid condition/astro combo,
            level in range for domain, channels selected, duration format
```

Returns an array of error strings (not yet localized via typed keys).

## Testing Architecture

```
jest.config.js (root)
  │
  │  projects: ["<rootDir>/packages/schedule-core"]
  │
  ▼
packages/schedule-core/jest.config.js
  │
  │  preset: ts-jest
  │  testEnvironment: jsdom
  │
  ▼
packages/schedule-core/src/**/*.test.ts
```

Tests are co-located with source files. Each utility module has a corresponding test file. Card packages currently have no tests (they rely on schedule-core being well-tested).

## Deployment Architecture

### Repository Topology

```
┌────────────────────────────────────────────────────────────────┐
│              homematicip-local-frontend (monorepo)             │
│                                                                │
│  Development: source code, build tooling, tests, CI           │
│                                                                │
│  packages/                                                     │
│  ├── schedule-core/        → tsc → dist/                      │
│  ├── climate-schedule-card/ → rollup → dist/*.js              │
│  ├── schedule-card/         → rollup → dist/*.js              │
│  └── config-panel/          → rollup → dist/*.js              │
│                                                                │
│  scripts/deploy.sh    scripts/release.sh                      │
│       │                     │                                  │
└───────┼─────────────────────┼──────────────────────────────────┘
        │                     │
        ▼                     ▼
┌───────────────────┐  ┌───────────────────┐  ┌──────────────────┐
│ homematicip_local │  │ homematicip_local │  │ homematicip_local│
│ _climate_schedule │  │ _schedule_card    │  │ /frontend/       │
│ _card             │  │                   │  │                  │
│                   │  │                   │  │ Integration      │
│ HACS distribution │  │ HACS distribution │  │ config panel     │
│ (built .js only)  │  │ (built .js only)  │  │ (built .js only) │
└────────┬──────────┘  └────────┬──────────┘  └──────────────────┘
         │                      │
         ▼                      ▼
┌────────────────────────────────────────────┐
│              HACS (Home Assistant)          │
│                                            │
│  Users install cards via HACS custom       │
│  repositories. HACS downloads the .js      │
│  file from GitHub releases.                │
└────────────────────────────────────────────┘
```

### Deployment Pipeline

```
Developer edits code in monorepo
         │
         ▼
npm run version:climate -- minor     ← Bump version (e.g., 0.10.0 → 0.11.0)
         │
         ▼
git commit -m "Bump version"         ← Commit version bump
         │
         ▼
npm run release:climate              ← Full release workflow
         │
         ├── 1. npm run validate     ← Lint + type-check + test + build
         │
         ├── 2. cp dist/*.js →       ← Copy artifact to standalone repo
         │      standalone repo
         │
         ├── 3. Sync version in      ← Update package.json version
         │      standalone repo
         │
         ├── 4. git commit in        ← "Release 0.11.0"
         │      standalone repo
         │
         ├── 5. git tag in           ← Tag: 0.11.0 (standalone)
         │      standalone repo       ← Tag: climate-v0.11.0 (monorepo)
         │
         ▼
git push origin climate-v0.11.0     ← Push monorepo tag
         │                             → Triggers monorepo GitHub release
         ▼
cd standalone && git push --tags    ← Push standalone tag
         │                             → Triggers standalone GitHub release
         ▼
HACS detects new release            ← Users see update notification
```

### CI/CD Workflows

**Monorepo CI** (`.github/workflows/ci.yml`):

```
Push/PR to main/devel
  → Node.js 20.x + 22.x matrix
  → npm ci → lint → type-check → test → build
```

**Monorepo Release** (`.github/workflows/release.yml`):

```
Tag climate-v* or schedule-v*
  → npm ci → build → test
  → Create GitHub release with built .js as artifact
```

**Standalone Release** (standalone repos: `.github/workflows/release.yml`):

```
Tag [0-9]+.[0-9]+.[0-9]+
  → Extract changelog section
  → Create GitHub release with .js file attached
  → HACS picks up the new release
```

### Key Design Decisions

1. **Monorepo as single source**: All source code, tests, and build tooling live here. Standalone repos never contain source code.

2. **Built artifacts committed to standalone repos**: The `.js` file is tracked in git in standalone repos because HACS requires the file to be in the repository (either in root or `dist/`). The `hacs.json` configuration uses `content_in_root: true`.

3. **Version synced automatically**: The deploy script reads the version from the monorepo package and writes it to the standalone repo's `package.json`, ensuring consistency.

4. **Separate tags per card**: Monorepo uses `climate-v*` and `schedule-v*` prefixes to distinguish which card is being released. Standalone repos use plain semver tags.

5. **No build step in standalone CI**: Since the `.js` file is pre-built and committed, the standalone release workflow skips `npm ci`, `npm test`, and `npm run build`. It only creates a GitHub release from the existing file.
