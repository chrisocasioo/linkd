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
                publicUrl: publicUrl
            )
        }
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

struct SelectCardIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Select Card"
    static var description = IntentDescription("Choose which Linkd card this widget shows.")

    @Parameter(title: "Card")
    var card: CardEntity?
}
