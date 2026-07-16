import ActivityKit
import Foundation
import SwiftUI
import WidgetKit

private let qrAppGroup = "group.com.santrico.linkd"

private func qrFileURL(mode: String) -> URL? {
    FileManager.default
        .containerURL(forSecurityApplicationGroupIdentifier: qrAppGroup)?
        .appendingPathComponent("live-activity-qr-\(mode).png")
}

private func loadQrImage(mode: String) -> UIImage? {
    guard let url = qrFileURL(mode: mode), let data = try? Data(contentsOf: url) else { return nil }
    return UIImage(data: data)
}

// Reads the PNG the main app already rendered and wrote to the shared App
// Group container at Activity start time, rather than generating a fresh
// CIImage here — the widget extension has been observed to fail to
// rasterize a QR while the device is genuinely locked, even with a software
// CIContext, and embedding image Data directly in ContentState made the
// Live Activity fail to start at all. Falls back to the online QR if the
// offline vCard's file is somehow missing, so a bad/oversized vCard never
// leaves the Live Activity blank.
private func currentQrImage(for state: CardActivityAttributes.ContentState) -> UIImage? {
    loadQrImage(mode: state.mode) ?? (state.mode == "offline" ? loadQrImage(mode: "online") : nil)
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
                qrView(for: context.state, size: 20)
            } compactTrailing: {
                Text(context.state.name)
                    .font(.caption2)
                    .lineLimit(1)
            } minimal: {
                qrView(for: context.state, size: 20)
            }
        }
    }

    // Falls back to the generic SF Symbol if the QR image failed to render,
    // so the Dynamic Island never shows a blank space.
    @ViewBuilder
    private func qrView(for state: CardActivityAttributes.ContentState, size: CGFloat) -> some View {
        if let qr = currentQrImage(for: state) {
            Image(uiImage: qr)
                .interpolation(.none)
                .resizable()
                .frame(width: size, height: size)
        } else {
            Image(systemName: "qrcode")
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
                // White backing "frame" behind the QR, independent of
                // whatever qrBgColor the card itself uses — without it, a
                // card with a dark QR background (like this one) blends
                // straight into the Live Activity's own black background
                // with zero visual separation. Sized to roughly match the
                // outer footprint competitors' framed QR treatments use.
                Image(uiImage: qr)
                    .interpolation(.none)
                    .resizable()
                    .frame(width: 110, height: 110)
                    .padding(8)
                    .background(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(Color.white)
                    )
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
