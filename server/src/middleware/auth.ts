import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';

const AUTH_SECRET = process.env.COPPEROS_AUTH_SECRET || 'copperos-pilot-hmac-secret-2026-v1';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  jobTitle?: string | null;
  department?: string | null;
  departmentId?: string | null;
  canAccessAllDepartments: boolean;
  organizationId: string;
  companyAccess: string[];
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export function hashPassword(raw: string): string {
  return crypto.createHash('sha256').update(`copperos_salt_v1:${raw}`).digest('hex');
}

export function signAuthToken(user: {
  id: string;
  role: string;
  departmentId?: string | null;
}): string {
  const payload = {
    sub: user.id,
    role: user.role,
    departmentId: user.departmentId || null,
    iat: Date.now(),
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

export function verifyAuthToken(token: string): {
  sub: string;
  role: string;
  departmentId?: string | null;
  iat: number;
  exp: number;
} | null {
  try {
    const parts = token.trim().split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', AUTH_SECRET)
      .update(payloadB64)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!decoded?.sub || typeof decoded.exp !== 'number' || Date.now() > decoded.exp) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

const safeParseArray = (raw: string | null | undefined, fallback: string[] = []): string[] => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

export function mapProfileToAuthUser(row: any): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role || 'OPERATOR',
    jobTitle: row.jobTitle || null,
    department: row.department || null,
    departmentId: row.departmentId || null,
    canAccessAllDepartments: Boolean(row.canAccessAllDepartments || row.role === 'CEO'),
    organizationId: row.organizationId || 'org-copper-group',
    companyAccess: safeParseArray(row.companyAccess, ['*']),
    permissions: safeParseArray(row.permissions, []),
  };
}

export async function extractAuthUser(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.authorization;
  let token = '';
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof req.headers['x-auth-token'] === 'string') {
    token = req.headers['x-auth-token'].trim();
  }

  if (!token) return null;

  const decoded = verifyAuthToken(token);
  if (!decoded) return null;

  const userRow = await prisma.userProfile.findUnique({
    where: { id: decoded.sub },
  });
  if (!userRow) return null;

  return mapProfileToAuthUser(userRow);
}

/**
 * Middleware que exige token autenticado válido e carrega o perfil real do banco.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authUser = await extractAuthUser(req);
    if (!authUser) {
      res.status(401).json({
        error: 'Não autenticado. Token de sessão ausente, inválido ou expirado.',
        code: 'AUTH_REQUIRED',
      });
      return;
    }
    req.authUser = authUser;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware opcional que popula `req.authUser` quando o token é enviado.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authUser = await extractAuthUser(req);
    if (authUser) {
      req.authUser = authUser;
    }
    next();
  } catch {
    next();
  }
}

/**
 * Exige nível 3 — André (Administrador executivo / CEO).
 */
export function requireCeo(req: Request, res: Response, next: NextFunction): void {
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ error: 'Não autenticado.', code: 'AUTH_REQUIRED' });
    return;
  }
  if (user.role !== 'CEO') {
    res.status(403).json({
      error: 'Acesso negado. Esta operação é exclusiva do Administrador Executivo (André / CEO).',
      code: 'FORBIDDEN_CEO_ONLY',
    });
    return;
  }
  next();
}

/**
 * Exige nível 2 ou 3 — Gestor de Departamento ou CEO.
 */
export function requireManagerOrCeo(req: Request, res: Response, next: NextFunction): void {
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ error: 'Não autenticado.', code: 'AUTH_REQUIRED' });
    return;
  }
  if (user.role !== 'CEO' && user.role !== 'MANAGER') {
    res.status(403).json({
      error: 'Acesso negado. Operação restrita a Gestores de Departamento e Diretoria.',
      code: 'FORBIDDEN_MANAGER_OR_CEO',
    });
    return;
  }
  next();
}

/**
 * Verifica no backend se o usuário tem permissão para consultar/consolidar determinado departamento.
 */
export function canAccessDepartment(user: AuthUser, targetDepartmentId?: string | null): boolean {
  if (user.role === 'CEO' || user.canAccessAllDepartments) {
    return true;
  }
  if (user.role === 'MANAGER') {
    return Boolean(targetDepartmentId && user.departmentId && user.departmentId === targetDepartmentId);
  }
  return false;
}
