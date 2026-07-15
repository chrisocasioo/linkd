import ActivityKit
import AppIntents

/// Mirrored (not shared-by-file) in targets/widget/AppIntent.swift, same
/// reasoning as CardActivityAttributes.swift — but this one isn't just
/// style duplication. A LiveActivityIntent used by a button on the Live
/// Activity needs membership in *this* (main app) target too, not only the
/// widget extension, or Activity<CardActivityAttributes>.activities comes
/// back empty when perform() actually runs, silently no-opping the toggle
/// (the button's own tap animation still fires either way, since that's
/// independent of what perform() does — this is what made the bug look
/// like "the switch flips but never actually changes state," when really
/// perform() found no activity to update at all). Widely reported
/// ActivityKit/AppIntents quirk; see Apple Developer Forums thread 735382.
struct ToggleQrModeIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Toggle QR Mode"

    func perform() async throws -> some IntentResult {
        if let activity = Activity<CardActivityAttributes>.activities.first {
            var state = activity.content.state
            state.mode = state.mode == "offline" ? "online" : "offline"
            await activity.update(ActivityContent(state: state, staleDate: nil))
        }
        return .result()
    }
}
