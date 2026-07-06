import ActivityKit
import ExpoModulesCore

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
