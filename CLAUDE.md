# CLAUDE.md - AI Development Guide

This document provides comprehensive context for AI assistants working with the HomematicIP Local Frontend monorepo.

## Project Overview

**Name**: HomematicIP Local Frontend
**Type**: npm workspaces monorepo (shared library + custom Lovelace cards)
**Primary Language**: TypeScript 5.9+
**Framework**: Lit 3.0 (Web Components)
**Build System**: TypeScript compiler (schedule-core, schedule-ui) + Rollup (cards, config panel)
**Testing**: Jest 30 with ts-jest
**Linting**: ESLint 9 (flat config) + Prettier
**Git Hooks**: Husky + lint-staged

## Repository Structure

```
homematicip-local-frontend/
├── packages/
│   ├── schedule-core/                      # @hmip/schedule-core (v1.0.0)
│   │   ├── src/
│   │   │   ├── index.ts                    # Public API exports
│   │   │   ├── adapters/
│   │   │   │   ├── types.ts                # Adapter interfaces
│   │   │   │   ├── service-adapter.ts      # hass.callService adapter (HACS cards)
│   │   │   │   └── websocket-adapter.ts    # hass.callWS adapter (config panel)
│   │   │   ├── models/
│   │   │   │   ├── common-types.ts         # Weekday, HomeAssistant, HassEntity
│   │   │   │   ├── climate-types.ts        # TimeBlock, WeekdayData, SimpleProfileData
│   │   │   │   └── device-types.ts         # SimpleScheduleEntry, ScheduleDomain, DOMAIN_FIELD_CONFIG
│   │   │   ├── localization/
│   │   │   │   ├── index.ts                # getTranslations, formatString, getDomainLabel
│   │   │   │   ├── types.ts                # ScheduleTranslations type
│   │   │   │   ├── en.ts                   # English translations
│   │   │   │   └── de.ts                   # German translations
│   │   │   └── utils/
│   │   │       ├── time.ts                 # Time parsing, formatting, conversion
│   │   │       ├── colors.ts               # Temperature color mapping
│   │   │       ├── converters.ts           # Schedule parsing and conversion
│   │   │       ├── device-helpers.ts       # Device schedule helpers
│   │   │       ├── device-address.ts       # Device address extraction
│   │   │       ├── history.ts              # UndoRedoHistory class
│   │   │       ├── validation.ts           # Schedule validation
│   │   │       ├── import-export.ts        # JSON import/export
│   │   │       └── *.test.ts              # Unit tests (co-located)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── jest.config.js
│   ├── schedule-ui/                        # @hmip/schedule-ui (v1.0.0)
│   │   ├── src/
│   │   │   ├── index.ts                    # Public exports
│   │   │   ├── types.ts                    # Translation interfaces, event detail types
│   │   │   ├── schedule-grid.ts            # <hmip-schedule-grid> — climate timeline
│   │   │   ├── schedule-editor.ts          # <hmip-schedule-editor> — climate edit dialog
│   │   │   ├── device-schedule-list.ts     # <hmip-device-schedule-list> — device event list
│   │   │   ├── device-schedule-editor.ts   # <hmip-device-schedule-editor> — device edit dialog
│   │   │   └── styles/
│   │   │       ├── grid-styles.ts          # Climate grid CSS
│   │   │       ├── editor-styles.ts        # Climate editor CSS
│   │   │       ├── device-list-styles.ts   # Device list CSS
│   │   │       └── device-editor-styles.ts # Device editor CSS
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── climate-schedule-card/              # @hmip/climate-schedule-card (v0.10.0)
│   │   ├── src/
│   │   │   ├── card.ts                     # Main Lit component (thin wrapper)
│   │   │   ├── editor.ts                   # Visual config editor
│   │   │   ├── types.ts                    # Card config types (re-exports from core)
│   │   │   └── localization.ts             # Card-specific UI translations
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── rollup.config.mjs
│   ├── schedule-card/                      # @hmip/schedule-card (v0.1.0)
│   │   ├── src/
│   │   │   ├── card.ts                     # Main Lit component (thin wrapper)
│   │   │   ├── editor.ts                   # Visual config editor
│   │   │   ├── types.ts                    # Card config types (re-exports from core)
│   │   │   └── localization.ts             # Card-specific UI translations
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── rollup.config.mjs
│   └── config-panel/                       # @hmip/config-panel (v1.0.0)
│       ├── src/
│       │   ├── homematic-config.ts         # Main entry point & view router
│       │   ├── api.ts                      # WebSocket API client
│       │   ├── types.ts                    # Panel-specific types
│       │   ├── styles.ts                   # Shared CSS styles
│       │   ├── localize.ts                 # i18n: flatten, cache, placeholder substitution
│       │   ├── ha-helpers.ts               # HA dialog/toast helpers
│       │   ├── safe-element.ts             # Safe element utilities
│       │   ├── json.d.ts                   # JSON module declaration
│       │   ├── views/                      # Panel views
│       │   │   ├── device-list.ts          # Device list with search & interface grouping
│       │   │   ├── device-detail.ts        # Device detail & channel list
│       │   │   ├── channel-config.ts       # Channel paramset editor
│       │   │   ├── device-schedule.ts      # Device schedule editing
│       │   │   ├── device-links.ts         # Device links view
│       │   │   ├── link-config.ts          # Link configuration view
│       │   │   ├── add-link.ts             # Add device link view
│       │   │   └── change-history.ts       # Change history view
│       │   └── components/                 # Reusable form components
│       │       ├── config-form.ts          # Form schema renderer
│       │       ├── form-parameter.ts       # Parameter widget renderer
│       │       └── form-time-selector.ts   # Time selection widget
│       ├── translations/
│       │   ├── en.json                     # English translations
│       │   └── de.json                     # German translations
│       ├── package.json
│       ├── tsconfig.json
│       └── rollup.config.mjs
├── scripts/
│   ├── deploy.sh                           # Deploy built card to standalone repo
│   └── release.sh                          # Full release workflow (validate → deploy → tag)
├── .github/workflows/
│   ├── ci.yml                              # GitHub Actions CI
│   └── release.yml                         # Release pipeline (on card tags)
├── tsconfig.base.json                      # Shared TypeScript base config
├── eslint.config.mjs                       # ESLint 9 flat config
├── .prettierrc                             # Prettier config
├── .editorconfig                           # EditorConfig
├── .gitignore
├── jest.config.js                          # Root Jest config (projects)
└── package.json                            # Workspace root
```

