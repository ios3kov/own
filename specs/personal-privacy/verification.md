# Own verification

Status: INCOMPLETE. Evidence refers to the active Own source-only candidate, version0.1.0(1). Earlier recovery workspaces are excluded from delivery.

| Gate | Result | Evidence and limits |
|---|---|---|
| Clean npm install + seven native patches | PASS | Final lockfile installed; patched native package versions unchanged. Dependency API smoke passes. |
| JavaScript unit/integration/UI component tests | PASS | 193 suites,5524 tests passed,4 skipped; current T09 run exited0. Jest reports delayed shutdown/open-handle warning; this is recorded, not hidden. |
| TypeScript | PASS | Active candidate types checked after T09 hook API change; exit0. |
| JavaScript lint | PASS with warnings | 0 errors,30 warnings; warnings remain reviewed/incomplete work, not erased. |
| SwiftLint | PASS with warnings | Installed0.65.1; no-cache command exits0; native style/complexity warnings remain. |
| Native crypto and destination policy | PASS | Independent native vectors and deny-list tests compiled/executed as Objective-C and Objective-C++. |
| Renamed Release simulator build/start | PASS | Latest T09 Release simulator rebuild exits0 (own-eta-ios-build.log), including latest native error copy. Earlier scene startup and actual welcome screen viewed; latest screen/runtime not rerun. |
| Apple default/Home/relaunch UI | PASS | XCTest UI run4 passed; screenshot viewed, Apple remains selected without downloaded files. |
| Native storage tests | PASS | Current52 tests passed, including8 storage/HTTP/path safety cases. Symlink regression failed before the fix and passed after it. |
| Real local Apple chat | FAIL in simulator | UI chat probe reaches native response generation but Apple model service throws ModelManagerServices.ModelManagerError1026. Host macOS26.6.2 and simulator iOS27.0 differ; Apple documents simulator use of host model and matching-version requirements. This is a likely environment cause, not proven physical-phone behavior. Tools/schema/history setup passed the diagnostic phase. |
| Dependency advisories | OPEN | Compatible fixes reduce to15 findings:0critical,4high,11moderate. High findings currently trace to Metro image-size and ESLint/Zod build tooling; full release-bundle reachability review remains. |
| Identity | PARTIAL | Owned-source text and binary scan reviewed; original editor path and marketing cover removed; own icon and Home visually inspected. Final built-bundle scan remains. |
| Google live search | FAIL / UNVERIFIED | Earlier Mac request received a JavaScript challenge. Parser handles challenge honestly. Phone successful result search remains unverified. |
| Device/background/speech/traffic/model import | NOT_RUN | Physical iPhone and full download/background/lock/retry/cancel/storage/network scenarios remain. HF search and Files GGUF(+vision) import confirmed in source. |
| T09 measured download estimate | PASS for source behavior; device NOT_RUN | Four focused suites /47 tests pass, including actual download-store to visible-card integration. TypeScript exits0; focused ESLint exits0. Real phone transfers, background recovery and rendered ETA review remain NOT_RUN. |
| T10/T11 additions and final T17 settings | NOT_COMPLETE | T10 pinned source/API research recorded in ash-reference-review.md; playback, citations/context and final simple model settings remain. |

Current native log: work/own-validation-5.log outside the delivery tree. Prior UI result: work/own-ui-validation-4.xcresult. No physical phone install, Git publication or release has occurred.

Final review has found and corrected real defects: scene lifecycle startup crash, onboarding/relaunch forcing model downloads, stale test fixtures, missing button accessibility roles, network changes after download consent, unsafe multi-file destinations, and false completion after file-save failure. This review does not establish complete security or readiness.

T09 separate self-review: inspected the utility, hook and active download card against measured-only ETA, combined-byte progress, retries, stale data and timer cleanup. Corrected a transient old-task sample by gating task ID and byte rollback before rendering. Source implementation does not change the native background downloader. Integration initially failed a global timer-count assertion because React Native also owns timers; it now checks that this hook clears its interval. All47 focused tests pass. There is no independent-agent review or actual phone/visual proof for T09 yet. Logs: work/own-eta-regression.log, work/own-eta-types.log, work/own-eta-lint.log, outside delivery tree.

## Current feature verification update — 2026-10-24

This section supersedes older T10/T11/T17 implementation status above.

