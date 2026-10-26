# iPhone follow-up acceptance — 2026-10-24

## Build14 installed on iPhone — 2026-10-25

User explicitly authorized installation. Installed verified Own0.1.0(14) in place on the paired iPhone15ProMax without uninstall/reset. Installed version read back as14; launch succeeded and the process remained running. Before/after and post-launch comparison:9chats/44messages unchanged; both image-model records and Whisper selection preserved; all33 original Documents files retain paths/sizes. No existing model/image/chat deleted. Text-model catalog contained0downloaded records before and after. File verification is path/size comparison, not full multi-gigabyte weight hashing. App settings/storage bytes were identical immediately after installation; post-launch model-path normalization allowed only sandbox UUID changes.

Fresh private storage backup `../own-phone-pre-build14/storage-cabled`; after snapshots `../own-phone-post-build14-pre-launch` and `../own-phone-post-build14-live`. Proof `../own-build14-preservation.json`, install/version/launch/process logs `../own-build14-*`. Initial wireless backup failed before installation; cable/unlock restored connectivity and the backup completed before update. Full model-quality, network, thermal/energy and remaining phone QA were not run during this installation.

## Latest Mac-only result — 2026-10-25, Batch7

This section supersedes historical status below. No iPhone was accessed, updated, reset or uninstalled in this batch; its Build13 chats, downloaded models and images remain untouched. No model downloaded, source committed or pushed. Existing dirty work and private backups retained.

- **PASS — functional:** full coverage run251 suites /5,513 tests on final functional code (`../own-mac-batch7-final-all-jest.log`). Later compact Knowledge Base layout passed62 related screen tests (`../own-mac-batch7-layout-final-js.log`). These are automated logic/component tests, with native dependencies mocked where applicable.
- **PASS — static:** TypeScript (`../own-mac-batch7-layout-final-types.log`), full lint0errors/37existing JS warnings plus native warnings (`../own-mac-batch7-release-final-lint.log`), affected final screen lint0errors (`../own-mac-batch7-layout-final-lint.log`). Final whitespace check PASS. Final database-index TypeScript and affected lint PASS (`../own-mac-batch7-index-final-types.log`, `../own-mac-batch7-index-final-lint.log`).
- **PASS — native:**70 simulator tests, including process footprint and serialized image-residency checks; final rerun70PASS (`../own-mac-batch7-final-native-guard.log`). Native tests had no skips. The separate fixture-dependent UI case intentionally skipped once after fixture cleanup; its positive normal/large runs passed earlier with the owned fixture. Actual Apple inference probe NOT_RUN in this batch.
- **PASS — scoped runtime/visual:**2 normal/large model-advice and installed-voice UI checks;2 recovered-reply UI checks with inspected screenshots; final2 Knowledge Base navigation/refresh UI checks (`../own-mac-batch7-search-visual-final.log`), with normal and maximum-text screenshots individually inspected. Final search xcresult: `../Own-build/Logs/Test/Test-Own-2026.10.25_12-35-16-+0100.xcresult`. Chrome is compact, actions are reachable, document content remains large. This is scoped visual evidence, not whole-app accessibility certification.
- **PASS — preservation:** temporary recovery chat and search document removed; both original simulator conversations deep-equal their original backup (`../own-mac-batch7-data-preservation.json`); all original search DB rows verified unchanged. Private fixtures/backups remain outside Git. Physical phone untouched.
- **REVIEW — scanner:** final report `../own-mac-batch7-handoff-audit.json`; 46 findings,0new rule/path pairs versus Build13; these are review candidates, not proof of absence of malware, runtime traffic or release readiness. Compare rule/path pairs against the retained Build13 baseline.
- **PASS — signed candidate:** Own0.1.0(14), original bundle identifier and existing development profile; generic iOS Release build and deep/strict signature verification PASS. Profile expires2026-10-31 17:18:19UTC. App: `../Own-device-build/Build/Products/Release-iphoneos/Own.app`. Exact hashes: `../own-mac-batch7-build14-artifact.json`; executable8b93f12752733f0c4f540092788649cc856a34b3f9f2d64369fe4ea1b3674c17, JS469c11aed0a5a4bb5e81ffedee7ff494498e895fe76921705aec58532ed4cdcd. Build14 is NOT installed on the phone. Previous signed Build13 preserved as an APFS clone at `../Own-build13-preserved.app`. Build number14 is a command-line build override; project defaults remain13. Sandboxed certificate checks could not reach macOS trust services; the same strict verification passed with approved OS trust-service access, without weakening verification.

