#!/bin/bash
set -e

REPO_DIR="./xmlittre-data"

if [ -d "$REPO_DIR/.git" ]; then
    echo "xmlittre-data already exists. Updating..."
    git -C "$REPO_DIR" pull --ff-only
    echo "Done."
    exit 0
fi

echo "Cloning XMLittré data..."

# Try GitHub mirror first, fall back to Bitbucket
GITHUB_URL="https://github.com/tasinttttttt/xmlittre-data.git"
BITBUCKET_URL="https://bitbucket.org/Mytskine/xmlittre-data.git"

if git clone --depth 1 "$GITHUB_URL" "$REPO_DIR" 2>/dev/null; then
    echo "Cloned from GitHub mirror."
elif git clone --depth 1 "$BITBUCKET_URL" "$REPO_DIR" 2>/dev/null; then
    echo "Cloned from Bitbucket (original)."
else
    echo "ERROR: Failed to clone from both sources."
    echo "  GitHub:    $GITHUB_URL"
    echo "  Bitbucket: $BITBUCKET_URL"
    exit 1
fi

echo "Done. $(ls "$REPO_DIR"/*.xml 2>/dev/null | wc -l) XML files ready."
