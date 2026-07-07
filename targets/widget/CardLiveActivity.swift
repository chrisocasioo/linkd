import ActivityKit
import SwiftUI
import WidgetKit

private func currentQrValue(for state: CardActivityAttributes.ContentState) -> String {
    state.mode == "offline" ? state.offlineValue : state.onlineUrl
}

// Falls back to the online QR if the offline vCard fails to encode, so a
// bad/oversized vCard never leaves the Live Activity blank.
private func currentQrImage(for state: CardActivityAttributes.ContentState) -> UIImage? {
    qrImage(from: currentQrValue(for: state)) ?? (state.mode == "offline" ? qrImage(from: state.onlineUrl) : nil)
}

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
        if let qr = currentQrImage(for: state) {
            Image(uiImage: qr)
                .interpolation(.none)
                .resizable()
                .frame(width: size, height: size)
        }
    }
}

private struct LockScreenView: View {
    let state: CardActivityAttributes.ContentState

    // iOS overlays its own native Allow/Don't Allow buttons on an app's very
    // first Live Activity automatically — no custom UI needed or wanted here;
    // one of our own would just duplicate/compete with the real one.
    var body: some View {
        HStack(spacing: 14) {
            if let qr = currentQrImage(for: state) {
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
            VStack(spacing: 3) {
                Button(intent: ToggleQrModeIntent()) {
                    FakeSwitch(isOn: state.mode == "offline", tint: Color(hex: state.accentColor))
                }
                .buttonStyle(.plain)
                Text(state.mode == "offline" ? "Offline" : "Online")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .activityBackgroundTint(Color.black)
        .activitySystemActionForegroundColor(Color.white)
    }
}
