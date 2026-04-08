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

### Setup

```bash
npm install
```

### Commands

```bash
npm run build         # Build all packages
npm run build:core    # Build only schedule-core
npm run build:ui      # Build only schedule-ui
npm test              # Run all tests
npm run lint          # ESLint
npm run lint:fix      # ESLint with auto-fix
npm run format        # Prettier formatting
npm run type-check    # TypeScript validation
npm run validate      # All checks: lint + type-check + test + build
```

### Watch Mode

```bash
npm run watch -w packages/climate-schedule-card
npm run watch -w packages/schedule-card
npm run watch -w packages/status-card
npm run watch -w packages/config-panel
```

### Pre-commit Hooks

Husky + lint-staged automatically run on commit:

- ESLint with auto-fix on `.ts` files
- Prettier formatting on `.ts`, `.js`, `.json`, `.md` files

## Release & Deployment

All frontend packages are deployed to the integration's `frontend/` directory. The integration registers them on startup.

### Repository Architecture

```
homematicip-local-frontend (this repo)      ← Development & build
        │
        │  npm run deploy:integration
        │
        ▼
homematicip_local/custom_components/homematicip_local/frontend/
├── homematic-config.js                     ← Config panel
├── homematicip-local-climate-schedule-card.js  ← Climate card
├── homematicip-local-schedule-card.js      ← Schedule card
└── homematicip-local-status-card.js        ← Status cards
```

### Deployment Commands

| Command                           | Description                                |
| --------------------------------- | ------------------------------------------ |
| `npm run deploy:integration`      | Deploy all integration-bundled packages    |
| `npm run deploy:climate`          | Deploy climate schedule card               |
| `npm run deploy:schedule`         | Deploy schedule card                       |
| `npm run deploy:config-panel`     | Deploy config panel                        |
| `npm run deploy:status-card`      | Deploy status cards                        |
| `npm run deploy:all`              | Deploy all packages                        |
| `npm run release:climate`         | Full release: validate, build, deploy, tag |
| `npm run release:schedule`        | Full release for schedule card             |
| `npm run release:config-panel`    | Full release for config panel              |
| `npm run release:status-card`     | Full release for status cards              |
| `npm run release:<pkg>:dry`       | Dry-run release (no changes)               |
| `npm run version:<pkg> -- <bump>` | Bump version (patch/minor/major)           |

### Release Workflow

```bash
# 1. Bump version
npm run version:climate -- patch

# 2. Commit version bump
git add -A && git commit -m "Bump climate-schedule-card to 0.10.1"

# 3. Run full release (validate → build → deploy → tag)
npm run release:climate

# 4. Push monorepo tag
git push origin climate-v0.10.1
```

### CI/CD Workflows

| Workflow      | Trigger                                                              | Purpose                                       |
| ------------- | -------------------------------------------------------------------- | --------------------------------------------- |
| `ci.yml`      | Push/PR to `main`/`devel`                                            | Lint, type-check, test, build                 |
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