- T10: native55 tests PASS (own-speech-native-final.log), including real installed basic-voice playback and cancellation. Full speech-stage JS196 suites /5543 PASS,4 skipped. Voice opt-in/relaunch UI PASS; default light screenshot reviewed.
- T11: trusted document sources, saved excerpts and project-scoped original-file lookup implemented; actual local tokenizer/managed-prompt context count with reply reserve, honest unavailable capacity for other engines. Seven focused suites /270 tests PASS (own-t11-focused-2.log). Generation ownership fixes prevent stale data/errors affecting a new response. Native rendered citation/context flow NOT RUN.
- T17: plain controls, built-in/custom local profiles, supported-parameter filtering, history limits, explanations, memory warnings and advanced sections implemented. Four initial focused suites /168 PASS,1 skipped. Profile save while keyboard open, relaunch, apply and remove passed on Own QA iPhone17e/iOS27 simulator (own-t17-ui-4.log). Two screenshots visually reviewed at1170x2532 light/default text; headings, choices and profile controls fit without overlap. Earlier three UI attempts failed due test gestures hitting keyboard; corrected test targets the actual RN wrapper and visible coordinates.
- Separate final review found Reset did not meet the plan's chosen-profile requirement. Fixed with persisted engine-specific reset baseline, validated and whitelisted on hydration. Twelve focused tests PASS, including rehydration, failed persistence, reset after custom selection and screen remount. Types and scoped lint exit0. New final UI/full regression are still running; do not substitute earlier artifact results.
- Full JS before reset fix:203 suites /5570 PASS,4 skipped; process exit0, delayed shutdown warning remains recorded. Full app ESLint0 errors/38 warnings; current targeted scopes clean.
- Source identity scan:762 files checked, two raw-byte matches in Android third-party libraries are a lowercase Unicode script alias, not retired identity. No app-brand match in source. Final current iOS bundle scan still pending.
- Scanner41 heuristic findings:39 max-token findings, one export-as-endpoint and one local message-role finding. These require contextual classification; no certification or zero-finding claim. Dependency15 advisories remain open, including build-tool image-size/Zod high findings; no blind major override.
- Physical phone installation and all device/traffic checks are NOT RUN and explicitly deferred by the user. Simulator Apple generation still has model service error1026; successful local Apple reply is not proven. Dark/large-text and source/context runtime review remain open.

Final reset-source checks:203 suites /5571 tests PASS,4 skipped (own-final-regression.log); scoped reset tests12 PASS; TypeScript and scoped ESLint exit0. Delayed Jest shutdown warning remains. Dependency API smoke PASS (own-final-dependency-smoke.log). `npm ls --omit=dev` still includes image-size through React Native's community CLI/Metro dependency; this is build tooling even though RN declares the CLI in its production tree. Zod is absent from this production tree; neither package has a direct application-source import. This is scoped reachability evidence, not proof that all advisories are harmless. Current built iOS identity scan78 files /0 matches with hashes recorded in own-features-built-identity.json.

Final T17 simulator result: PASS on Own QA iPhone17e/iOS27.0, Release build. Normal/light flow (own-t17-ui-reset.log) and dark/accessibility-extra-extra-large flow (own-t17-ui-accessibility.log,154sec) both exercised save, restart, choose profile, edit, reset, supported technical controls and removal. Two final accessibility screenshots reviewed: text and buttons wrap, selected choices remain visible, no observed overlap within the viewed scroll positions. Large-text first run failed the test's eight-scroll limit; raised bounded limit to32 and reran successfully. QA simulator restored to light/large. Remaining source/context runtime, local Apple reply1026, dependencies and all phone/traffic/download/background checks remain open; no full readiness claim.

## Initial repository upload — 2026-10-24
The user explicitly requested uploading the current project. Source is on `feat/current-own-project`, draft PR https://github.com/ios3kov/own/pull/1. An initial README-only commit bootstraps main; the project has not been merged or released. Upload excludes node_modules, Pods, local assistant permissions, machine environment overrides, device logs and built app output. Required bundled embedding models/native libraries and two simulator screenshots are included. Secret-key pattern scan found no candidates in760 initial files; this is not an exhaustive security guarantee. Existing native patches retain their required context whitespace. GitHub CI started; no Gemini review had appeared at the first check. Phone/security/dependency gates above remain open.

## 2026-10-24 — host completion repairs (uncommitted candidate after f29c6dc)

These records supersede older results only for the named changed scope. Full acceptance remains open; Android removal is a new final task (T18).

