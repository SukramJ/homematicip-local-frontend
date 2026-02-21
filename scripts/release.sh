#!/bin/bash
# Full release workflow: validate, build, deploy, and prepare standalone repo for release.
# Usage: scripts/release.sh <climate-schedule-card|schedule-card|config-panel> [--dry-run]
#
# This script:
#   1. Runs validation (lint, type-check, tests)
#   2. Builds all packages
#   3. Deploys the built artifact to the standalone/target repo
#   4. Syncs the version (for card packages)
#   5. Creates a git commit and tag in the standalone repo (for card packages)
#
# Use --dry-run to see what would happen without making changes.

set -euo pipefail

PACKAGE="${1:?Usage: scripts/release.sh <climate-schedule-card|schedule-card|config-panel> [--dry-run]}"
DRY_RUN="${2:-}"

DEPLOY_SUBDIR=""
SKIP_STANDALONE_GIT=false

case "$PACKAGE" in
  climate-schedule-card)
    STANDALONE="../homematicip_local_climate_schedule_card"
    FILENAME="homematicip-local-climate-schedule-card.js"
    PKG_DIR="packages/climate-schedule-card"
    TAG_PREFIX="climate-v"
    ;;
  schedule-card)
    STANDALONE="../homematicip_local_schedule_card"
    FILENAME="homematicip-local-schedule-card.js"
    PKG_DIR="packages/schedule-card"
    TAG_PREFIX="schedule-v"
    ;;
  config-panel)
    STANDALONE="../homematicip_local"
    FILENAME="homematic-config.js"
    PKG_DIR="packages/config-panel"
    TAG_PREFIX="config-panel-v"
    DEPLOY_SUBDIR="custom_components/homematicip_local/frontend"
    SKIP_STANDALONE_GIT=true
    ;;
  *)
    echo "Error: Unknown package '$PACKAGE'"
    echo "Usage: scripts/release.sh <climate-schedule-card|schedule-card|config-panel> [--dry-run]"
    exit 1
    ;;
esac

VERSION=$(node -p "require('./$PKG_DIR/package.json').version")

echo "=== Release: $PACKAGE v$VERSION ==="
echo ""

if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "[DRY RUN] No changes will be made."
  echo ""
fi

# Step 1: Validate
echo "Step 1/5: Validating..."
npm run validate
echo ""

# Step 2: Build (already done by validate, but explicit for clarity)
echo "Step 2/5: Build complete."
echo "  Artifact: $PKG_DIR/dist/$FILENAME"
echo ""

# Step 3: Deploy to standalone repo
echo "Step 3/5: Deploying to standalone repo..."
if [ ! -d "$STANDALONE" ]; then
  echo "Error: Standalone repo not found at $STANDALONE"
  exit 1
fi

if [ "$DRY_RUN" != "--dry-run" ]; then
  if [ -n "$DEPLOY_SUBDIR" ]; then
    cp "$PKG_DIR/dist/$FILENAME" "$STANDALONE/$DEPLOY_SUBDIR/$FILENAME"
    echo "  Copied $FILENAME to $DEPLOY_SUBDIR/"
  else
    cp "$PKG_DIR/dist/$FILENAME" "$STANDALONE/$FILENAME"
    echo "  Copied $FILENAME"
  fi
  if [ "$SKIP_STANDALONE_GIT" = false ]; then
    node -e "
      const fs = require('fs');
      const pkg = JSON.parse(fs.readFileSync('$STANDALONE/package.json', 'utf8'));
      pkg.version = '$VERSION';
      fs.writeFileSync('$STANDALONE/package.json', JSON.stringify(pkg, null, 2) + '\n');
    "
    echo "  Synced version to $VERSION"
  fi
else
  if [ -n "$DEPLOY_SUBDIR" ]; then
    echo "  [DRY RUN] Would copy $FILENAME to $STANDALONE/$DEPLOY_SUBDIR/"
  else
    echo "  [DRY RUN] Would copy $FILENAME to $STANDALONE/"
  fi
  if [ "$SKIP_STANDALONE_GIT" = false ]; then
    echo "  [DRY RUN] Would sync version to $VERSION"
  fi
fi
echo ""

# Step 4: Git commit in standalone repo
if [ "$SKIP_STANDALONE_GIT" = false ]; then
  echo "Step 4/5: Creating git commit in standalone repo..."
  if [ "$DRY_RUN" != "--dry-run" ]; then
    cd "$STANDALONE"
    git add -A
    if git diff --cached --quiet; then
      echo "  No changes to commit (artifact unchanged)."
    else
      git commit -m "Release $VERSION"
      echo "  Committed: Release $VERSION"
    fi
    cd - > /dev/null
  else
    echo "  [DRY RUN] Would commit: Release $VERSION"
  fi
  echo ""
else
  echo "Step 4/5: Skipped (no standalone git for $PACKAGE)."
  echo ""
fi

# Step 5: Tag in standalone repo
if [ "$SKIP_STANDALONE_GIT" = false ]; then
  echo "Step 5/5: Creating git tag in standalone repo..."
  if [ "$DRY_RUN" != "--dry-run" ]; then
    cd "$STANDALONE"
    git tag "$VERSION"
    echo "  Tagged: $VERSION"
    cd - > /dev/null
  else
    echo "  [DRY RUN] Would tag: $VERSION"
  fi
  echo ""
else
  echo "Step 5/5: Skipped (no standalone git for $PACKAGE)."
  echo ""
fi

# Also tag in monorepo
echo "Tagging monorepo..."
MONO_TAG="${TAG_PREFIX}${VERSION}"
if [ "$DRY_RUN" != "--dry-run" ]; then
  git tag "$MONO_TAG"
  echo "  Tagged: $MONO_TAG"
else
  echo "  [DRY RUN] Would tag: $MONO_TAG"
fi
echo ""

echo "=== Release $VERSION prepared ==="
echo ""
if [ "$SKIP_STANDALONE_GIT" = false ]; then
  echo "To publish, push tags:"
  echo "  git push origin $MONO_TAG"
  echo "  cd $STANDALONE && git push origin main --tags"
else
  echo "To publish, push monorepo tag:"
  echo "  git push origin $MONO_TAG"
  echo ""
  echo "The built artifact has been deployed to $STANDALONE."
fi
