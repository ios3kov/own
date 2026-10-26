# Remaining-software review — 2026-10-25

Scope: user plan0,00,1–88. Work without the iPhone. Preserve saved chats, downloaded models, images, existing dirty work and private backups. No commit, push, physical installation or model download in this batch.

## Review decisions

- **14/44:** `src/screens/ChatScreen/useChatModelActions.ts` preloads only the explicitly selected classifier in Performance mode. Ordinary active text remains resident after use. Avoid speculative extra preloads; energy/first-response comparison needs hardware.
- **18/26:** `src/services/activeModelService/index.ts` clears cross-chat state. Installed `node_modules/llama.rn/src/index.ts` explicitly requires this for hybrid/recurrent isolation. Its native save/load API stores opaque token/KV state; no architecture-safe round-trip proof is available in this Mac-only run. Keep fresh state rather than ship an unchecked disk session cache. Persisted user conversations remain intact.
- **20:** Exact request-scoped formatter reuse is gated to installed engine0.12.0-rc.9. Unknown engine version falls back to its wrapper. No native grammar, tools, media or parser fields are rebuilt by Own. Native completion still performs its internal tokenization; the public completion API does not accept the meter's token array.
- **29–36/46–48:** Actual launch parameters and native GPU availability/fallback are logged locally. These do not establish actual Metal throughput or sustained thermal/energy behavior. No engine upgrade or universal quantization/GPU/cache preset is claimed as faster without comparison.
- **50/52:** Visibility means active, focused, visible model-text layout inside the chat viewport. Measurement begins at the send handler and uses monotonic time. This is an app-side layout measurement, not display hardware presentation time. Native Mach footprint peak is since process launch; it is not mislabeled as a per-reply peak. No developer telemetry is added.
- **59/62/64/67:** Core ML tensor resolution stays model-defined; export size is separate and aspect-fit. Keep release-after-image until retention is measured safely. Intermediate images are not promised: current bridge reports steps, not real preview frames. Compute-mode/attention and preview work requires an actual supported pipeline experiment.
- **61/63:** Removed the final generation-service legacy thread comparison; unused old thread values no longer trigger a pipeline load request. Native memory-warning release and residency queries share the pipeline queue; JS pressure cleanup refreshes actual native state. Real model pressure acceptance remains NOT_RUN.
- **65/66:** Use pattern routing and the selected Apple/already resident text model for image prompt preparation. Explicit zero guidance must survive every layer; regressions cover service and native-bridge arguments. Image semantic quality still needs actual generation.
- **69/71/78:** Do not shorten audio tails, alter VAD/chunks, or declare embedding backend tuning without accuracy, latency and battery comparisons on the actual resources.
- **74/76:** Existing imported documents are immutable saved snapshots. Reuse exact chunk text only with SHA256 weights identity, engine version and dimensions. Additive document provenance lets search reject old or incomplete indexes. Refresh rebuilds saved chunks, replaces vectors/version atomically, and can reuse matching cached chunks. Document-count checks use additive doc_id indexes; host SQLite EXPLAIN and completeness tests verify covering-index lookups. Index/deletion writes share a queue; no original document or model file is deleted by refresh. Keyset pages/top-K bound working data but still scan every vector; an approximate vector index is not justified without corpus benchmarks.
- **80/81:** Fresh Apple sessions own current tools and bounded transcript. Naive session reuse would duplicate history and retain stale tool closures. Keep fresh sessions until prefix/tool/ownership and prewarm comparisons are proven on a supported device.
- **84:** `src/components/ChatInput/Attachments.tsx` bounds camera/photo chat input to1024 pixels; OCR has a separate higher-detail path. Installed llama.rn `cpp/tools/mtmd/clip.cpp` chooses architecture-specific resize/pad/crop from model metadata. `cpp/rn-mtmd.hpp` compares bitmap hashes and chunk prefix before reuse. Keep model-native processing rather than a guessed generic image dimension that can remove document detail. A separate decoded-image cache needs bounded-memory/quality proof and is not claimed here.

