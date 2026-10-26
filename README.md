# Own

Personal AI for iPhone. Apple Foundation Models is the default on supported devices. If it is unavailable, choose another model yourself. No alternative model downloads automatically.

Before downloading, Own shows model size and recommends Wi-Fi. Apple speech recognition is a separate option, off by default. Search, model downloads and servers you configure use the network.

## Development status

INCOMPLETE: device validation, full privacy review and remaining plan tasks are not finished. A successful build does not certify security. See specs/personal-privacy/plan.md and verification.md for the current scope and evidence.

## Build

Use Node 24, Xcode 27.1 and CocoaPods. Run `RNLLAMA_SKIP_POSTINSTALL=1 npm ci`, then `pod install` from `ios/`. The Podfile builds the local model runtime from package sources; this supported install option avoids downloading unused native archives. Open ios/Own.xcworkspace and use the Own scheme. Bundle ID: io.github.ios3kov.own. Use your own development signing team.

Third-party libraries and models retain their own licenses. Do not remove their notices.
