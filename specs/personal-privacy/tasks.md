# Own tasks

Requirements and acceptance: [plan](plan.md), R01-R14 / T01-T18. Host completion and physical-device acceptance are separate.

## Historical baseline before the iPhone follow-up

The table below records the earlier candidate, not the newly installed follow-up build.

| Task | Baseline result | Still unverified at that handoff |
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

The earlier host-only candidate was Own 0.1.0 (1), on the existing review branch. Recovery archives and Own Git history are preserved. Shared upstream packages and their third-party notices remain intact. No phone installation, merge, public release or account-setting change is claimed.


## Follow-up acceptance, 2026-10-24 (in progress)

F01: No LAN scan or server additions on onboarding/home startup; discovery requires an explicit action.
F02: Every model tool execution obeys requested and current permissions; empty search never substitutes private chat text.
F03: Queues preserve chat ownership and arrival order. Interleaved tool arguments stay with their indexed call.
F04: Image jobs become busy before enhancement; cancellation stays effective across enhancement/load/native/save and blocks overlapping jobs. Saved dimensions match the selected export size; fixed native rendering is explained.
F05: Unlinked vision files are never attached by fuzzy filename scan. Document content preserves mathematical operators and quoted markup.
F06: URL reading checks all DNS answers and every redirect, pins a checked public address, verifies TLS for the original hostname, caps body/redirects and fails closed. Website compatibility and native network behavior require runtime proof.
F07: Local OCR for photos and scanned PDF pages; bounded CSV/XLSX table import, deterministic sum/group/filter/duplicates and charts; local audio file decoding/transcription with a user-installed Whisper model. Original files stay local; no formula execution or automatic model download. Unit, integration and representative native/UI checks required.
F08: Remove GitHub stars, About project link and X sharing/prompts.
F09: Four-digit PIN setup/change/disable, optional supported Face ID/Touch ID, secure Keychain storage, preserved legacy passphrase fallback and lockout. Correct Security/setup safe areas, including Dynamic Island and large text. Hardware biometric acceptance stays separate.

Installation gate: run the applicable host checks before an in-place update. The first phone build was cda65cd; current follow-up status is recorded below.

F10: Updated bottom navigation preserves native history, avoids keyboard overlap and supports tab reselect scrolling. Review normal and large text renderings.
F11: Model guidance recommends only real available files, explains size/memory tradeoffs and never downloads automatically.
F12: One image finalization prompt per owned job; nested registered Core ML folders are not recovered as duplicate models. Model-loading phases/progress are visible and never fabricate a percentage.
F13: No automatic image onboarding or rating/share promotion popups. Manual help remains intentional.
F14: Russian image requests are translated locally even with optional prompt improvement off. Translation-only preserves the subject; failure stops with an actionable message. Actual puppy output needs semantic phone review.
F15: Apple changes from ORCHID to a newer request in the same conversation. Actual supported-device execution is required.
F16: Back up chat preferences and inventory model files, install build 5 without uninstalling, compare retained data after launch. Preserve legacy credentials and do not change user's lock configuration.

Exact 17-item mapping: [iPhone follow-up acceptance](../../docs/iphone-followup-2026-10-24.md). Earlier T01–T18 results describe the previous candidate, not these changed bytes.

## Follow-up status, 2026-10-25

- Implemented F01–F16 and the additional whole-app gallery/composer fixes. Exact mapping and limitations: [iPhone QA ledger](../../docs/iphone-followup-2026-10-24.md).
- PASS: latest JavaScript coverage suite, 214 suites / 5,307 tests; types; lint with warnings; resolved-dependency audit, zero known advisories.
- PASS: complete native/simulator suite, 62 native tests and 11 UI user-flow tests, with synthetic model/document/gallery fixtures loaded. Actual Apple inference remains separate. Final Hugging Face pairing adjustment is covered by the later full JS suite and its new unit/integration cases; native/UI behavior was unchanged.
- PASS: reviewed normal navigation, gallery confirmation, composer with keyboard and corrected large-text Security/PIN renderings. Dedicated simulator state restored from its backups.
- PASS: final signed Release build 0.1.0 (5), deep/strict signature verification, existing bundle identifier and iPhone provisioning. Installed as an update without uninstalling.
- BLOCKED: live phone startup and model-output checks require unlocking the Mac/iPhone. The launch attempt was rejected by iOS with Device Locked; this is not a successful launch or an observed app crash.
- NOT RUN on the installed candidate: actual Apple changed-turn/tool-history replies; Russian puppy semantic output; real background downloads/connectivity/termination; network traffic; real Files/media-provider flows and imported speech recognition; PIN/biometric hardware and interruptions/memory pressure. Touch ID requires suitable hardware.

Do not mark phone acceptance or release readiness complete from the host checks above. Preserve existing chats/models/images and do not enroll credentials during automated checks.

Final address-boundary correction was rechecked by all 62 native tests after the complete UI run. Build 5 preserves the original two chats/eight messages, all saved model records and all pre-existing document file paths/sizes after installation. Live phone launch remains blocked by the lock; no post-launch retention or runtime semantic claim is made.

## Live phone QA continuation

Build 7 installed and launched in place. Original two chats/eight messages remain exactly unchanged, all 34 prior Documents files retain their paths/sizes (29 SDXL files), text/Whisper records retained, image-model paths only relocated to the current sandbox. Gallery now displays the older images. Physical Info/Done/Close, visible delete confirmation and Cancel passed; no phone image was deleted. Apple changed-turn ORCHID → TULIP passed on build 5; saved tool history remains open. Security header visually clears the Dynamic Island.

F14 now covers multilingual prompts, including Latin-script languages. Live test found and cancelled an English refusal being treated as an image description. New acceptance: detect language locally; classify non-English intent with the selected local text model; explicit quoted translation task; reject refusals/untranslated output; show actionable error for unsupported language; never auto-download a text model/language pack or use cloud translation. Regression matrix covers 14 non-English languages; real phone model-language quality remains separate. Build 8 is being prepared. Full QA/release acceptance remains incomplete.

### 2026-10-25 expanded user scope

Track the full numbered 0, 00, 1–88 request in [performance-plan.md](performance-plan.md). This is additional required work, not covered by earlier release checks. Batch 1 fixes history persistence, late embedding load disposal, and mathematical comparisons in speech. Hardware recommendations, loading policies and the remaining measured work stay open.


### Batch7 Mac-only continuation — 2026-10-25

Supersedes earlier software-open summaries. Implemented and tested request-scoped prompt reuse20, partial recovery38, first-event stream flush39, safe auxiliary idle release45, actual visible-layout timing50, native footprint/launch diagnostics52, model-versioned persisted document cache and refresh74, incremental speech85, plus final image guidance/thread/pressure and Knowledge Base accessibility fixes. Final code review and per-item decisions are in [software review](../../docs/software-review-2026-10-25.md); all90 IDs remain in performance-plan.md.

Host functional checks and scoped simulator visuals are recorded in the latest follow-up report. Physical model quality, Metal/heat/energy, session/prewarm/pipeline experiments and actual phone installation remain NOT_RUN in this batch. No phone accessed; preserve installed Build13, chats/models/images. No source commit/push was performed.
