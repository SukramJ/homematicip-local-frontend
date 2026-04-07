# Changelog

## Unreleased

### Non-Admin Permissions (Phase 2 — Frontend)

- Added granular permission support for non-admin users (requires backend Phase 1 in homematicip_local)
- **schedule-core**: Added `PermissionScope` and `UserPermissions` types; added `insufficientPermissions` error translation (en/de)
- **HACS Cards** (climate-schedule-card, schedule-card):
  - Removed frontend admin check (`hass.user.is_admin`) from `_isEditable` — backend now enforces permissions
  - Added Unauthorized error handling: service call rejections display a localized "insufficient permissions" message instead of raw error
- **Config Panel**:
  - Added `getUserPermissions()` API function to query effective user permissions via WebSocket
  - Panel loads permissions on startup and entry switch; falls back to admin if endpoint unavailable (backward compatible)
  - Tab visibility: Integration and OpenCCU tabs hidden for users without `system_admin` scope
  - Views receive `editable` property based on permission scopes:
    - `device-schedule`: `schedule_edit` — hides Import/Reload buttons and disables editing in read-only mode
    - `channel-config`: `device_config` — hides action bar (Save/Discard/Undo/Redo/Reset) in read-only mode
    - `device-links`: `device_links` — hides Add Link button and Configure/Delete actions in read-only mode
    - `link-config`: `device_links` — hides Save/Discard buttons in read-only mode
    - `change-history`: `system_admin` — hides Clear History button in read-only mode
  - Added permission-related translations (en/de) for read-only notices and scope requirements
- Read operations (list devices, view schedules, view paramsets) remain accessible to all authenticated users

### Device Schedule List

- Redesigned device schedule list from grid table to card-based two-line layout:
  - **Line 1**: Full condition description (e.g. "Sunrise +20min", "Earliest: Sunset -20min or 06:30") with edit/delete actions
  - **Line 2**: Weekday badges, level value, and duration
  - Previously, the "Time" column showed "00:00" for astro-based conditions, which was not meaningful
- Added `formatConditionSummary()` utility in `@hmip/schedule-core` that builds localized condition descriptions from entry fields (9 new tests)
- Extended `DeviceListTranslations` with `conditionLabels`, `conditionSummaryLabels`, and `condition` header — updated both schedule-card and config-panel consumers
- Added "or"/"oder" translation key to schedule-card localization and config-panel translations
- Localized binary level display: switches now show "Ein"/"Aus" (DE) instead of hardcoded "On"/"Off" — added optional `binaryLabels` parameter to `formatLevel()` and `levelOn`/`levelOff` to `DeviceListTranslations`
- Improved combined astro condition descriptions: "fixed_if_before_astro" and "fixed_if_after_astro" (and their astro-first counterparts) are now distinguishable — e.g. "16:00 wenn vor Sonnenuntergang +10min" vs "16:00 wenn nach Sonnenuntergang +10min" instead of the previous identical "16:00 / Sonnenuntergang +10min"
- Added `ifBefore`/`ifAfter` to `ConditionSummaryLabels` interface with translations in schedule-card (en/de) and config-panel (en/de)

### Config Panel

- Removed frontend message enrichment for service and alarm messages — `display_name`, `message_code`, and `msg_type_name` are now provided by aiohomematic 2026.3.20; removed `_messageNameLabel()` and `_serviceMessageTypeLabel()` helper methods and 19 `msg_name_*`/`msg_type_*` translation keys per language

- Added CCU inbox, service messages, and alarm messages to OpenCCU dashboard:
  - **Inbox**: lists new devices not yet accepted, with "Accept" button per device
  - **Service Messages**: detailed list with device name, address, message type (Generic/Sticky/Config Pending), timestamp, counter, and "Acknowledge" button for quittable messages
  - **Alarm Messages**: detailed list with name, description, last trigger, timestamp, counter, and "Acknowledge" button
  - All three cards are always visible on the Messages sub-tab (show "No messages" when empty)
  - Added `panel-api.ts` functions: `getInboxDevices`, `acceptInboxDevice`, `getServiceMessages`, `acknowledgeServiceMessage`, `getAlarmMessages`, `acknowledgeAlarmMessage`
  - Requires new backend WebSocket endpoints in homematicip_local and `acknowledge_message` Rega script in aiohomematic
- OpenCCU dashboard: added sub-tab navigation (General, Messages, Signal Quality, Firmware) to organize the growing number of dashboard cards
  - Messages tab shows a badge with the total count of inbox devices + service messages + alarm messages
