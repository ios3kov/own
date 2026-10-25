# Model reliability and performance plan

Updated 2026-10-25. User items retain their original IDs. Preserve existing chats, downloads and images. No automatic model downloads. No developer telemetry. Apple server use must be explicit in model description and follow the user’s Apple-access preference.

Use unit and cross-module integration regressions for behavior changes; use native builds and real device checks where needed. Benchmarks require identical model, prompt, settings, hardware, thermal state and measured outputs. A simulator or mock cannot prove throughput, energy, quality or Metal execution.

Order: confirmed correctness and lifecycle failures; loading policy and memory ownership; Apple/default and recommendation UX; context/cache/streaming work; measured engine/media tuning. Independent hardware checks remain open.

| User ID | Acceptance target | Status |
|---|---|---|
| 0 | Apple Core Advanced default | Platform constraint reviewed: public SDK uses SystemLanguageModel.default; Apple chooses the on-device variant. Do not label the selected model Core Advanced or promise a forced variant. Supported-device acceptance remains NOT_RUN. |
| 00 | Hardware-based model recommendations | Local device/RAM/storage advice and real catalog files implemented; unit/RNTL and scoped normal/large-text simulator UI PASS. Measured fit on actual phones NOT_RUN. |
| 1 | Skip unchanged history writes | Fixed in source; unit/integration PASS; phone acceptance NOT_RUN |
| 2 | Stop permanent architecture retries | Source regression checks PASS; physical acceptance and measured effects NOT_RUN |
| 3 | Keep successful reduced-context load | Source regression checks PASS; physical acceptance and measured effects NOT_RUN |
| 4 | Apply device context cap before init | Source regression checks PASS; physical acceptance and measured effects NOT_RUN |
| 5 | Cancel or reclaim timed-out loads | Source regression PASS for text/image late-load reclamation; native calls remain non-interruptible mid-call; phone cancellation acceptance NOT_RUN |
| 6 | Remove fixed 350ms load delay | Source regression checks PASS; physical acceptance and measured effects NOT_RUN |
| 7 | Load vision only when needed | Implemented lazy projector initialization on user-image input; ordinary text does not load vision; unit/integration PASS; real-model device acceptance NOT_RUN |
| 8 | Separate text and vision readiness | Separate linked capability from native vision readiness; retain text context through vision success/failure; unit/integration PASS; real native projector acceptance NOT_RUN |
| 9 | Plan context and memory before init | Device cap and memory estimate applied before init; source regression PASS; measured memory profiles remain open (46) |
| 10 | Reduce GPU allocation before CPU fallback | Source regression checks PASS; physical acceptance and measured effects NOT_RUN |
| 11 | Classify load failures | Source regression checks PASS; physical acceptance and measured effects NOT_RUN |
| 12 | Retain successful configuration and fallback reason | Bounded persisted successful-load profiles keyed by actual engine version, file identity, device RAM and requested init parameters; unit/integration PASS; real model acceptance NOT_RUN |
| 13 | Retain active text model between messages | Existing text context retained across messages, including lazy vision; native init/release regression PASS; sustained real-model residency NOT_RUN |
| 14 | Measure selected-model preloading | Reviewed: load text on explicit selection/use, retain while active; only explicitly configured classifier preloads in Performance mode. No new automatic warmup without an energy/latency comparison. Physical benchmark NOT_RUN. |
| 15 | Reload only for init settings | Existing pending-settings check covers init-only fields, now including micro-batch; temperature/response length stay live; source/component regressions PASS |
| 16 | Remove unnecessary KV resets | Removed occupancy/truncation reset; chat-switch isolation reset retained; native cache effectiveness NOT_RUN |
| 17 | Review 70-percent cache threshold | Source regression checks PASS; physical acceptance and measured effects NOT_RUN |
| 18 | Isolate and restore chat caches | Reviewed: keep explicit cross-chat clearKVCache(false), as installed engine requires this for recurrent/hybrid isolation. Do not reuse opaque state across chats; real-model isolation/restoration benchmark NOT_RUN. |
| 19 | Keep system prefix and tool order stable | Registry filters tools in stable declaration order; copied stop arrays prevent cross-request mutation; native prefix/cache efficiency NOT_RUN |
| 20 | Reuse formatting and tokenization | Request-scoped prepared formatter reused by meter and actual llama wrapper for exact matching inputs on engine0.12.0-rc.9; diagnostics reuse meter. Unit/integration PASS. Native engine tokenization remains internal; no public pre-tokenized completion API. |
| 21 | Count tools and images in context | Local context meter uses actual formatted tools/media; Apple26.4+ preflight counts full transcript including tool definitions with native tokenizer; device validation NOT_RUN |
| 22 | Bound relevant history | Existing limitChatHistory bounds generation and preserves stored messages; Apple native request cap additionally preserves latest user turns/system instructions; unit/integration PASS |
| 23 | Budget retrieved document context | Automatic retrieval now uses context budget; serialized source wrappers and escaping count toward excerpt limit; character heuristic remains approximate, not a full remaining-token budget |
| 24 | Measure retrieval separately | Search result exposes separate retrieval duration in milliseconds; instrumentation present; actual document-search latency benchmark NOT_RUN |
| 25 | Avoid unnecessary classifiers | Existing pattern-first routing avoids LLM classification for clear intents; bounded internal classifier uses full request and disables Thinking; semantic device acceptance NOT_RUN |
| 26 | Evaluate engine session restoration | Evaluated installed native save/load session API: opaque KV/token state needs exact model/config/history identity and supported-model round-trip proof. Keep safe fresh per-chat state; no unverified disk KV restoration shipped. Physical round-trip benchmark NOT_RUN. |
| 27 | Device/model auto thread count | Local native active-core/heat/LowPower facts and model size inform Auto threads at load; explicit settings preserved; unit/integration/native bridge PASS; tuning benchmark NOT_RUN |
| 28 | Separate batch and microbatch | Independent n_batch/n_ubatch; Auto micro-batch capped at128 and at batch size, advanced override wired to native init/reload identity; unit/integration PASS; performance comparison NOT_RUN |
| 29 | Verify actual Metal backend | Actual native GPU availability/layers and CPU fallback reason captured in successful launch metadata; unit/integration PASS. Actual Metal execution on phone NOT_RUN. |
| 30 | Tune GPU layers for sustained load | Memory admission, reduced GPU fallback and successful-config profiles implemented. Sustained layer/thermal tuning is a physical benchmark NOT_RUN. |
| 31 | Compare flash attention and KV formats | Explicit Flash Attention/KV controls retained and passed to engine; comparative supported-format speed/memory/quality benchmark NOT_RUN. No guessed universal winner. |
| 32 | Compare quantization quality speed memory energy | Quantization comparison requires same model, prompts, phone and energy measurements; NOT_RUN. Catalog recommendation remains a fit estimate. |
| 33 | Task-aware Thinking | Bounded internal tasks disable Thinking; normal answers preserve the user choice. No silent task classifier overriding that choice. Broader quality comparison NOT_RUN. |
| 34 | Suitable response lengths | Existing Quick/Everyday/Detailed profiles limit output and expose supported model controls; source/component tests PASS; quality/length benchmark NOT_RUN |
| 35 | Check architecture compatibility | GGUF/file validation before load, native architecture rejection treated as permanent and not retried. Native engine is architecture authority; no speculative family-name allowlist. Real architecture matrix NOT_RUN. |
| 36 | Benchmark engine upgrades | Pinned installed engine retained; no upgrade without identical-scenario comparison. Upgrade benchmark NOT_RUN. |
| 37 | Separate transient response from persistence | Fixed in source; unit/integration PASS; phone acceptance NOT_RUN |
| 38 | Final-answer and recovery checkpoints | Separate bounded partial-reply checkpoint, throttled/background flush and revision/anchor/ID-safe recovery implemented; unit/integration and normal/maximum-text simulator recovery UI PASS. Original history/models preserved; crash/power-loss phone acceptance NOT_RUN. |
| 39 | Tune streaming update cadence | First model content/reasoning update flushes immediately; later events batch50ms with no empty timers. Unit/integration PASS. Cadence/frame/energy comparison on phone NOT_RUN. |
| 40 | Limit conversation rerenders | Completed Markdown subtrees and message rows memoized; stable action callbacks use latest committed handlers. Row regression and ChatScreen153 tests PASS; device render profiling NOT_RUN |
| 41 | Reduce streaming Markdown work | Incoming answer/reasoning uses selectable plain text; full Markdown runs when stable; completed Markdown subtrees memoized. Unit/component transition regressions PASS; device frame/allocation profiling NOT_RUN |
| 42 | Avoid production debug serialization | Affected release debug serialization guarded by __DEV__; source checks PASS; whole-app allocation profiling NOT_RUN |
| 43 | Account for all loaded engines | Resident vision/Whisper/embedding file estimates added to resource diagnostics and load admission estimates; selected-but-unloaded resources excluded; unit/integration PASS; estimates are not measured allocations |
| 44 | Review auxiliary automatic loads | Duplicate embedding warmup removed; saved Memory mode no longer forced to Performance on rehydrate; classifier preloading still requires explicit classifier choice plus Performance mode; unit/integration PASS |
| 45 | Release idle auxiliary resources safely | Memory-mode background and OS pressure release only idle owned embedding/Whisper/vision resources; pending/active work protected, Whisper restores on demand, native state refreshed. Unit/integration PASS. Physical pressure acceptance NOT_RUN. |
| 46 | Measured memory profiles | Kernel current/peak process footprint and actual config instrumentation implemented; file-based admission estimates remain explicitly estimates. Measured per-model/context profiles NOT_RUN. |
| 47 | Sustained 5–10 minute test | Sustained5–10 minute inference/energy/thermal test requires real phone and supported models; NOT_RUN. |
| 48 | Thermal and battery-aware modes | Auto thread policy reduces allocation for heat/LowPower at model load; no forced mid-answer reload; sustained energy/thermal benchmark NOT_RUN |
| 49 | Separate loading stage timings | Local load trace records queue/files/weights/runtime/vision phases and wall-clock durations, scoped by ownership ticket; unit/integration PASS; native-stage fidelity benchmark NOT_RUN |
| 50 | Tap-to-first-visible-text timing | Send-handler to first visible model-text layout, queue and preparation timings implemented with actual focus/app/viewability/viewport checks; no synthetic offscreen value. Unit/integration PASS. App-side layout boundary, not pixel presentation measurement; real phone latency NOT_RUN. |
| 51 | Use native token and cache metrics | Use native predicted/prompt/cache counts and decode duration when available; fallback event estimates labeled in diagnostics; unit/integration PASS; runtime measurement NOT_RUN |
| 52 | Record backend fallback peak memory configuration | Successful actual launch config, backend/layers/fallback, native token/cache metrics and kernel current/peak process footprint attached to completed replies. Unit/integration/native tests PASS. Peak is since process launch, not a per-reply high-water mark; phone sampling NOT_RUN. |
| 53 | Regular iPhone 15 versus Pro scenarios | Identical regular iPhone15 versus Pro physical comparison NOT_RUN; no phone used in this batch. |
| 54 | Russian and tool quality regressions | Russian/markup/tool regressions covered by automated tests; actual language quality and native tool execution on models after optimizations NOT_RUN. |
| 55 | Invalidate late embedding loads | Fixed in source; unit/integration PASS; phone acceptance NOT_RUN |
| 56 | Full-request classifier cache key | Full normalized cache key and full local classifier prompt; unit/integration PASS; real multilingual quality NOT_RUN for this batch |
| 57 | Preserve mathematical less-than in speech | Fixed in source; unit/integration PASS; phone acceptance NOT_RUN |
| 58 | Whisper operation ownership | Source regression checks PASS; physical acceptance and measured effects NOT_RUN |
| 59 | Separate generation and export dimensions | UI distinguishes saved/export dimensions; Core ML model tensor resolution remains fixed; dynamic inference sizing not claimed |
| 60 | Preserve image aspect ratio | Aspect-fit export implemented; native geometry and PNG regression PASS in prior 65-test native run; phone export acceptance NOT_RUN |
| 61 | Remove or implement image thread setting | Non-working image-thread UI removed; Core ML owns scheduling. Final review removed the remaining generation-service thread comparison, so legacy settings cannot request an unnecessary pipeline load. Unit/integration PASS; physical acceptance NOT_RUN. |
| 62 | Evaluate retained image pipeline | Reviewed: keep release-after-generation to protect memory until same-device repeated-image latency/peak comparison supports retention. No unsupported claim of safe retained pipeline; benchmark NOT_RUN. |
| 63 | Synchronize native image unload state | Native image memory-warning release and residency reads use pipeline queue; JS pressure cleanup synchronizes native model state. Unit/integration and70-test native suite PASS, including queued residency reads; real phone pressure NOT_RUN. |
| 64 | Compare Core ML compute modes | Existing CPU-only/default Core ML and model attention variants retained. CPU/GPU/Neural Engine/attention comparison on actual models and phones NOT_RUN. |
| 65 | Reduce image preparation model swaps | Pattern-first routing and selected Apple/already-resident text model prepare images; no extra model download or speculative preparation model load. Real multilingual quality/swap counts NOT_RUN. |
| 66 | Model-specific steps guidance and valid zero | Explicit zero guidance preserved through chat settings, service and native bridge; unit/integration PASS. Per-model steps/guidance quality benchmark NOT_RUN. |
| 67 | Evaluate real native image previews | Reviewed optional preview: no native intermediate images supplied, so no preview is promised. Keep step progress; do not fabricate frames. Native preview implementation/overhead needs a supported pipeline experiment; NOT_RUN. |
| 68 | Coordinate Whisper load unload recognition | Serialized load/unload/file work and realtime setup; late-start stop plus permission-phase cancellation covered; native microphone acceptance NOT_RUN |
| 69 | Measure recording tail before reducing | Keep recording tail until final-word accuracy comparison justifies a change; phone recording benchmark NOT_RUN. |
| 70 | Remove artificial recognition display delay | Source regression checks PASS; physical acceptance and measured effects NOT_RUN |
| 71 | Measure VAD and audio chunks | VAD/chunk latency, accuracy, load and battery comparison requires microphone/device; NOT_RUN. |
| 72 | Align audio model and language | Known .en.bin models use English and reject incompatible explicit languages; multilingual default auto; source unit/integration PASS; imported unknown model metadata and recognition quality remain open |
| 73 | Coordinate embedding context operations | Source regression checks PASS; physical acceptance and measured effects NOT_RUN |
| 74 | Reuse unchanged document embeddings | Exact chunk/model-SHA256/engine-version bounded persisted cache; additive per-document index provenance and atomic replacement; stale/partial indexes explicitly require Refresh document search. UI refresh, serialized index/delete work and doc_id indexes implemented; unit/integration/RNTL and host SQLite query-plan PASS. Existing document snapshots/files unchanged. |
| 75 | Bounded query embedding cache | Source regression checks PASS; physical acceptance and measured effects NOT_RUN |
| 76 | Bounded vector top-K or index | Bounded top-K scoring plus 256-row keyset SQLite pages, yielding between pages; unit/integration checks cover a best match in page 2. Full vectors still scanned; index/latency benchmark NOT_RUN |
| 77 | Show missing semantic search explicitly | No unranked fallback; missing/failed/incompatible embeddings yield explicit unavailable result, tool output and chat notice; unit/integration PASS; notice visual acceptance NOT_RUN |
| 78 | Tune embedding runtime separately | Separate conservative embedding context settings retained; queue/cache correctness tested. Independent threads/batching/backend speed/memory/retrieval-quality comparison NOT_RUN. |
| 79 | Bound classifier response length | Local classifier capped at 8 tokens; Apple structured classifier capped at 64; native-parameter integration PASS; real classification quality NOT_RUN |
| 80 | Evaluate Apple session reuse | Reviewed: fresh Apple sessions reconstruct bounded transcript/tool scope correctly. Reuse would need prefix equality, callback ownership and cross-chat isolation proof; do not append already-supplied history again. Real Apple reuse benchmark NOT_RUN. |
| 81 | Measure Apple prewarm | No new Apple prewarm without supported-device latency/energy comparison. Physical benchmark NOT_RUN. |
| 82 | Recover Apple context overflow | Apple26.4+ native token preflight trims request-only history at user-turn boundaries with notice/count event; latest oversized request gets clear recovery error; saved chat unchanged; native helper/unit/integration PASS, real Apple overflow NOT_RUN; iOS26.0-26.3 lacks preflight token API |
| 83 | Deduplicate availability checks | Overlapping native availability checks coalesced; each caller retains selection policy; subsequent checks stay fresh; integration PASS |
| 84 | Prepare and cache vision input | Camera/photo chat input bounded to1024 pixels; native mtmd/CLIP owns model-specific resize/crop and bitmap-prefix reuse. OCR uses a separate higher-detail path. Preserve originals; extra decoded-image cache and large-photo memory/quality benchmark NOT_RUN. |
| 85 | Incremental speech parsing | Incremental protected-span parser commits closed lines and sanitizes pending paragraphs; unchanged playback drains reuse output. Unit/integration PASS across split markup and comparisons. Physical speech performance NOT_RUN. |
| 86 | Allow Enhanced and Premium voices | Installed Standard/Enhanced/Premium voice picker and persisted preference implemented; personal/novelty voices excluded; unit/integration/native quality policy PASS; actual Premium playback NOT_RUN |
| 87 | Cache voice choice by locale | Native voice choice cached by language/locale/preference, invalidated on OS voice-list changes; source/native suite PASS; real multi-language voice runtime NOT_RUN |
| 88 | Bounded long-answer speech queue | Source regression checks PASS; physical acceptance and measured effects NOT_RUN |

