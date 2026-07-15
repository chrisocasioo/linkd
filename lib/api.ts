import { useAuth } from '@clerk/clerk-expo';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback } from 'react';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  username: string | null;
  bio: string | null;
  profilePhoto: string | null;
  theme: string | null;
  accentColor: string | null;
  buttonStyle: string | null;
  font: string | null;
  customDomain: string | null;
  isPro: boolean;
  revenueCatId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  fax: string | null;
  company: string | null;
  jobTitle: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  source: 'manual' | 'scan' | 'card';
  photo: string | null;
  createdAt: string;
}

export interface SavedQr {
  id: string;
  userId: string;
  type: 'url' | 'wifi';
  label: string | null;
  data: string;
  createdAt: string;
  color: string | null;
  bgColor: string | null;
  logo: string | null;
}

export interface ScanHistoryEntry {
  id: string;
  userId: string;
  type: 'contact' | 'qr';
  contactId: string | null;
  label: string;
  qrData: string | null;
  qrFormat: 'url' | 'wifi' | 'text' | null;
  createdAt: string;
}

export interface ScanResult {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  fax: string | null;
  faxes: string[];
  company: string | null;
  jobTitle: string | null;
  website: string | null;
  websites: string[];
  address: string | null;
  addresses: string[];
}

export interface FieldClickStat {
  fieldId: string;
  fieldType: string;
  fieldValue: string;
  fieldIcon: string | null;
  label: string | null;
  clicks: number;
  prevClicks: number;
}

export interface CardAnalytics {
  cardId: string;
  cardName: string;
  accentColor: string;
  views: number;
  prevViews: number;
  fieldClicks: FieldClickStat[];
}

export interface AnalyticsData {
  totalCardViews: number;
  prevTotalCardViews: number;
  trackingSince: string | null;
  cardBreakdown: CardAnalytics[];
}

export interface CardField {
  id: string;
  cardId: string;
  type: string;
  label: string | null;
  value: string;
  icon: string | null;
  displayOrder: number;
}

export interface Card {
  id: string;
  userId: string;
  name: string;
  // Who the card belongs to — independent of `name` above, which is just
  // the card's own organizational label (e.g. "Work"). Null falls back to
  // the account's own displayName wherever this card's name is shown.
  displayName: string | null;
  accentColor: string;
  font: string | null;
  photo: string | null;
  slug: string | null;
  displayOrder: number;
  createdAt: string;
  fields: CardField[];
  // QR branding — independent from the card's own accentColor/photo
  qrColor: string | null;
  qrLogo: string | null;
  qrBgColor: string | null;
}

async function request<T>(path: string, token: string | null, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> ?? {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let body: any = {};
    let raw = '';
    try { raw = await res.text(); body = JSON.parse(raw); } catch {}
    const msg = body.error ?? body.message ?? (raw.slice(0, 120) || res.statusText);
    throw new Error(`[${res.status}] ${msg}`);
  }
  return res.json();
}

