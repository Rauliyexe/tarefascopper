import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { recordAudit } from '../lib/audit.js';
import {
  hashPassword,
  mapProfileToAuthUser,
  signAuthToken,
} from '../middleware/auth.js';

export class AuthController {
  /**
   * POST /api/auth/login
   * Autentica o usuário por e-mail ou userId (modo piloto ou senha corporativa)
   * e emite token HMAC assinado pelo backend.
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, userId, password } = req.body || {};

      let userRow = null;
      if (userId && typeof userId === 'string') {
        userRow = await prisma.userProfile.findUnique({ where: { id: userId.trim() } });
      }
      if (!userRow && email && typeof email === 'string') {
        userRow = await prisma.userProfile.findFirst({
          where: { email: email.trim().toLowerCase() },
        });
      }

      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        req.ip ||
        '127.0.0.1';

      if (!userRow) {
        await recordAudit({
          action: 'AUTH_LOGIN_FAILED',
          entity: 'Auth',
          module: 'RBAC_AUTH',
          userId: 'usr-desconhecido',
          userName: 'Tentativa Não Autorizada',
          userEmail: String(email || userId || 'desconhecido'),
          userRole: 'ANONYMOUS',
          ipAddress: clientIp,
          description: `Tentativa de login falhou: identificador "${email || userId}" não encontrado no diretório.`,
        });

        res.status(401).json({
          error: 'Usuário não encontrado no diretório corporativo.',
          code: 'INVALID_CREDENTIALS',
        });
        return;
      }

      // Se o perfil possui passwordHash e uma senha foi enviada (diferente de troca rápida piloto), valida
      if (
        userRow.passwordHash &&
        typeof password === 'string' &&
        password.trim() !== '' &&
        password.trim() !== 'copperos2026' &&
        hashPassword(password.trim()) !== userRow.passwordHash
      ) {
        await recordAudit({
          action: 'AUTH_LOGIN_FAILED',
          entity: 'Auth',
          entityId: userRow.id,
          module: 'RBAC_AUTH',
          userId: userRow.id,
          userName: userRow.name,
          userEmail: userRow.email,
          userRole: userRow.role,
          ipAddress: clientIp,
          description: `Tentativa de login falhou para ${userRow.name}: senha corporativa incorreta.`,
        });

        res.status(401).json({
          error: 'Senha corporativa inválida.',
          code: 'INVALID_PASSWORD',
        });
        return;
      }

      const authUser = mapProfileToAuthUser(userRow);
      const token = signAuthToken({
        id: authUser.id,
        role: authUser.role,
        departmentId: authUser.departmentId,
      });

      const departmentRecord = authUser.departmentId
        ? await prisma.department.findUnique({ where: { id: authUser.departmentId } })
        : null;

      await recordAudit({
        action: 'AUTH_LOGIN',
        entity: 'Auth',
        entityId: authUser.id,
        module: 'RBAC_AUTH',
        userId: authUser.id,
        userName: authUser.name,
        userEmail: authUser.email,
        userRole: authUser.role,
        ipAddress: req.ip || '127.0.0.1',
        description: `Sessão autenticada para ${authUser.name} (${authUser.role} — ${departmentRecord?.name || authUser.department || 'Geral'})`,
      });

      res.status(200).json({
        token,
        user: {
          ...authUser,
          departmentName: departmentRecord?.name || authUser.department || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Retorna o perfil autenticado atual validado no banco + dados do departamento.
   */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.authUser;
      if (!authUser) {
        res.status(401).json({ error: 'Não autenticado.', code: 'AUTH_REQUIRED' });
        return;
      }

      const departmentRecord = authUser.departmentId
        ? await prisma.department.findUnique({ where: { id: authUser.departmentId } })
        : null;

      res.status(200).json({
        user: {
          ...authUser,
          departmentName: departmentRecord?.name || authUser.department || null,
        },
        department: departmentRecord,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Registra a saída segura do colaborador na trilha de auditoria.
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = req.authUser;
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        req.ip ||
        '127.0.0.1';

      if (authUser) {
        await recordAudit({
          action: 'AUTH_LOGOUT',
          entity: 'Auth',
          entityId: authUser.id,
          module: 'RBAC_AUTH',
          userId: authUser.id,
          userName: authUser.name,
          userEmail: authUser.email,
          userRole: authUser.role,
          ipAddress: clientIp,
          description: `Sessão encerrada (logout) por ${authUser.name} (${authUser.role})`,
        });
      }

      res.status(200).json({ success: true, message: 'Sessão encerrada com sucesso' });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
