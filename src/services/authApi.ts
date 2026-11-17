import { STORAGE_KEYS } from '../config/storage-keys';
import { User } from '../types';
import { standaloneStore } from './standaloneStore';

export function getStoredAuthToken(): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const sToken = sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
      if (sToken && sToken.trim().length > 0) return sToken;
    }
    if (typeof localStorage !== 'undefined') {
      const lToken = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
      if (lToken && lToken.trim().length > 0) return lToken;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export function setStoredAuthToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);
      localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Cliente de requisição HTTP para o backend PostgreSQL do CopperOS.
 * Anexa automaticamente o token assinado pelo backend (Authorization: Bearer <token>).
 */
export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getStoredAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

export interface LoginResponse {
  token: string;
  user: User & { departmentName?: string | null };
}

export const authApi = {
  async login(params: { email?: string; userId?: string; password?: string }): Promise<LoginResponse> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data: LoginResponse = await res.json();
        if (data.token) {
          setStoredAuthToken(data.token);
        }
        return data;
      }
    } catch {
      // Backend indisponível ou ambiente serverless estático (Vercel)
    }

    // ── Fallback Standalone Automático (Sem necessidade de servidor) ──
    const users = standaloneStore.getUsers();
    const cleanEmail = (params.email || '').trim().toLowerCase();
    const matchedUser =
      users.find(u => u.email.toLowerCase() === cleanEmail) ||
      users.find(u => u.id === params.userId) ||
      users[0];

    const demoToken = `standalone-token-${matchedUser.id}-${Date.now()}`;
    setStoredAuthToken(demoToken);

    return {
      token: demoToken,
      user: {
        ...matchedUser,
        departmentName: matchedUser.department || 'Operações Industriais',
      },
    };
  },

  async me(): Promise<{ user: User; department: any }> {
    try {
      const res = await authenticatedFetch('/api/auth/me');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // ignore
    }
    const user = standaloneStore.getUsers()[0];
    return { user, department: null };
  },

  async logout(): Promise<void> {
    try {
      await authenticatedFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // noop
    } finally {
      setStoredAuthToken(null);
    }
  },
};
