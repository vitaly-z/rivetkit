#!/bin/bash
set -euf -o pipefail

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

# Step 1: Bump version for all packages
echo "Setting version to $VERSION..."
yarn workspaces foreach -pt version $VERSION --no-git-tag-version

# Step 2: Commit the version changes
# git add .
# git commit -m "chore: release version $VERSION"
# git tag "v$VERSION"
# git push && git push --tags

# Step 3: Publish specified packages
echo "Publishing specified packages..."
yarn workspaces foreach -pt --topological-dev --include actor-core,@actor-core/cloudflare-workers,@actor-core/rivet publish --access public --new-version $VERSION

echo "✅ Published specified packages at version $VERSION"

