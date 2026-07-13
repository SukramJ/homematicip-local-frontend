# Makefile — HomematicIP Local Frontend
#
# Convenience frontend for the npm scripts in package.json. The npm scripts stay
# the single source of truth; this file only makes them easier to discover and
# adds the dependency ordering (schedule-core → schedule-ui → cards/panel) that
# `npm run build --workspaces` does not express.
#
# Run `make` or `make help` for the target list.

SHELL := /bin/bash
.DEFAULT_GOAL := help

# tsc and rollup share dist/ and tsbuildinfo state between packages; running
# them concurrently corrupts incremental builds.
.NOTPARALLEL:

NPM ?= npm

# Version bump level for the version-* targets: patch | minor | major
BUMP ?= patch

# npm writes this file on every install; using it as a sentinel means a fresh
# clone bootstraps itself and repeated builds skip the install.
NODE_MODULES := node_modules/.package-lock.json

$(NODE_MODULES): package.json package-lock.json
	$(NPM) install
	@touch $@

##@ Setup

.PHONY: install
install: ## Install dependencies reproducibly from package-lock.json (CI-style)
	$(NPM) ci

.PHONY: install-dev
install-dev: $(NODE_MODULES) ## Install dependencies, updating package-lock.json if needed

.PHONY: hooks
hooks: $(NODE_MODULES) ## (Re-)install the husky git hooks
	$(NPM) run prepare

##@ Quality

.PHONY: lint
lint: $(NODE_MODULES) ## Run ESLint
	$(NPM) run lint

.PHONY: lint-fix
lint-fix: $(NODE_MODULES) ## Run ESLint with auto-fix
	$(NPM) run lint:fix

.PHONY: format
format: $(NODE_MODULES) ## Format sources with Prettier
	$(NPM) run format

.PHONY: format-check
format-check: $(NODE_MODULES) ## Check formatting without writing
	$(NPM) run format:check

.PHONY: type-check
type-check: $(NODE_MODULES) ## TypeScript check across all packages
	$(NPM) run type-check

.PHONY: test
test: $(NODE_MODULES) ## Run all tests
	$(NPM) test

.PHONY: test-watch
test-watch: $(NODE_MODULES) ## Run schedule-core tests in watch mode
	$(NPM) test -w packages/schedule-core -- --watch

.PHONY: test-coverage
test-coverage: $(NODE_MODULES) ## Run schedule-core tests with coverage report
	npx jest --coverage -w packages/schedule-core

.PHONY: validate
validate: $(NODE_MODULES) ## Full pipeline: lint + type-check + test + build
	$(NPM) run validate

.PHONY: ci
ci: install lint type-check test build ## What GitHub Actions runs (clean install first)

##@ Build

.PHONY: build
build: $(NODE_MODULES) ## Build all packages
	$(NPM) run build

.PHONY: build-core
build-core: $(NODE_MODULES) ## Build @hmip/schedule-core
	$(NPM) run build:core

.PHONY: build-ui
build-ui: build-core ## Build @hmip/schedule-ui (needs schedule-core)
	$(NPM) run build:ui

.PHONY: build-panel-api
build-panel-api: $(NODE_MODULES) ## Build @hmip/panel-api
	$(NPM) run build -w packages/panel-api

.PHONY: build-libs
build-libs: build-ui build-panel-api ## Build all libraries (core, ui, panel-api)

.PHONY: build-config-panel
build-config-panel: build-libs ## Bundle the config panel
	$(NPM) run build -w packages/config-panel

.PHONY: build-status-card
build-status-card: build-libs ## Bundle all cards (combined all-cards bundle)
	$(NPM) run build -w packages/status-card

.PHONY: build-climate-card
build-climate-card: build-libs ## Bundle the climate schedule card (standalone HACS build)
	$(NPM) run build -w packages/climate-schedule-card

.PHONY: build-schedule-card
build-schedule-card: build-libs ## Bundle the schedule card (standalone HACS build)
	$(NPM) run build -w packages/schedule-card

##@ Watch