## Evidence and constraints

- Item 0: resolve the exact Apple API for “Core Advanced”; do not merely rename the existing model. The installed SDK exposes SystemLanguageModel and PrivateCloudComputeLanguageModel; this alone does not identify the requested label.
- Item 00: local chip/RAM/storage/iOS assessment; explain compatibility, expected memory, file size and task/language fit. Keep expert catalog access. No device details sent to developers.
- Item 53: only iPhone 15 Pro Max is available. Regular iPhone 15 comparison NOT_RUN.
- Whole-plan completion requires per-item evidence; open measurement tasks are not silently marked complete by builds.

## Batch 1 — 2026-10-25

- Items 1/37: compare persisted slice references before JSON serialization; transient streaming updates no longer write unchanged history. Final answers still write. Unit retry-after-storage-error and real-store integration checks added.
- Item 55: unloading invalidates unfinished embedding initialization, awaits disposal of a late native context and prevents it becoming active. Concurrent embedding/unload arbitration (73) remains open.
- Item 57: mathematical less-than comparisons survive speech parsing; incomplete markup remains withheld. Native spoken playback remains NOT_RUN.
- Item 56: full normalized-request cache key implemented in earlier follow-up patch; long-prefix regression refresh still required.
- Focused batch evidence: 136 tests passed (38 persistence/embedding + 98 speech/chat-store); TypeScript passed. New lifecycle integration and full applicable suite pending. Not installed.

