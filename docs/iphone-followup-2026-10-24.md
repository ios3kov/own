# iPhone follow-up acceptance — 2026-10-24

Scope: all 17 comments after first iPhone installation. Preserve all existing chats and downloaded models. Build 5 is an in-place update of bundle `io.github.ios3kov.own`; never uninstall to update.

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

Own 0.1.0 (5), bundle `io.github.ios3kov.own`, is the final follow-up development build. The final signed JavaScript bundle SHA256 is `4e4d03aa77bd4a9ee9be78a087fb5866e04c10cabdc8d10d0462de362c3d1d66`. The existing development profile expires on 2026-10-31 at 17:18:19 UTC. No App Store release, merge or new GitHub upload is claimed.

Latest full JavaScript suite: **214 suites / 5,307 tests passed**, statements 88.70%, branches 81.73%, functions 86.37%, lines 90.50%. Types/lint pass with retained warnings. Live dependency audit reports zero known advisories. The local source scanner retains 46 heuristic findings: six credential-like test-fixture assignments, 38 LLM-wrapper token-limit heuristics, a barrel export mistaken for an open endpoint, and a local chat role field mistaken for server authorization. These were reviewed as scoped false positives, not a universal security certification.

The complete native/UI run passed **62 native tests and 11 UI scenarios** with all synthetic fixtures present; no fixture-dependent tests were skipped. Actual supported-device Apple inference was deliberately excluded. The final pairing-only JS adjustment came after that run and has its own unit/integration checks plus the latest full JS suite.

Additional vision correction: Hugging Face pairing now restricts named companions to the selected model identity. Generic companions are allowed only in a single-model-family repository and the same directory; ambiguous same-precision matches are not silently picked. Existing explicit downloaded associations remain intact; native initialization still validates compatibility. Users can explicitly import a companion when automatic association is uncertain.

The corrected large-text PIN header and the composer/keyboard screens were visually reviewed. Native tests proved gallery details, cancel, single deletion, batch deletion and no return after relaunch using disposable images. They also proved all seven main Settings routes/Back controls, real local Llama inference, document source/original opening and draft retention through accessible options-menu open/close. This does not establish every device/provider/model variant.

Phone launch is **BLOCKED**: iOS rejected the launch while the device was locked, and iPhone Mirroring requires the Mac to be unlocked. Installation and post-install data checks do not establish startup, runtime quality or app traffic.

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
