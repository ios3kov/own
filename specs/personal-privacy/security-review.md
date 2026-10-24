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
