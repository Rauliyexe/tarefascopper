import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { recordAudit } from '../lib/audit.js';
import { safeParseJson } from '../lib/json.js';

const mapCompanyFromDb = (row: any) => ({
  id: row.id,
  monogram: row.monogram,
  numericCode: row.numericCode,
  legalName: row.legalName,
  tradeName: row.tradeName,
  sector: row.sector,
  cnpj: row.cnpj,
  status: row.status,
  unitsCount: row.unitsCount,
  state: row.state,
  city: row.city,
  enabledModules: safeParseJson(row.enabledModules, ['tarefas', 'metrologia']),
  stats: safeParseJson(row.stats, {}),
  branches: safeParseJson(row.branches, []),
  lastActivityAt: 'Agora',
  createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
});

const mapUserFromDb = (row: any) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  jobTitle: row.jobTitle || undefined,
  department: row.department || undefined,
  departmentId: row.departmentId || undefined,
  canAccessAllDepartments: Boolean(row.canAccessAllDepartments || row.role === 'CEO'),
  organizationId: row.organizationId,
  companyAccess: safeParseJson(row.companyAccess, ['*']),
  permissions: safeParseJson(row.permissions, []),
});

export class SystemController {
  /**
   * Retorna todas as empresas, departamentos, usuários RBAC e configurações operacionais do banco de dados.
   */
  async bootstrap(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const [companyRows, departmentRows, userRows, settingRows] = await Promise.all([
        prisma.companyRecord.findMany({ orderBy: { numericCode: 'asc' } }),
        prisma.department.findMany({ orderBy: { code: 'asc' } }),
        prisma.userProfile.findMany({ orderBy: { createdAt: 'asc' } }),
        prisma.systemSetting.findMany(),
      ]);

      const settings: Record<string, string> = {};
      for (const s of settingRows) {
        settings[s.key] = s.value;
      }

      res.status(200).json({
        companies: companyRows.map(mapCompanyFromDb),
        departments: departmentRows,
        users: userRows.map(mapUserFromDb),
        settings,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cria ou atualiza uma empresa multi-tenant e suas filiais no banco de dados.
   */
  async upsertCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = req.body;
      if (!company?.id || !company?.tradeName) {
        res.status(400).json({ message: 'id e tradeName da empresa são obrigatórios' });
        return;
      }

      const branches = Array.isArray(company.branches) ? company.branches : [];
      const payload = {
        monogram: company.monogram || 'CG',
        numericCode: company.numericCode || '01',
        legalName: company.legalName || company.tradeName,
        tradeName: company.tradeName,
        sector: company.sector || 'Metalurgia',
        cnpj: company.cnpj || '00.000.000/0001-00',
        status: company.status || 'OPERATIONAL',
        unitsCount: branches.length || company.unitsCount || 1,
        state: company.state || 'SP',
        city: company.city || 'São Paulo',
        enabledModules: JSON.stringify(company.enabledModules || ['tarefas', 'metrologia']),
        stats: JSON.stringify(company.stats || {}),
        branches: JSON.stringify(branches),
      };

      const saved = await prisma.companyRecord.upsert({
        where: { id: String(company.id) },
        update: payload,
        create: { id: String(company.id), ...payload },
      });

      await recordAudit({
        action: 'COMPANY_UPSERT',
        entity: 'Company',
        entityId: saved.id,
        module: 'GOVERNANCA',
        companyId: saved.id,
        description: `Empresa "${saved.tradeName}" (${branches.length} unidade(s)) sincronizada no banco de dados`,
      });

      res.status(200).json(mapCompanyFromDb(saved));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cria ou atualiza um perfil de colaborador (RBAC) no banco de dados.
   */
  async upsertUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.body;
      if (!user?.id || !user?.name || !user?.email) {
        res.status(400).json({ message: 'id, name e email do usuário são obrigatórios' });
        return;
      }

      const payload: Record<string, any> = {
        name: String(user.name).trim(),
        email: String(user.email).trim(),
        role: user.role || 'OPERATOR',
        jobTitle: user.jobTitle || null,
        department: user.department || null,
        organizationId: user.organizationId || 'org-copper-group',
        companyAccess: JSON.stringify(user.companyAccess || ['*']),
        permissions: JSON.stringify(user.permissions || []),
      };
      if (user.departmentId !== undefined) {
        payload.departmentId = user.departmentId || null;
      }
      if (typeof user.canAccessAllDepartments === 'boolean') {
        payload.canAccessAllDepartments = user.canAccessAllDepartments;
      }

      const saved = await prisma.userProfile.upsert({
        where: { id: String(user.id) },
        update: payload,
        create: { id: String(user.id), ...payload },
      });

      await recordAudit({
        action: 'USER_PROFILE_UPSERT',
        entity: 'UserProfile',
        entityId: saved.id,
        module: 'RBAC',
        userName: saved.name,
        userEmail: saved.email,
        userRole: saved.role,
        description: `Perfil RBAC de "${saved.name}" (${saved.role} - ${saved.jobTitle || 'Colaborador'}) salvo no banco de dados`,
      });

      res.status(200).json(mapUserFromDb(saved));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove ou desativa um perfil de colaborador (RBAC) pelo Administrador de TI.
   */
  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const actor = (req as any).user || null;

      const existing = await prisma.userProfile.findUnique({
        where: { id: String(id) },
      });

      if (!existing) {
        res.status(404).json({ message: 'Colaborador não encontrado' });
        return;
      }

      await prisma.userProfile.delete({
        where: { id: String(id) },
      });

      await recordAudit({
        action: 'USER_PROFILE_DELETE',
        entity: 'UserProfile',
        entityId: id,
        module: 'TI_RBAC',
        userId: actor?.userId || null,
        userName: actor?.userName || 'Administrador TI',
        userEmail: actor?.userEmail || null,
        userRole: actor?.userRole || 'TI_ADMIN',
        ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
        description: `Colaborador "${existing.name}" (${existing.role} - ${existing.email}) removido do sistema pelo Administrador de TI`,
        oldValues: JSON.stringify({
          id: existing.id,
          name: existing.name,
          email: existing.email,
          role: existing.role,
          jobTitle: existing.jobTitle,
          department: existing.department,
        }),
      });

      res.status(200).json({ success: true, message: `Colaborador ${existing.name} removido com sucesso` });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Salva configurações operacionais no banco de dados.
   */
  async saveSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { settings = {}, updatedBy = 'Gestão Operacional' } = req.body;

      const entries = Object.entries(settings);
      for (const [key, val] of entries) {
        await prisma.systemSetting.upsert({
          where: { key },
          update: { value: String(val), updatedBy },
          create: { key, value: String(val), updatedBy },
        });
      }

      res.status(200).json({
        success: true,
        updatedKeys: entries.map(([k]) => k),
      });
    } catch (error) {
      next(error);
    }
  }
}

export const systemController = new SystemController();

