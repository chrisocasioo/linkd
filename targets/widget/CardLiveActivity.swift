import ActivityKit
import SwiftUI
import WidgetKit

struct CardLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CardActivityAttributes.self) { context in
            LockScreenView(state: context.state)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    qrView(for: context.state, size: 44)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.state.name)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .lineLimit(1)
                        if !context.state.title.isEmpty {
                            Text(context.state.title)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: "qrcode")
            } compactTrailing: {
                Text(context.state.name)
                    .font(.caption2)
                    .lineLimit(1)
            } minimal: {
                Image(systemName: "qrcode")
            }
        }
    }

    @ViewBuilder
    private func qrView(for state: CardActivityAttributes.ContentState, size: CGFloat) -> some View {
        if let qr = qrImage(from: state.publicUrl) {
            Image(uiImage: qr)
                .interpolation(.none)
                .resizable()
                .frame(width: size, height: size)
        }
    }
}

private struct LockScreenView: View {
    let state: CardActivityAttributes.ContentState

    var body: some View {
        Group {
            if state.awaitingPermission {
                askView
            } else {
                cardView
            }
        }
        .padding()
        .activityBackgroundTint(Color.black)
        .activitySystemActionForegroundColor(Color.white)
    }

    // Shown only for the very first Live Activity ever — the "permission ask"
    // lives on the card itself since ActivityKit has no system prompt of its
    // own. Allow/Not Now are real buttons, backed by AppIntents.
    private var askView: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Keep \(state.name) on your Lock Screen?")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.white)
                    .lineLimit(2)
                Text("People nearby can scan it to open your card.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            Spacer(minLength: 8)
            VStack(spacing: 8) {
                Button(intent: AllowLiveActivityIntent()) {
                    Text("Allow").font(.footnote.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(hex: state.accentColor))
                Button(intent: DenyLiveActivityIntent()) {
                    Text("Not Now").font(.footnote)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
            }
        }
    }

    private var cardView: some View {
        HStack(spacing: 14) {
            if let qr = qrImage(from: state.publicUrl) {
                Image(uiImage: qr)
                    .interpolation(.none)
                    .resizable()
                    .frame(width: 64, height: 64)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(state.name)
                    .font(.headline)
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if !state.title.isEmpty {
                    Text(state.title)
                        .font(.subheadline)
                        .foregroundStyle(Color(hex: state.accentColor))
                        .lineLimit(1)
                }
                if !state.company.isEmpty {
                    Text(state.company)
                        .font(.subheadline)
                        .italic()
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer()
        }
    }
}