Apple sources checked 2026-10-25: https://developer.apple.com/forums/thread/832555 (Apple staff: no explicit model selection); https://www.apple.com/newsroom/2026/09/siri-ai-a-profoundly-more-capable-and-personal-assistant-is-here/ (eligible Core Advanced hardware).

Batch 1 verification refresh: full Jest coverage run PASS, 222 suites / 5,380 tests, 56.42 seconds; TypeScript PASS; changed-scope ESLint PASS (0 errors, 0 warnings); git diff whitespace check PASS. Logs outside repository: `../own-performance-batch1-full-jest.log`, `../own-performance-batch1-final-types.log`, `../own-performance-batch1-final-lint.log`. Release iOS simulator build PASS (`../own-performance-batch1-ios-build.log`); installation and physical acceptance NOT_RUN for this batch.

## Batch 2 — in progress

- 2/11: permanent architecture and file errors retain a typed failure and stop without retry. Distinct fallback configurations prevent identical CPU/context retries.
- 3/4/9: device context cap applies before memory estimation and first native init. A successful reduced context is retained, never released to probe a larger context.
- 5: timeout aborts the text-load signal; native initialization cannot currently be interrupted mid-call, but its late context is released before publication and no further retry occurs. The LLM mutex remains held until cleanup, preventing simultaneous context initialization. Image timeout ownership is still open.
- 6: replace fixed 350ms delay with an actual render-frame handoff after interactions.
- 10/29: memory fallback tries reduced GPU layers before CPU; active layer reporting uses successful configuration and native GPU availability.
- 58: Whisper callbacks/finalizers are scoped to operation IDs. File recognition waits for prior native recognition to settle before starting; old completion cannot clear a newer stop handler. Full load/unload/realtime arbitration (68) remains open.
- 70: ready transcripts publish without a minimum 600ms artificial delay. Recording tail unchanged pending real accuracy evidence.
- 66: guidance uses nullish defaults, preserving explicit zero. Model-specific quality/step tuning remains open.
- Focused check: 365 tests passed before final file-recognition serialization; new cross-module loading integration and updated Whisper checks passed (48 tests). Full-suite/type/lint refresh in progress. No physical installation or performance claims for this batch.