## Package Architecture

### Dependency Graph

```
climate-schedule-card ──→ schedule-ui ──→ schedule-core
         │                     ▲                ▲
         └──→ lit              │                │
                        schedule-card ──→ schedule-ui
                               │                ▲
                               └──→ lit         │
                                          config-panel
                                                │
                                                └──→ lit
```

All card and panel packages depend on `@hmip/schedule-ui` and `@hmip/schedule-core` (workspace dependencies). Build order: `schedule-core` → `schedule-ui` → card/panel packages. Libraries are compiled with `tsc`, consumer packages bundle everything via Rollup.

### @hmip/schedule-core

The shared library providing all schedule logic. Compiled with `tsc` to `dist/` with declaration files.

**Exports** (via `src/index.ts`):

- **Models**: `Weekday`, `HomeAssistant`, `HassEntity`, `WEEKDAYS`, `TimeBlock`, `ScheduleSlot`, `WeekdayData`, `SimpleWeekdayData`, `SimpleProfileData`, `ClimateScheduleEntityAttributes`, `SimpleScheduleEntry`, `SimpleSchedule`, `ScheduleData`, `DeviceScheduleEntityAttributes`, `ScheduleDomain`, `ConditionType`, `AstroType`, `CONDITION_TYPES`, `DOMAIN_FIELD_CONFIG`, `DURATION_UNITS`
- **Utils**: `timeToMinutes`, `minutesToTime`, `formatTime`, `parseTime`, `isValidTime`, `roundTimeToQuarter`, `formatTimeFromParts`, `getTemperatureColor`, `getTemperatureGradient`, `formatTemperature`, `getDeviceAddress`, `UndoRedoHistory`
- **Converters**: `parseWeekdaySchedule`, `parseSimpleWeekdaySchedule`, `timeBlocksToWeekdayData`, `timeBlocksToSimpleWeekdayData`, `convertToBackendFormat`, `calculateBaseTemperature`, `mergeConsecutiveBlocks`, `insertBlockWithSplitting`, `fillGapsWithBaseTemperature`, `sortBlocksChronologically`, `getScheduleApiVersion`, `getProfileFromPresetMode`, `getActiveProfileFromIndex`
- **Validation**: `validateTimeBlocks`, `validateWeekdayData`, `validateSimpleWeekdayData`, `validateProfileData`, `validateSimpleProfileData`, `validateEntry`
- **Device Helpers**: `isEntryActive`, `scheduleToUIEntries`, `createEmptyEntry`, `isAstroCondition`, `parseDuration`, `buildDuration`, `formatDurationDisplay`, `isValidDuration`, `formatLevel`, `formatAstroTime`, `entryToBackend`, `scheduleToBackend`, `isValidScheduleEntity`
- **Import/Export**: `downloadJson`, `readJsonFile`
- **Localization**: `getTranslations`, `formatString`, `getDomainLabel`
- **Adapters**: `ServiceClimateScheduleAdapter`, `ServiceDeviceScheduleAdapter`, `WebSocketClimateScheduleAdapter`, `WebSocketDeviceScheduleAdapter`

