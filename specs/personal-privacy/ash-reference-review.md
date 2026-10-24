# Ash reference review — 2026-10-24

Pinned reference: RaccoonOnion/ash commit `868ca385c7546a81190699ce937794c59e9f269e`, resolved through the GitHub connector. This is a feature reference, not a bundled dependency. No Ash source code was copied into Own.

## T09: measured download estimates

Reviewed `lib/services/model_download_state.dart` at the pinned commit (blob `1fff572466de374b9a29935cd72d9d2de261e78a`). It uses real progress and an exponential moving average, with no invented initial time. Its downloader deliberately has no pause/resume state; that behavior does not meet Own's background-download requirement.

Own uses its existing native download lifecycle. Independently authored byte-rate sampling combines the model and vision-file counters, waits for two measured changes over two seconds, and uses time-weighted smoothing. Task replacement, byte rollback, waiting/retry, clock rollback and a gap over ten seconds reset the estimate. Stale observations display measuring text instead of an ETA. Remaining time is marked approximate and rounded upward. This adds no request, telemetry, persisted speed history or download-engine change.

## T10: speech implementation decision

Reviewed `lib/services/apple_voice_service.dart` (blob `8c024d3985f06af8917e94ad3958080677399895`) and `lib/services/tts_sanitizer.dart` (blob `0e7bbfc0bbacc60a7eb590893cbae67fdbc5b1a5`). Useful concerns: sentence buffering must preserve token whitespace; stop must clear pending work and release the audio session; late async completions must not restart stopped speech. Ash's English enhanced/premium preference and combined recognition initialization will not be copied.

Chosen direction for Own: native AVSpeechSynthesizer, explicitly selected installed basic voices, with no implicit default-voice fallback, voice download or cloud TTS. Keep spoken replies optional and off initially, separate from the existing Apple recognition permission. Exclude personal and novelty voices. Show an honest unavailable state if an appropriate basic voice cannot be selected.

Apple documents basic voice quality as available on the device by default, while enhanced/premium voices require downloading: https://developer.apple.com/documentation/avfaudio/avspeechsynthesisvoicequality . Explicit voice selection avoids the nil-voice system default described at https://developer.apple.com/documentation/avfaudio/avspeechutterance/voice . Installed SDK headers confirm quality and voice-trait APIs. These are API findings, not device network proof.

Required before marking T10 implemented: stateful Markdown/reasoning cleanup across split chunks; bounded sentence queue; generation/session tokens; cancellation on new reply, microphone, model/conversation change, background/lock and audio interruption; no late restart; separate unit and integration checks; actual iPhone playback, repeated mic/speech transitions and offline traffic checks. T10 playback is now implemented in OwnReplySpeech.swift and replySpeech.ts, with no copied Ash source. Native basic-voice policy checks and real simulator utterance/cancellation passed; physical-phone offline traffic and repeated microphone/playback checks remain.

## T11: source and context inventory

Own retrieval already returns stable `doc_id` and chunk `position` in `rag/database.ts` / `rag/retrieval.ts`. The knowledge-base tool in `tools/handlers.ts` currently turns these into text labels and drops the IDs. The final UI must preserve a per-message source map from actual retrieved results; it must not trust a model-generated filename, URL or citation number as a local-file target. A missing/deleted document needs an explicit unavailable state. Source preview should show the saved excerpt and part number; document opening must use the current project-scoped record.

`llm.getContextDebugInfo` tokenizes formatted managed messages when available, with a character-count fallback. This is a diagnostic, not yet a complete capacity indicator: tool schemas/results, retrieved text and reply reserve must be accounted for at the actual generation boundary. Apple Foundation Models and other engines need separate capability handling; unavailable token counts must be shown as estimates or unavailable, never an exact zero. No T11 source-link or context-indicator implementation is claimed.

### T11/T17 implementation update
T11 trusted source metadata and tokenizer-based local context accounting are now implemented. No Ash code copied: its character heuristic and transcript-deleting trimming were deliberately not used. Unsupported engine capacities stay unavailable. Source identity comes from retrieved document records, not model-generated links. Seven focused suites /270 tests pass; rendered native document/context flows remain unverified. T17 simple settings implemented after these core additions, with capability filtering and local profiles; final simulator acceptance remains active.