export function useApi() {
  const { getToken } = useAuth();

  const withToken = useCallback(
    async <T>(fn: (token: string) => Promise<T>): Promise<T> => {
      // Right after the app resumes from the background/lock screen, Clerk
      // can take a moment to rehydrate its session — getToken() (even with
      // skipCache) transiently returns null in that window, not just a stale
      // cached value. A single retry doesn't ride that out, so back off and
      // retry a few times before surfacing "not authenticated" to the user.
      let token: string | null = null;
      for (let attempt = 0; attempt < 4 && !token; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 350));
        try { token = await getToken({ skipCache: attempt > 0 }); } catch {}
      }
      if (!token) throw new Error('Not authenticated — check your connection and try again');
      try {
        return await fn(token);
      } catch (err: any) {
        if (typeof err?.message === 'string' && err.message.startsWith('[401]')) {
          const fresh = await getToken({ skipCache: true });
          if (fresh) return fn(fresh);
        }
        throw err;
      }
    },
    [getToken]
  );

  return {
    getMe: () => withToken((t) => request<User>('/api/users/me', t)),
    updateMe: (body: Partial<Pick<User, 'displayName' | 'username' | 'bio' | 'theme' | 'accentColor' | 'buttonStyle' | 'font' | 'customDomain' | 'revenueCatId'>>) =>
      withToken((t) =>
        request<User>('/api/users/me', t, { method: 'PATCH', body: JSON.stringify(body) })
      ),
    checkUsername: (username: string) =>
      withToken((t) =>
        request<{ available: boolean; error?: string }>(`/api/users/me/check-username/${username}`, t)
      ),
    deleteMe: () => withToken((t) => request<void>('/api/users/me', t, { method: 'DELETE' })),

    uploadPhoto: (uri: string) =>
      withToken(async (t) => {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
        return request<{ photoUrl: string }>('/api/users/me/photo', t, {
          method: 'POST',
          body: JSON.stringify({ photo: base64, mimeType: 'image/jpeg' }),
        });
      }),

    getAnalytics: () => withToken((t) => request<AnalyticsData>('/api/analytics/me', t)),

    // Cards (new multi-card system)
    getMyCards: () => withToken((t) => request<Card[]>('/api/cards', t)),
    addCard: (body: { name: string; accentColor: string }) =>
      withToken((t) => request<Card>('/api/cards', t, { method: 'POST', body: JSON.stringify(body) })),
    updateCard: (id: string, body: Partial<{ name: string; displayName: string | null; accentColor: string; font: string; photo: string | null; slug: string; qrColor: string | null; qrLogo: string | null; qrBgColor: string | null }>) =>
      withToken((t) => request<Card>(`/api/cards/${id}`, t, { method: 'PATCH', body: JSON.stringify(body) })),
    uploadCardPhoto: (cardId: string, uri: string) =>
      withToken(async (t) => {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
        return request<{ photoUrl: string }>(`/api/cards/${cardId}/photo`, t, {
          method: 'POST',
          body: JSON.stringify({ photo: base64, mimeType: 'image/jpeg' }),
        });
      }),
    uploadCardQrLogo: (cardId: string, uri: string) =>
      withToken(async (t) => {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
        return request<{ logoUrl: string }>(`/api/cards/${cardId}/qr-logo`, t, {
          method: 'POST',
          body: JSON.stringify({ photo: base64, mimeType: 'image/jpeg' }),
        });
      }),
    deleteCard: (id: string) =>
      withToken((t) => request<{ success: boolean }>(`/api/cards/${id}`, t, { method: 'DELETE' })),

    addField: (cardId: string, body: { type: string; value: string; label?: string; icon?: string }) =>
      withToken((t) =>
        request<CardField>(`/api/cards/${cardId}/fields`, t, { method: 'POST', body: JSON.stringify(body) })
      ),
    updateField: (cardId: string, fieldId: string, body: { value?: string; label?: string; icon?: string }) =>
      withToken((t) =>
        request<CardField>(`/api/cards/${cardId}/fields/${fieldId}`, t, { method: 'PATCH', body: JSON.stringify(body) })
      ),
    deleteField: (cardId: string, fieldId: string) =>
      withToken((t) =>
        request<{ success: boolean }>(`/api/cards/${cardId}/fields/${fieldId}`, t, { method: 'DELETE' })
      ),
    reorderFields: (cardId: string, items: Array<{ id: string; order: number }>) =>
      withToken((t) =>
        request<{ success: boolean }>(`/api/cards/${cardId}/fields/reorder`, t, {
          method: 'PATCH',
          body: JSON.stringify({ items }),
        })
      ),

    // Contacts
    getMyContacts: () => withToken((t) => request<Contact[]>('/api/contacts', t)),
    addContact: (body: Partial<Omit<Contact, 'id' | 'userId' | 'createdAt'>>) =>
      withToken((t) => request<Contact>('/api/contacts', t, { method: 'POST', body: JSON.stringify(body) })),
    updateContact: (id: string, body: Partial<Omit<Contact, 'id' | 'userId' | 'createdAt'>>) =>
      withToken((t) => request<Contact>(`/api/contacts/${id}`, t, { method: 'PATCH', body: JSON.stringify(body) })),
    deleteContact: (id: string) =>
      withToken((t) => request<{ success: boolean }>(`/api/contacts/${id}`, t, { method: 'DELETE' })),
    uploadContactPhoto: (contactId: string, uri: string) =>
      withToken(async (t) => {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
        return request<{ photoUrl: string }>(`/api/contacts/${contactId}/photo`, t, {
          method: 'POST',
          body: JSON.stringify({ photo: base64, mimeType: 'image/jpeg' }),
        });
      }),

    // Saved QR codes (Scans tab generator)
    getMyQrs: () => withToken((t) => request<SavedQr[]>('/api/qrs', t)),
    addQr: (body: { type: 'url' | 'wifi'; label?: string; data: string; color?: string; bgColor?: string }) =>
      withToken((t) => request<SavedQr>('/api/qrs', t, { method: 'POST', body: JSON.stringify(body) })),
    updateQr: (id: string, body: Partial<{ type: 'url' | 'wifi'; label: string; data: string; color: string | null; bgColor: string | null; logo: string | null }>) =>
      withToken((t) => request<SavedQr>(`/api/qrs/${id}`, t, { method: 'PATCH', body: JSON.stringify(body) })),
    deleteQr: (id: string) =>
      withToken((t) => request<{ success: boolean }>(`/api/qrs/${id}`, t, { method: 'DELETE' })),
    uploadQrLogo: (qrId: string, uri: string) =>
      withToken(async (t) => {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
        return request<{ logoUrl: string }>(`/api/qrs/${qrId}/logo`, t, {
          method: 'POST',
          body: JSON.stringify({ photo: base64, mimeType: 'image/jpeg' }),
        });
      }),

    // Scan history (Scans tab — contact scans + QR reads)
    getScanHistory: () => withToken((t) => request<ScanHistoryEntry[]>('/api/scan-history', t)),
    addScanHistory: (body: {
      type: 'contact' | 'qr';
      contactId?: string;
      label: string;
      qrData?: string;
      qrFormat?: 'url' | 'wifi' | 'text';
    }) =>
      withToken((t) =>
        request<ScanHistoryEntry>('/api/scan-history', t, { method: 'POST', body: JSON.stringify(body) })
      ),
    deleteScanHistory: (id: string) =>
      withToken((t) => request<{ success: boolean }>(`/api/scan-history/${id}`, t, { method: 'DELETE' })),
  };
}
