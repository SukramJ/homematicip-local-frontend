# Changelog

## Unreleased

### Config Panel

- Added device icons: device list, device detail, and channel config views now display device images from the CCU via proxy endpoint (`/api/homematicip_local/<entry_id>/device_icon/<filename>`). Graceful fallback when icon is unavailable.
- Added parameter help text support: `FormParameter.description` field renders Markdown-formatted help text below each parameter using `<ha-markdown>` (requires aiohomematic-config 2026.2.11+)
- MASTER paramset: Unit/Value parameter pairs (e.g. `*_UNIT` + `*_VALUE`) are now displayed as a single preset dropdown instead of two separate rows, matching the CCU behavior
- 13 standard Homematic time presets (100ms–15 minutes) with localized labels (EN/DE)
- "Custom value" / "Wert eingeben" option reveals the original unit and value fields for manual entry
- Automatic detection: if current values match a preset, the preset is shown; otherwise custom mode with detail fields
- Dropdown and radio group options now use translated labels from the backend's `option_labels` field (e.g. "Off Delay" instead of raw "OFF_DELAY")

### UI Migration

- Migrated all UI elements to Home Assistant built-in components (`ha-slider`, `ha-switch`, `ha-select`, `ha-radio`, `ha-button`, `ha-icon-button`)

### Bug Fixes

- Fixed `ha-slider` event handling in config panel paramset editor and device schedule editor — `ha-slider` fires `value-changed` instead of native `change`, causing slider changes not to register and the save button to remain disabled
- Fixed `ha-select` event leaking in paramset editor — `value-changed` events from `ha-select` leaked through the shadow DOM hierarchy, corrupting the pending changes state with undefined parameter keys
- Fixed `ha-select` dropdown closing the device schedule editor dialog — `ha-select` fires an internal `closed` event that bubbled up to the outer `ha-dialog`
- Fixed editor dialog closing on save when validation errors exist — removed `dialogAction="close"` from save button
- Fixed device schedule entries without target channels not being shown in the schedule list
- Target channels are now optional — entries without channels are displayed dimmed (opacity 0.5)
- Removed frontend `target_channels` validation (CCU allows `TARGET_CHANNELS = 0`)
- Config panel auto-selects first device in schedule view when no matching device is found

### New Package

- **@hmip/schedule-ui** v1.0.0 — Shared Lit web components for schedule editing, used by both the HACS cards and the config panel

### Climate Schedule Components

- Extracted `<hmip-schedule-grid>` (visual 7-day timeline with color-coded temperature blocks) and `<hmip-schedule-editor>` (edit dialog with weekday tabs, undo/redo, slot editing) from `climate-schedule-card` into `@hmip/schedule-ui`
- Refactored `@hmip/climate-schedule-card` to use shared components (~3170 LOC → ~770 LOC)
- Integrated shared climate schedule components into `@hmip/config-panel`, replacing the basic form-based editor with the same visual grid and editor dialog used by the card

### Device Schedule Components

- Extracted `<hmip-device-schedule-list>` (weekday-grouped event list with edit/delete/add) and `<hmip-device-schedule-editor>` (modal form editor for time, condition, weekdays, level, duration, ramp time, channels) from `schedule-card` into `@hmip/schedule-ui`
- Refactored `@hmip/schedule-card` to use shared components (~1724 LOC → ~530 LOC)
- Integrated shared device schedule components into `@hmip/config-panel`, replacing the basic read-only table with the full interactive list and editor

### Translations

- Added 30+ climate schedule editor keys to config panel translations (en/de)
- Added 18 device schedule editor keys to config panel translations (en/de), including condition labels, astro fields, level on/off, slat position, ramp time

### Infrastructure

- Added `packages/schedule-ui` to workspace configuration
- Added `build:ui` script to root package.json
- Updated TypeScript project references and path mappings for all consumer packages

## 1.0.0 — 2026-02-21

Initial release of the HomematicIP Local Frontend monorepo, consolidating all frontend packages into a single development environment.

### Packages

- **@hmip/schedule-core** v1.0.0 — Shared schedule logic, types, adapters, localization, and utilities
- **@hmip/climate-schedule-card** v0.10.0 — Lovelace card for thermostat schedule editing
- **@hmip/schedule-card** v0.1.0 — Lovelace card for device schedule editing (switches, lights, covers, valves)
- **@hmip/config-panel** v1.0.0 — Integration config panel for device configuration, paramset editing, and linking

### Highlights

- Monorepo architecture with npm workspaces
- Shared `schedule-core` library with full test coverage (9 suites, 187 tests)
- Two schedule adapters: Service (HACS cards) and WebSocket (config panel)
- Localization support for English and German
- Automated deploy and release scripts for all packages
- CI pipeline with lint, type-check, test, and build (Node.js 20.x + 22.x)
- Config panel migrated from standalone `homematicip-local-config-panel` repo
