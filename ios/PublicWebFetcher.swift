import Foundation
import Security
import Darwin
import Network

// URL tools use a pinned public IP per hop. Never fall back to ordinary fetch:
// checking DNS and then resolving it again would leave a rebinding window.
enum PublicWebAddress {
  // Exact prefixes: https://www.iana.org/assignments/iana-ipv4-special-registry/
  static func isPublicIPv4(_ bytes: [UInt8]) -> Bool {
    guard bytes.count == 4 else { return false }
    let firstOctet = bytes[0], secondOctet = bytes[1], thirdOctet = bytes[2]
    return !(firstOctet == 0 || firstOctet == 10 || firstOctet == 127 || firstOctet >= 224 ||
      (firstOctet == 100 && (64...127).contains(secondOctet)) || (firstOctet == 169 && secondOctet == 254) ||
      (firstOctet == 172 && (16...31).contains(secondOctet)) ||
      (firstOctet == 192 && (secondOctet == 168 || (secondOctet == 0 && (thirdOctet == 0 || thirdOctet == 2)) || (secondOctet == 88 && thirdOctet == 99))) ||
      (firstOctet == 198 && (secondOctet == 18 || secondOctet == 19 || (secondOctet == 51 && thirdOctet == 100))) ||
      (firstOctet == 203 && secondOctet == 0 && thirdOctet == 113))
  }

  static func isPublicIPv6(_ bytes: [UInt8]) -> Bool {
    guard bytes.count == 16, bytes[0] & 0xe0 == 0x20 else { return false }
    // Reject transition/special-use ranges, including NAT64/Teredo/6to4.
    if bytes[0] == 0x20 && bytes[1] == 0x02 { return false }
    if bytes[0] == 0x20 && bytes[1] == 0x01 {
      if bytes[2] == 0 && bytes[3] < 0x20 { return false }
      if bytes[2] == 0x0d && bytes[3] == 0xb8 { return false }
    }
    return true
  }

  static func resolve(_ host: String) throws -> String {
    var hints = addrinfo()
    hints.ai_socktype = SOCK_STREAM
    hints.ai_family = AF_UNSPEC
    var result: UnsafeMutablePointer<addrinfo>?
    guard getaddrinfo(host, nil, &hints, &result) == 0, let first = result else {
      throw NSError(domain: "OwnWeb", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot resolve this website."])
    }
    defer { freeaddrinfo(first) }
    var cursor: UnsafeMutablePointer<addrinfo>? = first
    var selected: String?
    while let entry = cursor {
      let info = entry.pointee
      var buffer = [CChar](repeating: 0, count: Int(NI_MAXHOST))
      guard let address = info.ai_addr,
            getnameinfo(address, info.ai_addrlen, &buffer, socklen_t(buffer.count), nil, 0, NI_NUMERICHOST) == 0 else {
        throw blocked()
      }
      let ip = String(cString: buffer)
      var bytes = [UInt8](repeating: 0, count: info.ai_family == AF_INET ? 4 : 16)
      let parsed = bytes.withUnsafeMutableBytes { inet_pton(info.ai_family, ip, $0.baseAddress) }
      let allowed = info.ai_family == AF_INET ? isPublicIPv4(bytes) : isPublicIPv6(bytes)
      guard parsed == 1, allowed else { throw blocked() }
      selected = selected ?? ip
      cursor = info.ai_next
    }
    guard let selected = selected else { throw blocked() }
    return selected
  }

  static func blocked() -> NSError {
    NSError(domain: "OwnWeb", code: 2, userInfo: [NSLocalizedDescriptionKey: "Blocked private or special-use website address."])
  }
}

private final class PublicWebHop {
  var body = Data()
  var error: Error?
  private let finished = DispatchSemaphore(value: 0)
  private let queue = DispatchQueue(label: "Own.PublicWebHop")
  private var completed = false

  func read(url: URL, address: String, hostname: String) throws -> (Int, [String: String], Data) {
    let secure = url.scheme == "https"
    let portValue = url.port ?? (secure ? 443 : 80)
    guard let portNumber = UInt16(exactly: portValue), let port = NWEndpoint.Port(rawValue: portNumber),
          let parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else { throw URLError(.badURL) }
    let tcp = NWProtocolTCP.Options()
    let tls = NWProtocolTLS.Options()
    if secure {
      sec_protocol_options_set_tls_server_name(tls.securityProtocolOptions, hostname)
      sec_protocol_options_add_tls_application_protocol(tls.securityProtocolOptions, "http/1.1")
      sec_protocol_options_set_verify_block(tls.securityProtocolOptions, { _, trust, complete in
        let certificateTrust = sec_trust_copy_ref(trust).takeRetainedValue()
        let policy = SecPolicyCreateSSL(true, hostname as CFString)
        complete(SecTrustSetPolicies(certificateTrust, policy) == errSecSuccess && SecTrustEvaluateWithError(certificateTrust, nil))
      }, queue)
    }
    let parameters = NWParameters(tls: secure ? tls : nil, tcp: tcp)
    let connection = NWConnection(host: NWEndpoint.Host(address), port: port, using: parameters)
    let path = (parts.percentEncodedPath.isEmpty ? "/" : parts.percentEncodedPath) + (parts.percentEncodedQuery.map { "?" + $0 } ?? "")
    let hostHeader = (hostname.contains(":") ? "[\(hostname)]" : hostname) + (url.port.map { ":\($0)" } ?? "")
    let request = "GET \(path) HTTP/1.1\r\nHost: \(hostHeader)\r\nAccept: text/html, text/plain\r\nAccept-Encoding: identity\r\nConnection: close\r\nUser-Agent: Own/1\r\n\r\n"
    func complete(_ error: Error?) {
      guard !self.completed else { return }
      self.completed = true; self.error = error; self.finished.signal(); connection.cancel()
    }
    func receive() {
      connection.receive(minimumIncompleteLength: 1, maximumLength: 16384) { data, _, end, error in
        if let data = data {
          guard self.body.count + data.count <= 2_000_000 else { complete(URLError(.dataLengthExceedsMaximum)); return }
          self.body.append(data)
        }
        if let error = error { complete(error) }
        else if end { complete(nil) }
        else { receive() }
      }
    }
    connection.stateUpdateHandler = { state in
      switch state {
      case .ready:
        connection.send(content: request.data(using: .utf8), completion: .contentProcessed { error in
          if let error = error { complete(error) } else { receive() }
        })
      case .failed(let error): complete(error)
      default: break
      }
    }
    connection.start(queue: queue)
    guard finished.wait(timeout: .now() + 20) == .success else { connection.cancel(); throw URLError(.timedOut) }
    if let error = error { throw error }
    return try Self.parseResponse(body)
  }

