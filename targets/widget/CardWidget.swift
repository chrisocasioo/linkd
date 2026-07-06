import AppIntents
import CoreImage.CIFilterBuiltins
import SwiftUI
import WidgetKit

// MARK: - Timeline

struct CardEntry: TimelineEntry {
    let date: Date
    let card: CardEntity?
    let qrMode: QrModeOption
}

struct CardProvider: AppIntentTimelineProvider {
    /// AppIntents persists a snapshot of the picked entity alongside the
    /// configuration, so `configuration.card` can go stale (renamed/deleted)
    /// between reloads. Re-resolve by id against the live store on every
    /// call instead of trusting the embedded struct.
    ///
    /// The systemMedium "card" layout also lets arrow buttons page through
    /// cards independently of the Edit Widget selection — that in-progress
    /// override takes priority for that family only, and resets itself the
    /// moment Edit Widget picks a different card.
    private func resolve(_ configuration: SelectCardIntent, family: WidgetFamily) -> CardEntity? {
        let live = CardStore.loadAll()
        if family == .systemMedium,
           let overrideId = CardStore.mediumOverrideCardId(configuredId: configuration.card?.id),
           let match = live.first(where: { $0.id == overrideId }) {
            return match
        }
        if let id = configuration.card?.id, let match = live.first(where: { $0.id == id }) {
            return match
        }
        return live.first
    }

    func placeholder(in context: Context) -> CardEntry {
        CardEntry(date: Date(), card: CardStore.loadAll().first, qrMode: .online)
    }

    func snapshot(for configuration: SelectCardIntent, in context: Context) async -> CardEntry {
        CardEntry(date: Date(), card: resolve(configuration, family: context.family), qrMode: configuration.qrMode)
    }

    func timeline(for configuration: SelectCardIntent, in context: Context) async -> Timeline<CardEntry> {
        let entry = CardEntry(
            date: Date(),
            card: resolve(configuration, family: context.family),
            qrMode: configuration.qrMode
        )
        // The RN app calls ExtensionStorage.reloadWidget() whenever card data
        // changes, so the timeline doesn't need to re-poll on a schedule.
        return Timeline(entries: [entry], policy: .never)
    }
}

// MARK: - QR + color helpers

func qrImage(from string: String) -> UIImage? {
    // Software renderer — a GPU-backed CIContext can fail to produce output
    // when this runs on the Lock Screen while the device is actually locked
    // (the Live Activity's rendering context), unlike Home Screen widgets
    // which never render in that state.
    let context = CIContext(options: [.useSoftwareRenderer: true])
    let filter = CIFilter.qrCodeGenerator()
    filter.message = Data(string.utf8)
    filter.correctionLevel = "M"
    guard let output = filter.outputImage else { return nil }
    // CIQRCodeGenerator outputs one point per module — scale up for crispness
    let scaled = output.transformed(by: CGAffineTransform(scaleX: 10, y: 10))
    // CIQRCodeGenerator's "off" modules are transparent, not opaque white —
    // composite over a solid white backing so a dark background (this app's
    // widgets/Live Activity are always on black) can't bleed through and
    // turn the whole code into a solid black square.
    let whiteBackground = CIImage(color: .white).cropped(to: scaled.extent)
    let composited = scaled.composited(over: whiteBackground)
    guard let cgImage = context.createCGImage(composited, from: composited.extent) else { return nil }
    return UIImage(cgImage: cgImage)
}

extension Color {
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
            content(for: card, qrMode: entry.qrMode)
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
    private func content(for card: CardEntity, qrMode: QrModeOption) -> some View {
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

        case .systemMedium:
            let mode = CardStore.mediumQrMode()
            let mediumQr = qrImage(from: mode == "offline" ? card.offlineValue : card.publicUrl)
            HStack(spacing: 12) {
                if let mediumQr {
                    Image(uiImage: mediumQr)
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
                Spacer(minLength: 4)
                VStack(spacing: 8) {
                    Spacer()
                    Toggle(isOn: mode == "offline", intent: ToggleWidgetQrModeIntent()) {
                        EmptyView()
                    }
                    .toggleStyle(.switch)
                    .labelsHidden()
                    .scaleEffect(0.65)
                    .frame(width: 34, height: 20)
                    HStack(spacing: 14) {
                        Button(intent: ShowAdjacentCardIntent(currentCardId: card.id, forward: false)) {
                            Image(systemName: "chevron.left")
                                .font(.footnote.weight(.bold))
                        }
                        .buttonStyle(.plain)
                        Button(intent: ShowAdjacentCardIntent(currentCardId: card.id, forward: true)) {
                            Image(systemName: "chevron.right")
                                .font(.footnote.weight(.bold))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .foregroundStyle(.secondary)
            }
            .padding(12)
            .containerBackground(for: .widget) { Color.black }

        default: // .systemSmall, .systemLarge — pure QR code, no text
            let plainQr = qrImage(from: qrMode == .offline ? card.offlineValue : card.publicUrl)
            VStack {
                if let plainQr {
                    Image(uiImage: plainQr)
                        .interpolation(.none)
                        .resizable()
                        .aspectRatio(1, contentMode: .fit)
                }
            }
            .padding(family == .systemLarge ? 24 : 10)
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
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular])
    }
}
