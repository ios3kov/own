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
  func testSavedDocumentSourcePreview() throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launch()
    let title = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Own QA document sources")).firstMatch
    guard title.waitForExistence(timeout: 10) else {
      throw XCTSkip("Requires scripts/qa/document-fixture.py synthetic simulator data")
    }
    title.tap()
    let source = app.buttons["Own QA notes.txt, part 1"]
    XCTAssertTrue(source.waitForExistence(timeout: 10))
    source.tap()
    XCTAssertTrue(app.staticTexts["Saved excerpt · Part 1"].waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts["Own QA source: the meeting starts at 14:30 in room Cedar. This is synthetic test data."].exists)
    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.name = "Own saved document source"
    screenshot.lifetime = .keepAlways
    add(screenshot)
    app.buttons["Open original document"].tap()
    let close = app.buttons["QLOverlayDoneButtonAccessibilityIdentifier"]
    XCTAssertTrue(close.waitForExistence(timeout: 10))
    let original = app.textViews.matching(NSPredicate(format: "label CONTAINS %@", "Own QA source: the meeting starts at 14:30")).firstMatch
    XCTAssertTrue(original.waitForExistence(timeout: 10))
    let originalScreenshot = XCTAttachment(screenshot: app.screenshot())
    originalScreenshot.name = "Own original document after sandbox move"
    originalScreenshot.lifetime = .keepAlways
    add(originalScreenshot)
    close.tap()
  }
  func testForegroundRemovesPrivacyCover() {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launch()
    let skip = app.descendants(matching: .any)["onboarding-skip"]
    if skip.waitForExistence(timeout: 3) { skip.tap() }
    XCTAssertTrue(app.descendants(matching: .any)["settings-tab"].firstMatch.waitForExistence(timeout: 15))
    XCUIDevice.shared.press(.home)
    app.activate()
    XCTAssertTrue(app.descendants(matching: .any)["settings-tab"].firstMatch.waitForExistence(timeout: 15))
    XCTAssertFalse(app.descendants(matching: .any)["own-privacy-cover"].exists)
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
    // The profile scenario checks Apple-supported controls, independent of
    // the local-engine scenario that may have selected Llama before this test.
    app.descendants(matching: .any)["home-tab"].firstMatch.tap()
    let useApple = app.buttons["Use Apple model"]
    if useApple.waitForExistence(timeout: 3) { useApple.tap() }
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
  func testLocalLlamaReplyAndContext() throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launch()
    let skip = app.descendants(matching: .any)["onboarding-skip"]
    if skip.waitForExistence(timeout: 3) { skip.tap() }
    let card = app.buttons["text-model-picker"]
    guard card.waitForExistence(timeout: 10) else {
      throw XCTSkip("Requires local-model-fixture.py and Apple default on the dedicated QA simulator")
    }
    card.tap()
    print(app.debugDescription)
    let model = app.descendants(matching: .any).matching(NSPredicate(format: "identifier == %@ AND label BEGINSWITH %@", "model-item", "Own QA local model")).firstMatch
    guard model.waitForExistence(timeout: 10) else {
      throw XCTSkip("Requires the hash-checked synthetic local model fixture")
    }
    model.tap()
    let selected = app.buttons["Use Apple model"]
    XCTAssertTrue(selected.waitForExistence(timeout: 90), "Local model selection must finish before opening chat")
    let newChat = app.buttons["new-chat-button"]
    let ready = NSPredicate { _, _ in newChat.exists && newChat.isHittable }
    expectation(for: ready, evaluatedWith: app)
    waitForExpectations(timeout: 30)
    newChat.tap()
    let input = app.textViews["chat-input"]
    XCTAssertTrue(input.waitForExistence(timeout: 10))
    input.tap()
    input.typeText("Once upon a time")
    app.descendants(matching: .any)["send-button"].tap()
    let measured = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Latest request: about ")).firstMatch
    XCTAssertTrue(measured.waitForExistence(timeout: 60), "Real tokenizer context must be measured")
    let stop = app.descendants(matching: .any)["stop-button"]
    let finished = NSPredicate { _, _ in !stop.exists }
    expectation(for: finished, evaluatedWith: app)
    waitForExpectations(timeout: 60)
    let reply = app.descendants(matching: .any)["assistant-message"].firstMatch
    XCTAssertTrue(reply.waitForExistence(timeout: 5))
    print(app.debugDescription)
    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.name = "Own actual local Llama reply and context"
    screenshot.lifetime = .keepAlways
    add(screenshot)
    input.tap()
    input.typeText("Synthetic unsent draft")
    XCTAssertTrue(app.buttons["Add attachment"].exists)
    XCTAssertTrue(app.buttons["Chat options"].exists)
    let composer = XCTAttachment(screenshot: app.screenshot())
    composer.name = "Own composer with keyboard and persistent controls"
    composer.lifetime = .keepAlways
    add(composer)
    app.buttons["Chat options"].tap()
    XCTAssertTrue(app.buttons["Image generation mode"].waitForExistence(timeout: 5))
    app.buttons["Close chat options"].tap()
    XCTAssertTrue((input.value as? String ?? "").contains("Synthetic unsent draft"))
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
    input.tap()
    input.typeText("Change the request: reply only with TULIP now.")
    app.descendants(matching: .any)["send-button"].tap()
    let changedReply = app.staticTexts.matching(NSPredicate(format: "label MATCHES[c] %@", "^TULIP[.!]?$" )).firstMatch
    XCTAssertTrue(changedReply.waitForExistence(timeout: 60), "Apple must follow a changed follow-up request")

  }

  func testSecurityHeaderAndPINSetupRespectSafeArea() {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launch()
    let skip = app.descendants(matching: .any)["onboarding-skip"]
    if skip.waitForExistence(timeout: 3) { skip.tap() }
    app.descendants(matching: .any)["settings-tab"].firstMatch.tap()
    let security = app.descendants(matching: .any)["settings-SecuritySettings"].firstMatch
    if !security.isHittable { app.swipeUp() }
    XCTAssertTrue(security.waitForExistence(timeout: 10))
    security.tap()
    let title = app.staticTexts["Security"].firstMatch
    XCTAssertTrue(title.waitForExistence(timeout: 10))
    let status = app.statusBars.firstMatch
    if status.exists { XCTAssertGreaterThanOrEqual(title.frame.minY, status.frame.maxY) }
    let screen = XCTAttachment(screenshot: app.screenshot())
    screen.name = "Own Security safe area"
    screen.lifetime = .keepAlways
    add(screen)
    let toggle = app.switches.firstMatch
    guard toggle.value as? String == "0" else { return }
    toggle.tap()
    let setup = app.staticTexts["Set up PIN"].firstMatch
    XCTAssertTrue(setup.waitForExistence(timeout: 10))
    if status.exists { XCTAssertGreaterThanOrEqual(setup.frame.minY, status.frame.maxY) }
    XCTAssertTrue(app.secureTextFields["Four-digit PIN"].exists)
    let form = XCTAttachment(screenshot: app.screenshot())
    form.name = "Own PIN setup safe area"
    form.lifetime = .keepAlways
    add(form)
    app.buttons["Cancel"].tap()
  }

  func testLargeTextSecurityHeaderAndPINSetupRespectSafeArea() {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
    app.launch()
    let skip = app.descendants(matching: .any)["onboarding-skip"]
    if skip.waitForExistence(timeout: 3) { skip.tap() }
    app.descendants(matching: .any)["settings-tab"].firstMatch.tap()
    let security = app.descendants(matching: .any)["settings-SecuritySettings"].firstMatch
    if !security.isHittable { app.swipeUp() }
    XCTAssertTrue(security.waitForExistence(timeout: 10))
    security.tap()
    let title = app.staticTexts["Security"].firstMatch
    XCTAssertTrue(title.waitForExistence(timeout: 10))
    let status = app.statusBars.firstMatch
    if status.exists { XCTAssertGreaterThanOrEqual(title.frame.minY, status.frame.maxY) }
    let screen = XCTAttachment(screenshot: app.screenshot())
    screen.name = "Own large text Security safe area"
    screen.lifetime = .keepAlways
    add(screen)
    let toggle = app.switches.firstMatch
    guard toggle.value as? String == "0" else { return }
    toggle.tap()
    let setup = app.staticTexts["Set up PIN"].firstMatch
    XCTAssertTrue(setup.waitForExistence(timeout: 10))
    if status.exists { XCTAssertGreaterThanOrEqual(setup.frame.minY, status.frame.maxY) }
    XCTAssertTrue(app.secureTextFields["Four-digit PIN"].exists)
    let form = XCTAttachment(screenshot: app.screenshot())
    form.name = "Own large text PIN setup safe area"
    form.lifetime = .keepAlways
    add(form)
    app.buttons["Cancel"].tap()
  }

  func testMainNavigationAndModelGuide() {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launch()
    let skip = app.descendants(matching: .any)["onboarding-skip"]
    if skip.waitForExistence(timeout: 3) { skip.tap() }
    for tab in ["home-tab", "chats-tab", "projects-tab", "models-tab", "settings-tab"] {
      let button = app.descendants(matching: .any)[tab].firstMatch
      XCTAssertTrue(button.waitForExistence(timeout: 15))
      button.tap()
      // Capture after finite navigation/entry animations, not halfway through a transition.
      Thread.sleep(forTimeInterval: 0.8)
      let screenshot = XCTAttachment(screenshot: app.screenshot())
      screenshot.name = "Own navigation " + tab
      screenshot.lifetime = .keepAlways
      add(screenshot)
    }
  }

  func testGalleryViewerAndDeletion() throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launch()
    app.descendants(matching: .any)["home-tab"].firstMatch.tap()
    let gallery = app.descendants(matching: .any)["open-gallery"].firstMatch
    XCTAssertTrue(gallery.waitForExistence(timeout: 10))
    if !gallery.isHittable { app.swipeUp() }
    gallery.tap()
    let first = app.buttons["gallery-image-own-qa-gallery-one"]
    guard first.waitForExistence(timeout: 10) else {
      throw XCTSkip("Requires gallery-fixture.py on the dedicated QA simulator")
    }
    first.tap()
    app.buttons["Image details"].tap()
    XCTAssertTrue(app.staticTexts["Image Details"].waitForExistence(timeout: 5))
    app.buttons["Done"].tap()
    app.buttons["Delete image"].tap()
    XCTAssertTrue(app.staticTexts["Delete Image"].waitForExistence(timeout: 5))
    let confirmation = XCTAttachment(screenshot: app.screenshot())
    confirmation.name = "Own gallery visible delete confirmation"
    confirmation.lifetime = .keepAlways
    add(confirmation)
    app.buttons["Cancel"].tap()
    XCTAssertTrue(app.buttons["Delete image"].exists)
    app.buttons["Delete image"].tap()
    app.buttons["Delete"].tap()
    XCTAssertTrue(first.waitForNonExistence(timeout: 10))
    XCTAssertTrue(app.buttons["Select images"].waitForExistence(timeout: 10))
    app.buttons["Select images"].tap()
    let second = app.buttons["gallery-image-own-qa-gallery-two"]
    XCTAssertTrue(second.waitForExistence(timeout: 5))
    second.tap()
    app.buttons["Delete selected images"].tap()
    XCTAssertTrue(app.staticTexts["Delete Images"].waitForExistence(timeout: 5))
    app.buttons["Delete"].tap()
    XCTAssertTrue(second.waitForNonExistence(timeout: 10))
    app.terminate()
    app.launch()
    app.descendants(matching: .any)["home-tab"].firstMatch.tap()
    app.descendants(matching: .any)["open-gallery"].firstMatch.tap()
    XCTAssertFalse(app.buttons["gallery-image-own-qa-gallery-one"].exists)
    XCTAssertFalse(app.buttons["gallery-image-own-qa-gallery-two"].exists)
  }

  func testSettingsRoutesAndBackButtons() {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launch()
    app.descendants(matching: .any)["settings-tab"].firstMatch.tap()
    let routes = [("ModelSettings", "Model Settings"), ("RemoteServers", "Remote Servers"),
                  ("VoiceSettings", "Voice"), ("SecuritySettings", "Security"),
                  ("DeviceInfo", "Device Information"), ("StorageSettings", "Storage"), ("About", "About")]
    for (route, title) in routes {
      let row = app.descendants(matching: .any)["settings-" + route].firstMatch
      for _ in 0..<5 {
        if row.exists && row.isHittable { break }
        app.swipeUp()
      }
      XCTAssertTrue(row.waitForExistence(timeout: 5))
      row.tap()
      XCTAssertTrue(app.staticTexts[title].firstMatch.waitForExistence(timeout: 10))
      XCTAssertTrue(app.buttons["Back"].firstMatch.waitForExistence(timeout: 5))
      app.buttons["Back"].firstMatch.tap()
      XCTAssertTrue(app.staticTexts["Settings"].firstMatch.waitForExistence(timeout: 10))
    }
  }

}
