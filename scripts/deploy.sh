#!/bin/bash
# Deploy a built card/panel to its standalone repository.
# Usage: scripts/deploy.sh <climate-schedule-card|schedule-card|config-panel>

set -euo pipefail

PACKAGE="${1:?Usage: scripts/deploy.sh <climate-schedule-card|schedule-card|config-panel>}"

DEPLOY_SUBDIR=""
SKIP_VERSION_SYNC=false

case "$PACKAGE" in
  climate-schedule-card)
    STANDALONE="../homematicip_local_climate_schedule_card"
    FILENAME="homematicip-local-climate-schedule-card.js"
    PKG_DIR="packages/climate-schedule-card"
    ;;
  schedule-card)
    STANDALONE="../homematicip_local_schedule_card"
    FILENAME="homematicip-local-schedule-card.js"
    PKG_DIR="packages/schedule-card"
    ;;
  config-panel)
    STANDALONE="../homematicip_local"
    FILENAME="homematic-config.js"
    PKG_DIR="packages/config-panel"
    DEPLOY_SUBDIR="custom_components/homematicip_local/frontend"
    SKIP_VERSION_SYNC=true
    ;;
  *)
    echo "Error: Unknown package '$PACKAGE'"
    echo "Usage: scripts/deploy.sh <climate-schedule-card|schedule-card|config-panel>"
    exit 1
    ;;
esac

DIST="$PKG_DIR/dist/$FILENAME"

if [ ! -f "$DIST" ]; then
  echo "Build artifact not found at $DIST"
  echo "Run 'npm run build' first."
  exit 1
fi

if [ ! -d "$STANDALONE" ]; then
  echo "Standalone repo not found at $STANDALONE"
  exit 1
fi

# Copy built artifact
if [ -n "$DEPLOY_SUBDIR" ]; then
  cp "$DIST" "$STANDALONE/$DEPLOY_SUBDIR/$FILENAME"
  echo "Deployed $FILENAME → $STANDALONE/$DEPLOY_SUBDIR/"
else
  cp "$DIST" "$STANDALONE/$FILENAME"
  echo "Deployed $FILENAME → $STANDALONE/"
fi

# Sync version from monorepo package to standalone package.json
if [ "$SKIP_VERSION_SYNC" = false ]; then
  VERSION=$(node -p "require('./$PKG_DIR/package.json').version")
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$STANDALONE/package.json', 'utf8'));
    pkg.version = '$VERSION';
    fs.writeFileSync('$STANDALONE/package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  echo "Synced version → $VERSION"
  echo ""
  echo "Next steps:"
  echo "  cd $STANDALONE"
  echo "  # Update CHANGELOG.md"
  echo "  git add -A && git commit -m 'Release $VERSION'"
  echo "  git tag $VERSION && git push origin main --tags"
fi
