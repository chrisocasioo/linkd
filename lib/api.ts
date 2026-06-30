import { useAuth } from '@clerk/clerk-expo';
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

export interface Link {
  id: string;
  userId: string;
  title: string;
  url: string;
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

export interface AnalyticsData {
  profileViews: number;
  linkClicks: Array<{ linkId: string; title: string; url: string; count: number }>;
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
        const formData = new FormData();
        formData.append('photo', { uri, type: 'image/jpeg', name: 'photo.jpg' } as any);
        return request<{ photoUrl: string }>('/api/users/me/photo', t, { method: 'POST', body: formData });
      }),

    getMyLinks: () => withToken((t) => request<Link[]>('/api/links', t)),
    addLink: (body: { title: string; url: string }) =>
      withToken((t) =>
        request<Link>('/api/links', t, { method: 'POST', body: JSON.stringify(body) })
      ),
    updateLink: (id: string, body: Partial<Pick<Link, 'title' | 'url' | 'goLiveAt' | 'expiresAt'>>) =>
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

    getCard: (username: string) =>
      request<{ user: User; links: Link[] }>(`/api/cards/${username}`, null),
    logView: (body: { username: string; linkId?: string }) =>
      request<{ success: boolean }>('/api/analytics/view', null, {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    getQRs: () => withToken((t) => request<SavedQR[]>('/api/qrs', t)),
    saveQR: (body: { type: string; label: string; data: string }) =>
      withToken((t) =>
        request<SavedQR>('/api/qrs', t, { method: 'POST', body: JSON.stringify(body) })
      ),
    deleteQR: (id: string) =>
      withToken((t) => request<void>(`/api/qrs/${id}`, t, { method: 'DELETE' })),
  };
}
