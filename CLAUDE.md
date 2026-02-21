# CLAUDE.md - AI Development Guide

This document provides comprehensive context for AI assistants working with the HomematicIP Local Frontend monorepo.

## Project Overview

**Name**: HomematicIP Local Frontend
**Type**: npm workspaces monorepo (shared library + custom Lovelace cards)
**Primary Language**: TypeScript 5.9+
**Framework**: Lit 3.0 (Web Components)
**Build System**: TypeScript compiler (schedule-core) + Rollup (cards)
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
│   ├── climate-schedule-card/              # @hmip/climate-schedule-card (v0.10.0)
│   │   ├── src/
│   │   │   ├── card.ts                     # Main Lit component
│   │   │   ├── editor.ts                   # Visual config editor
│   │   │   ├── types.ts                    # Card config types (re-exports from core)
│   │   │   └── localization.ts             # Card-specific UI translations
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── rollup.config.mjs
│   ├── schedule-card/                      # @hmip/schedule-card (v0.1.0)
│   │   ├── src/
│   │   │   ├── card.ts                     # Main Lit component
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
climate-schedule-card ──→ schedule-core ←── schedule-card
         │                     │ ▲               │
         └──→ lit              │ └── config-panel
                               └──→ lit    │
                                           └──→ lit
```

All card and panel packages depend on `@hmip/schedule-core` (workspace dependency). The core library is built first (`tsc`), and consumer packages bundle everything via Rollup.

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

### @hmip/climate-schedule-card

Lovelace card for thermostat schedule editing. Bundled with Rollup into a single ES module.

**Custom element**: `homematicip-local-climate-schedule-card`
**Output**: `dist/homematicip-local-climate-schedule-card.js`

### @hmip/schedule-card

Lovelace card for device schedule editing (switches, lights, covers, valves). Bundled with Rollup into a single ES module.

**Custom element**: `homematicip-local-schedule-card`
**Output**: `dist/homematicip-local-schedule-card.js`

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

All packages extend this base. Card packages add `moduleResolution: "bundler"` and reference `schedule-core` via TypeScript project references.

## Build Process

### schedule-core

Compiled with `tsc` to `dist/` with type declarations. Must be built before card packages.

### Card packages

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
npm run build             # Build all packages (core first, then cards)
npm run build:core        # Build schedule-core only
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

### Modifying a Card

1. Edit files in `packages/<card>/src/`
2. Use `npm run watch -w packages/<card>` for live rebuilding
3. Import shared logic from `@hmip/schedule-core`
4. Run `npm run validate` before committing

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
- `active_profile` - Currently active profile name
- `available_profiles` - List of profile names
- `preset_mode` - Current preset (maps to profile)
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

## Notes for AI Assistants

1. **Always run `npm run validate`** before suggesting code changes
2. **Build order matters**: schedule-core must build before card packages
3. **Tests are in schedule-core only** - card packages have no tests yet
4. **Import from `@hmip/schedule-core`** in card packages, never relative paths to core source
5. **Both EN and DE translations required** for all user-facing strings
6. **Two schedule models exist**: climate (time-slot based) and device (event-based) - don't confuse them
7. **Two adapter types exist**: service (HACS cards) and WebSocket (config panel)
8. **Rollup bundles everything** - no external dependencies in card output files
9. **Standalone repos and integration frontend are deployment-only** - never edit source code there, always work in this monorepo
10. **Use `npm run release:<card>:dry`** to preview a release before executing it

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
