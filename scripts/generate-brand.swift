import AppKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let svg = """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#13211f"/>
  <g transform="translate(-36 0)" fill="none" stroke="#fff" stroke-width="64" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="256" cy="512" rx="88" ry="112"/>
    <path d="M414 400 L458 624 L540 468 L622 624 L666 400"/>
    <path d="M744 624 V400 M744 472 C744 380 928 380 928 476 V624"/>
  </g>
</svg>
"""
try svg.write(to: root.appendingPathComponent("src/assets/own-mark.svg"), atomically: true, encoding: .utf8)
func render(_ size: Int, _ destination: URL) throws {
  guard let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
    bytesPerRow: size * 4, space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { fatalError("Cannot create icon bitmap") }
  context.setFillColor(CGColor(srgbRed: 19/255, green: 33/255, blue: 31/255, alpha: 1))
  context.fill(CGRect(x: 0, y: 0, width: size, height: size))
  context.scaleBy(x: CGFloat(size)/1024, y: CGFloat(size)/1024)
  context.translateBy(x: -36, y: 1024)
  context.scaleBy(x: 1, y: -1)
  context.setStrokeColor(CGColor(gray: 1, alpha: 1))
  context.setLineWidth(64); context.setLineCap(.round); context.setLineJoin(.round)
  context.strokeEllipse(in: CGRect(x: 168, y: 400, width: 176, height: 224))
  let w = CGMutablePath(); w.move(to: CGPoint(x: 414, y: 400))
  for p in [CGPoint(x: 458,y:624),CGPoint(x:540,y:468),CGPoint(x:622,y:624),CGPoint(x:666,y:400)] { w.addLine(to:p) }
  context.addPath(w); context.strokePath()
  let n = CGMutablePath(); n.move(to:CGPoint(x:744,y:624)); n.addLine(to:CGPoint(x:744,y:400))
  n.move(to:CGPoint(x:744,y:472)); n.addCurve(to:CGPoint(x:928,y:476), control1:CGPoint(x:744,y:380), control2:CGPoint(x:928,y:380)); n.addLine(to:CGPoint(x:928,y:624))
  context.addPath(n); context.strokePath()
  guard let image = context.makeImage(),
    let output = CGImageDestinationCreateWithURL(destination as CFURL, UTType.png.identifier as CFString, 1, nil) else { fatalError("Cannot export PNG") }
  CGImageDestinationAddImage(output, image, nil)
  guard CGImageDestinationFinalize(output) else { fatalError("Cannot finish PNG") }
}
var exports: [URL:Int] = [root.appendingPathComponent("src/assets/logo.png"):512]
let assetDirectories = ["ios/Own/Images.xcassets/AppIcon.appiconset", "ios/Own/Images.xcassets/Logo.imageset"]
for directory in assetDirectories {
  for file in try FileManager.default.contentsOfDirectory(at: root.appendingPathComponent(directory), includingPropertiesForKeys:nil) where file.pathExtension == "png" {
    guard let image = NSBitmapImageRep(data: try Data(contentsOf:file)) else { fatalError("Cannot read existing export dimensions") }
    exports[file] = image.pixelsWide
  }
}
for (file, size) in exports { try render(size, file) }
print("Generated \(exports.count) Own icon exports from the original Own vector paths.")
