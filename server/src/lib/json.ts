/**
 * Utilitários unificados de tratamento e parsing resiliente de JSON para o backend.
 * Previne falhas de parsing ao lidar com campos string/JSON do PostgreSQL.
 */

export function safeParseJson<T = any>(val: any, fallback: T): T {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return val as T;
}

export function safeParseArray<T = any>(val: any): T[] {
  if (!val) return [];
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(val) ? val : [];
}

export function safeParseObject<T = Record<string, any>>(val: any): T {
  if (!val) return {} as T;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return typeof parsed === 'object' && parsed !== null ? (parsed as T) : ({} as T);
    } catch {
      return {} as T;
    }
  }
  return typeof val === 'object' && val !== null ? (val as T) : ({} as T);
}

export function safeStringify(val: any, fallback = '[]'): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(val);
  } catch {
    return fallback;
  }
}
