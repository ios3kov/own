#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../ios"
exec xcodebuild test \
  -workspace Own.xcworkspace \
  -scheme Own \
  -configuration Release \
  -destination "${OWN_IOS_TEST_DESTINATION:-platform=iOS Simulator,name=Own QA}" \
  -derivedDataPath "${OWN_IOS_DERIVED_DATA:-../../Own-build}" \
  -only-testing:OwnTests -only-testing:OwnUITests \
  ENABLE_TESTABILITY=YES CODE_SIGNING_ALLOWED=NO
