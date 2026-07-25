# HomematicIP Local Frontend

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A monorepo containing shared frontend libraries, custom Lovelace cards, and the configuration panel for the [HomematicIP Local](https://github.com/SukramJ/homematicip_local) Home Assistant integration.

All cards and the config panel are delivered directly through the integration — no separate HACS installation required.

## Packages

| Package                                                         | Version | Description                                                                      |
| --------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| [`@hmip/schedule-core`](packages/schedule-core)                 | 1.0.0   | Shared schedule logic, types, adapters, localization, and utilities              |
| [`@hmip/schedule-ui`](packages/schedule-ui)                     | 1.0.0   | Shared Lit web components for schedule editing                                   |
| [`@hmip/panel-api`](packages/panel-api)                         | 1.0.0   | Shared WebSocket API client (types and functions for all endpoints)              |
| [`@hmip/climate-schedule-card`](packages/climate-schedule-card) | 0.10.0  | Lovelace card for thermostat schedule editing                                    |
| [`@hmip/schedule-card`](packages/schedule-card)                 | 0.1.0   | Lovelace card for device schedule editing (switches, lights, covers, valves)     |
| [`@hmip/status-card`](packages/status-card)                     | 0.1.0   | Lovelace cards for system health, device status, and messages                    |
| [`@hmip/config-panel`](packages/config-panel)                   | 1.0.0   | Integration config panel for device configuration, paramset editing, and linking |

## Cards

All cards are automatically available once the HomematicIP Local integration is loaded. They appear in the Lovelace card picker.

### Climate Schedule Card

Visual week schedule display with color-coded temperature blocks for thermostat schedules.

- Profile switching with active profile indicator
- Inline editor for time slots and temperatures
- Copy/paste and import/export schedules
- Undo/redo support

```yaml
type: custom:homematicip-local-climate-schedule-card
entities:
  - entity: climate.living_room
    name: "Living Room"
    profile_names:
      P1: "Comfort"
      P2: "Eco"
  - climate.bedroom
```

| Option                  | Type              | Default        | Description                              |
| ----------------------- | ----------------- | -------------- | ---------------------------------------- |
| `entity`                | string            | —              | Single climate entity (legacy)           |
| `entities`              | string[] or array | —              | List of climate entities                 |
| `name`                  | string            | Entity name    | Custom card title                        |
| `profile`               | string            | Active profile | Force specific profile                   |
| `show_profile_selector` | boolean           | `true`         | Show profile dropdown                    |
| `editable`              | boolean           | `true`         | Enable editing                           |
| `show_temperature`      | boolean           | `true`         | Show temperature values on blocks        |
| `show_gradient`         | boolean           | `false`        | Show color gradient between temperatures |
| `temperature_unit`      | string            | `°C`           | Temperature unit                         |
| `hour_format`           | string            | `24`           | `12` or `24` hour format                 |
| `language`              | string            | Auto-detect    | Force language: `en` or `de`             |

### Schedule Card

Event-based device schedules for switches, lights, covers, and valves.

- Fixed time and astronomical triggers (sunrise/sunset with offsets)
- Category-specific UI (on/off, dimming, position + slat)
- Duration and ramp time configuration

```yaml
type: custom:homematicip-local-schedule-card
entities:
  - sensor.living_room_schedule
  - sensor.bedroom_schedule
editable: true
hour_format: "24"
```

| Option        | Type     | Default     | Description                  |
| ------------- | -------- | ----------- | ---------------------------- |
| `entity`      | string   | —           | Single entity ID             |
| `entities`    | string[] | —           | List of entity IDs           |
| `name`        | string   | Entity name | Custom card title            |
| `editable`    | boolean  | `true`      | Enable editing               |
| `hour_format` | string   | `24`        | `12` or `24` hour format     |
| `language`    | string   | Auto-detect | Force language: `en` or `de` |

### Status Cards

Three monitoring cards bundled in one package:

**System Health Card** (`homematicip-system-health-card`)

- Health score, device statistics (total/unreachable/firmware updates)
- Duty Cycle and Carrier Sense levels per radio module/HAP/LAN gateway
- Optional incidents list with adaptive polling

**Device Status Card** (`homematicip-device-status-card`)

- Device status overview with problem highlighting
- Filtering: all, problems, unreachable, low battery, config pending

**Messages Card** (`homematicip-messages-card`)

- Service messages and alarm messages with acknowledge buttons

All status cards require an `entry_id` (selectable via dropdown in the editor).

## Installation

Cards are automatically registered when the HomematicIP Local integration starts. No manual resource configuration needed.

**Migrating from standalone HACS cards:** If you previously installed the climate or schedule card via HACS, the integration-bundled version detects this and shows a console warning. Remove the HACS card resource at your convenience — both versions coexist without conflicts.

## Requirements

- Home Assistant 2026.3.0 or newer
- [HomematicIP Local](https://github.com/SukramJ/homematicip_local) integration

## Development

### Prerequisites

- Node.js 20.x or 22.x
- npm
- GNU Make

### Setup

```bash
make install-dev   # Install dependencies (updates package-lock.json if needed)
make install       # Reproducible install from package-lock.json (CI-style)
```

Every target installs dependencies on demand, so `make build` on a fresh clone just works.

The `Makefile` is a convenience wrapper around the npm scripts in `package.json` — those remain the single source of truth. Make adds discoverability, the build dependency ordering (`schedule-core` → `schedule-ui` → cards/panel), and the on-demand install. Run `make` or `make help` for the full target list.

### Commands

```bash
make build              # Build all packages
make build-core         # Build only schedule-core
make build-ui           # Build only schedule-ui (builds schedule-core first)
make build-libs         # Build all libraries (core, ui, panel-api)
make test               # Run all tests
make test-watch         # schedule-core tests in watch mode
make test-coverage      # schedule-core tests with coverage report
make lint               # ESLint
make lint-fix           # ESLint with auto-fix
make format             # Prettier formatting
make format-check       # Check formatting without writing
make type-check         # TypeScript validation
make validate           # All checks: lint + type-check + test + build
make ci                 # What GitHub Actions runs (clean install first)
make versions           # Show the current version of every package
make clean              # Remove all dist/ directories and tsbuildinfo files
make distclean          # Also remove node_modules
make hooks              # (Re-)install the husky git hooks
```

Single packages can be bundled individually with `make build-config-panel`, `make build-status-card`, `make build-climate-card`, and `make build-schedule-card`.

### Watch Mode

```bash
make watch-config-panel
make watch-status-card
make watch-climate-card
make watch-schedule-card
```

### Pre-commit Hooks

Husky + lint-staged automatically run on commit:

- ESLint with auto-fix on `.ts` files
- Prettier formatting on `.ts`, `.js`, `.json`, `.md` files

Parts of HomematicIP Local Frontend are developed with agentic AI assistance, primarily [Claude Code](https://www.anthropic.com/claude-code). Submitted issues are also triaged and analyzed with agentic help. Every change is still reviewed by a human maintainer and must pass the project's test suite before it is merged — AI accelerates the work, it does not replace the review gate.

## Release & Deployment

All frontend packages are deployed to the integration's `frontend/` directory. The integration registers them on startup.

### Repository Architecture

```
homematicip-local-frontend (this repo)      ← Development & build
        │
        │  make deploy
        │
        ▼
homematicip_local/custom_components/homematicip_local/frontend/
├── homematic-config.js               ← Config panel
└── homematicip-local-all-cards.js    ← All cards (climate, schedule, status)
```

### Deployment Commands

Deploy targets build their artifact first, so a separate `make build` is not needed.

| Command                       | Description                                                 |
| ----------------------------- | ----------------------------------------------------------- |
| `make deploy`                 | Deploy config panel and all-cards bundle to the integration |
| `make deploy-config-panel`    | Deploy config panel only                                    |
| `make deploy-status-card`     | Deploy the all-cards bundle only                            |
| `make release-config-panel`   | Full release: validate, build, deploy, tag                  |
| `make release-status-card`    | Full release for the all-cards bundle                       |
| `make release-climate`        | Full release for the climate schedule card                  |
| `make release-schedule`       | Full release for the schedule card                          |
| `make release-<pkg>-dry`      | Dry-run release (no changes)                                |
| `make version-<pkg> BUMP=<b>` | Bump version (`BUMP=patch\|minor\|major`, default patch)    |

The climate and schedule cards no longer have their own deploy targets — both ship inside the combined all-cards bundle, which `make deploy` and `make deploy-status-card` cover.

### Release Workflow

```bash
# 1. Bump version
make version-climate BUMP=patch

# 2. Commit version bump
git add -A && git commit -m "Bump climate-schedule-card to 0.10.1"

# 3. Preview, then run the full release (validate → build → deploy → tag)
make release-climate-dry
make release-climate

# 4. Push monorepo tag
git push origin climate-v0.10.1
```

### CI/CD Workflows

| Workflow      | Trigger                                                              | Purpose                                       |
| ------------- | -------------------------------------------------------------------- | --------------------------------------------- |
| `ci.yml`      | Push/PR to `main`                                                    | Lint, type-check, test, build                 |
| `release.yml` | Tag `climate-v*`, `schedule-v*`, `config-panel-v*`, `status-card-v*` | Build and create GitHub release with artifact |

## Project Structure

```
homematicip-local-frontend/
├── packages/
│   ├── schedule-core/              # Shared logic, types, adapters, i18n
│   ├── schedule-ui/                # Shared Lit components for schedule editing
│   ├── panel-api/                  # Shared WebSocket API client
│   ├── climate-schedule-card/      # Climate schedule Lovelace card
│   ├── schedule-card/              # Device schedule Lovelace card
│   ├── status-card/                # System health, device status, messages cards
│   └── config-panel/               # Integration config panel
├── scripts/
│   ├── deploy.sh                   # Deploy built artifacts to integration
│   └── release.sh                  # Full release workflow
├── docs/
│   └── architecture.md             # Architecture documentation
├── .github/workflows/
│   ├── ci.yml                      # CI pipeline
│   └── release.yml                 # Release pipeline
├── Makefile                        # Development entry point (wraps the npm scripts)
├── tsconfig.base.json              # Shared TypeScript config
├── eslint.config.mjs               # ESLint 9 flat config
├── .prettierrc                     # Prettier config
└── jest.config.js                  # Root Jest config
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Related Projects

- [HomematicIP Local Integration](https://github.com/SukramJ/homematicip_local) - The Home Assistant integration
- [aiohomematic](https://github.com/SukramJ/aiohomematic) - Python library for Homematic device communication

## Support

For issues and questions, please use the [GitHub Issues](https://github.com/SukramJ/homematicip-local-frontend/issues) page.
