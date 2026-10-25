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