Software changes: request-scoped prompt formatting reuse, partial-answer recovery, immediate first stream update, safe idle helper release, actual visible-layout/queue timing, native process memory and launch diagnostics, exact model-versioned document cache/index refresh, indexed document-count checks, incremental speech parsing. Final review also fixed zero guidance defaults, an unused image-thread reload condition, memory-warning state checks and inaccessible/oversized document-management controls.

Final simulator startup installed both indexes, with every original DB row and both chats unchanged (`../own-mac-batch7-final-schema-preservation.json`); final read-only UI run PASS (`../own-mac-batch7-final-schema-ui.log`).

Host SQLite EXPLAIN confirms the document-count checks use covering indexes instead of repeated chunk/vector table scans; missing/complete index behavior PASS (`../own-mac-batch7-sqlite-index-proof.json`). This is a query-plan check, not a phone latency benchmark.

All90 original IDs and their boundaries remain in [performance-plan.md](../specs/personal-privacy/performance-plan.md). [Software review and exact remaining physical checks](software-review-2026-10-25.md) covers Apple/default and tool quality, actual Metal/models, multilingual image quality, audio/voices, background downloads/Files/privacy traffic, biometrics, data-preserving installation, real pressure/cancellation/recovery and sustained performance/heat/energy. These remain NOT_RUN on the phone in this batch. Public Apple API does not let Own force the Core Advanced variant. Safe decisions about session restore, prewarm, image-pipeline retention and previews are explicitly documented rather than represented as proven improvements.

## Historical installation and follow-up evidence

Historical initial scope: all 17 comments after first iPhone installation. Preserve all existing chats and downloaded models. Build 5 is an in-place update of bundle `io.github.ios3kov.own`; never uninstall to update.

| # | Requested behavior | Implementation / acceptance |
|---|---|---|
| 1 | No startup local-network permission | Removed startup discovery; explicit server discovery remains. Check cold launch on phone. |
| 2 | Nine reported code defects | Permission checks before dispatch; no private-message search fallback; chat-owned FIFO; cancellation across image preparation; explicit projector link only; lossless document quoting; immediate image busy state; indexed streaming tool calls; saved image size applied; DNS/redirect checked public-IP-pinned URL transport. Unit/integration and native checks; real network/device scenarios remain separate. |
| 3 | OCR, table tools, audio imports | Vision OCR photos/scanned PDFs; bounded CSV/XLSX with sum/group/filter/duplicates/chart; imported audio decoded locally and passed to installed Whisper. No formula execution or speech-model auto-download. Native decoder/OCR plus JS integration; real Files providers and actual imported speech recognition need phone verification. |
| 4 | Remove GitHub star | Settings promotion removed. |
| 5 | Remove About application link | Project link removed. |
| 6 | Remove X sharing | Promotion sheet, callbacks and stored flag removed. |
| 7 | PIN / Face ID / Touch ID | Four-digit PIN with salted Keychain verifier; optional available biometric authentication; legacy lock preserved. Do not set user credentials during automated phone checks. |
| 8 | Security header safe area | Full-screen modal owns safe area. Native simulator Security/PIN geometry tests and screenshot review. Hardware and large-text review separate. |
| 9 | Apple follows changed requests | Native history retains roles; instruction gives latest changed request priority. ORCHID → TULIP acceptance requires actual Apple model. |
| 10 | Bottom navigation | New coherent vector icons, selected tab treatment, keyboard hiding, native navigation/history, reselect scroll-to-top. Native five-tab test and visual review. |
| 11 | Clear model selection | Task guidance and actual suggested file, estimated memory, size and consent. No automatic model downloads. |
| 12 | Missing Q4_K_M recommendation | Suggestions use actual available complete GGUF files; available fallback rather than nonexistent quantization. |
| 13 | Duplicate confirmation / freeze | Download finalization ownership and recovery de-duplication; nested Core ML folder is not recovered twice. Loading state visible. Existing model bytes retained. Real phone repeated-download/background acceptance separate. |
| 14 | Load-to-memory progress | Llama reports actual progress; Core ML reports preparation phases with an explicitly indeterminate bar, not invented percentages. Cleanup owned by load ticket. |
| 15 | Incorrect tutorial popup | Automatic image tutorial triggers removed; manual help remains available. |
| 16 | Russian puppy image | Translate non-English script locally even when optional improvement is off. Translation-only mode preserves request without extra artistic details. No untranslated Russian SDXL fallback on failure. Semantic image quality requires viewing a real phone output. |
| 17 | Rating popup | Promotion trigger/sheet removed; no StoreKit rating request found in owned source. Check ordinary phone use. |