## Required physical acceptance — NOT RUN in this batch

1. PASS on2026-10-25: Build14 installed in place and launched;9chats/44messages and model records unchanged after launch,33original files retained paths/sizes. Full visual gallery QA and weight-file hashing were not part of the installation.
2. Apple availability/default, actual native language/tool replies, context overflow, supported model variant and optional Apple server preference.
3. Local text: cold/warm/long-chat, cancellation/timeouts, permanent architecture failure, reduced context/GPU fallback, actual backend and cross-chat isolation. Compare regular iPhone15 and Pro with identical files/prompts/settings.
4. Vision and documents: projector match/lazy lifecycle, large photos/OCR/scanned PDF, refreshed semantic sources and language/tool correctness.
5. Images: Russian and other non-English puppy prompts plus ordinary follow-up text; cancel while preparing/generating, gallery deletion/export, repeated SDXL load, memory-warning state and dimensions/aspect ratio.
6. Microphone and imported audio: language selection, last words/VAD/tail, rapid stop/restart, idle restore, installed Enhanced/Premium voices and long speech/comparisons containing `<`.
7. Sustained5–10 minute throughput, current/peak memory, thermal state and energy. Compare quantizations, GPU layers, batch/microbatch, Flash Attention/KV types, compute modes, prewarm and pipeline retention with identical scenarios.
8. Background model downloads/resume/cancel, Wi-Fi advice, security PIN/biometrics, safe areas/composer, first visible-text timings and interruption recovery under real app termination. Network traffic privacy verification remains separate from static scans.

Simulator/mock checks cannot substitute for these results. The90-row plan records implementation, review decision or NOT_RUN separately.

## Independent final review of the changed result

This was a separate self-review, not an external review-service result. It found and corrected: two remaining zero-guidance defaults; the legacy image-thread load check; missing index-model provenance and partial-index rejection; inaccessible nested document-management navigation; oversized maximum-text chrome. Checks were repeated for affected behavior. Native queue tests cover empty-resource memory warnings and residency reads; they do not prove real SDXL memory pressure handling. The scanner still reports review candidates and does not certify safety.

Final evidence totals and installable candidate identity are in `iphone-followup-2026-10-24.md`. Historical failed navigation/geometry/visual attempts are retained in logs; only the final inspected screenshots count as visual evidence.


## Follow-up to the independent 88-item review

The independent report inspected an earlier dirty working copy at eaf6923. Its counts are not a new acceptance verdict for later revisions. Its concrete item43 finding was reproduced in the current code: dual-model admission ignored the resident auxiliary estimate in both the service caller and helper.

Acceptance: combined load admission must include loaded speech, embedding and vision estimates; reject totals above the device budget; return consistent available/required/resident/remaining fields; stop counting resources after unload. This changes admission only, with no storage migration, model deletion or chat mutation.

The helper and caller now include auxiliary estimates. A unit regression and a real-service integration regression both failed before the fix for the reported omission. The affected service suites pass after the fix (90 tests). Final full-suite/type/lint results are recorded in the task handoff outside the repository.

Items20/23/76/82/85 remain partial where the existing plan says so: native internal tokenization, approximate document budgets, full-vector scoring, Apple-version restrictions and pending-paragraph reparsing are not claimed solved by this patch. Items26/62/67/80/81 remain unimplemented experiments/evaluations; no performance benefit is established, and the plan retains the hardware/isolation/energy checks. All physical performance comparisons remain NOT_RUN in this follow-up. The earlier 52/21/10/5 totals have not been recomputed.


## Local document-token admission follow-up

