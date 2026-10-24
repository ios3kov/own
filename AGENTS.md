# Project Instructions

## Pre-Push Quality Gates

The installed Husky pre-push hook checks the pushed change range:

| Changed file type | Required checks |
|---|---|
| `.ts` / `.tsx` / `.js` / `.jsx` | ESLint, TypeScript and related Jest tests |
| `.swift` | SwiftLint and the native/simulator iOS test suite |

Use Node24, Xcode and CocoaPods. Significant changes also require the full applicable unit/integration coverage suite and an iOS build. The host-dependent actual Apple-model probe is explicit (`npm run test:ios:apple`); it remains a required supported-device acceptance check even when ordinary CI cannot run it. Record skips and external review-service gaps separately.

Fix failing checks before pushing. Never bypass hooks with `--no-verify`. The hook must stop on failure. See package.json and scripts/test-ios.sh for the live commands. Physical-device, traffic and performance acceptance remain separate from simulator success.

## Testing Requirements

Always write **both** unit tests and integration tests for new features and significant changes:

- **Unit tests** (`__tests__/unit/`): Test individual functions, hooks, and store actions in isolation with mocked dependencies.
- **Integration tests** (`__tests__/integration/`): Test how multiple modules work together end-to-end (e.g., service A calls service B which writes to database C). Use mocked native modules but real logic across layers.

Do not consider a feature complete with only unit tests. Integration tests catch wiring bugs, incorrect data flow between layers, and lifecycle issues that unit tests miss.

## Push = Create PR + Address Review

When asked to push code, follow this full workflow:

0. ensure that you are on a branch that is specific to this change i.e feat/new-feature or fix/bug-fix or docs/update-readme or chore/update-dependencies, or test/new-test, etc
1. Push the branch to the remote (`git push -u origin <branch>`)
2. Create a PR using `gh pr create`. Ensure that you are adhering to the PR template. **Do NOT include "Generated with Codex" or any AI attribution in PR descriptions.**
3. Wait for Gemini to review the PR (poll with `gh pr checks` and `gh api repos/{owner}/{repo}/pulls/{number}/reviews` until a review appears)
4. Once a review exists, pull down the review comments: `gh api repos/{owner}/{repo}/pulls/{number}/comments` and `gh api repos/{owner}/{repo}/pulls/{number}/reviews`
5. Address every review comment — fix the code, re-run the quality gates (tests, lint, tsc).
6. Reply to **each** review comment individually on the PR using `gh api` (use `/pulls/comments/{id}/replies` endpoint). Every comment must get its own reply confirming what was done — do not post a single summary comment.
7. Push the fixes
8. Report what was changed in response to the review

## CI Review Loop

The repo has three automated reviewers on every PR. After pushing, loop until all are green:

| Reviewer | What it checks | How to address |
|---|---|---|
| **Gemini Bot** | Code quality, style, logic issues | Read comments via `gh api`, fix code or reply explaining why it's fine, then comment `/gemini review` to trigger a fresh pass |
| **Codecov** | Test coverage thresholds | Add missing tests, ensure new code is covered. Check the Codecov report for uncovered lines |
| **SonarCloud** | Security hotspots, code smells, duplications, bugs | Fix flagged issues — especially security hotspots and duplications. Resolve quality gate failures before merging |

**Workflow:**
1. Push code → wait for all three reviewers to report
2. Pull down Gemini comments, Codecov report, and SonarCloud findings
3. Fix issues: code changes for Gemini/SonarCloud, add tests for Codecov
4. Re-run local quality gates (`npm run lint && npm test && npx tsc --noEmit`)
5. Push fixes, comment `/gemini review` on the PR to re-trigger Gemini
6. Repeat until all three reviewers pass with no blocking issues
