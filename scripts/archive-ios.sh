#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
command -v xcodebuild >/dev/null || { echo 'Xcode is required.' >&2; exit 1; }
ARCHIVE_PATH="${OWN_ARCHIVE_PATH:-$ROOT_DIR/build/Own.xcarchive}"
if [[ -e "$ARCHIVE_PATH" ]]; then
  echo "Archive already exists: $ARCHIVE_PATH. Choose a new OWN_ARCHIVE_PATH." >&2
  exit 1
fi
mkdir -p "$(dirname "$ARCHIVE_PATH")"
xcodebuild archive -workspace ios/Own.xcworkspace -scheme Own \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates
[[ -d "$ARCHIVE_PATH" ]] || { echo 'Xcode did not produce the archive.' >&2; exit 1; }
ARCHIVE_APP="$ARCHIVE_PATH/Products/Applications/Own.app"
[[ -d "$ARCHIVE_APP" ]] || { echo 'The archive has no Own app.' >&2; exit 1; }
codesign --verify --deep --strict "$ARCHIVE_APP"
echo "Verified local iOS archive: $ARCHIVE_PATH"