## Preservation

Before-update app preference/chat directory copied outside the repository to `../own-phone-backup-build1-20261024`. Backup contains two conversations and eight messages. CoreDevice Documents metadata inventory retained outside Git. SDXL is already downloaded; no deletion or re-download is required for installation. Inventory comparison must follow successful update and launch. Never commit private backups or chat content.

## Evidence limits

Mocked-native JS tests establish wiring and state behavior, not real biometric, language-model or media output. Native simulator tests establish only their executed native scenarios. A build or screenshot cannot establish no telemetry under every condition. Device network capture, background downloads, imported-audio recognition, memory pressure, biometrics and actual semantic model output must be recorded separately.

This ledger is in progress. Current test logs and recovery copies live outside the source repository. External PR review/CI is separate from local verification and is not claimed here.

## Expanded whole-app QA (user request during follow-up)

Check actual main paths, not only the gallery: onboarding/startup; all five tabs and back navigation; existing/new chat and changed requests; tools off/on; model guidance/import/download/load/delete; image prepare/cancel/generate/view/save/delete; projects/document sources; OCR/tables/audio; model profiles; voice; Security/PIN/biometrics; storage and About; background/resume and offline behavior. Use synthetic records on the dedicated simulator for destructive tests. Never delete the user's phone records, images or model files.

New gallery defect found: confirmation was presented as a sibling sheet behind a native full-screen viewer. Viewer now renders its own accessible confirmation overlay; cancel keeps the viewer open. File deletion failure keeps the record and shows an error. Multi-delete reports partial failure instead of silently hiding it. Native image identifiers reject path traversal; already-missing image files allow stale thumbnail removal. Real native gallery cancel/single-delete/multi-delete/relaunch tests use two explicitly synthetic simulator images.

Whole-app QA remains in progress. Passing individual paths does not imply every hardware, provider, network or model variant has been exercised.

### Current host QA evidence

- Full JS coverage run before the last header-only adjustment: 212 suites / 5,302 tests passed; later affected PIN tests: 14 passed. Types and lint pass with existing warnings. No blanket security guarantee follows from these checks.
- All 62 native tests passed, including actual raster/scanned-PDF OCR, mono audio conversion and HTTPS public-address transport plus private alias rejection.
- Native screen checks: five-tab navigation; saved model profiles and voice preference; Security/PIN safe areas; seven Settings routes with Back; gallery details/cancel/single delete/multi-delete/no return after relaunch. Earlier gallery attempts exposed missing accessibility labels and were repaired; failed logs remain retained.
- Settled normal-size Models/Settings screenshots reviewed: readable, no clipping. Earlier mid-animation screenshots were rejected as visual evidence.
- Large text first passed the geometry assertion but failed visual review: PIN header wrapped across three lines and introductory copy delayed the fields. The header now scales within bounds and fields come before help. Changed layout still needs a fresh large-text visual check on the installed candidate.
- Composer now uses native SVG symbols, 44-point controls and a separate persistent action row; draft survives opening options, and Send persists only the submitted text. The controls remain available while typing. Actual phone/keyboard visual check is still required.
- Newly picked external file URLs are decoded without sandbox relocation, and the Files picker uses its native local-copy operation before processing. Saved historical document paths keep their separate relocation behavior. Regression/integration checks pass.

## Final installed candidate and remaining checks

