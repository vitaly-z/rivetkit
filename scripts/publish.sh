#!/bin/bash
set -euf -o pipefail

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

# Bump version for all packages
echo "Setting version to $VERSION..."
yarn workspaces foreach -A -t version $VERSION

# Commit the version changes
git add .
git commit -m "chore: release version $VERSION"

# Check if the tag already exists
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
  echo "Tag v$VERSION already exists. Skipping tag creation."
else
  git tag "v$VERSION"
fi

# Push changes
git push
git push --tags

# Publish packages
echo "Publishing packages..."
yarn workspaces foreach -A -t --include actor-core --include @actor-core/cloudflare-workers --include @actor-core/rivet npm publish --access public --tolerate-republish

echo "✅ Published specified packages at version $VERSION"

