import Foundation
import Network
import React

/// Reads the current system route; does not probe a remote server or request tracking permissions.
@objc(OwnNetworkInfo)
final class OwnNetworkInfo: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }
  @objc(status:rejecter:)
  func status(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let monitor = NWPathMonitor()
    let queue = DispatchQueue(label: "own.network-status")
    var finished = false
    func finish(_ path: NWPath?) {
      guard !finished else { return }
      finished = true
      monitor.cancel()
      monitor.pathUpdateHandler = nil
      guard let path else { resolve(["kind": "unknown"]); return }
      let kind: String
      if path.status != .satisfied { kind = "unavailable" }
      else if path.usesInterfaceType(.cellular) { kind = "cellular" }
      else if path.usesInterfaceType(.wifi) { kind = "wifi" }
      else if path.usesInterfaceType(.wiredEthernet) { kind = "wired" }
      else { kind = "unknown" }
      resolve(["kind": kind, "expensive": path.isExpensive, "constrained": path.isConstrained])
    }
    monitor.pathUpdateHandler = { path in finish(path) }
    monitor.start(queue: queue)
    queue.asyncAfter(deadline: .now() + 2) { finish(nil) }
  }
}
