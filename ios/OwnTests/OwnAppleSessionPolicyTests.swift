import XCTest

@testable import Own

final class OwnAppleSessionPolicyTests: XCTestCase {
  private func identity(_ conversation: String = "chat-A", text: String = "hello") throws -> OwnAppleSessionPolicy.Identity {
    try XCTUnwrap(OwnAppleSessionPolicy.identity(conversationId: conversation, instructions: "Be helpful",
      messages: [["role": "system", "content": "Be helpful"], ["role": "user", "content": text]]))
  }

  func testExactContinuationIsReusedWithoutAppendingPriorHistoryAgain() throws {
    var policy = OwnAppleSessionPolicy()
    let request = try identity()
    let complete = request.appendingAssistant("Answer")
    XCTAssertTrue(policy.store(complete, now: 10, ticket: policy.epoch))
    let nextPrefix = try XCTUnwrap(OwnAppleSessionPolicy.identity(conversationId: "chat-A", instructions: "Be helpful",
      messages: [["role": "system", "content": "Be helpful"], ["role": "user", "content": "hello"],
                 ["role": "assistant", "content": "Answer"]]))
    XCTAssertTrue(policy.canReuse(nextPrefix, now: 11, responding: false))
    XCTAssertFalse(policy.canReuse(request, now: 11, responding: false))
    XCTAssertFalse(policy.canReuse(nextPrefix.appendingAssistant("Answer"), now: 11, responding: false))
  }

  func testDifferentChatChangedHistoryOrInstructionsCannotReuse() throws {
    var policy = OwnAppleSessionPolicy()
    let original = try identity()
    XCTAssertTrue(policy.store(original, now: 10, ticket: 0))
    XCTAssertFalse(policy.canReuse(try identity("chat-B"), now: 11, responding: false))
    XCTAssertFalse(policy.canReuse(try identity(text: "changed"), now: 11, responding: false))
    var changed = original
    changed.history.append(0)
    XCTAssertFalse(policy.canReuse(changed, now: 11, responding: false))
    let instructions = try XCTUnwrap(OwnAppleSessionPolicy.identity(conversationId: "chat-A", instructions: "Changed",
      messages: [["role": "system", "content": "Be helpful"], ["role": "user", "content": "hello"]]))
    XCTAssertFalse(policy.canReuse(instructions, now: 11, responding: false))
  }

  func testIdentityUsesExactUTF8NotCanonicalStringEqualityOrAmbiguousJoining() throws {
    XCTAssertNotEqual(try identity(text: "\u{E9}"), try identity(text: "e\u{301}"))
    XCTAssertNotEqual(try identity("\u{E9}"), try identity("e\u{301}"))
    let first = OwnAppleSessionPolicy.identity(conversationId: "a", instructions: "bc", messages: [])
    let second = OwnAppleSessionPolicy.identity(conversationId: "ab", instructions: "c", messages: [])
    XCTAssertNotEqual(first, second)
    XCTAssertNil(OwnAppleSessionPolicy.identity(conversationId: " ", instructions: "", messages: []))
    XCTAssertNil(OwnAppleSessionPolicy.identity(conversationId: String(repeating: "a", count: 129), instructions: "", messages: []))
    XCTAssertNil(OwnAppleSessionPolicy.identity(conversationId: "chat", instructions: "", messages: [["role": "tool", "content": "x"]]))
  }

  func testOnlyIdleEligibleNormalChatCanBeRetained() {
    let eligible = OwnAppleSessionPolicy.Admission(enabled: true, hasAttachments: false, historyTrimmed: false,
      internalTask: false, toolCount: 0, active: true, lowPower: false, thermalPermits: true)
    XCTAssertTrue(eligible.allowsRetention)
    var value = eligible; value.enabled = false; XCTAssertFalse(value.allowsRetention)
    value = eligible; value.hasAttachments = true; XCTAssertFalse(value.allowsRetention)
    value = eligible; value.historyTrimmed = true; XCTAssertFalse(value.allowsRetention)
    value = eligible; value.internalTask = true; XCTAssertFalse(value.allowsRetention)
    value = eligible; value.toolCount = 1; XCTAssertFalse(value.allowsRetention)
    value = eligible; value.active = false; XCTAssertFalse(value.allowsRetention)
    value = eligible; value.lowPower = true; XCTAssertFalse(value.allowsRetention)
    value = eligible; value.thermalPermits = false; XCTAssertFalse(value.allowsRetention)
    XCTAssertFalse(OwnAppleSessionPolicy.Admission().allowsRetention)
  }

