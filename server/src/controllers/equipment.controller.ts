import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { recordAudit } from '../lib/audit.js';

export class EquipmentController {
  /**
   * Lista todas as balanças e equipamentos metrológicos do banco de dados.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.query.companyId as string | undefined;
      const whereClause: any = {};

      if (companyId && companyId !== 'all') {
        whereClause.companyId = companyId;
      }

      const items = await prisma.equipment.findMany({
        where: whereClause,
        orderBy: [{ bloqueadoOperacionalmente: 'desc' }, { codigo: 'asc' }],
      });

      res.status(200).json({
        total: items.length,
        equipamentos: items,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cadastra uma nova balança ou equipamento de leitura no banco de dados.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        id,
        companyId = 'emp-copper-group',
        codigo,
        nome,
        tipo = 'BALANCA_RODOVIARIA',
        capacidadeMaxKg = 80000,
        precisaoKg = 10,
        localizacao = 'Portaria Principal',
        marcaModelo = 'Toledo Prix 9094',
        ultimaCalibracao = new Date().toISOString().slice(0, 10),
        validadeCalibracao = '2027-06-30',
        certificadoNumero = 'RBC-2026',
        orgaoCertificador = 'Inmetro / RBC',
        status = 'CALIBRADO_ATIVO',
        bloqueadoOperacionalmente = false,
        motivoBloqueio,
        userName = 'Engenharia de Metrologia',
      } = req.body;

      if (!codigo || !nome) {
        res.status(400).json({ message: 'codigo e nome do equipamento são obrigatórios' });
        return;
      }

      const data: any = {
        companyId,
        codigo: String(codigo).trim().toUpperCase(),
        nome: String(nome).trim(),
        tipo,
        capacidadeMaxKg: Number(capacidadeMaxKg),
        precisaoKg: Number(precisaoKg),
        localizacao: String(localizacao).trim(),
        marcaModelo: String(marcaModelo).trim(),
        ultimaCalibracao: String(ultimaCalibracao).slice(0, 10),
        validadeCalibracao: String(validadeCalibracao).slice(0, 10),
        certificadoNumero: String(certificadoNumero).trim(),
        orgaoCertificador: String(orgaoCertificador).trim(),
        status,
        bloqueadoOperacionalmente: Boolean(bloqueadoOperacionalmente),
        motivoBloqueio: motivoBloqueio || null,
      };

      if (id) data.id = id;

      const created = await prisma.equipment.create({ data });
      const authUser = req.authUser;
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        req.ip ||
        '127.0.0.1';

      await recordAudit({
        action: 'EQUIPMENT_CREATE',
        entity: 'Equipment',
        entityId: created.id,
        module: 'METROLOGIA_RN16',
        companyId,
        userId: authUser?.id || null,
        userName: authUser?.name || userName || 'Engenharia de Metrologia',
        userEmail: authUser?.email || 'metrologia@coppergroup.com.br',
        userRole: authUser?.role || 'MANAGER',
        ipAddress: clientIp,
        description: `Equipamento metrológico [${created.codigo}] "${created.nome}" cadastrado no PostgreSQL`,
        newValues: created,
      });

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Atualiza calibração, certificado RBC ou trava operacional RN-16 no banco de dados.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const existing = await prisma.equipment.findUnique({ where: { id } });

      if (!existing) {
        res.status(404).json({ message: 'Equipamento não encontrado' });
        return;
      }

      const payload = { ...req.body };
      const userName = payload.userName || 'Engenharia de Metrologia';
      delete payload.id;
      delete payload.createdAt;
      delete payload.updatedAt;
      delete payload.userName;

      if (payload.capacidadeMaxKg !== undefined) {
        payload.capacidadeMaxKg = Number(payload.capacidadeMaxKg);
      }
      if (payload.precisaoKg !== undefined) {
        payload.precisaoKg = Number(payload.precisaoKg);
      }
      if (payload.bloqueadoOperacionalmente !== undefined) {
        payload.bloqueadoOperacionalmente = Boolean(payload.bloqueadoOperacionalmente);
      }

      const updated = await prisma.equipment.update({
        where: { id },
        data: payload,
      });

      const wasLocked = existing.bloqueadoOperacionalmente;
      const nowLocked = updated.bloqueadoOperacionalmente;
      const authUser = req.authUser;
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        req.ip ||
        '127.0.0.1';

      await recordAudit({
        action: wasLocked && !nowLocked ? 'RN16_RECALIBRATION_UNLOCK' : nowLocked && !wasLocked ? 'RN16_METROLOGY_LOCK' : 'EQUIPMENT_UPDATE',
        entity: 'Equipment',
        entityId: updated.id,
        module: 'METROLOGIA_RN16',
        companyId: updated.companyId,
        userId: authUser?.id || null,
        userName: authUser?.name || userName || 'Engenharia de Metrologia',
        userEmail: authUser?.email || 'metrologia@coppergroup.com.br',
        userRole: authUser?.role || 'MANAGER',
        ipAddress: clientIp,
        description:
          wasLocked && !nowLocked
            ? `Recalibração homologada para [${updated.codigo}] "${updated.nome}" (Certificado: ${updated.certificadoNumero}) — Trava RN-16 liberada`
            : nowLocked && !wasLocked
            ? `Trava Metrológica RN-16 acionada para [${updated.codigo}] "${updated.nome}" (${updated.motivoBloqueio || 'Calibração vencida'})`
            : `Equipamento [${updated.codigo}] "${updated.nome}" atualizado`,
        oldValues: existing,
        newValues: updated,
      });

      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove um equipamento metrológico do banco PostgreSQL.
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const existing = await prisma.equipment.findUnique({ where: { id } });

      if (!existing) {
        res.status(404).json({ message: 'Equipamento não encontrado' });
        return;
      }

      await prisma.equipment.delete({ where: { id } });

      const authUser = req.authUser;
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        req.ip ||
        '127.0.0.1';

      await recordAudit({
        action: 'EQUIPMENT_DELETE',
        entity: 'Equipment',
        entityId: id,
        module: 'METROLOGIA_RN16',
        companyId: existing.companyId,
        userId: authUser?.id || null,
        userName: authUser?.name || 'Engenharia de Metrologia',
        userEmail: authUser?.email || 'metrologia@coppergroup.com.br',
        userRole: authUser?.role || 'MANAGER',
        ipAddress: clientIp,
        description: `Equipamento [${existing.codigo}] "${existing.nome}" removido do parque metrológico`,
        oldValues: existing,
      });

      res.status(200).json({ success: true, id });
    } catch (error) {
      next(error);
    }
  }
}

export const equipmentController = new EquipmentController();

