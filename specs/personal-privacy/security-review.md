# Privacy and security review — incomplete

This is a source and scoped test review of the Own candidate, not a security certification.

## Confirmed fixes

- PBKDF2-SHA256 verifier with independent native vectors; secure random salt, constant-time compare, bounded inputs.
- Original destination deny checks in JavaScript, RN networking, RNFS and native download setup; cookies disabled and credential handling reviewed in changed paths.
- Apple Foundation Models uses the on-device system model. Alternative models and downloads require explicit user choice.
- Apple speech defaults off; permission/cancellation races have tests.
- Multi-file downloads reject unsafe relative paths and parent symlinks; HTTP error responses cannot become model files. Failed saves report failure, preserve old files, and clean temporary copies.
- Native build and test scripts propagate failures. CI actions use verified fixed revisions; checkout credentials are not retained.

## Remaining boundaries and acceptance work

- Background URLSession redirects are controlled by iOS; the usual redirect delegate is not a universal enforcement point. A deny list does not prove absence of all developer traffic.
- Required physical-device traffic scenarios remain unperformed: startup/idle, local chat, explicit search/model download, speech opt-in/off, background/lock/retry/cancel and configured remote servers.
- Local passphrase locks the interface. Full database/file-protection, backup and recovery behavior still needs the R02 review; do not claim all saved content has independent app-level encryption.
- Remaining dependency findings after compatible updates:15 total,0critical,4high,11moderate. High findings trace to Metro image-size and ESLint/Zod tooling; Expo/xcode/uuid and CLI XML parser findings remain. Classification is preliminary until exact Release-bundle reachability and relevant build-input paths are checked.
- Scanner max-token findings largely flag imports, types, server registration and test doubles. Actual local Apple generation is capped. Configured remote providers intentionally allow server-owned output limits; this resource boundary remains an explicit review item. tools/index.ts is an export module, not a public server endpoint. chatStore message roles are local app state, not an authenticated server authorization policy.
- Google HTML search received a JavaScript challenge in the previous live Mac probe; a successful physical-phone query remains unverified.
- No modern closed feature modules or closed upstream Git history are included. Additional Ash-inspired features remain unfinished, as listed in tasks.md.

No physical-phone installation or public release is approved as complete by this report.

### Final feature review update
New speech uses installed basic voices and has no app cloud TTS/download API. Trusted document references contain bounded saved excerpts and record IDs, with no model-generated URL navigation. Context and response profiles are local; profiles whitelist response settings and never store permissions. Source/component/native checks do not replace phone traffic acceptance. Reset-to-chosen-profile was corrected after separate review and has persistence/error regression tests.
Current source scanner41 findings remain heuristic review items. Current built iOS scan78 files has no strict retired identity matches. Two Android raw-byte matches are the unrelated Unicode script alias, not author/app metadata. Remaining image-size/Zod high advisories are traced to CLI/Metro and ESLint tools; the RN production dependency tree still contains its CLI. No untested major dependency override was introduced. The broader privacy/file-protection and physical traffic acceptance remain open.

### Host repair candidate: source scan review, 24 October

`own-host-source-audit.json` exits1 with48 heuristic findings. They are reviewed, not labeled a clean scanner PASS. Six `secret.assignment` locations are synthetic credential strings in credential/profile regression fixtures; no operational credential was found at those locations. The40 `ai_no_maxtokens` hits are test call sites or imports/type/barrel/registry references rather than proof of an unlimited network handler. `tools/index.ts` is a local export barrel, not an unauthenticated HTTP endpoint. `chatStore.ts` role assignment is local conversation data, not a server authorization decision. These findings do not establish live network safety, model resource limits or protection of operating-system backups. Those boundaries remain covered by explicit runtime/device acceptance rather than scanner absence.

The current host regression reports208 suites,5638 tests passed,4 skipped, branch coverage80.45% without lowering thresholds or force-exit. The dependency advisory refresh reports0 known advisories. Further iOS-only cleanup changes require fresh affected checks and final regression.

## Final host review additions, 2026-10-24

Confirmed and regression-tested: Keychain-only provider-key persistence with safe legacy migration/retry, atomic indexing and duplicate-guard release, exact document identity after container moves, direct local-address URL normalization, persistent disabled-tool preferences, supported Apple history roles, safe main/vision import basenames and literal percent handling, failed archive staging cleanup, bounded CPU context retries, Release document diagnostics and incremental signed-bundle integrity. Retired identity patterns have no matches in the final owned-source and signed-app scan. See the latest verification section for the exact counts and artifacts.

The application has no independently verified all-attacks guarantee. No independent human review is claimed. Physical traffic, supported-device Apple generation, lock/backup/deletion behavior, audio/permissions, background scheduling and workload remain in the device checklist. Direct URL checks do not prove DNS-rebinding or redirect enforcement. A personal development signature expires and is distinct from App Store distribution. External review-service results remain a separate release gate.
