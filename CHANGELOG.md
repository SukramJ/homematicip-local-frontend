# Changelog

## Unreleased

### UX Review — Full CCU Parity & Mobile Optimization

Comprehensive UX review comparing the frontend against the CCU WebUI (occu), covering 57 items across 8 priority levels — all resolved.

#### Critical UX Fixes (P1)

- **Responsive schedule editor**: Replaced hardcoded grid column widths (`100px 100px 90px`) with `minmax()` for flexible layouts on small screens
- **Device schedule editor dialog**: Changed fixed `500px` max-width to `min(500px, 95vw)` for small smartphones
- **Parameter controls**: Increased desktop max-width from `200px` to `280px` for better slider/input usability
- **CCU dashboard tables → mobile card layout**: All tables (Signal Quality, Firmware, Inbox, Service Messages, Alarm Messages) now render as stacked card lists on mobile (<600px) using CSS `display: block` with `data-label` attributes
- **Filter inputs responsive**: `min-width: min(200px, 100%)`, filter bars stack vertically on mobile, sub-tabs scrollable
- **Device list search**: Migrated from custom `<input>` to `<ha-input>` for HA design consistency
- **Inline alerts instead of `alert()`**: All `alert()` calls in both schedule cards (15+ locations) replaced with dismissable `<ha-alert>` inline components
- **Landscape layout**: Schedule editor `max-height` changed from `200px` to `calc(100vh - 200px)` for usable landscape editing

#### CCU Feature Parity (P2)

- **Expert mode toggle**: `<ha-switch>` in channel config filters parameters with `hidden_by_default` flag; label and hint text localized (EN/DE)
- **Auto-detect button**: Parameters with `operations & 8` (SERVICE flag) show an `mdi:auto-fix` icon button that calls the new `determineParameter` WS endpoint; includes loading spinner and error toast
- **Link profile testing**: "Test profile" button in link config applies a profile's default values to the link paramset via new `testLinkProfile` WS endpoint
- **Firmware update trigger**: "Update" button in CCU dashboard firmware table with confirmation dialog, calls new `updateDeviceFirmware` WS endpoint
- **Device list sorting**: Pill-shaped sort buttons for Name/Address/Model with ascending/descending toggle
- **Link list sorting**: Sort by Sender/Receiver/Channel with direction toggle
- **Virtual channel badges**: Channels with number >= 50 marked with "Virtual"/"Virtuell" badge and dashed border
- **Device icons**: Already implemented in device detail header via `getDeviceIconUrl()`
- **Device-specific schedule mode hints**: Info alerts for HmIP-BSL, HmIP-RGBW, HmIP-DLD, HmIP-FLC, HmIP-DLP with localized descriptions
- **Party mode**: Evaluated — available via HA `climate.set_preset_mode(boost/away)`

#### HA Design Conformity (P3)

- **Validation errors as `<ha-alert>`**: Replaced red `<div>` error text with `<ha-alert alert-type="error">` in `form-parameter.ts` and `config-form.ts`
- **Toast notifications**: Channel config and link config already had success toasts; cards now use inline `<ha-alert>` for feedback
- **Skeleton loading**: Device list shows 5 pulsing placeholder cards during loading instead of plain text
- **Card header audit**: All views confirmed to use consistent `ha-card` + `.card-header` pattern
- **Icon button tooltips**: Added `.label` attributes to all icon buttons (Edit, Delete, Remove-Slot, Close) with new translation keys in `schedule-core`
- **Expand arrows**: Replaced ▼/▶ text characters with `mdi:chevron-down`/`mdi:chevron-right` HA icons in climate card editor
- **ha-textfield audit**: No deprecated `ha-textfield` usage found in source code

#### Mobile UX (P4)

