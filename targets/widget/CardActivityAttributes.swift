import ActivityKit
import Foundation

/// Mirrored (not shared-by-file) in modules/live-activity/ios — the widget
/// extension and the main app are separate compiled targets, so both keep
/// their own copy of this Codable shape rather than sharing a file across
/// two independently-generated Xcode targets.
struct CardActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var name: String
        var title: String
        var company: String
        var accentColor: String
        var onlineUrl: String
        var offlineValue: String
        // Pre-rendered PNG bytes for both QR variants, generated in the main
        // app (which always has full rendering access) at Activity start
        // time — not regenerated here in the widget extension, which has
        // been observed to fail to rasterize a fresh CIImage while the
        // device is genuinely locked, even with a software CIContext.
        var onlineQrPNG: Data
        var offlineQrPNG: Data
        // "online" | "offline" — which QR value is currently displayed;
        // flipped by the toggle button on the card itself.
        var mode: String
    }

    var cardId: String
}
