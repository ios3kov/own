# Own tasks

Requirements and acceptance: [plan](plan.md), R01-R14 / T01-T18. Host completion and physical-device acceptance are separate.

| Task | Current result | Still unverified |
|---|---|---|
| T01 setup | PASS clean installation, four retained patches, Pods and resolved consumer APIs | Uploaded-candidate CI results |
| T02-T06 privacy/auth/search/speech consent | PASS scoped host tests and repaired source paths; Release logging guards and inactivity cover checked | Real app traffic, phone lock/capture/permissions and optional-provider behavior |
| T07 dependency/quality checks | PASS live npm audit: 0 advisories; types and lint have no errors | External review-service gates; warnings remain |
| T08/T16 Own identity | PASS owned source and final signed-bundle identity review | Phone installation/name/icon/upgrade |
| T09 download progress/ETA | Implemented; retained unit/integration checks pass | Real phone progress, background/lock/termination/retry and connectivity changes |
| T10 local spoken replies | PASS host queue/lifecycle tests, native speech checks and simulator preference/relaunch | Phone offline audio, routes, interruptions and repeated microphone handoff |
| T11 sources/context | PASS real simulator source/original opening after sandbox relocation, real CPU Llama reply and tokenizer context display; import path and failure tests pass | Real Files providers, suitable phone models, sustained use and upgrade/deletion scenarios |
| T12 review | Separate critical self-review completed and observed defects fixed; full iOS-only suite passed 5,329 tests / 202 suites including the final import corrections | Uploaded-candidate checks and Gemini/Codecov/Sonar results; no independent human review claimed |
| T13 installation | PASS signed Release build, deep/strict verification and changed-bundle/reverted-source signing regressions | Phone installation and physical acceptance, deferred by the user |
| T14 Apple default | PASS availability/selection/manual-alternative behavior and simulator relaunch | Actual supported-device Apple generation, including saved tool history; earlier host probe failed with error 1026 |
| T15 download consent | PASS size/unknown-size/Wi-Fi/mobile reconfirmation unit/integration checks | Real mobile/Wi-Fi and background transfers |
| T17 understandable settings | PASS built-in/custom profiles, supported controls, explanations, persisted reset baseline and storage failure tests; normal/light and dark/large-text simulator flows and visual review | Phone VoiceOver and real workload/memory acceptance |
| T18 iOS-only cleanup | PASS removal of owned target/backends, obsolete patches, direct platform dependency, build/release/CI paths and unsupported tests; iOS installation/build/regression checks retained | Phone acceptance and uploaded-candidate external gates |

## Final review corrections

Provider keys are kept out of preferences and migrate safely to Keychain. Failed indexing releases its duplicate guard. Document paths retain exact identity after container moves. Disabled knowledge search stays disabled during restoration/send/regenerate. Direct local-address aliases are blocked by the URL tool. Apple receives saved tool history as supported-role reference data. Model imports reject unsafe names, preserve literal percent characters and clean owned archive staging on failure. CPU retries do not increase a small requested context. Release document diagnostics do not evaluate private payloads. Xcode declares the JavaScript bundle output so incremental signing follows bundle changes.

These are bounded mechanisms and checks, not a guarantee against all attacks. Direct address validation does not establish DNS/redirect enforcement. Local storage is not a separate encrypted vault. See [privacy limits and the exact phone checklist](../../docs/privacy-and-phone-checks.md).

The current app is Own 0.1.0 (1), on the existing review branch. Recovery archives and Own Git history are preserved. Shared upstream packages and their third-party notices remain intact. No phone installation, merge, public release or account-setting change is claimed.
