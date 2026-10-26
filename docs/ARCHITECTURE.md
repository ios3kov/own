# Own architecture

Own is an iPhone app built with React Native and native iOS modules. The current requirements and release gates are in [the production plan](../specs/personal-privacy/plan.md). Historical implementation proposals do not establish current behavior or release readiness.

## Model selection

Apple Foundation Models is the default. Own checks local availability and explains unavailable states. The user chooses an alternative; Own does not silently switch engines or start a model download.

Downloaded and imported GGUF models run through llama.rn, using CPU or Metal. Vision requires a compatible model and projector. The runtime falls back to CPU when initialization fails, and a final retry never increases the requested context size. This does not guarantee that any model fits a particular phone.

Image generation uses the Core ML bridge. Catalog entries, imported archives and recovered downloads must resolve to Core ML model resources. Native progress and error events use the OwnImageProgress and OwnImageError names. Actual phone image generation and resource limits still need device validation.

## Main components

| Responsibility | Source |
|---|---|
| Apple availability, streaming and tool bridge | [foundationModels.ts](../src/services/foundationModels.ts), [OwnFoundationModels.swift](../ios/OwnFoundationModels.swift) |
| GGUF inference and CPU fallback | [llm.ts](../src/services/llm.ts), [llmHelpers.ts](../src/services/llmHelpers.ts) |
| Core ML image generation | [coreMLImageGenerator.ts](../src/services/coreMLImageGenerator.ts), [CoreMLDiffusionModule.swift](../ios/CoreMLDiffusionModule.swift) |
| Model registration/import/recovery | [modelManager](../src/services/modelManager/) |
| Background transfers | [backgroundDownloadService.ts](../src/services/backgroundDownloadService.ts), [DownloadManagerModule.swift](../ios/DownloadManagerModule.swift) |
| Search and page reading | [tool handlers](../src/services/tools/handlers.ts) |
| Configured providers and credentials | [remoteServerManager.ts](../src/services/remoteServerManager.ts), [serverPreferenceStorage.ts](../src/services/serverPreferenceStorage.ts) |
| Trusted document source paths | [localDocumentPath.ts](../src/services/localDocumentPath.ts), [documentSourceFile.ts](../src/services/documentSourceFile.ts) |
| Understandable settings and profiles | [SimpleModelSettings.tsx](../src/components/SimpleModelSettings.tsx), [responseProfilesStore.ts](../src/stores/responseProfilesStore.ts) |

## Background downloads

The JavaScript download store tracks UI state. The native URLSession implementation retains transfer state for hydration after relaunch. The user sees combined main/vision size, or an honest unknown size, plus Wi-Fi advice and mobile-data confirmation before starting a transfer.

Background transfer behavior is subject to iOS scheduling. Cancellation, interrupted transfers, retry, relaunch and model registration have automated checks; lock, termination, real connectivity and background redirects still need phone checks. Do not promise uninterrupted downloading or complete redirect inspection.

## Documents and tools

Imported documents and retrieval records stay in the app sandbox. Source links carry project/document identity; opening a file resolves that record and the exact relative path after an iOS container move. It does not guess by basename. Indexing writes document/chunk records atomically and releases duplicate-import guards on failure.

Knowledge-search settings survive restoration. Disabling that tool also stops new automatic project retrieval during send/regenerate. Saved history is retained. Saved tool output is labeled as reference data when passed to Apple using supported message roles; native response behavior with that history remains a device acceptance check.

Google is the default search service. A challenge or failed response is shown as an error. Page reading rejects direct local-address aliases after URL normalization. These checks do not establish DNS or redirect protection.

## Speech and storage

Whisper transcription uses an installed local model. Apple speech recognition is a separate option, off by default. Spoken replies use installed system voices and follow generation/cancellation ownership.

Chats, preferences and profiles use AsyncStorage. Provider keys and the app-lock verifier use Keychain; preference persistence strips API keys. Documents and retrieval records use local files/SQLite. The interface lock is not an independent encrypted vault. See [privacy limits and phone checks](privacy-and-phone-checks.md) for backup, deletion, lock-state and network boundaries.

Release diagnostics do not print document payloads. A neutral cover hides the window while inactive. These mechanisms require physical-device verification as well as source/native tests.

## Validation

Use the build instructions in [README](../README.md), the project pre-push gates and the [verification ledger](../specs/personal-privacy/verification.md). Keep simulator evidence, actual local generation, static review, signed builds and physical-device results separate. No build or scanner result alone certifies security.
