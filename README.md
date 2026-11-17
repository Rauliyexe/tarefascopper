# 📋 CopperOS Tarefas & Rotinas Operacionais (Módulo Standalone)

Projeto autônomo e desacoplado de **Tarefas e Rotinas Operacionais Industriais** extraído do ecossistema CopperOS.

Construído com **React 19**, **Vite**, **Tailwind CSS**, **Node.js (Express)**, **Prisma ORM** e banco de dados **SQLite** local (zero configuração, roda sem Docker).

---

## 🚀 Como Executar o Projeto

### 1. Instalação das Dependências
Na raiz da pasta `CopperOS-Tarefas`, execute:
```bash
npm install
```

### 2. Configuração Inicial do Banco (SQLite)
Gera o Prisma Client, cria o arquivo `dev.db` com as tabelas e popula com dados industriais realistas:
```bash
npm run setup
```
*(Executa em cadeia: `prisma generate`, `prisma db push` e `seed`)*.

### 3. Iniciar o Aplicativo Full-Stack
Inicia simultaneamente o servidor backend e o cliente Vite:
```bash
npm run dev
```

- **Frontend**: [http://localhost:5174](http://localhost:5174)
- **API Backend**: [http://localhost:3001/api/tasks](http://localhost:3001/api/tasks)
- **Prisma Studio** (Opcional - interface gráfica para ver o banco SQLite):
  ```bash
  npm run prisma:studio
  ```

---

## 🌟 Recursos do Módulo

1. **Gestão de Tarefas & Checklists**:
   - Criação, edição, priorização (Alta, Média, Baixa) e delegação.
   - Checklists operacionais interativos (NR-12, ASTM B49, calibração).
   - Anexos e fotos com compressão inteligente via Canvas.
   - Diálogo de conclusão com registro de evidências e notas de entrega.

2. **Motor de Rotinas Diárias Recorrentes**:
   - Rotinas configuradas por horário (ex.: 06:30, 07:00).
   - Atribuição direta por colaborador ou por departamento industrial.
   - Disparo diário automático (`sweepRoutines`) e disparo manual imediato.
   - Opção de repetição apenas em dias úteis ou todos os dias.

3. **Múltiplas Visualizações Interativas**:
   - **Tabela Operacional**: Ordenação, filtros rápidos, paginação e ações em linha.
   - **Kanban**: Arraste e solte de cartões entre *Pendente*, *Em andamento* e *Concluída*.
   - **Calendário**: Visão mensal e semanal de prazos com destaque para atrasadas e urgentes.
   - **Projetos**: Agrupamento por setor industrial com barra de progresso visual.
   - **Calibração Metrológica**: Checklist de balanças e instrumentos de pesagem.
   - **Relatório Diário**: Diário de bordo, histórico de turnos e exportação em CSV/Impressão.

4. **Experiência do Usuário**:
   - Tema Claro e Escuro (Dark Mode obsidian persistente).
   - Efeitos sonoros acústicos zen via Web Audio API nativa (com botão mute/unmute).
   - Resumo dinâmico no topo (total, pendentes, concluídas).

---

## 🗄️ Estrutura de Pastas

```
CopperOS-Tarefas/
├── package.json               # Scripts e dependências
├── vite.config.ts             # Configuração do Vite com proxy para o backend (:3001)
├── tailwind.config.js         # Design system com cores dark (night-*) e brand (#10B981)
├── index.html                 # HTML de entrada com detecção antecipada de tema
├── .env                       # Porta (3001) e URL do SQLite ("file:./dev.db")
│
├── server/                    # Backend Node.js / Express
│   ├── prisma/
│   │   ├── schema.prisma      # Modelo de dados Task no SQLite
│   │   └── seed.ts            # Tarefas industriais realistas pré-cadastradas
│   └── src/
│       ├── server.ts          # Inicializador Express com CORS e rotas
│       ├── controllers/
│       │   └── task.controller.ts # CRUD, batch, resumo estatístico e comentários
│       ├── routes/
│       │   └── task.routes.ts # Endpoints REST /api/tasks
│       └── lib/
│           └── prisma.ts      # Instância singleton do PrismaClient
│
└── src/                       # Frontend React 19
    ├── App.tsx                # Layout principal com Navbar e página de tarefas
    ├── main.tsx               # Ponto de entrada React
    ├── context/
    │   ├── CopperOSContext.tsx # Contexto de tema, som e empresa
    │   └── TasksContext.tsx   # Estado global das tarefas e sincronização com a API
    ├── domain/
    │   ├── recurrence.ts      # Cálculo de recorrência e datas
    │   └── routineDispatch.ts # Motor de despacho de rotinas
    ├── services/
    │   ├── tasksApi.ts        # Chamadas REST para /api/tasks
    │   └── soundEngine.ts     # Sintetizador de áudio Web Audio
    └── pages/
        ├── TarefasPage.tsx    # Página mestre com toolbar, cards e abas
        └── tarefas/           # 21 subcomponentes modulares (Kanban, Calendário, etc.)
```

---

## 🔄 Como Migrar de SQLite para PostgreSQL (Quando Desejar)

O projeto foi projetado para portabilidade total. Se futuramente você quiser conectar este projeto ao PostgreSQL:

1. No arquivo `.env`, altere:
   ```env
   DATABASE_URL="postgresql://usuario:senha@localhost:5432/seu_banco?schema=public"
   ```
2. No arquivo `server/prisma/schema.prisma`, altere o provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Execute `npm run prisma:push` e pronto!

