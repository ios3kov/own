# Own: privacy limits and physical-device acceptance

Status: work in progress. A simulator build or a source scan is not a privacy certificate.

## Storage and recovery

- Chats, preferences and response profiles use local AsyncStorage. Its iOS implementation excludes its storage folder from backup by default. Do not rely on an iCloud restore to recover these records.
- Provider API keys and the app-lock verifier use iOS Keychain, accessible while the device is unlocked. Keys are excluded from the app's preference records. Legacy preference keys migrate only after Keychain storage succeeds; a failed migration preserves the original records for retry.
- Own does not enable Keychain synchronization. Keychain items may survive app deletion, and encrypted operating-system backup behavior depends on the platform and account. App deletion is not proof of key deletion; remove configured servers and disable the lock first when needed.
- Imported documents, extracted text, retrieval chunks and embeddings are local files/SQLite records. There is no separate app-level encrypted document vault. The sandbox, iOS file protection and device passcode provide the platform boundary; exact lock-state access still needs device testing.
- Model folders are marked as excluded from backup. Keep original model/document files elsewhere if they matter. Reinstalling Own can remove its sandbox.
- The passphrase lock controls access through Own's interface. It does not independently encrypt every stored chat or document. A neutral cover hides Own's window when it becomes inactive; verify the real app-switcher capture on the phone.

## Network behavior to verify

Local inference and installed local speech should work without app network access. User-requested model downloads, web search, page reading, configured remote providers and optional Apple speech recognition can use the network. Apple model preparation and other operating-system traffic must be distinguished from Own's requests.

Use a controlled phone trace, with timestamps and the exact build identity. Test idle launch, local chat, document import/index/search, local spoken replies, background/foreground and restart before enabling optional online functions. There must be no unexpected app requests or payloads. Then enable each online function separately and match destinations and contents to that action. A domain allowlist cannot guarantee the destination of every iOS background-download redirect.

## Required phone checks

Record PASS, FAIL or NOT RUN for each scenario, the build version/commit, iOS/device, steps and evidence. Preserve real data before reinstall, recovery or low-storage experiments.

1. Install a signed build, launch, relaunch and upgrade without losing existing chats, documents, profiles or downloads. Check the displayed Own name/icon and permissions.
2. Apple model available: real streamed reply, tools, cancellation and a new reply. Reopen a chat containing saved tool output and switch it from Llama/remote to Apple; verify a new Apple reply and correct history. Unavailable/not ready/disabled: clear explanation, retry and explicit alternative selection. No silent fallback or automatic model download.
3. Explicit Hugging Face/GGUF discovery and Files import; load a suitable phone-sized model, real offline reply, tokenizer context display, model switch/unload and memory warning. Test supported vision/projector files. The tiny simulator fixture is engine smoke evidence only.
4. Model settings: supported controls only, profile save/relaunch/apply/edit/reset/remove; long history trims request context without deleting saved messages. Check large text, dark mode, keyboard and VoiceOver.
5. Download consent: exact combined main/vision size or honest unknown, Wi-Fi advice and mobile-data confirmation. Test foreground → background → lock → foreground, app termination/relaunch, network loss/change, retry/resume/cancel and low disk. Check progress, approximate ETA, partial-file cleanup and no false completion.
6. Documents: Files import, indexing/search, project isolation, real source excerpt, original-file opening, deletion/missing-file error and upgrade/relaunch. Test same-named files from different folders and failed indexing followed by retry.
7. Speech: local installed voice offline; long streamed reply, stop, new chat/model, lock/background, audio-route change, interruption and repeated microphone handoff. Apple speech recognition starts off; enable/disable deliberately and test permission denial/revocation.
8. App lock: wrong/correct passphrase, background/foreground, app-switcher cover, permission prompts and lock-screen behavior. Check expected file/Keychain access while locked and after first unlock. Test backup/restore only with a recoverable copy and document what survives.
9. Remote providers: explicit setup, key save/restart, health/model discovery, rejected credentials, key replacement/deletion and storage failure/retry. Confirm no raw API key in preference files or diagnostic output.
10. Google search: real successful results, challenge, timeout, network denial and page-reading errors. Never label a challenge as successful search.
11. Supported iOS image generation: model download/import/load, real output, cancellation, save/share and denied Photos access. Camera/photos/vision permissions must fail safely when denied or revoked.
12. Real workload: sustained generation, repeated load/unload, memory pressure, thermal behavior, battery and responsiveness. Simulator memory/performance does not establish phone limits.
13. Run the controlled network trace described above and inspect final packaged identifiers/resources. Confirm no unexpected collection. Keep operating-system and explicitly enabled provider traffic separate.

Page-reading tool checks must include IPv6 and alternate numeric IPv4 local addresses. Direct address checks do not establish DNS-rebinding protection; redirect and resolved-address enforcement remain unverified. With knowledge search disabled, restoring settings, sending and regenerating project chats must not enable it or retrieve project documents.

## Signing for a personal phone

The pre-cleanup development profile was valid until 2026-10-31 at 17:18:19 UTC. A fresh signed candidate must be checked again. Development profiles expire; renew signing with the same bundle ID and team to preserve app data. Do not uninstall Own as a renewal step.

## Host and service limits

A real Apple reply currently fails on this Mac/simulator with ModelManagerServices error 1026. The host Apple model is unavailable; the exact cause is not established. `npm run test:ios:apple` retains this explicit acceptance probe. Ordinary simulator CI excludes only that host-dependent probe; it is still required on a working supported environment/phone.

External CI, coverage/reviewer services and signing/profile availability are separate gates. A disconnected phone is not the explanation for every outstanding service or host check. See the current verification ledger for actual results.
