# Own tasks

Requirements and acceptance: [plan](plan.md), R01–R13 / T01–T17.

- T01 PARTIAL: clean npm install, seven native patches and pod install passed in the renamed source. Uploaded as a work-in-progress review branch, feat/current-own-project, in ios3kov/own (PR #1).
- T02–T06 PARTIAL: privacy guards, PBKDF2 authentication, Google parser, optional Apple speech implemented; complete source inventory, live traffic and phone scenarios remain.
- T07 IN_PROGRESS: JavaScript lint has no errors (38 warnings); repaired fail-masking native scripts and stale tests. Compatible dependency updates applied and API-smoke tested. SwiftLint0.65.1 installed; no lint errors, style warnings remain.
- T08/T16 PARTIAL: Own project/identifiers/icons and source rename done; binary scan removed original editor recovery path; runtime bundle/UI review remains.
- T09 PARTIAL: measured speed/approximate ETA implemented, including combined vision-file progress and fresh retry observations. Four focused suites /47 tests pass; TypeScript and focused lint pass. Actual phone/background/rendered ETA checks NOT_RUN. See ash-reference-review.md.
- T10 PARTIAL: local native basic-voice speech implemented, optional and off by default. Sentence/Markdown/reasoning cleanup, bounded queue, session cancellation, stop control and lifecycle guards implemented. Native55 tests pass, including actual simulator playback/cancellation. Voice-screen opt-in/relaunch test passes and screenshot reviewed. Full T10 JS regression:196 suites /5543 tests pass,4 skipped. Phone/offline/interruption/repeated microphone scenarios remain.
- T11 PARTIAL: trusted document references, saved-excerpt preview and project-scoped file lookup implemented. Local context uses the loaded tokenizer and actual managed prompt; unsupported capacities are shown as unavailable. Focused seven suites /270 tests pass. Native rendered source/context flows and phone checks remain.
- T12 IN_PROGRESS: separate regression and critical review. No overall readiness claim.
- T13 NOT_RUN: signed physical phone validation and traffic acceptance.
- T14 PARTIAL: local Apple Foundation Models default and manual alternatives implemented/tested; actual device generation unverified.
- T15 PARTIAL: size/Wi-Fi consent implemented; network change re-confirmation has failing-before/passing-after unit and integration evidence. Background/device scenarios remain.

Active candidate: source-only Own directory, version0.1.0(1). No inherited Git history will be published. Earlier source remains separate recovery material.

- T17 / R13 PARTIAL, required final feature: understandable model settings, built-in/custom saved profiles, explanations, capability filtering, memory warnings, one-action reset and advanced controls. Implemented after core additions. Capability-filtered controls, built-in/local custom profiles, explanations, warnings and advanced sections are present; focused four suites /168 tests pass,1 skipped. Simulator profile/relaunch/edit/reset/remove PASS at normal/light and dark/accessibility-extra-extra-large settings. Final acceptance remains open. Reset now restores a persisted per-engine chosen profile (defaults before first choice); twelve focused tests pass, including storage failure and rehydration. Current settings simulator acceptance passed; native source/context and full device acceptance remain open.