- **PASS, credential boundary:** reproduced raw provider keys in persisted preferences before repair (2 failing assertions, `own-credential-before.log`). The real manager/store now strips keys, migrates old keys to Keychain before cleaning preferences, preserves data on migration failure and provides retry. Keychain false results cannot report successful key/passphrase storage. Unit/integration/auth/profile regression:41 tests (`own-credential-regression.log`).
- **PASS, dependency installation/API scope:** clean `npm ci` applied8 patches and reported0 advisories (`own-clean-fixed-dependencies.log`). Updated image-size required a real Metro file-path consumer repair: reproduced build/probe failure, patched Metro to read image bytes, then verified PNG path transform, Xcode parse/write/UUID, Markdown safety and other resolved consumer APIs (`own-clean-resolved-api-check.log`). This does not establish native runtime safety.
- **PASS, native privacy-cover scope:**57 native tests plus foreground UI check in Release simulator (`own-security-native-fixed.log/.xcresult`). Includes actual installed basic-voice playback/cancel. Physical app-switcher capture remains NOT RUN.
- **PASS, RAG transaction/retry scope:** document+chunk insertion is atomic; failed chunk writes allow retry; overlapping imports release their in-flight guard on failure. Focused storage/RAG/generation tests pass (`own-rag-foundation-final.log`).
- **PASS, current saved-source UI scope:** source chip, saved excerpt, project-scoped original file, exact contents after iOS changed the app-container UUID, and close (`own-source-original-ui.log/.xcresult`). Original/excerpt screenshots exported and visually inspected at1170×2532; text readable, controls visible. Synthetic saved conversation proves presentation and original-file resolution, not actual retrieval/model generation. Earlier skipped/bad-selector/failing runs are not counted as passes.
- **PASS, exact-document regression scope:**38 tests across path unit/source integration/document-preview screen (`own-document-resolution-final.log`). Old preview could guess a different same-named file; removed that fallback. Safe container-relative rebasing rejects traversal/control characters and never selects a target by basename.
- **PASS, permanent import regression scope:**73 tests across import helper and real knowledge-base/project screens (`own-document-import-final.log`). New picker imports retain a unique document-directory copy before indexing, rather than persisting a temporary picker path. Real Files-provider transport remains NOT RUN.
- **PASS, hook failure handling:** a controlled fake lint failure stops the actual push hook before later checks; recorded nonzero status (`own-hook-fail-fast.json`). No bypass used.
- **Host-dependent Apple probe retained:**`npm run test:ios:apple` explicitly includes the real-model probe. Ordinary iOS CI excludes this single host-dependent test; it still runs all native tests and other UI checks. The earlier actual response failure1026 remains FAIL on this host, not resolved or converted to PASS.
- **Storage inventory:**[privacy limits and physical-device checklist](../../docs/privacy-and-phone-checks.md) documents AsyncStorage backup exclusion, Keychain policy, local SQLite/document limits and the lack of independent app-level data encryption. Platform lock-state, backup/recovery and real app traffic remain device acceptance work.

Full current regression, real local Llama/context, signed generic build and T18 cleanup are still in progress. No new candidate push, release or phone installation is claimed by this section.

### Real local-engine simulator acceptance

**PASS** `own-local-llama-valid.log/.xcresult`: explicit selection through the normal model picker, CPU load, real generation, measured context display and completed assistant reply. Saved synthetic reply has32 generated tokens and CPU/f16 metadata (`own-local-llama-result.json`). Screenshot `own-local-llama-valid-attachments/46713157-28FC-44E5-9A4D-2F32287E5E1E.png` inspected at1170×2532: measured context about20%, readable reply, input/keyboard fit. This is a tiny engine fixture, not evidence of useful model quality or phone performance. Earlier selector skips/failures did not reach generation; one later load failed because the fixture combined flash-attention OFF with quantized V cache, which the native engine rejects. Normal settings controls already prevent that combination. Corrected fixture uses CPU/f16. No product download or production test backdoor was added.

## Review findings — 2026-10-24, dirty iOS-only candidate

The reported direct local-address bypass, forced knowledge-search re-enabling and unsupported Apple tool-history role were reproduced with regression tests before the fixes (`../own-review-findings-before.log`: 10 failed, 172 passed). A later test-harness timeout came from an empty `it.each` row and was corrected; it was not an application failure.

