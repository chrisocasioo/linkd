import ActivityKit
import ExpoModulesCore

struct CardActivityPayload: Record {
    @Field var cardId: String = ""
    @Field var name: String = ""
    @Field var title: String = ""
    @Field var company: String = ""
    @Field var accentColor: String = "#C9973A"
    @Field var publicUrl: String = ""
}

public class LiveActivityModule: Module {
    // Must match targets/widget/AppIntent.swift's CardStore — the Allow/Not
    // Now buttons rendered on the Live Activity card itself write here.
    private static let appGroup = "group.com.santrico.linkd"
    private static let permissionKey = "liveActivityPermission"

    public func definition() -> ModuleDefinition {
        Name("LiveActivity")

        Function("areActivitiesEnabled") { () -> Bool in
            ActivityAuthorizationInfo().areActivitiesEnabled
        }

        Function("start") { (payload: CardActivityPayload) -> Bool in
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }

            let permission = UserDefaults(suiteName: Self.appGroup)?.string(forKey: Self.permissionKey)
            // Declined once on the card itself — don't start another.
            if permission == "denied" { return false }

            // Only one Linkd card should be live on the Lock Screen at a time.
            for activity in Activity<CardActivityAttributes>.activities {
                Task { await activity.end(nil, dismissalPolicy: .immediate) }
            }

            let attributes = CardActivityAttributes(cardId: payload.cardId)
            let state = CardActivityAttributes.ContentState(
                name: payload.name,
                title: payload.title,
                company: payload.company,
                accentColor: payload.accentColor,
                publicUrl: payload.publicUrl,
                // nil means never asked — show the ask right on the card.
                awaitingPermission: permission == nil
            )

            do {
                _ = try Activity.request(attributes: attributes, content: .init(state: state, staleDate: nil))
                return true
            } catch {
                return false
            }
        }

        Function("end") { () -> Void in
            for activity in Activity<CardActivityAttributes>.activities {
                Task { await activity.end(nil, dismissalPolicy: .immediate) }
            }
        }
    }
}
