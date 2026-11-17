import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { taskRoutes } from './routes/task.routes.js';
import { auditRoutes } from './routes/audit.routes.js';
import { fechamentoRoutes } from './routes/fechamento.routes.js';
import { equipmentRoutes } from './routes/equipment.routes.js';
import { systemRoutes } from './routes/system.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { questionnaireRoutes } from './routes/questionnaire.routes.js';
import { reportsRoutes } from './routes/reports.routes.js';
import { optionalAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(optionalAuth);

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    module: 'Tarefas & Rotinas Operacionais',
    timestamp: new Date().toISOString(),
  });
});

// Rotas principais
app.use('/api/auth', authRoutes);
app.use('/api/questionnaires', questionnaireRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/fechamento-expediente', fechamentoRoutes);
app.use('/api/equipamentos', equipmentRoutes);
app.use('/api/system', systemRoutes);

// Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Tarefas API Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno no servidor de tarefas',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 [CopperOS API] Servidor rodando em http://localhost:${PORT}`);
  console.log(`📋 API de Tarefas disponível em http://localhost:${PORT}/api/tasks`);
  console.log(`⚖️  API de Metrologia RN-16 em http://localhost:${PORT}/api/equipamentos`);
  console.log(`📝 API de Fechamento RDO em http://localhost:${PORT}/api/fechamento-expediente`);
  console.log(`🏛️  API de Governança & RBAC em http://localhost:${PORT}/api/system/bootstrap`);
  console.log(`🛡️  Trilha de Auditoria disponível em http://localhost:${PORT}/api/audit\n`);
});
