import ActivityKit
import AppIntents
import WidgetKit

// MARK: - Shared storage

/// Reads the card snapshot the RN app writes via `ExtensionStorage` (App
/// Group UserDefaults, key "cards"). The widget never talks to the network
/// or Clerk directly — it only ever reads what the main app last synced.
enum CardStore {
    static let appGroup = "group.com.santrico.linkd"

    static func loadAll() -> [CardEntity] {
        guard
            let defaults = UserDefaults(suiteName: appGroup),
            let data = defaults.data(forKey: "cards"),
            let raw = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        else { return [] }

        return raw.compactMap { dict in
            guard
                let id = dict["id"] as? String,
                let name = dict["name"] as? String,
                let accentColor = dict["accentColor"] as? String,
                let username = dict["username"] as? String,
                let publicUrl = dict["publicUrl"] as? String
            else { return nil }
            return CardEntity(
                id: id,
                name: name,
                accentColor: accentColor,
                username: username,
                slug: dict["slug"] as? String ?? "",
                title: dict["title"] as? String ?? "",
                company: dict["company"] as? String ?? "",
                publicUrl: publicUrl,
                offlineValue: dict["offlineValue"] as? String ?? publicUrl
            )
        }
    }

    /// The "card" (systemMedium) widget lets the user page through all their
    /// cards with on-face arrow buttons, layered on top of the Edit Widget
    /// selection. Keyed off which card id Edit Widget last configured so
    /// picking a new one there resets any in-progress arrow navigation.
    static func mediumOverrideCardId(configuredId: String?) -> String? {
        let defaults = UserDefaults(suiteName: appGroup)
        let lastConfiguredId = defaults?.string(forKey: "mediumWidgetConfiguredId")
        guard lastConfiguredId == configuredId else {
            defaults?.set(configuredId, forKey: "mediumWidgetConfiguredId")
            defaults?.removeObject(forKey: "mediumWidgetCardId")
            return nil
        }
        return defaults?.string(forKey: "mediumWidgetCardId")
    }

    static func setMediumOverrideCardId(_ id: String) {
        UserDefaults(suiteName: appGroup)?.set(id, forKey: "mediumWidgetCardId")
    }

    /// The "card" widget's online/offline QR toggle — a display preference,
    /// not tied to any one card, so it doesn't reset when paging or when
    /// Edit Widget picks a different card.
    static func mediumQrMode() -> String {
        UserDefaults(suiteName: appGroup)?.string(forKey: "mediumWidgetQrMode") ?? "online"
    }

    static func setMediumQrMode(_ mode: String) {
        UserDefaults(suiteName: appGroup)?.set(mode, forKey: "mediumWidgetQrMode")
    }
}

// MARK: - AppEntity (one Linkd card, listed in the "Edit Widget" picker)

struct CardEntity: AppEntity {
    var id: String
    var name: String
    var accentColor: String
    var username: String
    var slug: String
    var title: String
    var company: String
    var publicUrl: String
    var offlineValue: String

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Linkd Card"
    static var defaultQuery = CardEntityQuery()

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }
}

struct CardEntityQuery: EntityQuery {
    func entities(for identifiers: [CardEntity.ID]) async throws -> [CardEntity] {
        CardStore.loadAll().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [CardEntity] {
        CardStore.loadAll()
    }

    func defaultResult() async -> CardEntity? {
        CardStore.loadAll().first
    }
}

// MARK: - Widget configuration intent

/// Only meaningful for the Small/Large (pure-QR) families, which have no
/// room for the medium widget's own runtime toggle button — this is set
/// once via long-press ▸ Edit Widget instead, per widget instance.
enum QrModeOption: String, AppEnum {
    case online
    case offline

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "QR Code"
    static var caseDisplayRepresentations: [QrModeOption: DisplayRepresentation] = [
        .online: "Online (Link)",
        .offline: "Offline (Contact Card)",
    ]
}

struct SelectCardIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Select Card"
    static var description = IntentDescription("Choose which Linkd card this widget shows.")

    @Parameter(title: "Card")
    var card: CardEntity?

    @Parameter(title: "QR Code", default: .online)
    var qrMode: QrModeOption
}

// MARK: - On-widget card paging (the "card" / systemMedium layout's arrows)

struct ShowAdjacentCardIntent: AppIntent {
    static var title: LocalizedStringResource = "Show Adjacent Card"

    @Parameter(title: "Current Card ID")
    var currentCardId: String

    @Parameter(title: "Direction")
    var forward: Bool

    init() {
        self.currentCardId = ""
        self.forward = true
    }

    init(currentCardId: String, forward: Bool) {
        self.currentCardId = currentCardId
        self.forward = forward
    }

    func perform() async throws -> some IntentResult {
        let cards = CardStore.loadAll()
        guard !cards.isEmpty, let index = cards.firstIndex(where: { $0.id == currentCardId }) else {
            return .result()
        }
        let step = forward ? 1 : -1
        let nextIndex = (index + step + cards.count) % cards.count
        CardStore.setMediumOverrideCardId(cards[nextIndex].id)
        WidgetCenter.shared.reloadTimelines(ofKind: "CardWidget")
        return .result()
    }
}

// MARK: - Widget online/offline QR toggle (the "card" / systemMedium layout)

struct ToggleWidgetQrModeIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Widget QR Mode"

    func perform() async throws -> some IntentResult {
        let next = CardStore.mediumQrMode() == "offline" ? "online" : "offline"
        CardStore.setMediumQrMode(next)
        WidgetCenter.shared.reloadTimelines(ofKind: "CardWidget")
        return .result()
    }
}

// MARK: - Live Activity online/offline QR toggle

// LiveActivityIntent (not plain AppIntent) — buttons inside a Live Activity
// need this so the intent runs in place against the live Activity instead of
// risking a launch of the containing app.
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