## Batch 3 — in progress

- 73: one embedding work queue coordinates load, indexing batches, query embedding and unload; native release waits for active embedding. Rejected work does not poison the queue.
- 75: bounded 64-entry query cache (keys capped at 4096 characters); full query identity, copied vectors, invalidation on context release/load. Large document batches bypass query caching. Integration verifies no early release and no stale cache after reload.
- 88: speech queue applies backpressure at 12 pending chunks and refills as playback advances; long sentences split at word boundaries below native utterance limit. Remaining raw text is retained rather than discarded. Integration verifies a long sentence plus 30 sentences.
- 16/17: remove occupancy/truncation-triggered pre-generation KV reset. Installed llama.rn `cpp/rn-completion.cpp:136–157` reuses the matching token prefix, removes changed suffixes, and clears hybrid/recurrent cache if partial removal fails. Explicit chat-switch clearing and overflow recovery remain pending target-device correctness evaluation (18/26).
- 29: when native context reports GPU unavailable, active GPU layer count is zero even if layers were requested. No claim of measured Metal execution yet.
- 42: guard JSON-based debug log argument construction with __DEV__ across the affected services, so release builds skip serialization. Protocol JSON serialization is unchanged.
- Focused embedding tests: 18 PASS. Focused speech tests: 16 PASS. Full suite/type/lint refresh in progress. Device, thermal, quality and energy checks NOT_RUN for this batch.