### @hmip/schedule-ui

Shared Lit web components for schedule editing. Compiled with `tsc` to `dist/` with declaration files. Used by both HACS cards and the config panel for a consistent UX.

**Components**:

| Component                  | Element                         | Purpose                                                                                               |
| -------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `HmipScheduleGrid`         | `<hmip-schedule-grid>`          | Visual 7-day climate timeline with color-coded temperature blocks, copy/paste, current time indicator |
| `HmipScheduleEditor`       | `<hmip-schedule-editor>`        | Climate schedule edit dialog with weekday tabs, undo/redo, inline slot editing, validation            |
| `HmipDeviceScheduleList`   | `<hmip-device-schedule-list>`   | Device event list grouped by weekday with edit/delete/add buttons                                     |
| `HmipDeviceScheduleEditor` | `<hmip-device-schedule-editor>` | Device event editor dialog with time, condition, weekdays, level, duration, ramp time, channels       |

**Translation Interfaces**: Components receive translations via typed interfaces (`GridTranslations`, `EditorTranslations`, `DeviceListTranslations`, `DeviceEditorTranslations`). Each consumer builds these from its own i18n system (card `localization.ts` or panel `localize()`).

**Event-based communication**: Components dispatch typed `CustomEvent`s instead of calling APIs directly:

- Climate grid: `weekday-click`, `copy-schedule`, `paste-schedule`
- Climate editor: `save-schedule`, `validation-failed`, `editor-closed`
- Device list: `add-event`, `edit-event`, `delete-event`
- Device editor: `save-event`, `editor-closed`

### @hmip/climate-schedule-card

Lovelace card for thermostat schedule editing. Thin wrapper around `@hmip/schedule-ui` components. Bundled with Rollup into a single ES module.

**Custom element**: `homematicip-local-climate-schedule-card`
**Output**: `dist/homematicip-local-climate-schedule-card.js`

The card manages entity/profile state, service calls, import/export, and config editing. Rendering and editing logic is delegated to `<hmip-schedule-grid>` and `<hmip-schedule-editor>`.

### @hmip/schedule-card

Lovelace card for device schedule editing (switches, lights, covers, valves). Thin wrapper around `@hmip/schedule-ui` components. Bundled with Rollup into a single ES module.

**Custom element**: `homematicip-local-schedule-card`
**Output**: `dist/homematicip-local-schedule-card.js`

The card manages entity/config state, service calls, import/export, and loading/error states. Rendering and editing logic is delegated to `<hmip-device-schedule-list>` and `<hmip-device-schedule-editor>`.

### @hmip/config-panel

Integration config panel for device configuration, paramset editing, device linking, and schedule management. Bundled with Rollup into a single ES module that is deployed to the integration's `frontend/` directory.

**Custom element**: `homematic-config`
**Output**: `dist/homematic-config.js`
**Deployment**: Copied to `homematicip_local/custom_components/homematicip_local/frontend/homematic-config.js`

Unlike the card packages, the config panel:

- Has no standalone HACS distribution repo (it's part of the integration)
- Uses its own i18n system (JSON-based translations in `translations/`)
- Communicates via WebSocket API (`hass.callWS`) rather than service calls
- Does not generate declaration files (not a library)

## Schedule Data Models

### Climate Schedules

Two API versions:

**v1 (Slot-based)**: 13 time slots per day with `ENDTIME` and `TEMPERATURE`:

```typescript
interface ScheduleSlot {
  ENDTIME: string; // "HH:MM"
  TEMPERATURE: number;
}

interface WeekdayData {
  [slot: string]: ScheduleSlot; // Keys "1"-"13"
}
```

**v2 (Period-based)**: Base temperature with deviation periods:

```typescript
interface SimpleWeekdayData {
  base_temperature: number;
  periods: SimpleSchedulePeriod[];
}

interface SimpleSchedulePeriod {
  starttime: string; // "HH:MM"
  endtime: string; // "HH:MM"
  temperature: number;
}
```

Both are converted to `TimeBlock[]` internally for display and editing:

```typescript
interface TimeBlock {
  startTime: string;
  startMinutes: number;
  endTime: string;
  endMinutes: number;
  temperature: number;
  slot: number;
}
```

### Device Schedules

Event-based scheduling for switches, lights, covers, and valves:

```typescript
interface SimpleScheduleEntry {
  weekdays: Weekday[];
  time: string;
  condition: ConditionType; // "fixed_time" | "astro" | etc.
  astro_type: AstroType | null; // "sunrise" | "sunset"
  astro_offset_minutes: number;
  target_channels: string[];
  level: number; // 0/1 for switches, 0.0-1.0 for dimmers
  level_2: number | null; // Slat position for covers
  duration: string | null; // "5min", "1h30min"
  ramp_time: string | null; // Light ramp time
}

type SimpleSchedule = Record<string, SimpleScheduleEntry>; // Keys "1"-"24"
```

Domain-specific behavior is driven by `DOMAIN_FIELD_CONFIG`:

```typescript
const DOMAIN_FIELD_CONFIG: Record<ScheduleDomain, DomainFieldConfig> = {
  switch: { levelType: "binary", hasLevel2: false, hasDuration: true, hasRampTime: false },
  light: { levelType: "percentage", hasLevel2: false, hasDuration: true, hasRampTime: true },
  cover: { levelType: "percentage", hasLevel2: true, hasDuration: false, hasRampTime: false },
  valve: { levelType: "percentage", hasLevel2: false, hasDuration: true, hasRampTime: false },
};
```

## Adapter Pattern

Two adapter implementations for communicating with Home Assistant:

### Service Adapter (HACS cards)

Used by standalone Lovelace cards. Calls `hass.callService("homematicip_local", ...)`:

```typescript
class ServiceClimateScheduleAdapter implements ClimateScheduleAdapter
class ServiceDeviceScheduleAdapter implements DeviceScheduleAdapter
```

### WebSocket Adapter (Config panel)

Used by the integration's built-in config panel. Calls `hass.callWS({type: "homematicip_local/config/..."})`:

```typescript
class WebSocketClimateScheduleAdapter implements ClimateScheduleAdapter
class WebSocketDeviceScheduleAdapter implements DeviceScheduleAdapter
```

### Adapter Interfaces

```typescript
interface ClimateScheduleAdapter {
  getScheduleProfile(deviceAddress: string, profile: string): Promise<SimpleProfileData>;
  setScheduleWeekday(params: { ... }): Promise<void>;
  setActiveProfile(deviceAddress: string, profile: string): Promise<void>;
  reloadDeviceConfig(deviceAddress: string): Promise<void>;
}

interface DeviceScheduleAdapter {
  getSchedule(deviceAddress: string): Promise<SimpleSchedule>;
  setSchedule(deviceAddress: string, scheduleData: { ... }): Promise<void>;
  reloadDeviceConfig(deviceAddress: string): Promise<void>;
}
```

## Localization

Centralized in `schedule-core` with card-specific extensions.

**Supported languages**: English (`en`), German (`de`)

**Core translations** (`ScheduleTranslations` type):

- `weekdays.short` / `weekdays.long` - Day name labels
- `domains` - Device type labels (switch, light, cover, valve)
- `conditions` - Trigger condition labels
- `common` - Shared UI labels (schedule, loading, entityNotFound, save, cancel, etc.)
- `climate` - Climate-specific labels (from, to, baseTemperature, etc.)
- `device` - Device-specific labels (level, slat, addEvent, etc.)
- `errors` - Error messages
- `warnings` - Warning labels
- `validationMessages` - Validation error messages (keyed by `ClimateValidationMessageKey`)

**Usage**:

```typescript
import { getTranslations, formatString, getDomainLabel } from "@hmip/schedule-core";

const t = getTranslations("de");
const msg = formatString(t.errors.failedToSaveSchedule, { entity: "climate.foo" });
const label = getDomainLabel("switch", "de");
```

Card packages extend core translations with card-specific UI strings in their own `localization.ts`.

## TypeScript Configuration

### Base Config (`tsconfig.base.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

All packages extend this base. Card and panel packages add `moduleResolution: "bundler"` and reference `schedule-core` and `schedule-ui` via TypeScript project references.

## Build Process

### schedule-core

Compiled with `tsc` to `dist/` with type declarations. Must be built first (no dependencies on other workspace packages).

### schedule-ui

Compiled with `tsc` to `dist/` with type declarations. Depends on `schedule-core` and must be built after it, but before card/panel packages.

### Card and panel packages

Bundled with Rollup:

1. TypeScript compilation via `@rollup/plugin-typescript`
2. Node module resolution (browser mode) via `@rollup/plugin-node-resolve`
3. CommonJS interop via `@rollup/plugin-commonjs`
4. Environment variable replacement (`NODE_ENV=production`)
5. Terser minification with `drop_console` and 2-pass compression

Output: Single ES module `.js` file per card (all dependencies bundled, no externals).

## Testing

### Framework

- **Jest 30** with `ts-jest` preset and `jsdom` environment
- Tests co-located with source: `*.test.ts` next to `*.ts`
- Root `jest.config.js` uses `projects` to run across packages

### Running Tests

```bash
npm test                    # All tests (via workspace)
npm test -w packages/schedule-core  # schedule-core only
```

### Coverage

```bash
npx jest --coverage -w packages/schedule-core
```

Coverage collected from `src/**/*.ts`, excluding `.d.ts`, `.test.ts`, and `index.ts`.

### Current Test Coverage

9 test suites, 187 tests covering:

- `utils/time.test.ts` - Time formatting, parsing, conversion
- `utils/colors.test.ts` - Temperature colors and gradients
- `utils/device-address.test.ts` - Device address parsing
- `utils/device-helpers.test.ts` - 57 tests: entry helpers, schedule conversion, formatting
- `utils/history.test.ts` - UndoRedoHistory (push, undo, redo, limits, clear)
- `utils/validation.test.ts` - 37 tests: time blocks, weekday data, profile data validation
- `utils/converters.test.ts` - Schedule parsing, conversion, merging, sorting
- `localization/localization.test.ts` - 25 tests: translations (en/de), formatting, domain labels
- `models/types.test.ts` - Constants and type structure validation

## Development Workflow

### Commands

```bash
npm install               # Install all dependencies
npm run build             # Build all packages (core → ui → cards/panel)
npm run build:core        # Build schedule-core only
npm run build:ui          # Build schedule-ui only
npm test                  # Run all tests
npm run lint              # ESLint check
npm run lint:fix          # ESLint auto-fix
npm run format            # Prettier format
npm run format:check      # Prettier check
npm run type-check        # TypeScript check (all packages)
npm run validate          # Full pipeline: lint + type-check + test + build
npm run clean             # Remove all dist/ directories
```

### Pre-commit Hooks

Husky + lint-staged run automatically on commit:

- `*.ts` files: ESLint auto-fix + Prettier
- `*.{js,mjs,json,md}` files: Prettier

### CI Pipeline (GitHub Actions)

Runs on push/PR to `main`/`devel`:

- Node.js matrix: 20.x, 22.x
- Steps: install, lint, type-check, test, build

## Common Development Tasks

### Adding a Utility Function

1. Add function to the appropriate file in `packages/schedule-core/src/utils/`
2. Export from `packages/schedule-core/src/index.ts`
3. Write tests in a co-located `.test.ts` file
4. Run `npm run validate`

### Adding a New Type

1. Add to the appropriate file in `packages/schedule-core/src/models/`
2. Export from `packages/schedule-core/src/index.ts`
3. Import in card packages via `@hmip/schedule-core`

### Adding Translations

1. Add key to `ScheduleTranslations` type in `packages/schedule-core/src/localization/types.ts`
2. Add English text in `packages/schedule-core/src/localization/en.ts`
3. Add German text in `packages/schedule-core/src/localization/de.ts`
4. For card-specific strings, add to the card's `src/localization.ts` instead

### Modifying a Schedule UI Component

1. Edit files in `packages/schedule-ui/src/`
2. Components use properties (in) and CustomEvents (out) — no direct API calls
3. Translation strings come via typed translation interfaces, not hardcoded
4. Styles are in separate files under `src/styles/`
5. After changes, rebuild with `npm run build:ui` then rebuild consumers
6. Both cards and the config panel use these components — test both UX paths
7. Run `npm run validate` before committing

### Modifying a Card

1. Edit files in `packages/<card>/src/`
2. Use `npm run watch -w packages/<card>` for live rebuilding
3. Import shared logic from `@hmip/schedule-core`
4. Import shared UI components from `@hmip/schedule-ui`
5. Run `npm run validate` before committing

### Adding a New Adapter

1. Define the interface in `packages/schedule-core/src/adapters/types.ts`
2. Implement in a new file under `packages/schedule-core/src/adapters/`
3. Export from `packages/schedule-core/src/index.ts`

## Code Style

### TypeScript

- Strict mode enabled
- No `any` without justification (warned by ESLint)
- Unused variables prefixed with `_`
- ES2022 target

### Formatting (Prettier)

- Semicolons: yes
- Trailing commas: all
- Single quotes: no (double quotes)
- Print width: 100
- Tab width: 2
- Arrow parens: always
- End of line: LF

### ESLint Rules

- `@typescript-eslint/no-explicit-any`: warn
- `@typescript-eslint/no-unused-vars`: error (args prefixed with `_` allowed)
- `@typescript-eslint/explicit-module-boundary-types`: off

## Home Assistant Integration

### Service Calls

The cards communicate with the HomematicIP Local integration via service calls:

| Service                                          | Used By       | Purpose                     |
| ------------------------------------------------ | ------------- | --------------------------- |
| `homematicip_local.set_schedule_simple_weekday`  | Climate card  | Save simple format schedule |
| `homematicip_local.set_schedule_profile_weekday` | Climate card  | Save legacy format schedule |
| `homematicip_local.set_schedule_active_profile`  | Climate card  | Load profile data           |
| `homematicip_local.set_schedule`                 | Schedule card | Save device schedule        |
| `homematicip_local.reload_device_config`         | Both cards    | Force device config reload  |

### Entity Attributes

**Climate entities** expose:

- `schedule_data` - Schedule data (SimpleProfileData)
- `active_profile` - Currently active profile name (see [Profile Concepts](#climate-schedule-profile-concepts))
- `available_profiles` - List of profile names
- `preset_mode` - Current device preset (v1, maps to active profile on device)
- `device_active_profile_index` - Active profile index on the physical device (v2)
- `schedule_api_version` - `"v1"` or `"v2"`
- `min_temp` / `max_temp` / `target_temp_step` - Temperature constraints
- `interface_id` / `address` - Device identifiers

**Device entities** expose:

- `schedule_data` - Schedule data (ScheduleData with entries)
- `schedule_domain` - Device type (switch, light, cover, valve)
- `max_entries` - Maximum schedule entries
- `available_target_channels` - Channel info for multi-channel devices
- `schedule_api_version` - API version
- `interface_id` / `address` - Device identifiers

### Climate Schedule Profile Concepts

**IMPORTANT**: There are two distinct profile concepts that must not be confused:

1. **Current schedule profile** (`active_profile` / `current_schedule_profile`): Which schedule profile's data is currently loaded and displayed in the UI. This is a **display-only** selection — changing it loads different schedule data but does **not** change any device setting. Both the config panel (via WebSocket `get_schedule_profile`) and the cards track this.

2. **Device active profile** (`preset_mode` for v1, `device_active_profile_index` for v2): The profile that is actually active on the **physical device**. Changing this tells the thermostat which schedule to follow. Set via `set_climate_active_profile` / `setClimateActiveProfile`.

**Where each is available**:

| Context                    | Current schedule profile     | Device active profile                                   |
| -------------------------- | ---------------------------- | ------------------------------------------------------- |
| Climate entity attributes  | `active_profile`             | `preset_mode` (v1) / `device_active_profile_index` (v2) |
| Config panel WebSocket API | `active_profile` in response | Not directly available                                  |
| Climate schedule card      | `_currentProfile`            | `_activeDeviceProfile` (from entity attrs)              |

**Key implications**:

- The config panel's profile dropdown only switches which schedule data is displayed. When the user selects a different profile, the panel calls `setClimateActiveProfile` to also activate it on the device, then reloads the schedule data.
- The config panel does **not** have access to the device's active profile (no entity attributes available), so it cannot display which profile is currently active on the device.
- The climate schedule card has full access to both concepts via entity attributes and can distinguish between "displayed profile" and "device active profile".

## Release & Deployment

### Repository Architecture

This monorepo is the **single source of truth** for frontend development. Two standalone repositories serve as HACS distribution channels, and the config panel is deployed directly to the integration:

```
homematicip-local-frontend (this repo)
        │
        │  scripts/deploy.sh
        │
        ├──→ homematicip_local_climate_schedule_card  (HACS distribution)
        ├──→ homematicip_local_schedule_card           (HACS distribution)
        └──→ homematicip_local/frontend/               (integration config panel)
```

The standalone repos contain **only** the built `.js` file, HACS metadata, and documentation. The config panel is deployed as a single `.js` file into the integration's `frontend/` directory.

### Deployment Scripts

**`scripts/deploy.sh <climate-schedule-card|schedule-card|config-panel>`**

Copies the built artifact to the target repo. For card packages, also syncs the version from the monorepo's package.json. For config-panel, copies to the integration's `frontend/` subdirectory.

**`scripts/release.sh <climate-schedule-card|schedule-card|config-panel> [--dry-run]`**

Full release workflow:

1. Runs `npm run validate` (lint, type-check, test, build)
2. Copies built `.js` to standalone repo
3. Syncs version in standalone repo's `package.json`
4. Creates `Release <version>` commit in standalone repo
5. Tags standalone repo with `<version>` and monorepo with `<card>-v<version>`

### Release Commands

| Command                                                 | Description                                            |
| ------------------------------------------------------- | ------------------------------------------------------ |
| `npm run deploy:climate`                                | Deploy climate card (copy `.js` + sync version)        |
| `npm run deploy:schedule`                               | Deploy schedule card                                   |
| `npm run deploy:config-panel`                           | Deploy config panel to integration frontend directory  |
| `npm run deploy:all`                                    | Deploy all packages (cards + config panel)             |
| `npm run release:climate`                               | Full release: validate → build → deploy → commit → tag |
| `npm run release:schedule`                              | Full release for schedule card                         |
| `npm run release:config-panel`                          | Build, validate, and deploy config panel               |
| `npm run release:climate:dry`                           | Dry-run (preview without changes)                      |
| `npm run release:schedule:dry`                          | Dry-run for schedule card                              |
| `npm run release:config-panel:dry`                      | Dry-run for config panel                               |
| `npm run version:climate -- <patch\|minor\|major>`      | Bump climate card version                              |
| `npm run version:schedule -- <patch\|minor\|major>`     | Bump schedule card version                             |
| `npm run version:config-panel -- <patch\|minor\|major>` | Bump config panel version                              |

### Release Workflow (Step-by-Step)

```bash
# 1. Bump version in monorepo
npm run version:climate -- minor      # e.g., 0.10.0 → 0.11.0

# 2. Commit version bump
git add -A && git commit -m "Bump climate-schedule-card to 0.11.0"

# 3. Run full release (includes validation)
npm run release:climate

# 4. Push monorepo tag → triggers GitHub release with artifact
git push origin climate-v0.11.0

# 5. Push standalone repo → triggers HACS release
cd ../homematicip_local_climate_schedule_card
git push origin main --tags
```

### Tag Convention

| Tag Pattern       | Repository            | Purpose                          |
| ----------------- | --------------------- | -------------------------------- |
| `climate-v0.11.0` | Monorepo              | Triggers monorepo GitHub release |
| `0.11.0`          | Standalone (climate)  | Triggers HACS release            |
| `schedule-v0.2.0` | Monorepo              | Triggers monorepo GitHub release |
| `0.2.0`           | Standalone (schedule) | Triggers HACS release            |

### CI/CD Workflows

| Workflow | File                            | Trigger                           | Steps                                   |
| -------- | ------------------------------- | --------------------------------- | --------------------------------------- |
| CI       | `.github/workflows/ci.yml`      | Push/PR to `main`/`devel`         | lint → type-check → test → build        |
| Release  | `.github/workflows/release.yml` | Tag `climate-v*` or `schedule-v*` | install → build → test → GitHub release |

### Standalone Repo Structure

After deployment, each standalone repo contains:

```
homematicip_local_climate_schedule_card/
├── .github/workflows/
│   ├── release.yml             # Creates GitHub release on tag
│   └── validate.yml            # HACS structure validation
├── homematicip-local-climate-schedule-card.js  ← from monorepo build
├── package.json                # Version metadata only (no scripts/deps)
├── hacs.json                   # HACS registration
├── CHANGELOG.md                # Release history
├── README.md                   # User documentation
├── info.md                     # HACS info page
├── LICENSE
└── icon.png / logo.png         # HACS branding
```

## Related Projects

- [HomematicIP Local Integration](https://github.com/SukramJ/homematicip_local) - Home Assistant custom integration
- [aiohomematic](https://github.com/SukramJ/aiohomematic) - Python library for Homematic communication
- [homematicip_local_climate_schedule_card](https://github.com/SukramJ/homematicip_local_climate_schedule_card) - HACS distribution (climate card)
- [homematicip_local_schedule_card](https://github.com/SukramJ/homematicip_local_schedule_card) - HACS distribution (schedule card)

## Development Rules

These rules govern how AI assistants must approach all code changes in this project:

1. **Describe before coding** — Before writing any code, describe your approach and wait for approval.
2. **Clarify ambiguity** — If requirements are ambiguous, ask clarifying questions before writing any code.
3. **Suggest edge cases** — After finishing any code change, list edge cases and suggest test cases to cover them.
4. **Test-first bug fixes** — When fixing a bug, start by writing a test that reproduces it, then fix it until the test passes.
5. **Learn from corrections** — Every time you are corrected, reflect on what went wrong and describe a plan to avoid the same mistake in the future.

## Notes for AI Assistants

1. **Always run `npm run validate`** before suggesting code changes
2. **Build order matters**: `schedule-core` → `schedule-ui` → card/panel packages
3. **Tests are in schedule-core only** - UI and card packages have no tests yet
4. **Import from `@hmip/schedule-core`** for logic/types, **`@hmip/schedule-ui`** for UI components — never use relative paths to other package source
5. **Both EN and DE translations required** for all user-facing strings
6. **Two schedule models exist**: climate (time-slot based) and device (event-based) - don't confuse them
7. **Two adapter types exist**: service (HACS cards) and WebSocket (config panel)
8. **Rollup bundles everything** - no external dependencies in card output files
9. **Standalone repos and integration frontend are deployment-only** - never edit source code there, always work in this monorepo
10. **Use `npm run release:<card>:dry`** to preview a release before executing it
11. **Schedule UI components are shared** - changes to `schedule-ui` affect both cards and the config panel
12. **Components use events, not API calls** - `schedule-ui` components dispatch CustomEvents; consumers handle API communication
13. **Two distinct profile concepts** for climate schedules — "current schedule profile" (display only) vs "device active profile" (physical device setting). See [Profile Concepts](#climate-schedule-profile-concepts). Don't confuse them.
14. **`ha-select` uses `.options` property** (HA 2026.3.0+) — `ha-list-item` children no longer work. Use `.options` array of `{ value, label }` objects, `@selected` event with `e.detail.value`, and `@closed` with `e.stopPropagation()` to prevent dialog closing. See [HA Component Compatibility](#ha-component-compatibility).
15. **`ha-dialog` action slots removed** (HA 2026.3.0+) — `slot="primaryAction"`/`slot="secondaryAction"` no longer work. Place buttons inside dialog content. `scrimClickAction`/`escapeKeyAction` attributes are ignored.
16. **No `--mdc-*` CSS variables** (HA 2026.3.0+) — All Material Design Component CSS properties were removed. Use `--ha-*` equivalents. See [CSS Variable Migration](#css-variable-migration-ha-202630).
17. **`ha-textfield` removed** (HA 2026.5+) — Deprecated in 2026.4, removed in 2026.5. Use `ha-input` instead. Also: `search-input` → `ha-input-search`, `ha-multi-textfield` → `ha-input-multi`.

## HA Component Compatibility

### `ha-select` (HA 2026.3.0+ / frontend tag `20260302.0`)

Home Assistant 2026.3.0 rewrote `ha-select` from `mwc-select` (Material Web Components) to `ha-dropdown` (webawesome). **`ha-list-item` children are no longer recognized.**

**Required API**:

```typescript
<ha-select
  .label=${"Label"}
  .value=${currentValue}
  .disabled=${isDisabled}
  .options=${items.map((item) => ({
    value: item.id,
    label: item.name,
  }))}
  @selected=${(e: CustomEvent) => {
    e.stopPropagation();
    const value = e.detail.value; // string | undefined
    if (!value) return;
    // handle selection
  }}
  @closed=${(e: Event) => e.stopPropagation()}
></ha-select>
```

**Key points**:

- `.options`: Array of `{ value: string, label: string, secondary?: string, iconPath?: string, disabled?: boolean }`
- `@selected`: Fires with `e.detail.value` (string or undefined)
- `@closed`: Must call `e.stopPropagation()` to prevent parent `ha-dialog` from closing
- No `ha-list-item` children — the component renders its own dropdown items internally

### `ha-dialog` (HA 2026.3.0+)

Home Assistant 2026.3.0 rewrote `ha-dialog` from `mwc-dialog` to webawesome. **Slot-based action buttons and mwc-specific attributes no longer work.**

**Breaking changes**:

- `slot="primaryAction"` / `slot="secondaryAction"` — no longer rendered. Place action buttons inside the dialog content instead (e.g., in an `.editor-footer` div).
- `scrimClickAction` / `escapeKeyAction` attributes — ignored. The `@closed` event handler is sufficient for cleanup.
- `dialogAction` attribute — ignored.
- `.heading` property — still works but may change in future versions.

### CSS Variable Migration (HA 2026.3.0+)

All `--mdc-*` (Material Design Components) CSS custom properties were removed when HA switched to webawesome. Use the following replacements:

| Old (`--mdc-*`)                     | New                          | Context                |
| ----------------------------------- | ---------------------------- | ---------------------- |
| `--mdc-dialog-max-width`            | `--ha-dialog-max-width`      | `ha-dialog`            |
| `--mdc-dialog-max-height`           | `--ha-dialog-max-height`     | `ha-dialog`            |
| `--mdc-icon-button-size`            | `--ha-icon-button-size`      | `ha-icon-button`       |
| `--mdc-icon-size` (in icon-button)  | `--ha-icon-button-icon-size` | `ha-icon-button`       |
| `--mdc-icon-size` (standalone icon) | `--ha-icon-display-size`     | `ha-icon`              |
| `--mdc-theme-primary` (button)      | `--ha-button-color`          | `ha-button`            |
| `--mdc-theme-primary` (progress)    | `color`                      | `ha-circular-progress` |
| `--mdc-typography-button-font-size` | `font-size`                  | Direct CSS             |

### `ha-textfield` → `ha-input` (HA 2026.4+)

`ha-textfield` (Material Design based) is deprecated in HA 2026.4 and **will be removed in 2026.5**. Use `ha-input` instead.

| Old                      | New               |
| ------------------------ | ----------------- |
| `ha-textfield`           | `ha-input`        |
| `ha-outlined-text-field` | `ha-input`        |
| `search-input`           | `ha-input-search` |
| `ha-multi-textfield`     | `ha-input-multi`  |

### Quick Command Reference

```bash
# Development
npm run validate           # Full validation (before committing)
npm test                   # Run all tests
npm run build              # Build all packages
npm run lint:fix           # Auto-fix lint issues
npm run format             # Auto-format code

# Deployment
npm run deploy:all         # Deploy all packages (cards + config panel)
npm run deploy:config-panel # Deploy config panel to integration
npm run release:climate    # Full release for climate card
npm run release:schedule   # Full release for schedule card
npm run release:config-panel # Build, validate, deploy config panel
npm run version:climate -- minor  # Bump climate card version
```
