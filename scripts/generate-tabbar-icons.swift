import AppKit
import CoreText
import Foundation

struct TabIcon {
  let fileName: String
  let codePoint: UInt32
  let color: NSColor
}

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let fontURL = root
  .deletingLastPathComponent()
  .appendingPathComponent("QCard-Client/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf")
let outputURL = root.appendingPathComponent("miniprogram/assets/tabbar", isDirectory: true)

guard
  let provider = CGDataProvider(url: fontURL as CFURL),
  let graphicsFont = CGFont(provider)
else {
  fputs("无法加载 Client 的 MaterialCommunityIcons 字体：\(fontURL.path)\n", stderr)
  exit(1)
}

var registrationError: Unmanaged<CFError>?
if !CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, &registrationError) {
  let message = registrationError?.takeRetainedValue().localizedDescription ?? "未知错误"
  if !message.localizedCaseInsensitiveContains("already") {
    fputs("注册图标字体失败：\(message)\n", stderr)
    exit(1)
  }
}

guard
  let postScriptName = graphicsFont.postScriptName as String?,
  let iconFont = NSFont(name: postScriptName, size: 62)
else {
  fputs("无法创建 MaterialCommunityIcons 字体实例\n", stderr)
  exit(1)
}

let inactive = NSColor(calibratedRed: 0x65 / 255, green: 0x70 / 255, blue: 0x65 / 255, alpha: 1)
let active = NSColor(calibratedRed: 0x52 / 255, green: 0x99 / 255, blue: 0x17 / 255, alpha: 1)
let icons = [
  TabIcon(fileName: "home.png", codePoint: 984_737, color: inactive),
  TabIcon(fileName: "home-active.png", codePoint: 983_772, color: active),
  TabIcon(fileName: "explore.png", codePoint: 984_809, color: inactive),
  TabIcon(fileName: "explore-active.png", codePoint: 984_808, color: active),
  TabIcon(fileName: "resource.png", codePoint: 984_633, color: inactive),
  TabIcon(fileName: "resource-active.png", codePoint: 984_632, color: active),
  TabIcon(fileName: "profile.png", codePoint: 983_059, color: inactive),
  TabIcon(fileName: "profile-active.png", codePoint: 983_044, color: active),
]

try FileManager.default.createDirectory(at: outputURL, withIntermediateDirectories: true)

for icon in icons {
  guard let scalar = UnicodeScalar(icon.codePoint) else {
    fputs("无效图标码点：\(icon.codePoint)\n", stderr)
    exit(1)
  }

  guard
    let bitmap = NSBitmapImageRep(
      bitmapDataPlanes: nil,
      pixelsWide: 81,
      pixelsHigh: 81,
      bitsPerSample: 8,
      samplesPerPixel: 4,
      hasAlpha: true,
      isPlanar: false,
      colorSpaceName: .deviceRGB,
      bytesPerRow: 0,
      bitsPerPixel: 0
    ),
    let context = NSGraphicsContext(bitmapImageRep: bitmap)
  else {
    fputs("无法创建图标画布\n", stderr)
    exit(1)
  }

  bitmap.size = NSSize(width: 81, height: 81)
  let text = String(scalar) as NSString
  let attributes: [NSAttributedString.Key: Any] = [
    .font: iconFont,
    .foregroundColor: icon.color,
  ]
  let textSize = text.size(withAttributes: attributes)

  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = context
  NSColor.clear.setFill()
  NSRect(x: 0, y: 0, width: 81, height: 81).fill()
  text.draw(
    at: NSPoint(
      x: (81 - textSize.width) / 2,
      y: (81 - textSize.height) / 2
    ),
    withAttributes: attributes
  )
  context.flushGraphics()
  NSGraphicsContext.restoreGraphicsState()

  guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fputs("无法编码图标：\(icon.fileName)\n", stderr)
    exit(1)
  }
  try png.write(to: outputURL.appendingPathComponent(icon.fileName), options: .atomic)
}

print("已生成 \(icons.count) 个原生 TabBar 图标")