## Batch 4 — image controls and export

- 61: remove unsupported image-thread sliders from both settings surfaces. Legacy saved value is retained for data compatibility but ignored for Core ML scheduling and reload decisions. Integration confirms thread-setting changes no longer unload/reload the selected pipeline.
- 59: existing UI already labels this “Saved Image Size”; native tensor dimensions remain fixed. No claim that export dimensions reduce inference cost.
- 60: native export uses aspect-fit within the requested canvas; transparent margins preserve all content instead of stretching. Geometry and real PNG encode/decode tests added; native run in progress.
- 66: explicit zero guidance survives service defaults and both settings surfaces. Per-model tuning remains open.
- Latest JavaScript verification: 223 suites / 5,391 tests PASS; TypeScript PASS; full ESLint + SwiftLint command PASS with existing warnings (0 errors). Native tests and phone installation pending.
- Phone available; fresh pre-install AsyncStorage backup copied successfully to `../own-phone-pre-performance-build11/` (700 directories / 600 files); document/model file-size inventory saved outside Git. Never uninstall/reset the application.

## Build 12 physical acceptance and build 13 fixes

- Build 11 live QA exposed an additional issue: generated assistant images in history were treated as new vision input and blocked ordinary Apple text replies. Build 12 restricts vision-input validation to the latest user message, with a note when old user-photo content is unavailable. Unit + cross-layer regression passed; real puppy chat answered `2+2` with `4` (1.4s reported generation time; not tap-to-first-text).
- Build 12 real Russian request `Нарисуй кота` translated on device to `Draw a cat` and produced a recognizable cat (38.6s denoising, substantially longer cold preparation). The loading line visibly moved between captured frames; removed paragraph absent. This is movement/layout evidence, not an FPS or energy benchmark.
- Build 13: serialize Core ML load/unload/generation work; timeout and cancellation invalidate pending loads and reclaim late pipelines before replacement loads. Native compilation itself cannot be interrupted mid-call. Stop does not falsely mark a still-running native generation idle.
- 63: generation completion and resource refresh synchronize loaded IDs with native state, notify on residency changes, and exclude selected-but-unloaded weights from the memory estimate. Selection and downloaded records are retained.
- Missing image files now show `Image unavailable` instead of a permanently transparent box. Physical build 13 check PASS. Old missing files were already absent before installation; no existing file was removed by the update.
- Build 13 installed in place and launched. Pre/post comparison: all nine conversations / 40 messages unchanged, both image-model records unchanged, Whisper record unchanged, all 32 original files retain paths and sizes. Extra QA messages after this snapshot are additions.
- Latest gates: 225 Jest suites / 5,399 tests PASS; final TypeScript PASS; full lint PASS (38 existing JS warnings plus existing Swift warnings, zero errors); signed Release iPhone build PASS and strict code-signature verification PASS. Native suite: 65 PASS / 0 skipped on unchanged Swift sources. Scanner: 46 candidates, same rule/path pairs as earlier reviewed baseline; review_required, release_readiness not_assessed.
- Saved device evidence and private backups remain outside Git under the parent work folder. Build 13 whole-product release readiness remains INCOMPLETE; the open items above are not closed by these checks.