- Added Easymode support for paramset editor:
  - **Conditional visibility** (`visible_when`): parameters can be shown/hidden based on other parameter values, enabling context-dependent forms
  - **Preset dropdowns** (`presets`): parameters with predefined values render as a dropdown instead of raw input; optional "Custom..." entry reveals a number input for manual values
  - **Subset groups** (`subset_groups`): groups of related parameters are collapsed into a single dropdown that sets all member values at once (e.g. selecting a mode preset applies multiple parameter values)
- Added cross-validation translations (en/de) for min/max, level range, and threshold constraints
- Device detail: RSSI Peer is now always displayed (shows "—" when unavailable instead of being hidden)
- Device detail: Duty Cycle displayed as Yes/No instead of raw numeric value, label renamed to "DC Limit"/"DC-Limit"
- Device detail: Reachability displayed as Yes/No instead of "Reachable"/"Unreachable"
- Added tabbed navigation: panel now has three top-level tabs — Devices, Integration, and OpenCCU — with URL hash routing (`tab=` parameter)
- Added Integration dashboard (`hm-integration-dashboard`): system health, device statistics, command throttle status, incidents list with clear action, and cache management
- Added OpenCCU dashboard (`hm-ccu-dashboard`): system information, hub/service/alarm messages, install mode activation, signal quality overview, firmware overview with refresh, and CCU backup creation
- Added `panel-api.ts` — dedicated WebSocket API client for dashboard data (system health, throttle stats, incidents, device statistics, system information, hub data, install mode, signal quality, firmware overview, backup)
- Added device icons: device list, device detail, and channel config views now display device images from the CCU via proxy endpoint (`/api/homematicip_local/<entry_id>/device_icon/<filename>`). Graceful fallback when icon is unavailable.
- Added parameter help text support: `FormParameter.description` field renders Markdown-formatted help text below each parameter using `<ha-markdown>` (requires aiohomematic-config 2026.2.11+)
- MASTER paramset: Unit/Value parameter pairs (e.g. `*_UNIT` + `*_VALUE`) are now displayed as a single preset dropdown instead of two separate rows, matching the CCU behavior
- 13 standard Homematic time presets (100ms–15 minutes) with localized labels (EN/DE)
- "Custom value" / "Wert eingeben" option reveals the original unit and value fields for manual entry
- Automatic detection: if current values match a preset, the preset is shown; otherwise custom mode with detail fields
- Dropdown and radio group options now use translated labels from the backend's `option_labels` field (e.g. "Off Delay" instead of raw "OFF_DELAY")

### HA 2026.3.0+ / 2026.4.0+ Compatibility

- Migrated all UI elements to Home Assistant built-in components (`ha-slider`, `ha-switch`, `ha-select`, `ha-radio`, `ha-button`, `ha-icon-button`)
- Fixed `ha-dialog` action buttons not rendering — `slot="primaryAction"` / `slot="secondaryAction"` no longer work after HA rewrote `ha-dialog` from `mwc-dialog` to webawesome. Moved Save/Cancel buttons into the dialog content for both `<hmip-schedule-editor>` (climate) and `<hmip-device-schedule-editor>` (device)
- Removed deprecated `scrimClickAction` and `escapeKeyAction` attributes from all `ha-dialog` usages — these mwc-dialog attributes are ignored by the new webawesome implementation
- Replaced all `--mdc-*` CSS custom properties with HA-native equivalents across all packages (34 occurrences in 15 files):
  - `--mdc-dialog-max-width/height` → `--ha-dialog-max-width/height`
  - `--mdc-icon-button-size` → `--ha-icon-button-size`
  - `--mdc-icon-size` → `--ha-icon-button-icon-size` (icon buttons) / `--ha-icon-display-size` (standalone icons)
  - `--mdc-theme-primary` → `--ha-button-color` (buttons) / `color` (progress indicators)
  - `--mdc-typography-button-font-size` → `font-size`
- Migrated `ha-textfield` to `ha-input` in CCU dashboard filter bars (Signal Quality + Firmware tables) — `ha-textfield` is deprecated in HA 2026.4 and will be removed in 2026.5

### Bug Fixes

