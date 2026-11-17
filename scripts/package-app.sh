#!/usr/bin/env bash
set -euo pipefail

app="$1"
version="$2"
test -f "apps/$app/index.html"

rm -rf "dist/$app"
mkdir -p "dist/$app/apps" "dist/$app/packages"
cp -R "apps/$app" "dist/$app/apps/"
cp -R packages/agent-core "dist/$app/packages/"
cp -R packages/design-system "dist/$app/packages/"
(
  cd "dist/$app"
  zip -qr "../$app-$version.zip" "apps/$app" packages/agent-core packages/design-system
)
echo "dist/$app-$version.zip"
