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

export interface ContactMeta {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  website?: string;
}

export interface Contact {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  website: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ScanResult {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  website: string | null;
}

export interface Link {
  id: string;
  userId: string;
  title: string;
  url: string;
  type: string;
  metadata: string | null;
  order: number;
  goLiveAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface SavedQR {
  id: string;
  type: 'url' | 'wifi';
  label: string | null;
  data: string;
  createdAt: string;
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
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return fn(token);
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

    getMyLinks: () => withToken((t) => request<Link[]>('/api/links', t)),
    addLink: (body: { title: string; url: string; type?: string; metadata?: string }) =>
      withToken((t) =>
        request<Link>('/api/links', t, { method: 'POST', body: JSON.stringify(body) })
      ),
    updateLink: (id: string, body: Partial<Pick<Link, 'title' | 'url' | 'goLiveAt' | 'expiresAt' | 'metadata'>>) =>
      withToken((t) =>
        request<Link>(`/api/links/${id}`, t, { method: 'PATCH', body: JSON.stringify(body) })
      ),
    reorderLinks: (items: Array<{ id: string; order: number }>) =>
      withToken((t) =>
        request<{ success: boolean }>('/api/links/reorder', t, {
          method: 'PATCH',
          body: JSON.stringify({ items }),
        })
      ),
    deleteLink: (id: string) =>
      withToken((t) =>
        request<{ success: boolean }>(`/api/links/${id}`, t, { method: 'DELETE' })
      ),

    getAnalytics: () => withToken((t) => request<AnalyticsData>('/api/analytics/me', t)),

    logView: (body: { username: string }) =>
      request<{ success: boolean }>('/api/analytics/view', null, {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    // Cards (new multi-card system)
    getMyCards: () => withToken((t) => request<Card[]>('/api/cards', t)),
    addCard: (body: { name: string; accentColor: string }) =>
      withToken((t) => request<Card>('/api/cards', t, { method: 'POST', body: JSON.stringify(body) })),
    updateCard: (id: string, body: Partial<{ name: string; accentColor: string }>) =>
      withToken((t) => request<Card>(`/api/cards/${id}`, t, { method: 'PATCH', body: JSON.stringify(body) })),
    deleteCard: (id: string) =>
      withToken((t) => request<{ success: boolean }>(`/api/cards/${id}`, t, { method: 'DELETE' })),
    reorderCards: (items: Array<{ id: string; order: number }>) =>
      withToken((t) =>
        request<{ success: boolean }>('/api/cards/reorder', t, { method: 'PATCH', body: JSON.stringify({ items }) })
      ),

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
    updateContact: (id: string, body: Partial<Omit<Contact, 'id' | 'userId' | 'createdAt'>>) =>
      withToken((t) => request<Contact>(`/api/contacts/${id}`, t, { method: 'PATCH', body: JSON.stringify(body) })),
    deleteContact: (id: string) =>
      withToken((t) => request<{ success: boolean }>(`/api/contacts/${id}`, t, { method: 'DELETE' })),
    getQRs: () => withToken((t) => request<SavedQR[]>('/api/qrs', t)),
    saveQR: (body: { type: string; label: string; data: string }) =>
      withToken((t) =>
        request<SavedQR>('/api/qrs', t, { method: 'POST', body: JSON.stringify(body) })
      ),
    deleteQR: (id: string) =>
      withToken((t) => request<void>(`/api/qrs/${id}`, t, { method: 'DELETE' })),
  };
}
