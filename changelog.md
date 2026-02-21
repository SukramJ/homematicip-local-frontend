# Changelog

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
