# Own QA plan

Use [the production plan](../../specs/personal-privacy/plan.md), [tasks](../../specs/personal-privacy/tasks.md) and [verification ledger](../../specs/personal-privacy/verification.md) as the current acceptance set.

Run unit/integration coverage, types, lint and the native iOS suite. Use the dedicated Own QA simulator for persisted sources, real local model execution and settings flows. Fixture scripts must preserve and restore simulator data; skipped fixture checks do not count as passes. The explicit Apple-model probe is `npm run test:ios:apple` and requires a working supported environment.

Inspect rendered normal/large text, keyboard and supported themes. A passing functional test does not establish visual quality, VoiceOver behavior or phone performance. Complete the [physical-device checklist](../privacy-and-phone-checks.md) before release.
