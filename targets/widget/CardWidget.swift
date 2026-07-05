import AppIntents
import CoreImage.CIFilterBuiltins
import SwiftUI
import WidgetKit

// MARK: - Timeline

struct CardEntry: TimelineEntry {
    let date: Date
    let card: CardEntity?
}

struct CardProvider: AppIntentTimelineProvider {
    /// AppIntents persists a snapshot of the picked entity alongside the
    /// configuration, so `configuration.card` can go stale (renamed/deleted)
    /// between reloads. Re-resolve by id against the live store on every
    /// call instead of trusting the embedded struct.
    private func resolve(_ configuration: SelectCardIntent) -> CardEntity? {
        let live = CardStore.loadAll()
        if let id = configuration.card?.id, let match = live.first(where: { $0.id == id }) {
            return match
        }
        return live.first
    }

    func placeholder(in context: Context) -> CardEntry {
        CardEntry(date: Date(), card: CardStore.loadAll().first)
    }

    func snapshot(for configuration: SelectCardIntent, in context: Context) async -> CardEntry {
        CardEntry(date: Date(), card: resolve(configuration))
    }

    func timeline(for configuration: SelectCardIntent, in context: Context) async -> Timeline<CardEntry> {
        let entry = CardEntry(date: Date(), card: resolve(configuration))
        // The RN app calls ExtensionStorage.reloadWidget() whenever card data
        // changes, so the timeline doesn't need to re-poll on a schedule.
        return Timeline(entries: [entry], policy: .never)
    }
}

// MARK: - QR + color helpers

private func qrImage(from string: String) -> UIImage? {
    let context = CIContext()
    let filter = CIFilter.qrCodeGenerator()
    filter.message = Data(string.utf8)
    filter.correctionLevel = "M"
    guard let output = filter.outputImage else { return nil }
    // CIQRCodeGenerator outputs one point per module — scale up for crispness
    let scaled = output.transformed(by: CGAffineTransform(scaleX: 10, y: 10))
    guard let cgImage = context.createCGImage(scaled, from: scaled.extent) else { return nil }
    return UIImage(cgImage: cgImage)
}

private extension Color {
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        self.init(
            red: Double((value & 0xFF0000) >> 16) / 255,
            green: Double((value & 0x00FF00) >> 8) / 255,
            blue: Double(value & 0x0000FF) / 255
        )
    }
}

// MARK: - Views

struct CardWidgetEntryView: View {
    var entry: CardEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        if let card = entry.card {
            content(for: card)
        } else {
            emptyState
        }
    }

    private var emptyState: some View {
        VStack(spacing: 6) {
            Image(systemName: "qrcode")
                .font(.title2)
            Text("Open Linkd to set up a card")
                .font(.caption2)
                .multilineTextAlignment(.center)
        }
        .foregroundStyle(.secondary)
        .padding()
        .containerBackground(for: .widget) { Color.black }
    }

    @ViewBuilder
    private func content(for card: CardEntity) -> some View {
        let accent = Color(hex: card.accentColor)
        let qr = qrImage(from: card.publicUrl)

        switch family {
        case .accessoryRectangular:
            // Lock Screen — the system applies its own monochrome/vibrancy
            // rendering here, so no explicit background or accent tint.
            HStack(spacing: 8) {
                if let qr {
                    Image(uiImage: qr)
                        .interpolation(.none)
                        .resizable()
                        .frame(width: 40, height: 40)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(card.name)
                        .font(.caption)
                        .fontWeight(.semibold)
                        .lineLimit(1)
                    if !card.title.isEmpty {
                        Text(card.title)
                            .font(.caption2)
                            .lineLimit(1)
                    }
                }
            }

        case .systemSmall:
            VStack(spacing: 8) {
                if let qr {
                    Image(uiImage: qr)
                        .interpolation(.none)
                        .resizable()
                        .aspectRatio(1, contentMode: .fit)
                }
                Text(card.name)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            .padding(8)
            .containerBackground(for: .widget) { Color.black }

        default: // .systemMedium
            HStack(spacing: 12) {
                if let qr {
                    Image(uiImage: qr)
                        .interpolation(.none)
                        .resizable()
                        .frame(width: 90, height: 90)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(card.name)
                        .font(.headline)
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if !card.title.isEmpty {
                        Text(card.title)
                            .font(.subheadline)
                            .foregroundStyle(accent)
                            .lineLimit(1)
                    }
                    if !card.company.isEmpty {
                        Text(card.company)
                            .font(.subheadline)
                            .italic()
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
            }
            .padding(12)
            .containerBackground(for: .widget) { Color.black }
        }
    }
}

// MARK: - Widget

struct CardWidget: Widget {
    let kind: String = "CardWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: SelectCardIntent.self, provider: CardProvider()) { entry in
            CardWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Linkd Card")
        .description("Show one of your Linkd cards' QR code.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}