  func testExpiryAndBusySessionAreNotReusedAndOnlyOneRecordIsStored() throws {
    var policy = OwnAppleSessionPolicy()
    let original = try identity()
    XCTAssertTrue(policy.store(original, now: 10, ticket: 0))
    XCTAssertTrue(policy.canReuse(original, now: 129.9, responding: false))
    XCTAssertFalse(policy.canReuse(original, now: 130, responding: false))
    XCTAssertFalse(policy.canReuse(original, now: 9, responding: false))
    XCTAssertFalse(policy.canReuse(original, now: 11, responding: true))
    XCTAssertFalse(policy.canReuse(original, now: .nan, responding: false))
    XCTAssertTrue(policy.store(try identity("chat-B"), now: 12, ticket: 0))
    XCTAssertEqual(policy.count, 1)
    XCTAssertFalse(policy.canReuse(original, now: 13, responding: false))
  }

  func testEvictionPreventsInflightCompletionRefillingAfterCancellationOrPreferenceOff() throws {
    var policy = OwnAppleSessionPolicy()
    let ticket = policy.epoch
    policy.evict()
    XCTAssertFalse(policy.store(try identity(), now: 11, ticket: ticket))
    XCTAssertEqual(policy.count, 0)
    XCTAssertTrue(policy.store(try identity(), now: 12, ticket: policy.epoch))
  }

  func testOldExpiryCannotRemoveANewerRecordOrEvictConsumedActiveWork() throws {
    var policy = OwnAppleSessionPolicy()
    XCTAssertTrue(policy.store(try identity(), now: 10, ticket: 0))
    let oldExpiry = policy.revision
    policy.discardRecord()
    XCTAssertFalse(policy.expire(revision: oldExpiry))
    XCTAssertEqual(policy.epoch, 0, "Idle expiry must not invalidate an active generation's ticket")
    XCTAssertTrue(policy.store(try identity("chat-B"), now: 12, ticket: 0))
    XCTAssertFalse(policy.expire(revision: oldExpiry))
    XCTAssertEqual(policy.count, 1)
    XCTAssertTrue(policy.expire(revision: policy.revision))
    XCTAssertEqual(policy.count, 0)
  }

  func testPowerAndThermalNotificationsEvictRecordAndInvalidateInflightTicket() throws {
    let center = NotificationCenter()
    var policy = OwnAppleSessionPolicy()
    let original = try identity()
    let delivered = expectation(description: "Both environment changes reach cache ownership queue")
    delivered.expectedFulfillmentCount = 2
    var callbacks = 0
    let observer = OwnAppleSessionEnvironmentObserver(center: center) {
      XCTAssertTrue(Thread.isMainThread)
      let oldTicket = policy.epoch
      policy.evict()
      XCTAssertEqual(policy.count, 0)
      XCTAssertFalse(policy.store(original, now: 11, ticket: oldTicket))
      callbacks += 1
      // A new generation may finish between two environment transitions.
      XCTAssertTrue(policy.store(original, now: 12, ticket: policy.epoch))
      delivered.fulfill()
    }
    XCTAssertTrue(policy.store(original, now: 10, ticket: policy.epoch))
    DispatchQueue.global().async {
      center.post(name: .NSProcessInfoPowerStateDidChange, object: ProcessInfo.processInfo)
      center.post(name: ProcessInfo.thermalStateDidChangeNotification, object: ProcessInfo.processInfo)
    }
    wait(for: [delivered], timeout: 2)
    withExtendedLifetime(observer) {
      XCTAssertEqual(callbacks, 2)
      XCTAssertEqual(policy.epoch, 2)
    }
  }

  func testCachedTokenBudgetIncludesReplyReserveAndMarginWithoutOverflow() {
    XCTAssertTrue(OwnAppleSessionPolicy.budgetFits(promptTokens: 800, reserve: 136, capacity: 1000))
    XCTAssertFalse(OwnAppleSessionPolicy.budgetFits(promptTokens: 801, reserve: 136, capacity: 1000))
    XCTAssertFalse(OwnAppleSessionPolicy.budgetFits(promptTokens: .max, reserve: 136, capacity: 1000))
    XCTAssertFalse(OwnAppleSessionPolicy.budgetFits(promptTokens: 1, reserve: .max, capacity: 1000))
    XCTAssertFalse(OwnAppleSessionPolicy.budgetFits(promptTokens: -1, reserve: 1, capacity: 1000))
    XCTAssertFalse(OwnAppleSessionPolicy.budgetFits(promptTokens: 1, reserve: 0, capacity: 1000))
  }
}