- URL reading now parses the address with the application's WHATWG URL polyfill before classification. Decimal, short and hexadecimal IPv4 loopback forms, IPv6 loopback/mapped/local forms, localhost trailing dots and URL credentials are rejected before fetch. Ordinary public URLs retain existing behavior. This is direct-address validation, **not** DNS-rebinding protection or proof of redirect destination enforcement.
- Restoring explicit tool preferences no longer adds knowledge search. Sending and regenerating project chats respect that setting for both tool availability and automatic document retrieval. An enabled knowledge setting can still provide local document context to a model without native tool support.
- Saved `tool` messages are passed to the Apple bridge as clearly labeled reference data in a supported user role. Stored messages remain unchanged. The native model's actual response with this history still requires a supported-device test; this host previously failed the explicit Apple-model probe with error 1026.
- Model profile tests now cover retained Apple/Llama/remote backends; removed engine-specific parameter cases were removed with the unsupported implementation.

Focused verification: **PASS 357 tests / 7 suites** in `../own-ios-reviewed-focused-final.log`, including actual application URL polyfill, store restore, chat send/regenerate, Apple bridge integration, Core ML delegation and bounded CPU retry context. TypeScript has no errors in `../own-ios-types-final.log`. These results do not establish full application readiness. The wider iOS-only regression suite and fresh native builds remain pending.

### Retained iOS tests and imports

The first complete iOS-only run was **FAIL**: 61 failed, 5,286 passed, 203 suites (`../own-ios-cleanup-tests-2.log/.json`). Failures included unsupported-backend expectations, test mocks that ignored Zustand selectors and attempts to operate removed attachment popovers instead of the native iOS action sheets. Retained cases now exercise iOS sheet callbacks and explicit Apple-speech-disabled selection. Obsolete engine-only scopes were removed; generic Core ML loading, CPU fallback and iOS background-download cases were retained.

Additional source defects found during review:
- Import filenames were joined into the model destination without a basename boundary. Six regressions failed before the fix; both main and vision filenames now reject separators and control characters before copying (`../own-import-name-before.log`).
- Failed Core ML archive discovery could leave staging files and move the selected source. The importer now copies the source, refuses existing staging destinations, and cleans only its newly owned archive/directory on failure. The regression failed before this fix (`../own-zip-cleanup-before.log`). The installed SSZipArchive implementation also sanitizes archive entry paths and restricts symlink destinations; this inspection is not a guarantee about arbitrary model files.

Focused retained results: **PASS 247 tests / 3 suites** (`../own-ios-import-attachment-final.log`); **PASS 26 hook/import tests**, including selected-source preservation on failed archive import (`../own-zip-cleanup-after.log`). A fresh full coverage run is in progress; the earlier failed complete run remains historical evidence.

### iOS dependency reinstall

A default offline npm install failed when llama.rn's postinstall tried to download native artifacts from GitHub. The package's documented-in-code `RNLLAMA_SKIP_POSTINSTALL=1` option is now used in CI/build instructions because the existing iOS Podfile builds that runtime from package sources. No upstream package files were removed to hide another platform. **PASS** clean install with all four retained patches (`../own-ios-clean-install-fixed.log`), actual resolved consumer APIs (`../own-ios-dependency-apis.log`) and pod install (103 Podfile dependencies / 104 total pods, `../own-ios-pods-cleanup.log`). Live npm audit reports **0 advisories** (`../own-ios-live-audit.json`). Types have no errors and ESLint has 0 errors / 39 warnings; SwiftLint also completed with warnings. Current source and tests still require the full coverage/native/simulator result before completion.

## Final host checkpoint, 2026-10-24

This section supersedes earlier in-progress summaries. It does not supersede failed historical evidence or certify release readiness.

