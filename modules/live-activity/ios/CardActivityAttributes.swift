import ActivityKit

/// Mirrored (not shared-by-file) in targets/widget — the main app and the
/// widget extension are separate compiled targets, so both keep their own
/// copy of this Codable shape rather than sharing a file across two
/// independently-generated Xcode targets.
struct CardActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var name: String
        var title: String
        var company: String
        var accentColor: String
        var onlineUrl: String
        var offlineValue: String
        // "online" | "offline" — which QR value is currently displayed;
        // flipped by the toggle button on the card itself.
        var mode: String
    }

    var cardId: String
}