- **Mobile day view**: Schedule grid shows single-day view on screens <600px with prev/next navigation and swipe gestures; full-width day column with larger touch targets (min-height 400px)
- **Sticky interface headers**: Device list group headers use `position: sticky` to remain visible during scrolling
- **Scrollable tab navigation**: Main tabs and CCU sub-tabs scrollable on mobile with hidden scrollbar
- **Swipe-to-delete**: Event cards in device schedule list and link cards in device links support left-swipe to reveal red delete action (80px threshold to show, 120px to trigger)
- **Bottom-sheet evaluation**: HA has no public `<ha-bottom-sheet>` component; `ha-dialog` with `100vw` on mobile is the standard pattern
- **Pull-to-refresh evaluation**: Auto-polling (5s/30s) + reload buttons already provide refresh functionality
- **Time inputs**: Already using `type="time"` for native mobile time pickers

#### Accessibility & Usability (P5)

- **aria-live regions**: Added `aria-live="polite"` to validation error containers in schedule editor, device schedule editor, and channel config
- **Disabled state contrast**: Changed `opacity: 0.3` to `opacity: 0.5` across 7 locations (undo/redo buttons, ha-button, remove-btn, ha-icon-button)
- **Keyboard navigation**: Schedule grid weekday columns now have `tabindex="0"`, `role="button"`, and Enter/Space handlers with focus-visible styling
- **Better error messages**: Replaced `String(err)` with `err.message` in device list; fixed wrong translation key in change history (`channel_config.save_failed` → `change_history.clear_failed`)
- **Profile change confirmation**: Climate card shows `confirm()` dialog when switching profiles with an open editor
- **Focus management**: Schedule editor and device schedule editor focus the first interactive element when opened
- **Copy-to-clipboard**: Device detail shows copy buttons for device address and firmware version with toast feedback

#### Visual Improvements (P6)

- **Empty states**: Device links shows `mdi:link-off` icon with message and action button; change history shows `mdi:history` icon with message
- **Consistent badge classes**: Shared `.badge` CSS classes (success/warning/error/info) in `styles.ts`; CCU dashboard badges updated to transparent rgba() backgrounds for dark mode compatibility
- **View transitions**: Added `@keyframes fadeIn` animation with `keyed()` directive for smooth view changes
- **Dark mode**: Audited all hardcoded colors; CCU dashboard badge colors updated to use CSS variables with transparent backgrounds
- **Consistent spacing**: Fixed `gap: 6px` → `8px` in shared mobile styles
- **Change history arrows**: Increased from 14px to 18px; old values styled with opacity 0.8 and smaller font, new values with success-color and bold weight

#### Code Quality & Performance (P8)

- **Session timeout indicator**: Channel config shows toast warning after 270s and auto-refreshes the server session
- **Change history error keys**: Fixed incorrect translation key; added `change_history.clear_failed`
- **Schema caching**: Change history already implements `Map<string, FormSchema>` cache with deduplication
- **Lazy loading**: CCU dashboard, integration dashboard, and change history views loaded via dynamic `import()` on first access

#### New Backend API Endpoints (in homematicip_local)

- `homematicip_local/config/determine_parameter` — Auto-detect parameter value via XML-RPC `Interface.determineParameter`
- `homematicip_local/ccu/update_firmware` — Trigger device firmware update via `device.update_firmware()`
- `homematicip_local/config/test_link_profile` — Apply link profile default values for testing

#### New Frontend API Functions (in @hmip/panel-api)

- `determineParameter(hass, entryId, interfaceId, channelAddress, parameterId)`
- `updateDeviceFirmware(hass, entryId, deviceAddress)`
- `testLinkProfile(hass, entryId, interfaceId, senderAddress, receiverAddress, profileId)`

#### Library Changes

- **aiohomematic**: Added `determine_parameter()` method to backend protocol, CCU backend (XML-RPC proxy call), and interface client
- **aiohomematic_config**: Added `operations: int` field to `FormParameter` model, populated from paramset description `OPERATIONS` bitfield

### Integration-Bundled Cards & Shared API Library

All frontend cards are now delivered directly through the `homematicip_local` integration — no standalone HACS installation required. Cards are automatically available once the integration is loaded.

