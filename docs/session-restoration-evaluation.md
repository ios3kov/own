# Engine session restoration evaluation

The raw native session API passed a reproducible local experiment on 26 October 2026. App-level saved sessions remain disabled: this experiment does not solve the installed JSI wrapper's threading, lifetime or cross-chat ownership requirements.

## Executed check

The standalone [harness](../scripts/qa/session-roundtrip.cpp) was compiled for arm64 iOS17 Simulator against the installed llama.rn 0.12.0-rc.9 Release static library and headers. It ran in the dedicated Own QA simulator after application UI tests finished. No model download, phone access or application-data seeding was used.

| Criterion | Actual result |
|---|---|
| Existing fixture identity | 19,077,344 bytes; SHA-256 66967fbece6dbe97886593fdbb73589584927e29119ec31f08090732d1861739 |
| Runtime configuration | Explicit CPU device, zero GPU layers, KQV/operator offload disabled, context 2048, batch/microbatch 64, two CPU threads |
| Saved/restored prefix | 802 tokens; loaded token sequence exactly equals original |
| Real cached state | Fresh context starts empty; restored sequence maximum position is 801 |
| Continuation | Eight greedy tokens equal both uninterrupted and cold-prompt controls |
| Logits preparation | One final matching prompt token reevaluated, as the pinned completion implementation requires |
| Corrupt input | Rejected; failed target discarded |
| Worker boundary | Raw restore executed in a joined C++ worker thread |
| Original model | SHA256 unchanged after execution |

The worker assertion concerns this harness. It does not prove that the current JSI loadSession API executes off the JavaScript thread. The public SDK's raw file stores model architecture and memory state; it does not store ready output logits or prove exact weight identity.

Private execution receipts bind the fixture and harness-source hashes. The source copied into this repository matches the executed file byte-for-byte. This is a correctness experiment, not a phone speed, energy, quality or architecture-matrix benchmark.

## Shipping boundaries

Installed source evidence:

- cpp/jsi/RNLlamaJSI.cpp and JSISession.h defer session file loading into the JSI result generator. The isolated worker-offload proposal returns owned plain values instead; it has not been installed or linked into Own.
- JSITaskManager tracks pending tasks but does not provide a per-context operation mutex. Its waits use a five-second timeout; release must not destroy a context still used by a slow worker.
- llama-context.cpp checks architecture/state layout and explicitly lacks full model-identity validation. An application cache needs exact loaded-model/configuration/template/tool/history identity before restoring.
- Failed restoration may modify the target context. A cache miss or corrupt file must recover through a fresh/reset context, not continue from partially restored state.
- Cancellation must retain ownership until native work finishes, ignore stale results and prevent release or another context operation racing it. The pinned load API has no dedicated abort primitive.

The current application makes no session-file calls. Existing per-chat KV isolation remains unchanged. A shipping cache still needs a reviewed lifetime/serialization fix, private atomic bounded storage, identity rejection/corruption/cancellation tests and actual JSI/app roundtrips. Other model families, hybrid/recurrent contexts, vision/tools, sampling state and supported-phone behavior remain unverified.

## Reproduction

Use an existing matching simulator static library and the fixture above. Do not fetch a model automatically. Compile the harness with the pinned cpp include directory, matching arm64 iOS-simulator target, and Foundation/Metal/Accelerate frameworks. Run it through simctl spawn on an explicitly selected dedicated booted simulator:

    session-roundtrip EXISTING_FIXTURE_PATH NEW_EMPTY_OWNED_OUTPUT_DIRECTORY

The directory must be fresh; the harness refuses existing state.bin or corrupt.bin. Outputs contain only this synthetic experiment. Do not pass an app data directory. Preserve failed attempts before retrying.

Initial attempts are retained separately: the first spawn found the simulator shut down after Xcode; an initial standalone configuration lacked bundled Metal resources; the next reached restored memory but incorrectly expected stored logits. Header/source inspection established the final CPU configuration and required one-token reevaluation. The final 802-token control experiment passed. Standalone backend discovery can still log unavailable Metal resources; the actual test explicitly selects CPU and disables offload.
