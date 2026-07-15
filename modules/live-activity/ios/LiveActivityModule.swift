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

// Renders here in the main app process — always has full GPU rendering
// access, unlike the widget extension, which has been observed to fail to
// rasterize a fresh CIImage while the device is genuinely locked. Written to
// a file in the shared App Group container rather than carried through
// ContentState — embedding image Data directly in ContentState turned out to
// make the Live Activity fail to start at all (a documented pattern: the
// working approach for images in Live Activities is App Group file sharing,
// not inline Data). The extension only ever has to decode an already-
// rendered file, never generate or receive image bytes inline.
private func writeQrPNG(from string: String, mode: String) {
    guard let url = qrFileURL(mode: mode) else { return }
    let filter = CIFilter.qrCodeGenerator()
    filter.message = Data(string.utf8)
    // "L" (not "M") — the offline value is a full vCard, which needs more
    // capacity headroom than a short URL; low correction is still plenty
    // reliable for a clean device-to-device scan.
    filter.correctionLevel = "L"
    guard let output = filter.outputImage else { return }
    let scaled = output.transformed(by: CGAffineTransform(scaleX: 10, y: 10))
    let whiteBackground = CIImage(color: .white).cropped(to: scaled.extent)
    let composited = scaled.composited(over: whiteBackground)
    guard let cgImage = CIContext().createCGImage(composited, from: composited.extent) else { return }
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
            writeQrPNG(from: payload.onlineUrl, mode: "online")
            writeQrPNG(from: payload.offlineValue, mode: "offline")

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
