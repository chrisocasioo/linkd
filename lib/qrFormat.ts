export type QrFormat = 'url' | 'wifi' | 'text';

export function inferQrFormat(value: string): QrFormat {
  if (/^WIFI:/i.test(value)) return 'wifi';
  if (/^https?:\/\//i.test(value) || /^www\./i.test(value)) return 'url';
  return 'text';
}

export function normalizeUrl(value: string): string {
  const v = value.trim();
  return v.startsWith('http') ? v : `https://${v}`;
}

// WIFI:T:<WPA|WEP|nopass>;S:<ssid>;P:<password>;;  (per the standard QR Wi-Fi format)
function escapeWifi(s: string): string {
  return s.replace(/([\\;,":])/g, '\\$1');
}

export function buildWifiQr(ssid: string, password: string, security: 'WPA' | 'WEP' | 'nopass'): string {
  const s = escapeWifi(ssid.trim());
  const p = security === 'nopass' ? '' : `P:${escapeWifi(password.trim())};`;
  return `WIFI:T:${security};S:${s};${p};`;
}

export interface ParsedWifiQr {
  ssid: string;
  password: string;
  security: string;
}

export function parseWifiQr(value: string): ParsedWifiQr | null {
  const m = value.match(/^WIFI:(.*);;?$/i);
  if (!m) return null;
  const fields: Record<string, string> = {};
  // Split on semicolons that aren't escaped with a backslash
  const parts = m[1].split(/(?<!\\);/);
  for (const part of parts) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const key = part.slice(0, idx);
    const val = part.slice(idx + 1).replace(/\\(.)/g, '$1');
    fields[key] = val;
  }
  if (!fields.S) return null;
  return { ssid: fields.S, password: fields.P ?? '', security: fields.T ?? 'WPA' };
}
