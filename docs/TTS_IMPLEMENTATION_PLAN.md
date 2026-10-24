# Own speech implementation

The adopted requirements are T10 in [the production plan](../specs/personal-privacy/plan.md). Spoken replies use installed local system voices, follow the active generation and stop on cancellation, context changes and microphone handoff. Apple recognition is a separate explicit option and starts disabled. Whisper uses a locally installed model.

Use [the verification ledger](../specs/personal-privacy/verification.md) for automated evidence and [the phone checklist](privacy-and-phone-checks.md) for audio routes, interruptions, permissions, offline operation and repeated handoff. This document does not claim those device checks have passed.
