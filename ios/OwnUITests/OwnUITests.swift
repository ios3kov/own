import XCTest

final class OwnUITests: XCTestCase {
  func testAppleDefaultSurvivesOnboardingAndRelaunch() {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launch()
    print(app.debugDescription)
    let skip = app.descendants(matching: .any)["onboarding-skip"]
    if skip.waitForExistence(timeout: 5) { skip.tap() }
    XCTAssertTrue(app.staticTexts["Apple Foundation Models"].waitForExistence(timeout: 20))
    XCTAssertTrue(app.buttons["Choose another model"].exists)
    app.terminate()
    app.launch()
    XCTAssertTrue(app.staticTexts["Apple Foundation Models"].waitForExistence(timeout: 20))
    XCTAssertTrue(app.buttons["Choose another model"].exists)
    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.name = "Own Home with Apple default"
    screenshot.lifetime = .keepAlways
    add(screenshot)
  }
  func testSpokenReplyPreferenceAndVoiceScreen() {
    continueAfterFailure = false
    let app = XCUIApplication()
    func openVoice() {
      let skip = app.descendants(matching: .any)["onboarding-skip"]
      if skip.waitForExistence(timeout: 3) { skip.tap() }
      let settings = app.descendants(matching: .any)["settings-tab"].firstMatch
      XCTAssertTrue(settings.waitForExistence(timeout: 15))
      settings.tap()
      let voice = app.descendants(matching: .any)["settings-VoiceSettings"].firstMatch
      if !voice.exists { app.swipeUp() }
      XCTAssertTrue(voice.waitForExistence(timeout: 5))
      voice.tap()
      XCTAssertTrue(app.switches["Read replies aloud"].waitForExistence(timeout: 5))
    }
    app.launch()
    openVoice()
    let read = app.switches["Read replies aloud"]
    XCTAssertEqual(read.value as? String, "0")
    XCTAssertEqual(app.switches["Use Apple speech recognition"].value as? String, "0")
    read.tap()
    XCTAssertEqual(read.value as? String, "1")
    app.terminate()
    app.launch()
    openVoice()
    XCTAssertEqual(app.switches["Read replies aloud"].value as? String, "1")
    app.switches["Read replies aloud"].tap()
    app.buttons["Stop speaking"].tap()
    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.name = "Own voice settings, local speech off"
    screenshot.lifetime = .keepAlways
    add(screenshot)
  }
  func testSimpleSettingsProfileSurvivesRelaunch() {
    continueAfterFailure = false
    let app = XCUIApplication()
    func tap(_ element: XCUIElement, towardBottom: Bool = true) {
      XCTAssertTrue(element.waitForExistence(timeout: 10))
      for _ in 0..<32 where !element.isHittable {
        let scroll = app.descendants(matching: .any)["model-settings-scroll"].firstMatch
        if scroll.exists {
          let upper = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2))
          let lower = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8))
          if towardBottom { lower.press(forDuration: 0.05, thenDragTo: upper) }
          else { upper.press(forDuration: 0.05, thenDragTo: lower) }
        } else if towardBottom { app.swipeUp() } else { app.swipeDown() }
      }
      if !element.isHittable {
        let blocked = XCTAttachment(screenshot: app.screenshot())
        blocked.name = "Blocked control " + element.label
        blocked.lifetime = .keepAlways
        add(blocked)
        print(app.debugDescription)
      }
      XCTAssertTrue(element.isHittable)
      element.tap()
    }
    func openSettings() {
      let skip = app.descendants(matching: .any)["onboarding-skip"]
      if skip.waitForExistence(timeout: 3) { skip.tap() }
      tap(app.descendants(matching: .any)["settings-tab"].firstMatch)
      tap(app.descendants(matching: .any)["settings-ModelSettings"].firstMatch)
      tap(app.descendants(matching: .any)["text-generation-accordion"].firstMatch)
    }
    app.launch()
    openSettings()
    tap(app.buttons["Short"])
    let top = XCTAttachment(screenshot: app.screenshot())
    top.name = "Own understandable settings"
    top.lifetime = .keepAlways
    add(top)
    tap(app.buttons["Less"])
    let name = app.textFields["Profile name"]
    tap(name)
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
    for character in "QA settings" { name.typeText(String(character)) }
    XCTAssertEqual(name.value as? String, "QA settings")
    tap(app.buttons["Save response profile"])
    XCTAssertTrue(app.staticTexts["Profile saved on this device."].waitForExistence(timeout: 10))
    let saved = XCTAttachment(screenshot: app.screenshot())
    saved.name = "Own profile saved with keyboard"
    saved.lifetime = .keepAlways
    add(saved)
    app.terminate()
    app.launch()
    openSettings()
    tap(app.buttons["Reset answer settings"])
    tap(app.buttons["QA settings"], towardBottom: false)
    tap(app.buttons["Long"], towardBottom: false)
    tap(app.buttons["Reset answer settings"])
    tap(app.buttons["Technical settings"])
    XCTAssertTrue(app.staticTexts["Maximum response tokens · 256"].waitForExistence(timeout: 5))
    XCTAssertFalse(app.staticTexts["CPU Threads"].exists)
    tap(app.buttons["Remove QA settings"], towardBottom: false)
  }
  func testLocalAppleReplyThroughChat() throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchEnvironment["OWN_QA_DIAGNOSTICS"] = "1"
    app.launch()
    let skip = app.descendants(matching: .any)["onboarding-skip"]
    if skip.waitForExistence(timeout: 3) { skip.tap() }
    guard app.staticTexts["Current model · on device"].waitForExistence(timeout: 10) else {
      throw XCTSkip("Apple model is unavailable in this test environment")
    }
    let newChat = app.buttons["new-chat-button"]
    XCTAssertTrue(newChat.waitForExistence(timeout: 10))
    newChat.tap()
    let input = app.textViews["chat-input"]
    XCTAssertTrue(input.waitForExistence(timeout: 10))
    input.tap()
    input.typeText("Return only the word ORCHID.")
    app.descendants(matching: .any)["send-button"].tap()
    let reply = app.staticTexts.matching(NSPredicate(format: "label MATCHES[c] %@", "^ORCHID[.!]?$" )).firstMatch
    XCTAssertTrue(reply.waitForExistence(timeout: 60), "The local Apple model must produce the requested reply in chat")
    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.name = "Own local Apple reply"
    screenshot.lifetime = .keepAlways
    add(screenshot)
  }

}