- **New package: `@hmip/panel-api`** — Shared WebSocket API client library extracted from config panel, used by all cards and the config panel
  - Types and API functions for config, integration, and CCU endpoints
  - Eliminates code duplication between config panel and cards
  - Config panel refactored to re-export from `@hmip/panel-api`
- **New package: `@hmip/status-card`** — Three Lovelace cards bundled in one JS file (42 KB):
  - **`homematicip-system-health-card`**: System health score, device statistics (total/unreachable/firmware updates), Duty Cycle and Carrier Sense levels per radio module/HAP/LAN gateway, optional incidents list with adaptive polling
  - **`homematicip-device-status-card`**: Device status overview with filtering (all/problems/unreachable/low battery/config pending), problem highlighting, configurable max devices
  - **`homematicip-messages-card`**: Service messages and alarm messages with acknowledge buttons, configurable polling
  - All editors use a dropdown for `entry_id` selection (fetches available config entries via WebSocket)
- **Climate schedule card** (`homematicip-local-climate-schedule-card`):
  - Now delivered through integration instead of standalone HACS repo
  - Removed v1 API support — only v2 WebSocket API (`callWS`) is used; `callService` calls removed
  - Removed API version badge (v1/v2) from card header
  - Raw `callWS` calls replaced with `@hmip/panel-api` functions (`setClimateActiveProfile`, `setClimateScheduleWeekday`, `reloadDeviceConfig`)
  - Entity selector now only shows climate entities with `schedule_data` attribute
  - Migration guard: if standalone HACS version is already loaded, the integration version skips registration and shows a console warning with removal instructions
- **Schedule card** (`homematicip-local-schedule-card`):
  - Now delivered through integration instead of standalone HACS repo
  - Raw `callWS` calls replaced with `@hmip/panel-api` functions (`setDeviceSchedule`, `reloadDeviceConfig`)
  - Entity selector now only shows sensor entities with `schedule_type: "default"`
  - Removed `schedule_api_version` validation — only `schedule_type` is checked
  - Migration guard: same HACS conflict detection as climate card
- **`@hmip/schedule-core` cleanup**:
  - Removed `ServiceClimateScheduleAdapter` and `ServiceDeviceScheduleAdapter` (no consumers)
  - Removed `callService` from `HomeAssistant` interface
  - Simplified `isValidScheduleEntity()` — only checks `schedule_type === "default"`, no longer requires `schedule_api_version`
- **Integration (`homematicip_local`) changes**:
  - `panel.py`: Added Lovelace card registration via `add_extra_js_url()` with MD5-based cache busting
  - `__init__.py`: Cards registered on `async_setup_entry()`, unregistered on last entry unload
  - `frontend/` directory now contains 4 JS files: config panel + 3 card bundles (573 KB total)
- **Deployment**:
  - `deploy:integration` script deploys config-panel + all cards to integration `frontend/` directory
  - `release.sh` updated for all 4 packages with integration-targeted deployment
  - GitHub Actions release workflow extended with `config-panel-v*` and `status-card-v*` tag triggers

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

- Redesigned device schedule list from two-line to three-line card layout for better readability ([#28](https://github.com/SukramJ/homematicip-local-frontend/discussions/28)):
  - **Line 1**: Condition type label (e.g. "Fest wenn vor Astro", "Frühester") with edit/delete actions
  - **Line 2**: Parameter details (e.g. "16:00 / Sonnenuntergang +10min")
  - **Line 3**: Weekday badges, level value, and duration
  - Previously, complex conditions like "fixed_if_before_astro" and "fixed_if_after_astro" produced identical-looking single-line summaries — the split into label + details makes each condition type clearly distinguishable
- Added `formatConditionDisplay()` utility in `@hmip/schedule-core` that returns `{ label, details }` for structured two-line rendering (9 new tests); `formatConditionSummary()` retained for backward compatibility
- Originally redesigned from grid table to card-based two-line layout:
  - Previously, the "Time" column showed "00:00" for astro-based conditions, which was not meaningful
- Added `formatConditionSummary()` utility in `@hmip/schedule-core` that builds localized condition descriptions from entry fields (9 tests)
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
