#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../ios"
# This capability probe requires a working host Apple model. Keep it explicit;
# ordinary CI still runs native tests and all other simulator UI tests.
APPLE_SCOPE=(-skip-testing:OwnUITests/OwnUITests/testLocalAppleReplyThroughChat)
if [[ "${OWN_TEST_APPLE_MODEL:-0}" == "1" ]]; then
  APPLE_SCOPE=()
fi
exec xcodebuild test \
  -workspace Own.xcworkspace \
  -scheme Own \
  -configuration Release \
  -destination "${OWN_IOS_TEST_DESTINATION:-platform=iOS Simulator,name=Own QA}" \
  -derivedDataPath "${OWN_IOS_DERIVED_DATA:-../../Own-build}" \
  -only-testing:OwnTests -only-testing:OwnUITests \
  "${APPLE_SCOPE[@]}" \
  ENABLE_TESTABILITY=YES CODE_SIGNING_ALLOWED=NO
