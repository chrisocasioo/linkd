import ActivityKit
import CoreImage.CIFilterBuiltins
import ExpoModulesCore
import Foundation
import UIKit

private let qrAppGroup = "group.com.santrico.linkd"

private func qrFileURL(mode: String) -> URL? {
    FileManager.default
        .containerURL(forSecurityApplicationGroupIdentifier: qrAppGroup)?
        .appendingPathComponent("live-activity-qr-\(mode).png")
}

private func ciColor(hex: String) -> CIColor {
    let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    var value: UInt64 = 0
    Scanner(string: cleaned).scanHexInt64(&value)
    return CIColor(
        red: CGFloat((value & 0xFF0000) >> 16) / 255,
        green: CGFloat((value & 0x00FF00) >> 8) / 255,
        blue: CGFloat(value & 0x0000FF) / 255
    )
}

// Renders here in the main app process — always has full GPU rendering (and
// network) access, unlike the widget extension, which has been observed to
// fail to rasterize a fresh CIImage while the device is genuinely locked.
// Written to a file in the shared App Group container rather than carried
// through ContentState — embedding image Data directly in ContentState made
// the Live Activity fail to start at all (a documented pattern: the working
// approach for images in Live Activities is App Group file sharing, not
// inline Data). The extension only ever has to decode an already-rendered
// file, never generate or receive image bytes inline.
//
// Applies the card's actual QR branding (color/background/logo) instead of
// a hardcoded black-on-white QR, since this now renders in the same place
// the card's normal QR preview does — no reason for the Live Activity/
// widget versions to look different from what the user configured.
private func writeQrPNG(from string: String, mode: String, color: String, bgColor: String, logoUrl: String) async {
    guard let url = qrFileURL(mode: mode) else { return }
    let filter = CIFilter.qrCodeGenerator()
    filter.message = Data(string.utf8)
    // "L" (not "M") — the offline value is a full vCard, which needs more
    // capacity headroom than a short URL; low correction is still plenty
    // reliable for a clean device-to-device scan.
    filter.correctionLevel = "L"
    guard let output = filter.outputImage else { return }
    let scaled = output.transformed(by: CGAffineTransform(scaleX: 10, y: 10))
    // CIQRCodeGenerator's "on" modules are opaque black, "off" are
    // transparent — composite over white first to get a definite
    // black-on-white bitmap, THEN false-color it, so CIFalseColor's
    // luminance mapping has real black/white to work with instead of
    // getting confused by transparency.
    let whiteBackground = CIImage(color: .white).cropped(to: scaled.extent)
    let blackOnWhite = scaled.composited(over: whiteBackground)

    let recolor = CIFilter.falseColor()
    recolor.inputImage = blackOnWhite
    recolor.color0 = ciColor(hex: color)   // maps black (the QR's "on" modules) -> custom color
    recolor.color1 = ciColor(hex: bgColor) // maps white (the QR's "off" modules) -> custom background
    guard var final = recolor.outputImage else { return }

    if !logoUrl.isEmpty, let url = URL(string: logoUrl),
       // Short timeout (not the 60s default) — this runs before
       // Activity.request(), so a slow/unreachable logo host must never turn
       // into a long hang on the Share tap. Worst case: plain QR, no logo.
       let (logoData, _) = try? await URLSession.shared.data(for: URLRequest(url: url, timeoutInterval: 3)),
       let logoImage = CIImage(data: logoData) {
        let qrExtent = final.extent
        let targetSize = min(qrExtent.width, qrExtent.height) * 0.22
        let logoScale = targetSize / max(logoImage.extent.width, logoImage.extent.height)
        let scaledLogo = logoImage.transformed(by: CGAffineTransform(scaleX: logoScale, y: logoScale))
        let centeredLogo = scaledLogo.transformed(by: CGAffineTransform(
            translationX: qrExtent.midX - scaledLogo.extent.width / 2 - scaledLogo.extent.minX,
            y: qrExtent.midY - scaledLogo.extent.height / 2 - scaledLogo.extent.minY
        ))
        // Small backing square (in the QR's own background color) behind the
        // logo so it stays visually separated from the modules around it,
        // same as the in-app QR preview.
        let backingSize = targetSize + 8
        let backingRect = CGRect(
            x: qrExtent.midX - backingSize / 2, y: qrExtent.midY - backingSize / 2,
            width: backingSize, height: backingSize
        )
        let backing = CIImage(color: ciColor(hex: bgColor)).cropped(to: backingRect)
        final = centeredLogo.composited(over: backing.composited(over: final))
    }

    guard let cgImage = CIContext().createCGImage(final, from: final.extent) else { return }
    try? UIImage(cgImage: cgImage).pngData()?.write(to: url)
}

struct CardActivityPayload: Record {
    @Field var cardId: String = ""
    @Field var name: String = ""
    @Field var title: String = ""
    @Field var company: String = ""
    @Field var accentColor: String = "#C9973A"
    @Field var onlineUrl: String = ""
    @Field var offlineValue: String = ""
    @Field var qrColor: String = "#000000"
    @Field var qrBgColor: String = "#FFFFFF"
    @Field var qrLogoUrl: String = ""
}

public class LiveActivityModule: Module {
    public func definition() -> ModuleDefinition {
        Name("LiveActivity")

        // Reflects the real per-app "Live Activities" Settings toggle. iOS
        // shows its own Allow/Don't Allow prompt the first time this app's
        // Live Activity appears on the Lock Screen — if the user taps Don't
        // Allow there, this flips to false until they turn it back on at
        // Settings > Apps > Linkd > Live Activities. No app-side permission
        // tracking needed or wanted; this check is the whole story.
        Function("areActivitiesEnabled") { () -> Bool in
            ActivityAuthorizationInfo().areActivitiesEnabled
        }

        // AsyncFunction (not Function) so the old activity's `end` is fully
        // awaited before a new one is requested — never two on screen at once,
        // even for a single frame.
        AsyncFunction("start") { (payload: CardActivityPayload) async -> Bool in
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }

            // Only one Linkd card should ever be live on the Lock Screen.
            for activity in Activity<CardActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }

            // Written before the activity is requested so both files are
            // already on disk by the time the extension's first render happens.
            await writeQrPNG(
                from: payload.onlineUrl, mode: "online",
                color: payload.qrColor, bgColor: payload.qrBgColor, logoUrl: payload.qrLogoUrl
            )
            await writeQrPNG(
                from: payload.offlineValue, mode: "offline",
                color: payload.qrColor, bgColor: payload.qrBgColor, logoUrl: payload.qrLogoUrl
            )

            let attributes = CardActivityAttributes(cardId: payload.cardId)
            let state = CardActivityAttributes.ContentState(
                name: payload.name,
                title: payload.title,
                company: payload.company,
                accentColor: payload.accentColor,
                onlineUrl: payload.onlineUrl,
                offlineValue: payload.offlineValue,
                mode: "online"
            )

            do {
                _ = try Activity.request(attributes: attributes, content: .init(state: state, staleDate: nil))
                return true
            } catch {
                return false
            }
        }

        AsyncFunction("end") { () async -> Void in
            for activity in Activity<CardActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }
}
