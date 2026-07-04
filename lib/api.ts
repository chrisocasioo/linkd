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
  displayOrder: number;
}

export interface Card {
  id: string;
  userId: string;
  name: string;
  accentColor: string;
  font: string | null;
  photo: string | null;
  slug: string | null;
  displayOrder: number;
  createdAt: string;
  fields: CardField[];
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
      // Clerk's cached session can be stale after the app sits in the background;
      // a null/expired token here surfaced as "unauthenticated" errors in the UI.
      let token: string | null = null;
      try { token = await getToken(); } catch {}
      if (!token) {
        try { token = await getToken({ skipCache: true }); } catch {}
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
    updateCard: (id: string, body: Partial<{ name: string; accentColor: string; font: string; photo: string | null }>) =>
      withToken((t) => request<Card>(`/api/cards/${id}`, t, { method: 'PATCH', body: JSON.stringify(body) })),
    uploadCardPhoto: (cardId: string, uri: string) =>
      withToken(async (t) => {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
        return request<{ photoUrl: string }>(`/api/cards/${cardId}/photo`, t, {
          method: 'POST',
          body: JSON.stringify({ photo: base64, mimeType: 'image/jpeg' }),
        });
      }),
    deleteCard: (id: string) =>
      withToken((t) => request<{ success: boolean }>(`/api/cards/${id}`, t, { method: 'DELETE' })),

    addField: (cardId: string, body: { type: string; value: string; label?: string }) =>
      withToken((t) =>
        request<CardField>(`/api/cards/${cardId}/fields`, t, { method: 'POST', body: JSON.stringify(body) })
      ),
    updateField: (cardId: string, fieldId: string, body: { value?: string; label?: string }) =>
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
    deleteContact: (id: string) =>
      withToken((t) => request<{ success: boolean }>(`/api/contacts/${id}`, t, { method: 'DELETE' })),
  };
}