Own 0.1.0 (5), bundle `io.github.ios3kov.own`, was the first installed follow-up candidate; live QA below found further defects. The final signed JavaScript bundle SHA256 is `4e4d03aa77bd4a9ee9be78a087fb5866e04c10cabdc8d10d0462de362c3d1d66`. The existing development profile expires on 2026-10-31 at 17:18:19 UTC. No App Store release, merge or new GitHub upload is claimed.

Latest full JavaScript suite: **214 suites / 5,307 tests passed**, statements 88.70%, branches 81.73%, functions 86.37%, lines 90.50%. Types/lint pass with retained warnings. Live dependency audit reports zero known advisories. The local source scanner retains 46 heuristic findings: six credential-like test-fixture assignments, 38 LLM-wrapper token-limit heuristics, a barrel export mistaken for an open endpoint, and a local chat role field mistaken for server authorization. These were reviewed as scoped false positives, not a universal security certification.

The complete native/UI run passed **62 native tests and 11 UI scenarios** with all synthetic fixtures present; no fixture-dependent tests were skipped. Actual supported-device Apple inference was deliberately excluded. The final pairing-only JS adjustment came after that run and has its own unit/integration checks plus the latest full JS suite.

Additional vision correction: Hugging Face pairing now restricts named companions to the selected model identity. Generic companions are allowed only in a single-model-family repository and the same directory; ambiguous same-precision matches are not silently picked. Existing explicit downloaded associations remain intact; native initialization still validates compatibility. Users can explicitly import a companion when automatic association is uncertain.

The corrected large-text PIN header and the composer/keyboard screens were visually reviewed. Native tests proved gallery details, cancel, single deletion, batch deletion and no return after relaunch using disposable images. They also proved all seven main Settings routes/Back controls, real local Llama inference, document source/original opening and draft retention through accessible options-menu open/close. This does not establish every device/provider/model variant.

Historical launch blocker: iOS initially rejected launch while the device was locked. This was resolved on 2026-10-25 when the user unlocked the Mac and connected iPhone Mirroring. Live outcomes below supersede that blocker.

Phone checklist still required:

1. Cold/warm launch and resume; old chats and models usable after hydration.
2. Apple follows a new request after ORCHID and handles saved tool history.
3. Russian puppy prompt is translated and produces a recognizable puppy; repeat an English control prompt, generation cancellation and memory-load progress.
4. Existing gallery open/save/close and confirmed deletion of a new disposable image only.
5. Real Files providers: OCR photo/scanned PDF, CSV/XLSX controls and imported audio recognition with a user-chosen speech model.
6. User sets the PIN themselves; Face ID, fallback, lockout, background lock and interruptions. Touch ID needs a supported iPhone.
7. Background model transfers across lock/background/termination, Wi-Fi/mobile/offline changes and retries, without duplicate prompts.
8. Actual device traffic, optional Apple services, memory pressure, repeated workload/thermal/audio-route behavior and VoiceOver.

These unperformed checks remain **NOT RUN**, not PASS. Full product acceptance is not complete.