| Check | Scoped result | Evidence outside the source tree |
|---|---|---|
| Final iOS-only JS unit/integration coverage | PASS: 5,329 tests, 202 suites; statements 89.26%, branches 82.41%, functions 86.79%, lines 90.77% | `../own-ios-upload-full-coverage.log` |
| Types and ESLint | PASS: no errors; 39 lint warnings remain | `../own-ios-upload-types.log`, `../own-ios-upload-eslint.log` |
| Native Release tests | PASS: 58 tests, including private PDF diagnostic payload suppression | `../own-ios-final-source-model.log/.xcresult` |
| Real source and local-model simulator flows | PASS: both explicit fixture tests, no skips; original document opens after a sandbox move; CPU/f16 fixture saves a nonempty 32-token reply and displays measured 20% context | same result bundle; `../own-ios-final-local-model-result.json` |
| Profile/settings flows | PASS: normal/light and dark/accessibility-extra-large, save/relaunch/apply/reset/remove; actual screenshots inspected at 1170x2532 | `../own-ios-final-settings-light*`, `../own-ios-final-settings-dark-large*` |
| Fixture restoration | PASS: exact pre-fixture manifest, synthetic model/document/database row removed | `../own-ios-final-fixture-restoration.json` |
| Dependency installation/consumers | PASS: normal lifecycle scripts with supported source-build option, four patches, 104 Pods, actual Markdown/Metro/Xcode/XML/shell/ESLint consumers | `../own-ios-clean-install-fixed.log`, `../own-ios-pods-cleanup.log`, `../own-ios-final-dependency-apis.log` |
| Live npm audit | PASS: 0 known advisories | `../own-ios-live-audit.json` |
| Signed iPhone app | PASS: Release build and deep/strict signature verification; no phone install | `../own-ios-signed-final-evidence.json` |
| Incremental signing regression | PASS: a changed JS bundle is re-signed; exact source restored and rebuilt; both signatures valid and the temporary fixture absent from the final bundle | `../own-signing-regression.json` |
| Local archive guard | PASS: invalid signature fails, valid result succeeds, existing archive is refused in controlled runner tests; actual archive/export NOT RUN | `../own-ios-archive-guard-tests.json` |
| Identity review | PASS for explicit raw identity patterns: 642 owned files and 76 final packaged files, 0 findings | `../own-ios-final-identity-verified.json` |
| Static security patterns | REVIEWED, raw scanner exit 1: 48 pattern findings; six synthetic test credentials, forty client/type/import/settings/test output-limit patterns, one client barrel export, one local chat-store role | `../own-ios-verified-source-scan.json`, `../own-ios-verified-source-triage.json` |

The original signature failure was real: an incremental build changed main.jsbundle while retaining its previous resource seal. The bundling phase now declares its output and remains scheduled for JS changes. The regression used two different bundle hashes, verified both signatures, restored the source byte-for-byte and rebuilt the original bundle. The archive helper also verifies the produced app before reporting success.

Final signed artifact: Own 0.1.0 (1), `io.github.ios3kov.own`, development signing team `5U2ZS7H265`, profile expires `2026-10-31T17:18:19Z`. Executable SHA-256: `23971901b0617e6363f8b062d9c6913bd2e58ed0ca6e258f76ea58cec5b55019`. JavaScript bundle SHA-256: `74cea95e3b14b603a7b0d15ad48df1414d995b38e15cab7a0a22fab629b2052e`.

The final import review reproduced failures for literal percent characters in local filenames. Model import now uses the shared safe local-path resolver, decoding file URLs once and preserving plain filesystem names. The obsolete content-provider branch was removed. Relevant unit checks passed 167 tests; document integration checks passed 15 tests; the final full suite above includes this correction.

T18 removed the owned target/native assets, unsupported inference/image backends, obsolete patches, direct platform CLI dependency, packaging metadata, build/CI commands and unsupported tests. A test-local copy of recommendation logic was removed; actual hook filtering tests remain. Shared upstream packages and their notices remain intact. Superseded technical guides now point to the current iOS component/acceptance map. Recovery material and Own Git history remain preserved.

Remaining acceptance: the thirteen groups in [the phone checklist](../../docs/privacy-and-phone-checks.md), including an actual supported Apple reply with saved tool history, real background transfers, traffic, Files providers, permissions, audio and sustained device workload. The earlier explicit host Apple-model probe failed with error 1026; a real phone result is NOT RUN. Direct-address checks do not establish DNS/redirect enforcement. Source review, a zero-advisory database result and simulator success are not malware/privacy certificates. Uploaded-candidate CI and Gemini/Codecov/Sonar results must be checked separately; absent services are not passes. No merge or public release is authorized by these host results.

### Push-hook correction

The first upload attempt was stopped by the pre-push hook after its 4,833 related JS tests / 173 suites passed. Explicit-file SwiftLint also checked files excluded from the default directory scan and found seven errors in fixture helpers and the branding script. Forced fixture operations now propagate errors to XCTest, and path variables have descriptive names; no lint rules or hooks were weakened. Scoped SwiftLint and branding-script type checking pass. The corrected native suite passes all 58 tests (`../own-ios-test-fixture-lint-fix.log/.xcresult`). The branding generator was not run and image geometry/exports were not regenerated. The initial blocked push is preserved in `../own-ios-final-push.log`; the retry must pass the full hook before upload is claimed.

Unified-patch context lines in the Metro patch retain required whitespace. Source diff checks exclude that patch-format exception; clean-install patch application and actual Metro file-path transformation passed. Do not strip patch context to silence a generic whitespace check.