- Fixed install mode countdown not updating after activation — added 1-second polling that automatically fetches the current status and stops when the countdown expires or the component is removed
- Fixed install mode showing activate button for interfaces not configured in the integration (e.g. BidCos-RF) — added `available` flag to the `get_install_mode_status` WebSocket API response; the panel now only renders interfaces that are actually configured (requires homematicip_local backend update)
- Refactored install mode card rendering to eliminate duplicated HmIP/BidCos template code
- Fixed Integration dashboard showing stale system status ("Initializing" / 1%) even when the integration was fully connected — the `CentralHealth.central_state` was not synchronized after state machine transitions. Added `sync_central_state()` to update the cached health state after each state evaluation. (requires aiohomematic update)
- Fixed Integration dashboard health score displaying 1% instead of 85% — the backend returns a 0.0–1.0 float but the frontend displayed it without converting to percent
- Aligned Integration dashboard health score calculation with the HA sensor (`sensor.*_systemzustand`) — now uses binary client availability (healthy/total) instead of the weighted activity-based score. (requires aiohomematic update)
- Added auto-polling to Integration dashboard — refreshes every 5s during initialization, every 30s once stable
- Added auto-polling to OpenCCU dashboard — refreshes all data (system info, signal quality, firmware, install mode) every 30s; loading spinner only shown on initial load
- OpenCCU dashboard: all table columns are now sortable (Model, Interface, Reachable, Battery in Signal Quality; Model, Available FW in Firmware Overview) with a generic comparator supporting string, number, boolean, and null values
- OpenCCU dashboard: added filter bars for Signal Quality and Firmware tables (shown when >10 devices) — free-text search across device name and model, plus dropdown filters for Interface, Reachable, Battery (Signal Quality) and Status (Firmware Overview), with result counter
- OpenCCU dashboard: removed Signal column from Signal Quality table (redundant with RSSI)
- OpenCCU dashboard: removed Hub Messages section (data not reliably matching CCU WebUI)
- OpenCCU dashboard: removed "Backup available" badge from System Information
- OpenCCU dashboard: moved Actions card directly below System Information for better discoverability
- Fixed `ha-select` compatibility with Home Assistant 2026.3.0+ — HA rewrote `ha-select` to use `ha-dropdown` (webawesome) internally, replacing the old `mwc-select`. `ha-list-item` children are no longer recognized. Migrated all `ha-select` usages across all packages to use the `.options` property (array of `{ value, label }`) instead of slotted `ha-list-item` children, and `@selected` event with `e.detail.value`. Affected: config panel (device-schedule, device-list, link-config, form-parameter, config-form, form-time-selector), schedule-ui (device-schedule-editor), climate-schedule-card, and schedule-card.
- Removed non-functional "Active profile" button from config panel climate schedule view — the button called the wrong service. Profile activation now happens automatically when selecting a profile from the dropdown.
- Config panel profile dropdown now shows which profile is active on the device (e.g. "Profil 1 (Aktives Profil)") using the `device_active_profile_index` from the backend
- Fixed copy/paste schedule icons overflowing out of the weekday header box at narrow widths in the climate schedule grid — reduced icon button sizes at mobile breakpoints and added overflow constraints
- Fixed false dirty state when opening link config editor without making changes — `ha-select` and `ha-slider` fire events on initial render, which were incorrectly treated as user changes. Added guards in dropdown, slider, time preset selector, and profile selector to suppress no-op events.
- Fixed UTF-8 link names showing as mojibake (e.g. "KÃ¼chenblock" instead of "Küchenblock") — the CCU stores link names as UTF-8 but the XML-RPC transport decodes them as ISO-8859-1. Added `fix_xml_rpc_encoding()` in aiohomematic to re-decode NAME and DESCRIPTION fields correctly. (requires aiohomematic update)
- Fixed `ha-slider` event handling across all packages — HA 2026.3.0 rewrote `ha-slider` from `mwc-slider` to webawesome, which fires native `change` events instead of `value-changed` CustomEvents. Migrated config panel (`form-parameter.ts`) and schedule-ui (`device-schedule-editor.ts` level/slat sliders) to use `@change` with `e.target.value`
- Improved mobile layout across all packages:
  - **Device schedule editor**: dialog content now scrollable with height constraints (`--ha-dialog-max-height`), sticky footer keeps Save/Cancel buttons always visible on mobile
  - **Climate schedule grid**: increased copy/paste icon button touch targets to 44px minimum on mobile (was 20–24px)
  - **Device schedule list**: widened action/time columns at 480px breakpoint, icon buttons enlarged to 44px touch targets
  - **Config panel form**: added mobile breakpoints for config-form (reduced indentation for nested fields, full-width time inputs) and form-parameter (full-width number/text inputs, 44px radio items)
  - **iOS zoom prevention**: all form inputs use `font-size: 16px` on mobile to prevent Safari auto-zoom
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
