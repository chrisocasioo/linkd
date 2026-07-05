import ActivityKit

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
        var publicUrl: String
    }

    var cardId: String
}
