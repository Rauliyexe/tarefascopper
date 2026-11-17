# 📋 CopperOS Tarefas & Rotinas Operacionais Industriais

Módulo enterprise autônomo e desacoplado de **Gestão de Tarefas, Rotinas Industriais e Metrologia** do ecossistema CopperOS.

Construído com **React 19**, **Vite**, **Tailwind CSS**, **Node.js (Express)**, **Prisma ORM** e banco de dados relacional **PostgreSQL** rodando via **Docker Compose**.

---

## 🚀 Como Executar o Projeto

### 1. Pré-requisitos
- Node.js 20+
- Docker Desktop (para o PostgreSQL)

### 2. Subir o Banco de Dados PostgreSQL
Na raiz do projeto, inicie o container PostgreSQL:
```bash
docker compose up -d
```
> O container `coppertarefas` inicializa na porta mapeada `5433` (externa) -> `5432` (interna).

### 3. Instalação e Preparação do Banco
Instale as dependências e popule o banco relacional:
```bash
npm install
npm run setup
```
*(Executa em cadeia: `prisma generate`, `prisma db push` e `seed` com usuários, empresas e tarefas)*.

### 4. Iniciar a Aplicação Full-Stack
Inicia simultaneamente o backend Express (:3001) e o frontend Vite (:5174):
```bash
npm run dev
```

- **Frontend**: [http://localhost:5174](http://localhost:5174)
- **API Backend**: [http://localhost:3001/api/tasks](http://localhost:3001/api/tasks)
- **Saúde do Sistema**: [http://localhost:3001/api/health](http://localhost:3001/api/health)
- **Prisma Studio** (Opcional - interface visual para o banco):
  ```bash
  npm run prisma:studio
  ```

---

## 👥 Credenciais de Acesso Pré-Cadastradas

| Perfil | Nome | E-mail | Senha / PIN | Permissões |
|---|---|---|---|---|
| **TI / Administrador** | Lucas Mendes (TI) | `admin@coppergroup.com.br` | `copperos2026` / `1029` | Painel TI exclusivo, gestão de usuários, reset de PIN, auditoria total |
| **Diretor Executivo / CEO** | Carlos Eduardo | `carlos.eduardo@coppergroup.com.br` | `copperos2026` / `1234` | Visão executiva global, Briefing 5 Min, troca de empresas |
| **Gestor Operacional** | Roberto Silva | `roberto.silva@coppergroup.com.br` | `copperos2026` / `5678` | Gestão de equipe, criação de rotinas, RDO e relatórios |
| **Operador Industrial** | Você (Operador) | `operador@coppergroup.com.br` | `copperos2026` / `9999` | Kanban individual exclusivo, execução de tarefas, fechamento de turno |

---

## 🌟 Recursos Principais

1. **Controle de Acesso RBAC & Painel TI Dedicado**:
   - Cargo `ADMIN` exclusivo para TI com painel de colaboradores, reset de PIN instantâneo, métricas e exportação CSV.
   - Operadores possuem visão limpa e focada em suas próprias entregas (sem acesso a configurações ou dados de terceiros).
   - Gestores e Administradores possuem ferramentas analíticas (Insights, CSV, rotinas automatizadas).

2. **Quadro Kanban Individual & Seguro**:
   - Operadores visualizam e movimentam estritamente suas tarefas atribuídas.
   - Cartões de outros colaboradores ficam bloqueados contra arraste indevido.
   - Gestores e Administradores podem alternar entre "Minhas Tarefas" e "Quadro Geral da Equipe".

3. **Motor de Rotinas Industriais Recorrentes**:
   - Disparo automatizado por horário (ex.: 06:30, 07:00).
   - Atribuição direta por colaborador ou por departamento industrial com deduplicação diária.

4. **Metrologia & Checklist RN-16**:
   - Rastreamento e calibração de balanças industriais e instrumentos de pesagem.

5. **Governança & Trilha de Auditoria LGPD**:
   - Registro imutável de todas as ações no PostgreSQL (criação, edição, conclusão, reset de PIN, login).
   - Relatório de Portabilidade do Titular em conformidade com o Art. 18, V da LGPD.

6. **Modo Chão de Fábrica & Acessibilidade**:
   - Alternância com 1 clique para botões ampliados de 44px e alto contraste para operação em tablets ou uso com luvas.
   - Síntese de voz neural e comando por voz "Ei Copper".

---

## 🗄️ Estrutura do Repositório

```
CopperOS-Tarefas/
├── docker-compose.yml         # Container PostgreSQL 16
├── package.json               # Dependências e scripts
├── vite.config.ts             # Configuração do Vite com proxy (:3001)
├── tailwind.config.js         # Design system com cores dark (night-*) e brand (#10B981)
│
├── server/                    # Backend Node.js / Express / TypeScript
│   ├── prisma/
│   │   ├── schema.prisma      # Modelos relacionais no PostgreSQL
│   │   └── seed.ts            # Carga inicial com empresas, usuários e tarefas
│   └── src/
│       ├── server.ts          # Servidor Express com rotas REST e health check
│       ├── controllers/       # Controladores (tasks, auth, audit, system, etc.)
│       ├── middleware/        # Autenticação JWT e RBAC (requireCeo, requireAdmin)
│       └── routes/            # Rotas modulares /api/*
│
└── src/                       # Frontend React 19 / TypeScript
    ├── components/
    │   ├── admin/             # Painel TI (TiUserManagementPanel)
    │   ├── auth/              # Tela de Login com seletor de perfil rápido
    │   ├── common/            # CommandPalette (Ctrl+K), modais, toasts
    │   └── layout/            # Sidebar responsiva e StandaloneNavbar
    ├── context/               # CopperOSContext e TasksContext
    └── pages/                 # TarefasPage (Kanban, Calendário, RDO, etc.) e ConfiguracoesPage
```