  static func parseResponse(_ data: Data) throws -> (Int, [String: String], Data) {
    guard let separator = data.range(of: Data("\r\n\r\n".utf8)), separator.lowerBound <= 32768,
          let header = String(data: data[..<separator.lowerBound], encoding: .isoLatin1) else { throw URLError(.badServerResponse) }
    let lines = header.components(separatedBy: "\r\n")
    guard let first = lines.first, first.hasPrefix("HTTP/1."), let status = Int(first.split(separator: " ").dropFirst().first ?? "") else { throw URLError(.badServerResponse) }
    var headers: [String: String] = [:]
    for line in lines.dropFirst() {
      guard let colon = line.firstIndex(of: ":") else { throw URLError(.badServerResponse) }
      let name = line[..<colon].lowercased()
      let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
      if headers[name] != nil && ["location", "content-length", "transfer-encoding"].contains(name) { throw URLError(.badServerResponse) }
      headers[name] = value
    }
    var content = Data(data[separator.upperBound...])
    if let encoding = headers["content-encoding"], encoding.lowercased() != "identity" { throw URLError(.cannotDecodeContentData) }
    if let transfer = headers["transfer-encoding"] {
      guard transfer.lowercased() == "chunked", headers["content-length"] == nil else { throw URLError(.badServerResponse) }
      content = try decodeChunks(content)
    } else if let length = headers["content-length"] {
      guard let expected = Int(length), expected == content.count else { throw URLError(.badServerResponse) }
    }
    return (status, headers, content)
  }

  static func decodeChunks(_ data: Data) throws -> Data {
    var cursor = 0; var result = Data()
    for _ in 0..<10000 {
      guard cursor < data.count, let end = data.range(of: Data("\r\n".utf8), in: cursor..<data.count),
            end.lowerBound - cursor < 100, let line = String(data: data[cursor..<end.lowerBound], encoding: .ascii),
            let size = Int(line.split(separator: ";", maxSplits: 1).first ?? "", radix: 16), size >= 0, size <= 2_000_000 else { throw URLError(.badServerResponse) }
      cursor = end.upperBound
      if size == 0 { return result }
      guard size <= data.count - cursor - 2, result.count + size <= 2_000_000 else { throw URLError(.badServerResponse) }
      result.append(data[cursor..<cursor + size]); cursor += size
      guard data[cursor] == 13, data[cursor + 1] == 10 else { throw URLError(.badServerResponse) }
      cursor += 2
    }
    throw URLError(.badServerResponse)
  }
}

@objc(PublicWebFetcher)
class PublicWebFetcher: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc func fetch(_ rawURL: String, resolver resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        var next = URL(string: rawURL)
        for _ in 0..<6 {
          guard let url = next, ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
                url.user == nil, url.password == nil, let rawHost = url.host else { throw PublicWebAddress.blocked() }
          guard OwnPrivacyAllowsURL(url) else { throw PublicWebAddress.blocked() }
          let host = rawHost.trimmingCharacters(in: CharacterSet(charactersIn: "[]")).lowercased()
          guard host != "localhost", !host.hasSuffix(".localhost"), !host.hasSuffix(".local") else {
            throw PublicWebAddress.blocked()
          }
          let address = try PublicWebAddress.resolve(host)
          let hop = PublicWebHop()
          let (status, headers, body) = try hop.read(url: url, address: address, hostname: host)
          if (300...399).contains(status), let location = headers["location"] {
            next = URL(string: location, relativeTo: url)?.absoluteURL
            guard let destination = next, OwnPrivacyAllowsRedirect(url, destination) else { throw PublicWebAddress.blocked() }
            continue
          }
          guard (200...299).contains(status) else { throw URLError(.badServerResponse) }
          guard let text = String(data: body, encoding: .utf8) else { throw URLError(.cannotDecodeContentData) }
          resolve(text)
          return
        }
        throw URLError(.httpTooManyRedirects)
      } catch { reject("WEB_FETCH_ERROR", error.localizedDescription, error) }
    }
  }
}