Item23: before local completion, count the complete native-formatted request with the loaded tokenizer, including history, tools and image paths. Reserve requested output and64 tokens of margin. Drop low-ranked whole automatic knowledge excerpts until fit, preserving user/system instructions and original message objects. If counting fails or output has no finite limit, omit automatic excerpts rather than claim a precise fit. History-only overflow still follows existing recovery; no saved messages or documents are edited.

The candidate-retrieval character bound remains a coarse upper limit, not a precise remaining-context claim. The native completion adapter reuses the accepted formatted prompt, and the meter reuses the accepted token count. Late preparation cannot update another conversation's meter. Unit tests and cross-module retrieval/formatter/meter/completion tests cover the policy. This is a local completion improvement; Apple and tool-result document budgeting remain open, as do real-model/native-tokenizer quality and latency checks.

Follow-up automated checks:253 suites /5,524 JavaScript tests PASS with detectOpenHandles; TypeScript and scoped ESLint PASS. Release simulator build result and physical NOT_RUN boundaries are retained in the external handoff.


## Long-paragraph speech follow-up

Item85: reproduced repeated parsing of a long unfinished paragraph with a sanitizer-work regression (305,411 input characters processed for the fixed streamed fixture, above the128,000 bound). Commit safe whitespace-ended spans after512 raw characters, while retaining protected code/link/reasoning boundaries. Mid-line fragments use a non-spoken parser prefix to avoid turning text such as1. or- into a new Markdown list; adjacent span whitespace is normalized consistently.

Unit comparisons against the full parser cover long paragraphs, links, HTML, code, mathematical comparisons and list-like text. A cross-module streaming-to-speech-queue check verifies no duplicated/lost words and no private reasoning read aloud. This reduces reparsing in ordinary paragraphs; cumulative-prefix comparisons and unclosed protected/no-whitespace spans still have costs. No measured phone-speed, battery or fully linear-complexity claim.

Final combined JavaScript checks:253 suites /5,536 tests PASS with detectOpenHandles; TypeScript and affected ESLint PASS. Separate final review reproduced and corrected a long-indentation heading boundary; all41 speech regressions then passed, followed by the full suite. An earlier full runner crashed in V8 garbage collection (SIGSEGV/139) during a concurrent build and was not counted as PASS; standalone reruns passed. Physical speech latency/quality and native Apple tokenization remain NOT_RUN. The final artifact/build receipt is retained in the external handoff.


## Apple document budget and imported Whisper capability

Item23: on Apple26.4+, test the full request with native tokenCount, including tools, all retained turns, latest prompt, reply reserve and64-token margin. Remove lower-ranked automatic document excerpts before reducing the history suffix. Saved input strings/messages are unchanged. No extra count when instructions contain no automatic excerpts. Older versions retain the context-full recovery error; tool-result-specific budgets remain open. Native helper tests cover fit, partial removal, complete removal, surrounding instructions and no-document requests. Real Apple inference/tokenizer acceptance remains NOT_RUN.

Item72: a pinned whisper.rn0.5.5 patch exports whisper_is_multilingual from the initialized native context, preserving it through source/CommonJS/ESM wrappers and public types. Both recording and file transcription use actual capability ahead of imported filenames. A renamed English-only model rejects incompatible explicit language; a multilingual model with a misleading.en.bin name stays multilingual. Native capability is optional for legacy/mocked engines, retaining the previous filename fallback. Unit and cross-module service tests reproduce both former failures; the real JavaScript wrapper is exercised with a mocked native initialization result. No claim of real audio recognition quality. No engine upgrade, model download, storage migration or original notice changes.

This follow-up passed254 JavaScript suites /5,540 tests with coverage (statements88.75%, branches82%, functions86.81%, lines90.77%), TypeScript, scoped ESLint and SwiftLint (existing warnings). Release simulator native suite71 PASS /0skips. Dependency patch reverse applicability check PASS. Final diff review checked context/tool/history ownership, language metadata propagation and legacy fallback; real Apple inference and actual Whisper audio quality remain NOT_RUN. No physical phone/data operations.