- Final Build 13 text-response check NOT VERIFIED: Mirroring still reports iPhone in Use after reconnect was requested. No additional phone action taken.

## Batch 5 — Mac-only correctness work, 2026-10-25

- No iPhone access, installation, deletion, reset or model download in this batch. Existing phone chats/models are untouched. Build 13 remains the last phone installation.
- Document retrieval stops presenting unindexed/failed vectors as relevant text. Empty projects still return no results; unavailable search is distinct. Chat preparation shows a system notice and supplies the same status to the model; search tools return no fabricated source references. Duplicate speculative embedding warmup removed.
- Retrieval keeps at most K scored winners (K capped at 100), with stable tie ordering and invalid/dimension-mismatched vector rejection. All database vectors are still read; this does not complete large-project indexing/paging (76).
- SQLite embedding decoding now respects a typed-array view's offset/length and handles ArrayBuffers across realms. Existing semantic integration had silently passed with invalid scores; it now checks actual decoded dimensions.
- Local intent classification considers the full quoted request and uses an eight-token native completion. Apple availability checks share only overlapping work and preserve each caller's model-selection policy; later checks read fresh OS state.
- Whisper resource queue coordinates loading, unloading, file recognition and realtime setup. Stop during delayed native startup waits for the final callback; stop during permission setup prevents native recording. forceReset retains the native completion barrier. Known English-only filenames reject incompatible explicit language requests; multilingual defaults use auto detection.
- Separate self-review found and corrected the permission-phase cancellation gap. Tests use explicit completion barriers rather than timing sleeps. No claim of instant native cancellation or measured recognition/energy improvement.
- Remaining software work still includes hardware recommendation UX, vision-on-demand readiness, successful-load profile persistence, context/session/tokenization work, richer speech voice selection and further diagnostics. Hardware/thermal/energy/quality comparisons remain device-dependent. Full plan is INCOMPLETE.

