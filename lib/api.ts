import { useAuth } from '@clerk/clerk-expo';
import { useCallback } from 'react';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export interface SavedQR {
  id: string;
  type: 'url' | 'wifi';
  label: string | null;
  data: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    let body: any = {};
    let raw = '';
    try { raw = await res.text(); body = JSON.parse(raw); } catch {}
    const msg = body.error ?? body.message ?? raw.slice(0, 120) || res.statusText;
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
    updateMe: (body: { displayName: string }) =>
      withToken((t) =>
        request<User>('/api/users/me', t, { method: 'PATCH', body: JSON.stringify(body) })
      ),
    deleteMe: () =>
      withToken((t) => request<void>('/api/users/me', t, { method: 'DELETE' })),
    getQRs: () => withToken((t) => request<SavedQR[]>('/api/qrs', t)),
    saveQR: (body: { type: string; label: string; data: string }) =>
      withToken((t) =>
        request<SavedQR>('/api/qrs', t, { method: 'POST', body: JSON.stringify(body) })
      ),
    deleteQR: (id: string) =>
      withToken((t) => request<void>(`/api/qrs/${id}`, t, { method: 'DELETE' })),
  };
}
