# HomematicIP Local Frontend

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A monorepo containing shared frontend libraries and custom Lovelace cards for the [HomematicIP Local](https://github.com/SukramJ/homematicip_local) Home Assistant integration.

## Packages

| Package                                                         | Version | Description                                                                      |
| --------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| [`@hmip/schedule-core`](packages/schedule-core)                 | 1.0.0   | Shared schedule logic, types, adapters, localization, and utilities              |
| [`@hmip/climate-schedule-card`](packages/climate-schedule-card) | 0.10.0  | Lovelace card for thermostat schedule editing                                    |
| [`@hmip/schedule-card`](packages/schedule-card)                 | 0.1.0   | Lovelace card for device schedule editing (switches, lights, covers, valves)     |
| [`@hmip/config-panel`](packages/config-panel)                   | 1.0.0   | Integration config panel for device configuration, paramset editing, and linking |

## Climate Schedule Card

A custom Lovelace card for displaying and editing weekly thermostat schedules with color-coded temperature blocks.

### Features

- Visual week schedule display with color-coded temperature blocks
- Interactive editor for schedule time slots
- Profile switching with active profile indicator
- Copy/paste and import/export schedules
- Undo/redo support

### Configuration

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

## Schedule Card

A custom Lovelace card for displaying and editing event-based device schedules for switches, lights, covers, and valves.

### Features

- Event-based scheduling with fixed time and astronomical triggers
- Multi-device support (switches, lights, covers, valves)
- Category-specific UI (on/off for switches, dimming for lights, position + slat for covers)
- Flexible timing with sunrise/sunset offsets

### Configuration

```yaml
type: custom:homematicip-local-schedule-card
entities:
  - switch.living_room
  - switch.bedroom
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

## Installation

### HACS (Recommended)

1. Make sure [HACS](https://hacs.xyz/) is installed
2. In HACS, go to "Frontend"
3. Click the three-dot menu and select "Custom repositories"
4. Add the card repository URL
5. Select category "Lovelace"
6. Click "Install"
7. Restart Home Assistant

### Manual Installation

1. Download the `.js` file from the latest release
2. Copy it to your `config/www` folder
3. Add the resource in Settings > Dashboards > Resources:
   - URL: `/local/homematicip-local-climate-schedule-card.js` (or `homematicip-local-schedule-card.js`)
   - Resource type: JavaScript Module

## Requirements

- Home Assistant 2023.1 or newer
- [HomematicIP Local](https://github.com/SukramJ/homematicip_local) integration v2.0.0+
- Homematic devices with schedule support

## Development

### Prerequisites

- Node.js 20.x or 22.x
- npm

### Setup

```bash
npm install
```

### Build

```bash
npm run build         # Build all packages (core first, then cards)
npm run build:core    # Build only schedule-core
```

### Testing

```bash
npm test              # Run all tests
```

### Code Quality

```bash
npm run lint          # ESLint
npm run lint:fix      # ESLint with auto-fix
npm run format        # Prettier formatting
npm run type-check    # TypeScript validation
npm run validate      # All checks: lint + type-check + test + build
```

### Watch Mode

For card development, use watch mode in the respective package:

```bash
npm run watch -w packages/climate-schedule-card
npm run watch -w packages/schedule-card
```

### Pre-commit Hooks

Husky + lint-staged automatically run on commit:

- ESLint with auto-fix on `.ts` files
- Prettier formatting on `.ts`, `.js`, `.json`, `.md` files

## Release & Deployment

This monorepo is the **single source of truth** for card development. Users install cards via HACS from standalone deployment repositories that contain only the built `.js` file and HACS metadata.

### Repository Architecture

```
homematicip-local-frontend (this repo)      ← Development & build
        │
        │  npm run deploy:climate
        │  npm run deploy:schedule
        │  npm run deploy:config-panel
        │
        ▼
homematicip_local_climate_schedule_card      ← HACS distribution (climate card)
homematicip_local_schedule_card              ← HACS distribution (schedule card)
homematicip_local/frontend/                  ← Integration config panel
```

### Quick Release (Step-by-Step)

```bash
# 1. Bump version
npm run version:climate -- patch    # 0.10.0 → 0.10.1
# or: minor (0.10.0 → 0.11.0), major (0.10.0 → 1.0.0)

# 2. Commit version bump in monorepo
git add -A && git commit -m "Bump climate-schedule-card to 0.10.1"

# 3. Run full release (validate → build → deploy → commit+tag)
npm run release:climate

# 4. Push monorepo tag (triggers GitHub release with artifact)
git push origin climate-v0.10.1

# 5. Push standalone repo (triggers HACS release)
cd ../homematicip_local_climate_schedule_card
git push origin main --tags
```

Use `npm run release:climate:dry` to preview the release without making changes.

### Deployment Commands

| Command                                  | Description                                             |
| ---------------------------------------- | ------------------------------------------------------- |
| `npm run deploy:climate`                 | Copy built `.js` and sync version to climate card repo  |
| `npm run deploy:schedule`                | Copy built `.js` and sync version to schedule card repo |
| `npm run deploy:config-panel`            | Copy built `.js` to integration frontend directory      |
| `npm run deploy:all`                     | Deploy all packages (cards + config panel)              |
| `npm run release:climate`                | Full release: validate, build, deploy, commit, tag      |
| `npm run release:schedule`               | Full release for schedule card                          |
| `npm run release:config-panel`           | Build, validate, and deploy config panel                |
| `npm run release:climate:dry`            | Dry-run release (no changes)                            |
| `npm run release:schedule:dry`           | Dry-run release for schedule card                       |
| `npm run release:config-panel:dry`       | Dry-run release for config panel                        |
| `npm run version:climate -- <bump>`      | Bump climate card version (patch/minor/major)           |
| `npm run version:schedule -- <bump>`     | Bump schedule card version (patch/minor/major)          |
| `npm run version:config-panel -- <bump>` | Bump config panel version (patch/minor/major)           |

### What the Release Script Does

1. **Validate** — Runs lint, type-check, tests, and build (`npm run validate`)
2. **Deploy** — Copies the built `.js` to the standalone repo and syncs the version in `package.json`
3. **Commit** — Creates a `Release <version>` commit in the standalone repo
4. **Tag** — Tags the standalone repo with the version and the monorepo with `<card>-v<version>`

### CI/CD Workflows

| Workflow      | Trigger                           | Purpose                                       |
| ------------- | --------------------------------- | --------------------------------------------- |
| `ci.yml`      | Push/PR to `main`/`devel`         | Lint, type-check, test, build                 |
| `release.yml` | Tag `climate-v*` or `schedule-v*` | Build and create GitHub release with artifact |

### Standalone Repo Structure (After Deployment)

```
homematicip_local_climate_schedule_card/
├── .github/workflows/
│   ├── release.yml                 # Creates GitHub release on tag → HACS picks it up
│   └── validate.yml                # HACS structure validation
├── homematicip-local-climate-schedule-card.js  ← Built artifact from monorepo
├── package.json                    # Version metadata only
├── hacs.json                       # HACS registration
├── CHANGELOG.md
├── README.md
├── info.md
├── LICENSE
└── icon.png / logo.png
```

## Project Structure

```
homematicip-local-frontend/
├── packages/
│   ├── schedule-core/              # Shared library
│   │   ├── src/
│   │   │   ├── adapters/           # HA service & WebSocket adapters
│   │   │   ├── models/             # Type definitions
│   │   │   ├── localization/       # i18n (EN, DE)
│   │   │   └── utils/              # Utilities & helpers
│   │   └── dist/
│   ├── climate-schedule-card/      # Climate schedule Lovelace card
│   │   ├── src/
│   │   │   ├── card.ts             # Main Lit component
│   │   │   ├── editor.ts           # Visual config editor
│   │   │   ├── types.ts            # Card-specific types
│   │   │   └── localization.ts     # Card-specific translations
│   │   └── dist/
│   ├── schedule-card/              # Device schedule Lovelace card
│   │   ├── src/
│   │   │   ├── card.ts             # Main Lit component
│   │   │   ├── editor.ts           # Visual config editor
│   │   │   ├── types.ts            # Card-specific types
│   │   │   └── localization.ts     # Card-specific translations
│   │   └── dist/
│   └── config-panel/               # Integration config panel
│       ├── src/
│       │   ├── homematic-config.ts  # Main entry point & view router
│       │   ├── api.ts              # WebSocket API client
│       │   ├── types.ts            # Panel-specific types
│       │   ├── views/              # Panel views (device list, detail, config, etc.)
│       │   └── components/         # Form components
│       ├── translations/           # EN + DE translations
│       └── dist/
├── scripts/
│   ├── deploy.sh                   # Deploy built card to standalone repo
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

## Acknowledgments

- Built with [Lit](https://lit.dev/)
- Designed for [Home Assistant](https://www.home-assistant.io/)
- Compatible with [HomematicIP Local](https://github.com/SukramJ/homematicip_local) integration

## Related Projects

- [HomematicIP Local Integration](https://github.com/SukramJ/homematicip_local) - The Home Assistant integration
- [aiohomematic](https://github.com/SukramJ/aiohomematic) - Python library for Homematic device communication

## Support

For issues and questions, please use the [GitHub Issues](https://github.com/SukramJ/homematicip-local-frontend/issues) page.