Batch 5 final gates: 227 suites / 5,410 tests PASS; TypeScript PASS; full lint PASS (0 errors, existing warnings); Release simulator build PASS; whitespace PASS. Evidence: parent work/own-mac-batch5-reviewed-*.log. Scanner 46 candidates / no new rule-path pairs versus Build 13; review_required. No iPhone operations or data migration.

## Batch 6 — Mac-only software work, 2026-10-25

No physical iPhone commands, model/voice downloads, uninstall, reset or user-data deletion. Installed phone Build13 remains unchanged. No existing chats, downloaded weight files or model metadata are migrated or removed. New load profiles and voice preference are additive; hydration regression preserves chats/model records and the Memory setting.

Implemented lazy vision and retained text fallback, successful load profiles, native local hardware facts and Auto policy, reactive model advice, installed voice picker/cache, native token/cache metrics, Apple request/token limits and notices, formatted RAG context budgets, resident auxiliary estimates, micro-batch control and scoped load/retrieval timings. Bounded internal tasks disable Thinking; stop arrays are private per request.

Native suite:68 tests PASS on current production Swift sources. Apple actual tokenizer/generation, Premium voices and real projector loading still need supported-device runtime checks. GUI CUA cannot bind Simulator in this host; a purpose-built read-only XCTest UI scenario opens Models/Voice/list without changing preferences or data. First Release UI build failed without enable-testing; rerun explicitly enables testability. The first two UI runs passed assertions but screenshot review exposed large-text defects. Final corrected Release UI run:2 tests PASS /0skipped; normal and maximum-text screenshots inspected. Navigation labels remain on one line; voice list and Done/search are reachable. Earlier assertions alone did not establish visual quality.

Remaining software is not hidden behind device testing: full formatting/tokenization reuse (20), partial response recovery checkpoints (38), streaming cadence and device render profiling (39–40), document provenance/reuse (74), vector indexing/latency measurement (76), incremental speech parsing (85), complete request timing/peak-memory diagnostics (50/52), and idle-resource policy remain open. Hardware/memory/quality/thermal comparisons are separate NOT_RUN tasks. Do not call the whole plan complete.

Apple voice behavior reference: https://developer.apple.com/documentation/avfaudio/avspeechsynthesisvoice/speechvoices() (available voices on device); https://developer.apple.com/documentation/avfoundation/speech-synthesis (on-device speech synthesis). New Apple tokenCount/contextSize APIs checked against installed iOS27.1 FoundationModels swiftinterface; tokenCount availability26.4 is guarded. No cloud inference added.


## Batch 6 final review additions

- Screenshot inspection found that maximum system text size made navigation and fixed model controls crowd out the list. Compact navigation/model controls now scale up to1.5x and keep full accessibility names; model descriptions and voice rows remain scrollable at the system size. Voice-picker explanation moved to the scrollable footer; Done/search remain reachable. This is a deliberate compact-control limit, not a claim of unrestricted Dynamic Type support throughout the app.
- Device advice uses normal high-contrast text; two-column banner and transparent-sheet text bleed corrected. Simulator UI tests now check control reachability and a real installed voice row. Final screenshots must be reviewed separately from test assertions.
- Cancelled-load cleanup extracted into one helper without changing its behavior; focused model suite241 PASS. Full final checks are recorded in the follow-up ledger.
- Document search now decodes at most256 vectors per SQLite page and retains at most100 winners. Keyset cursor uses the unique embedding row ID; stalled cursors fail rather than loop. Nine RAG suites /138 tests PASS, including real database-wrapper decoding/ranking across a page boundary with a mocked SQLite transport. This is not a native SQLite performance benchmark or a vector index.
- Incoming Markdown is shown as plain selectable text until completion, including unfinished reasoning. Final formatting returns after completion. Completed Markdown subtrees use React memoization. Component regressions cover that transition; no device speed claim.

- MessageRenderer retains stable action callbacks updated on commit and wraps ChatMessage with React.memo. An integration regression verifies an unchanged row is skipped, a changed message rerenders, and Copy invokes the latest handler. Together with ChatScreen153 tests PASS; whole-device frame profiling remains NOT_RUN.