.PHONY: watch-config-panel
watch-config-panel: build-libs ## Rebuild the config panel on change
	$(NPM) run watch -w packages/config-panel

.PHONY: watch-status-card
watch-status-card: build-libs ## Rebuild the all-cards bundle on change
	$(NPM) run watch -w packages/status-card

.PHONY: watch-climate-card
watch-climate-card: build-libs ## Rebuild the climate schedule card on change
	$(NPM) run watch -w packages/climate-schedule-card

.PHONY: watch-schedule-card
watch-schedule-card: build-libs ## Rebuild the schedule card on change
	$(NPM) run watch -w packages/schedule-card

##@ Deploy (copies build artifacts into ../homematicip_local)

.PHONY: deploy-config-panel
deploy-config-panel: build-config-panel ## Deploy homematic-config.js to the integration
	$(NPM) run deploy:config-panel

.PHONY: deploy-status-card
deploy-status-card: build-status-card ## Deploy homematicip-local-all-cards.js to the integration
	$(NPM) run deploy:status-card

.PHONY: deploy
deploy: build ## Deploy config panel and all-cards bundle to the integration
	$(NPM) run deploy:all

##@ Release (validates, builds, deploys, tags — use the -dry targets first)

.PHONY: release-config-panel-dry
release-config-panel-dry: $(NODE_MODULES) ## Preview the config-panel release
	$(NPM) run release:config-panel:dry

.PHONY: release-config-panel
release-config-panel: $(NODE_MODULES) ## Release the config panel
	$(NPM) run release:config-panel

.PHONY: release-status-card-dry
release-status-card-dry: $(NODE_MODULES) ## Preview the status-card release
	$(NPM) run release:status-card:dry

.PHONY: release-status-card
release-status-card: $(NODE_MODULES) ## Release the all-cards bundle
	$(NPM) run release:status-card

.PHONY: release-climate-dry
release-climate-dry: $(NODE_MODULES) ## Preview the climate-schedule-card release
	$(NPM) run release:climate:dry

.PHONY: release-climate
release-climate: $(NODE_MODULES) ## Release the climate schedule card
	$(NPM) run release:climate

.PHONY: release-schedule-dry
release-schedule-dry: $(NODE_MODULES) ## Preview the schedule-card release
	$(NPM) run release:schedule:dry

.PHONY: release-schedule
release-schedule: $(NODE_MODULES) ## Release the schedule card
	$(NPM) run release:schedule

##@ Versioning (BUMP=patch|minor|major, default: patch)

.PHONY: version-config-panel
version-config-panel: $(NODE_MODULES) ## Bump the config-panel version
	$(NPM) run version:config-panel -- $(BUMP)

.PHONY: version-status-card
version-status-card: $(NODE_MODULES) ## Bump the status-card version
	$(NPM) run version:status-card -- $(BUMP)

.PHONY: version-climate
version-climate: $(NODE_MODULES) ## Bump the climate-schedule-card version
	$(NPM) run version:climate -- $(BUMP)

.PHONY: version-schedule
version-schedule: $(NODE_MODULES) ## Bump the schedule-card version
	$(NPM) run version:schedule -- $(BUMP)

.PHONY: versions
versions: ## Show the current version of every package
	@for pkg in packages/*/package.json; do \
		node -p "const p=require('./$$pkg'); p.name.padEnd(32) + p.version"; \
	done

##@ Cleanup

.PHONY: clean
clean: ## Remove all dist/ directories and tsbuildinfo files
	$(NPM) run clean

.PHONY: distclean
distclean: clean ## Also remove node_modules
	rm -rf node_modules packages/*/node_modules

##@ Help

.PHONY: help
help: ## Show this help
	@awk 'BEGIN { \
			FS = ":.*##"; \
			printf "\nHomematicIP Local Frontend\n\nUsage:\n  make \033[36m<target>\033[0m\n" \
		} \
		/^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-26s\033[0m %s\n", $$1, $$2 } \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)
	@printf "\nExample: make version-status-card BUMP=minor\n\n"
