export type QRType = 'url' | 'wifi';
export type SecurityType = 'WPA' | 'WEP' | 'nopass';

export function encodeWiFiQR(ssid: string, password: string, security: SecurityType): string {
  const escapedSSID = ssid.replace(/[\\;,":]/g, (c) => `\\${c}`);
  if (security === 'nopass') {
    return `WIFI:T:nopass;S:${escapedSSID};;`;
  }
  const escapedPW = password.replace(/[\\;,":]/g, (c) => `\\${c}`);
  return `WIFI:T:${security};S:${escapedSSID};P:${escapedPW};;`;
}

export function detectQRType(data: string): 'url' | 'wifi' | 'text' {
  if (data.startsWith('WIFI:')) return 'wifi';
  if (data.startsWith('http://') || data.startsWith('https://')) return 'url';
  return 'text';
}

export function getQRLabel(data: string, type: QRType): string {
  if (type === 'wifi') {
    const match = data.match(/S:([^;]+)/);
    return match ? match[1] : 'WiFi Network';
  }
  try {
    const url = new URL(data);
    return url.hostname || data;
  } catch {
    return data.length > 30 ? data.slice(0, 27) + '...' : data;
  }
}