Final native review correction: reserved IPv4 /24 prefixes now use all three network octets, so adjacent public addresses are not overblocked. Documentation, private, loopback, shared and deprecated relay ranges remain blocked. The 62 native tests passed again after this change, including public-neighbor boundaries and actual HTTPS retrieval. Prefix source: [IANA IPv4 Special-Purpose Address Space](https://www.iana.org/assignments/iana-ipv4-special-registry/).

Final post-install preservation check (build 5): the two original conversations/eight messages and text/image/Whisper model records match the pre-update backup exactly. All prior document/image/model files remain at the same paths with the same sizes, including 29 SDXL files totaling 3,052,951,722 bytes. This is post-install, **before successful phone launch**. Native executable SHA256: `4bb323c1f31da69f9aece0c556a832a80e0331aaccd504e0878d880edd810a67`. Private recovery copies remain outside Git with restricted local permissions.

## Live iPhone QA, 2026-10-25

Build 5 launched on the iPhone 15 Pro Max (iOS 27.0.1). Apple inference returned `ORCHID`, then correctly returned `TULIP` after a changed instruction in the same conversation. This is actual device evidence for changed-turn behavior; saved tool history is still unverified.

The Russian puppy request initially produced a text refusal rather than starting image generation. The automatic intent classifier only recognized English. Added anchored Russian drawing commands, with negative/tutorial/translation cases kept as text. The integration test now checks the real chat routing function before translation and native-generator dispatch. Focused classifier/image tests: 396 passed.

An English `Draw a puppy` control loaded SDXL and completed 20 steps, producing a recognizable but pale, gray animal sketch. Cold Core ML preparation took several minutes; actual denoising was 35.6 seconds. Native SDXL configuration incorrectly inherited SD 1.x VAE scale 0.18215. Corrected to 0.13025 for XL only, matching Apple's pinned StableDiffusionCLI source; standard models retain 0.18215. Native suite after this correction: 63 passed, zero failures/skips. Actual corrected image appearance remains to be tested. Model source: [Apple SDXL iOS model card](https://huggingface.co/apple/coreml-stable-diffusion-xl-base-ios/blob/main/README.md).

Gallery on the physical phone: new image opens; Info/Done and Close work; Delete shows its confirmation above the full-screen viewer; Cancel preserves the image. No physical-phone image was deleted. Original thumbnails were blank due to persisted paths referencing the old iOS container UUID. Gallery, share and chat attachment display now resolve saved sandbox paths at use time, without rewriting original chat/image records. Unit plus rendered integration/gallery checks: 36 passed. Live updated-path check remains required.

Post-hydration preservation: both original conversations (eight messages) are exactly unchanged. Text/Whisper records unchanged. Both original image-model records retained, with only the expected sandbox UUID relocation in modelPath; Documents-relative targets unchanged. Two QA conversations and one QA image were added separately.

### Multilingual correction after the live translation failure

The build-7 Russian request entered image mode but Apple returned an English refusal, which the old script-only check accepted as a description. The run was cancelled during loading; it saved no image. This disproves the earlier assumption that English-looking output alone is a valid translation.

The correction applies beyond Russian: local Apple Natural Language recognition identifies Latin-script and other languages; uncertain non-English requests use the selected on-device text model for intent, without English short-message/question heuristics rejecting CJK requests. The translation request is explicit in the latest user turn and quotes the source text as data. Refusals and still-untranslated output stop before SDXL. Translation failures now read current service state and show an actionable alert rather than relying on stale component state. Apple unsupported-language failures have a specific message. No automatic language/model download or cloud translation was added.

Focused routing/translation/negative-path tests: 513 passed. The integration matrix exercises Spanish, French, German, Italian, Portuguese, Polish, Turkish, Russian, Chinese, Japanese, Korean, Arabic, Hindi and Thai with mocked model responses. This verifies wiring, not the real model's language skill. Native suite: 64 passed, zero skips; actual local language recognition separates English from those 14 languages. The selected text model still determines which languages it can translate; support for all world languages is not claimed. Required real-phone translation and output checks remain open.

### 2026-10-25: follow-up routing and composer layout

- Removed both implicit image-only routing branches. Automatic mode classifies the current message; missing text weights no longer imply an image request. A text request without a selected text engine shows a model-selection explanation. Apple selection remains eligible for text.
- Composer input and attachment/options controls share a horizontal row. The text field can shrink; the controls retain their 44-point targets without wrapping below it.
- Intent cache now uses the full normalized request, avoiding the reported shared-200-character-prefix collision (performance backlog item 56).
- PASS: 215 tests across routing unit, composer component and image generation integration suites. Physical follow-up routing, keyboard layout and large-text rendering: NOT RUN on these changed bytes. Not installed yet.


## Build 13 verification checkpoint — 2026-10-25

Installed Own 0.1.0 (13) in place and launched. No uninstall or reset. Preservation comparison PASS: all 9 original chats / 40 messages, model records, and 32 original files (paths and sizes). Final checks PASS: 225 suites / 5,399 JavaScript tests, TypeScript, lint with existing warnings, 65 native tests, signed Release device build, strict signature check, whitespace check. Scanner retains 46 baseline candidates; release readiness not assessed.

Physical Build 12 proved ordinary text after image history (2+2 -> 4), Russian cat generation, and moving loading indicator. Build 13 visually proved missing-image fallback. Final Build 13 3+3 response NOT VERIFIED: after the user locked again, Mirroring still reports iPhone in Use and waits to reconnect. Do not claim this last check passed.

Full 90-entry plan remains INCOMPLETE. Current truth is in specs/personal-privacy/performance-plan.md. Major open groups: vision on demand, successful configuration persistence, hardware recommendations, engine/session/context tuning, full Whisper resource arbitration, document retrieval fallback, enhanced voices, and device thermal/energy benchmarks. No commit or push performed. All private backups remain outside Git. No native builds currently running.


## Batch 5 final verification — 2026-10-25

Mac-only changes: explicit document-search unavailable result/tool output/chat notice; bounded scored top-K; correct SQLite embedding buffer decoding; full-request classifier with 8-token native cap; coalesced concurrent Apple availability checks; serialized Whisper resource work, delayed-start and permission-phase cancellation protection, language/model consistency; removed duplicate embedding warmup.

PASS: 227 suites / 5,410 tests (coverage run), TypeScript, full lint (0 errors / 37 existing JS warnings, existing Swift warnings), Release simulator build, git diff --check. Logs: own-mac-batch5-reviewed-{jest,types,lint,ios-build}.log. Scanner: 46 candidates, no new rule/path pairs versus Build 13; review_required / release_readiness not_assessed. No Swift source changed in this batch; prior 65 native tests are historical evidence, not a new run.

No phone operations, installation, download, data deletion or storage migration. Build 13 remains installed on phone. Current Mac changes are uncommitted/unpushed. All 90 user requirements remain in Own/specs/personal-privacy/performance-plan.md; full plan INCOMPLETE, including software tasks that do not require a phone. Next priority: hardware recommendation UX and vision-on-demand/separate readiness, then persistent successful load profiles, session/context/diagnostic and voice selection work. Device testing still needed for real microphone capture/cancellation/language quality, document-search notice layout, classifier quality, energy/thermal/performance comparisons. No active build/test jobs remain.


## Mac-only follow-up, 2026-10-25 — Batch6

The physical phone has not been accessed or updated during this batch. Build13 is still the last installed build. No chat, downloaded model, image, credential or app container was removed or reset.

Changes implemented and covered by focused unit/integration checks:
- Lazy vision initialization, retaining the text engine; old assistant-generated images do not trigger vision. A failed vision component leaves later ordinary text replies usable.
- Bounded successful-load profiles keyed to file identity, device RAM, requested initialization parameters and actual engine version; cancellation cleanup remains owned by the loader.
- Native local processor/thermal/LowPower facts for Auto thread selection; reactive device/RAM model advice and suggestions based on files actually offered by the repository.
- Installed Standard/Enhanced/Premium voice selection with local settings, language fallback and cancellation ownership. No voice download is started by the picker.
- Apple26.4+ native full-transcript token preflight, turn-preserving history trimming and visible context notices; stored chat history is retained. Apple runtime behavior remains NOT_RUN on the phone.
- Native token/cache counts when supplied; estimates visibly marked when only stream events are available. Auxiliary resident model estimates and separate loading-stage/retrieval timings.
- Independent batch/micro-batch settings; request-owned stop arrays; reduced duplicate debug formatting.
- Document search uses256-row SQLite keyset pages and retains bounded top-K results, yielding between pages. Full vector scan remains; performance/index work is open.
- Streaming answers/reasoning use plain selectable text until stable; finished Markdown is memoized. Whole-row render isolation and cadence profiling remain open.
- Screenshot review corrected model-advice columns/contrast and voice-sheet transparency. Compact navigation/model controls now limit text scaling to1.5x, while long content/voice entries scroll. This limitation is explicit; whole-app Dynamic Type support is not certified.

Verification and final screenshot paths are maintained in the external `own-final-handoff.md` and `own-followup-checkpoint.md`, outside the repository. Full plan status remains in `specs/personal-privacy/performance-plan.md`; known software work must not be reclassified as phone-only testing.

Batch6 final gates:238 JavaScript suites /5448 tests PASS, final navigation7 focused tests PASS, TypeScript/lint0errors, native68 PASS on unchanged productionSwift, final Release simulator2 UI tests PASS /0skipped; normal/maximum-text screenshots visually reviewed. Physical iPhone Build13 and its data remain untouched. Full plan is incomplete; the software-open items remain listed in the performance plan.
