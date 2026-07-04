// The 'app' field stores both store links in one card_fields row as JSON:
// {"ios":"https://apps.apple.com/…","android":"https://play.google.com/…"}
// Either link may be absent (app only published on one store).

export interface AppLinks {
  ios?: string;
  android?: string;
}

export function parseAppLinks(value: string): AppLinks {
  try {
    const o = JSON.parse(value);
    return {
      ios: typeof o.ios === 'string' && o.ios ? o.ios : undefined,
      android: typeof o.android === 'string' && o.android ? o.android : undefined,
    };
  } catch {
    return {};
  }
}

export function serializeAppLinks(links: AppLinks): string {
  const out: AppLinks = {};
  if (links.ios?.trim()) out.ios = links.ios.trim();
  if (links.android?.trim()) out.android = links.android.trim();
  return JSON.stringify(out);
}

export const APP_FIELD_DISPLAY = 'Download the App';
