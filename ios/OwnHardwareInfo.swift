import Foundation
import Darwin
import React

/// Local system facts only. No network calls, identifiers, or tracking.
@objc(OwnHardwareInfo)
final class OwnHardwareInfo: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }
  static func memorySnapshot() -> [String: Double] {
    var info = task_vm_info_data_t()
    var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size)
    let result = withUnsafeMutablePointer(to: &info) { pointer in
      pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
        task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
      }
    }
    guard result == KERN_SUCCESS else { return [:] }
    var values: [String: Double] = [:]
    if info.phys_footprint > 0 { values["currentBytes"] = Double(info.phys_footprint) }
    if info.ledger_phys_footprint_peak > 0 { values["peakBytes"] = Double(info.ledger_phys_footprint_peak) }
    return values
  }
  @objc(memory:rejecter:)
  func memory(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve(Self.memorySnapshot())
  }
  @objc(status:rejecter:)
  func status(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let process = ProcessInfo.processInfo
    let thermal: String
    switch process.thermalState {
    case .nominal: thermal = "nominal"
    case .fair: thermal = "fair"
    case .serious: thermal = "serious"
    case .critical: thermal = "critical"
    @unknown default: thermal = "unknown"
    }
    resolve(["processors": process.processorCount,
             "activeProcessors": process.activeProcessorCount,
             "thermalState": thermal,
             "lowPowerMode": process.isLowPowerModeEnabled])
  }
}
