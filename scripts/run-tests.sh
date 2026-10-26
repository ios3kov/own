#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
TEST_DIR="${1:-.maestro/flows/p0}"
if [[ "$TEST_DIR" == --* || $# -gt 1 ]]; then
  echo 'Usage: scripts/run-tests.sh [flow-folder]' >&2
  exit 1
fi
command -v maestro >/dev/null || { echo 'Maestro is required.' >&2; exit 1; }
[[ -d "$TEST_DIR" ]] || { echo "Flow folder not found: $TEST_DIR" >&2; exit 1; }
if ! xcrun simctl list devices booted | grep -q Booted; then
  echo 'Start an iOS simulator first.' >&2
  exit 1
fi
passed=0
failed=0
while IFS= read -r -d '' test_file; do
  echo "Testing: $test_file"
  if maestro test -e APP_ID=io.github.ios3kov.own "$test_file"; then
    passed=$((passed+1))
  else
    failed=$((failed+1))
    break
  fi
done < <(find "$TEST_DIR" -type f -name '*.yaml' -print0 | sort -z)
echo "Passed: $passed; failed: $failed"
[[ $failed -eq 0 && $passed -gt 0 ]]