Latest gate results:238 suites /5448 JavaScript tests PASS; final navigation-only adjustment then7 focused tests PASS; final TypeScript PASS; full lint0errors37existingJSwarnings, affected navigation lint0errors. Native68 PASS on unchanged productionSwift; final Release UI2 PASS /0skipped. Full plan remains INCOMPLETE. Physical Build13 unchanged.


## Batch7 acceptance — remaining software work, 2026-10-25

Preservation boundary: no iPhone access, installation, app reset, model download or deletion of chats/model files. Existing histories and downloaded-model metadata retain their format. Derived caches may be discarded; original documents and models must remain intact.

-38: write a separate local partial-reply checkpoint at most once per5seconds, plus background/unmount flush. Recovery waits for chat hydration, requires the same conversation revision/user/last-message anchor, uses a stable ID, and labels the result as interrupted. Ignore malformed/stale/duplicate/completed/deleted conversations. Checkpoints must not replace main history or turn a recovered answer into a complete one. Explicit cancellation/deletion clears the checkpoint; normal completion retains a stale fallback until the next launch so an unfinished storage write is recoverable. The most recent unsaved interval can be lost on abrupt termination.
-74: reuse exact document-chunk content only under the same SHA256 fingerprint of the bundled embedding weights, engine version and vector dimension. Missing fingerprint disables cache reuse. Bound the optional local cache to128entries/750000JSONcharacters; validate finite nonzero384-dimensional vectors; copy returned arrays. Cached content must be removed through document/project deletion, serialized with embedding work. Cache read/write failure may not break indexing; deletion failure must be reported. This avoids recomputing unchanged chunk embeddings; it does not skip all file extraction or provide a document-version UI.
-85: commit only closed speech lines and parse the remaining unfinished part. Unchanged drain calls must reuse the parsed result. Keep open reasoning/tool/code/link blocks silent across split tokens and line breaks, preserve mathematical comparisons, and reset safely on response replacement. Cumulative-prefix validation and the unfinished paragraph still have costs; no physical speed claim.
-20: share the context meter's formatted prompt with the installed llama.rn wrapper through a request-scoped adapter, preserving native grammar/parser/thinking/media metadata without reconstructing them. Never mutate the resident context. Unknown engine versions use the original path. Optional diagnostics reuse measured request data after generation and no longer tokenize a second diagnostic prompt. The native engine must still tokenize its own prompt; the public API does not accept the meter's token array.

Verification: unit and cross-module integrations at the actual storage/engine boundaries with mocked native modules; full coverage suite/types/lint; Release build/native tests; simulator UI and visual check of recovered-state wording. Physical Apple/Metal/voice/quality/energy benchmarks remain separate NOT_RUN gates.


## Batch7 review decisions and acceptance boundaries

All90 original IDs are retained above. Implemented software is separate from physical measurement. Current decisions keep the user's settings and data safe: no automatic engine upgrade, opaque session restore, lossy image preprocessing, speculative warmup, pipeline retention or quality-tuning claim without supported-model evidence. These comparison tasks remain NOT_RUN, not passed by a simulator build. See `docs/software-review-2026-10-25.md` for source anchors and exact remaining checks.

Batch7 adds recovery38, formatter reuse20, first-event cadence39, safe idle ownership45, visible-layout timing50, actual launch and process peak52, persisted cache/index provenance74, incremental speech85 and image pressure synchronization63. Gate totals and final artifact identity are recorded in the follow-up report after completion of the final run.


### Batch7 final artifact and check record

Final functional source:251 Jest suites /5,513 tests PASS (`own-mac-batch7-final-all-jest.log`); final RAG149 tests and screen62 tests PASS; types and affected lint PASS. Release simulator UI and individually inspected normal/maximum-text recovery/search screens passed in their owned fixture runs. Final real simulator initialization installed both doc_id indexes and preserved every original DB row and both conversations. Physical phone not accessed.

Signed Own0.1.0(14) generic-iOS Release build and strict/deep signature PASS. Build14 uses a command-line version override; project default remains13. Profile expires2026-10-31T17:18:19Z. Not installed on the phone. Previous Build13 app retained separately. Exact artifact/source records and physical NOT_RUN checks are linked from `docs/iphone-followup-2026-10-24.md`. Static scanner46review candidates,0new rule/path pairs versus retained Build13 baseline; readiness not assessed.

Final native rerun70PASS; one separate no-document UI guard intentionally SKIPPED after fixture cleanup (`own-mac-batch7-final-native-guard.log`). Positive search normal/maximum-text cases passed with the owned fixture before cleanup; no skip counted as feature acceptance.
