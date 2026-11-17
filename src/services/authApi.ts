import { STORAGE_KEYS } from '../config/storage-keys';
import { User } from '../types';

export function getStoredAuthToken(): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const sToken = sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
      if (sToken && sToken.includes('.')) return sToken;
    }
    if (typeof localStorage !== 'undefined') {
      const lToken = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
      if (lToken && lToken.includes('.')) return lToken;
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
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao autenticar no servidor.' }));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }

    const data: LoginResponse = await res.json();
    if (data.token) {
      setStoredAuthToken(data.token);
    }
    return data;
  },

  async me(): Promise<{ user: User; department: any }> {
    const res = await authenticatedFetch('/api/auth/me');
    if (!res.ok) {
      throw new Error(`Sessão inválida (${res.status})`);
    }
    return res.json();
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
