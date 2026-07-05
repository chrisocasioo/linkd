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
        var publicUrl: String
        // True only for the very first Live Activity ever started — the Lock
        // Screen card itself shows an Allow/Not Now ask instead of the QR.
        var awaitingPermission: Bool
    }

    var cardId: String
}
