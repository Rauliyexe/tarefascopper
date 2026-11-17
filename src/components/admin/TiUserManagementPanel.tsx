import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Search,
  Filter,
  Download,
  KeyRound,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Lock,
  ArrowRight,
  RefreshCw,
  X,
  Save,
  Copy,
  Check,
  UserCheck,
} from 'lucide-react';
import { useCopperOS } from '../../context/CopperOSContext';
import { soundEngine } from '../../services/soundEngine';
import { downloadCsv } from '../../utils/exportFile';
import { User, CompanyBranch } from '../../types';
import { Modal } from '../common/Modal';

interface TiUserManagementPanelProps {
  onShowNotice?: (msg: string) => void;
}

export const TiUserManagementPanel: React.FC<TiUserManagementPanelProps> = ({ onShowNotice }) => {
  const {
    user: currentUser,
    availableUsers,
    companies,
    currentCompany,
    switchUser,
    createEmployeeByAdmin,
    updateEmployeeByAdmin,
    deleteEmployeeByAdmin,
  } = useCopperOS();

  // Estados de Filtro e Busca
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'CEO' | 'MANAGER' | 'OPERATOR'>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Estados do Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'OPERATOR' as User['role'],
    jobTitle: '',
    department: 'Operações Industriais',
    canAccessAllDepartments: false,
    selectedBranches: [] as string[],
  });

  // Modal de PIN / Reset de Senha de TI
  const [pinModalUser, setPinModalUser] = useState<{ user: User; tempPin: string } | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);

  // Modal de Confirmação de Exclusão
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Departamentos únicos existentes para o filtro
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    availableUsers.forEach(u => {
      if (u.department) set.add(u.department);
    });
    return Array.from(set).sort();
  }, [availableUsers]);

  // Lista filtrada
  const filteredUsers = useMemo(() => {
    return availableUsers.filter(u => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.jobTitle && u.jobTitle.toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q));

      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchDept = departmentFilter === 'ALL' || u.department === departmentFilter;

      return matchSearch && matchRole && matchDept;
    });
  }, [availableUsers, search, roleFilter, departmentFilter]);

  // Métricas de TI
  const stats = useMemo(() => {
    const total = availableUsers.length;
    const operators = availableUsers.filter(u => u.role === 'OPERATOR').length;
    const managers = availableUsers.filter(u => u.role === 'MANAGER').length;
    const ceos = availableUsers.filter(u => u.role === 'CEO').length;
    return { total, operators, managers, ceos };
  }, [availableUsers]);

  // Abrir Modal de Criação
  const handleOpenCreate = () => {
    soundEngine.playSwoosh();
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      role: 'OPERATOR',
      jobTitle: '',
      department: departmentOptions[0] || 'Operações Industriais',
      canAccessAllDepartments: false,
      selectedBranches: currentCompany?.branches?.map(b => b.id) || ['matriz'],
    });
    setIsModalOpen(true);
  };

  // Abrir Modal de Edição
  const handleOpenEdit = (user: User) => {
    soundEngine.playSwoosh();
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      jobTitle: user.jobTitle || '',
      department: user.department || 'Geral',
      canAccessAllDepartments: Boolean(user.canAccessAllDepartments),
      selectedBranches: Array.isArray(user.companyAccess) && !user.companyAccess.includes('*')
        ? user.companyAccess
        : currentCompany?.branches?.map(b => b.id) || ['matriz'],
    });
    setIsModalOpen(true);
  };

  // Salvar (Criar ou Atualizar)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      alert('Nome e E-mail corporativo são obrigatórios.');
      return;
    }

    try {
      const userPayload: User = {
        id: editingUser ? editingUser.id : `usr-${Date.now()}`,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        role: formData.role,
        jobTitle: formData.jobTitle.trim() || (formData.role === 'OPERATOR' ? 'Operador Industrial' : 'Gestor de Setor'),
        department: formData.department.trim(),
        organizationId: 'org-copper-group',
        canAccessAllDepartments: formData.role === 'CEO' ? true : formData.canAccessAllDepartments,
        companyAccess: formData.role === 'CEO' ? ['*'] : formData.selectedBranches,
        permissions:
          formData.role === 'CEO'
            ? [
              'company.view',
              'company.edit',
              'company.manage_modules',
              'module.view',
              'module.create',
              'module.edit',
              'module.delete',
              'reports.view',
              'reports.export',
              'control_tower.view',
              'control_tower.manage_alerts',
              'cadastro.view',
              'cadastro.edit',
            ]
            : formData.role === 'MANAGER'
              ? [
                'module.view',
                'module.create',
                'module.edit',
                'reports.view',
                'reports.export',
                'cadastro.view',
              ]
              : ['module.view'],
      };

      if (editingUser) {
        await updateEmployeeByAdmin(userPayload);
        soundEngine.playSuccess();
        onShowNotice?.(`Colaborador "${userPayload.name}" atualizado com sucesso no PostgreSQL!`);
      } else {
        await createEmployeeByAdmin(userPayload);
        soundEngine.playSuccess();
        onShowNotice?.(`Novo colaborador "${userPayload.name}" cadastrado e ativado no sistema!`);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      soundEngine.playError();
      alert(`Erro ao salvar no PostgreSQL: ${err?.message || 'Falha de comunicação'}`);
    }
  };

  // Gerar PIN Temporário de Acesso para a TI
  const handleGeneratePin = (targetUser: User) => {
    soundEngine.playClick();
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    setPinModalUser({ user: targetUser, tempPin: pin });
    setCopiedPin(false);
  };

  // Confirmar Exclusão
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    if (userToDelete.id === currentUser.id) {
      alert('Você não pode excluir o seu próprio perfil que está em uso no momento.');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteEmployeeByAdmin(userToDelete.id);
      soundEngine.playSuccess();
      onShowNotice?.(`Colaborador "${userToDelete.name}" removido com sucesso.`);
      setUserToDelete(null);
    } catch (err: any) {
      soundEngine.playError();
      alert(`Erro ao remover: ${err?.message || 'Falha no banco'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Exportar Base de Usuários para CSV
  const handleExportCsv = () => {
    soundEngine.playClick();
    const headers = ['ID', 'Nome', 'Email', 'Cargo', 'Departamento', 'Nivel_RBAC', 'Acesso_Global'];
    const rows = availableUsers.map(u => [
      u.id,
      u.name,
      u.email,
      u.jobTitle || 'Não especificado',
      u.department || 'Geral',
      u.role,
      u.canAccessAllDepartments || u.role === 'CEO' ? 'SIM' : 'NAO',
    ]);
    downloadCsv(`usuarios_rbac_copper_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* ── 1. Topo & Ações de TI ── */}
      <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Painel de Gestão de Usuários & TI
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                  RBAC Industrial
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Gerencie credenciais, permissões operacionais, departamentos e níveis de acesso da planta.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-night-800 hover:bg-gray-200 dark:hover:bg-night-700 rounded-xl transition-colors"
              title="Exportar base de colaboradores em CSV"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Base</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Novo Colaborador (TI)</span>
            </button>
          </div>
        </div>

        {/* ── 2. Cards de Métricas de TI ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-gray-100 dark:border-night-800">
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-100 dark:border-night-800">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block">Total de Usuários</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Ativos</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300 block">Operadores (Chão)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{stats.operators}</span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">OPERATOR</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300 block">Gestores / Chefes</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.managers}</span>
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-mono">MANAGER</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300 block">Diretoria / Admins</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-amber-900 dark:text-amber-100">{stats.ceos}</span>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">CEO / ROOT</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Barra de Busca e Filtros ── */}
      <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail corporativo, cargo ou setor..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 text-gray-800 dark:text-gray-200 focus:outline-none"
          >
            <option value="ALL">Todos os Níveis (RBAC)</option>
            <option value="OPERATOR">Apenas Operadores</option>
            <option value="MANAGER">Apenas Gestores / Gerentes</option>
            <option value="CEO">Apenas Diretoria (CEO)</option>
          </select>

          <select
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 text-gray-800 dark:text-gray-200 focus:outline-none max-w-[180px]"
          >
            <option value="ALL">Todos Departamentos</option>
            {departmentOptions.map(dept => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── 4. Tabela Administrativa de Usuários ── */}
      <div className="bg-white dark:bg-night-900 border border-gray-200/80 dark:border-night-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-gray-50/75 dark:bg-night-850 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-100 dark:border-night-800">
              <tr>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-4">Cargo / Função</th>
                <th className="py-3 px-4">Departamento</th>
                <th className="py-3 px-4">Nível de Acesso (RBAC)</th>
                <th className="py-3 px-4">Escopo</th>
                <th className="py-3 px-4 text-right">Ações de TI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-night-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    Nenhum colaborador encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const isCurrent = u.id === currentUser.id;
                  const initials = u.name
                    .split(' ')
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  const roleBadge =
                    u.role === 'CEO'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/70 dark:border-amber-800/60'
                      : u.role === 'MANAGER'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200/70 dark:border-blue-800/60'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/60';

                  const roleLabel =
                    u.role === 'CEO' ? 'Diretoria (CEO)' : u.role === 'MANAGER' ? 'Gestor (Manager)' : 'Operador (Chão)';

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-gray-50/50 dark:hover:bg-night-850/50 transition-colors ${isCurrent ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                        }`}
                    >
                      {/* Colaborador */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-gray-900 dark:text-white">{u.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                                  Você
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 block">{u.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Cargo */}
                      <td className="py-3.5 px-4 text-gray-700 dark:text-gray-300">
                        {u.jobTitle || 'Colaborador'}
                      </td>

                      {/* Departamento */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-night-800 text-gray-700 dark:text-gray-300">
                          {u.department || 'Geral'}
                        </span>
                      </td>

                      {/* Nível RBAC */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleBadge}`}
                        >
                          {roleLabel}
                        </span>
                      </td>

                      {/* Escopo */}
                      <td className="py-3.5 px-4 text-xs text-gray-500 dark:text-gray-400">
                        {u.role === 'CEO' || u.canAccessAllDepartments ? (
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            Acesso a Todos os Setores
                          </span>
                        ) : (
                          <span>Apenas {u.department || 'Setor'}</span>
                        )}
                      </td>

                      {/* Ações de TI */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* Assumir sessão / Teste de TI */}
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => {
                                soundEngine.playSwoosh();
                                switchUser(u.id);
                                onShowNotice?.(`Sessão alternada para ${u.name} (${u.role}) para teste de TI.`);
                              }}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                              title="Assumir sessão deste usuário para testes e suporte"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}

                          {/* Resetar Senha / Gerar PIN */}
                          <button
                            type="button"
                            onClick={() => handleGeneratePin(u)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors"
                            title="Gerar PIN temporário ou redefinir senha do colaborador"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Editar */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                            title="Editar dados cadastrais e permissões"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Excluir / Inativar */}
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => setUserToDelete(u)}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                              title="Remover ou inativar colaborador da planta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 bg-gray-50/50 dark:bg-night-850/50 border-t border-gray-100 dark:border-night-800 text-xs text-gray-500 flex justify-between items-center">
          <span>Exibindo <strong>{filteredUsers.length}</strong> de <strong>{availableUsers.length}</strong> colaboradores cadastrados</span>
          <span className="font-mono text-[11px] text-gray-400">PostgreSQL · user_profiles</span>
        </div>
      </div>

      {/* ── Modal de Cadastro / Edição de Colaborador (TI) ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? `Editar Colaborador: ${editingUser.name}` : 'Cadastrar Novo Colaborador (TI)'}
        subtitle="Controle de identidade corporativa e perfis de acesso industrial"
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Carlos Eduardo Silveira"
                className="w-full px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                E-mail Corporativo *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="carlos.silveira@coppergroup.com.br"
                className="w-full px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Cargo / Função *
              </label>
              <input
                type="text"
                value={formData.jobTitle}
                onChange={e => setFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                placeholder="Ex: Operador de Forno, Inspetor de Qualidade..."
                className="w-full px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Departamento *
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={e => setFormData(prev => ({ ...prev, department: e.target.value }))}
                placeholder="Ex: Fundição, Laminação, Qualidade, TI..."
                className="w-full px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Nível de Acesso (Papel RBAC) *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label
                className={`p-3 rounded-xl border cursor-pointer transition-all ${formData.role === 'OPERATOR'
                  ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/30'
                  : 'border-gray-200 dark:border-night-800 bg-gray-50/50 dark:bg-night-850'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    value="OPERATOR"
                    checked={formData.role === 'OPERATOR'}
                    onChange={() => setFormData(prev => ({ ...prev, role: 'OPERATOR' }))}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-gray-900 dark:text-white">OPERADOR</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Chão de fábrica: checklists, tarefas próprias, RDO individual e modo simplificado.
                </p>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer transition-all ${formData.role === 'MANAGER'
                  ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/30'
                  : 'border-gray-200 dark:border-night-800 bg-gray-50/50 dark:bg-night-850'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    value="MANAGER"
                    checked={formData.role === 'MANAGER'}
                    onChange={() => setFormData(prev => ({ ...prev, role: 'MANAGER' }))}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-gray-900 dark:text-white">GESTOR (MANAGER)</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Gestão do setor: cria rotinas, delega tarefas, aprova RDOs e vê briefing do setor.
                </p>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer transition-all ${formData.role === 'CEO'
                  ? 'border-amber-500 bg-amber-50/30 dark:bg-amber-950/30'
                  : 'border-gray-200 dark:border-night-800 bg-gray-50/50 dark:bg-night-850'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    value="CEO"
                    checked={formData.role === 'CEO'}
                    onChange={() => setFormData(prev => ({ ...prev, role: 'CEO' }))}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-gray-900 dark:text-white">DIRETORIA (CEO)</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Acesso total: visão consolidada de todas as filiais, governança e auditoria total.
                </p>
              </label>
            </div>
          </div>

          {/* Permissão de acesso a todos os setores */}
          {formData.role !== 'CEO' && (
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-night-850 border border-gray-200 dark:border-night-800">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.canAccessAllDepartments}
                  onChange={e => setFormData(prev => ({ ...prev, canAccessAllDepartments: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  Permitir visualização de tarefas de todos os departamentos
                </span>
              </label>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 pl-6">
                Útil para coordenadores gerais, pessoal de segurança do trabalho ou equipe de TI.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-night-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-night-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{editingUser ? 'Salvar Alterações' : 'Cadastrar Colaborador'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal de PIN Temporário / Reset de Senha ── */}
      {pinModalUser && (
        <Modal
          isOpen={true}
          onClose={() => setPinModalUser(null)}
          title="Credencial Temporária de Acesso (TI)"
          subtitle={`Redefinição de acesso para ${pinModalUser.user.name}`}
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-center">
              <span className="text-xs text-amber-800 dark:text-amber-200 font-medium block mb-1">
                PIN Temporário para Primeiro Acesso:
              </span>
              <span className="text-3xl font-mono font-bold tracking-widest text-amber-950 dark:text-amber-100 block my-2">
                {pinModalUser.tempPin}
              </span>
              <span className="text-[11px] text-amber-700 dark:text-amber-300">
                Passe este código para o colaborador. O sistema exigirá troca na primeira sessão.
              </span>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Olá ${pinModalUser.user.name}, seu PIN temporário para o CopperOS é: ${pinModalUser.tempPin}`
                  );
                  setCopiedPin(true);
                  soundEngine.playSuccess();
                  setTimeout(() => setCopiedPin(false), 2500);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-night-800 hover:bg-gray-200 dark:hover:bg-night-700 rounded-xl transition-colors"
              >
                {copiedPin ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                <span>{copiedPin ? 'Copiado para o Clipboard!' : 'Copiar Instrução de Acesso'}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-night-800 flex justify-end">
              <button
                type="button"
                onClick={() => setPinModalUser(null)}
                className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-night-800 rounded-xl"
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal de Confirmação de Exclusão ── */}
      {userToDelete && (
        <Modal
          isOpen={true}
          onClose={() => setUserToDelete(null)}
          title="Remover Colaborador da Planta"
          subtitle="Ação irreversível com registro em trilha de auditoria"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800 dark:text-rose-200">
                Tem certeza que deseja inativar e remover o colaborador <strong>{userToDelete.name}</strong> ({userToDelete.email})? As tarefas já concluídas serão preservadas para fins de conformidade.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-night-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-night-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition-colors"
              >
                {isDeleting ? 'Removendo...' : 'Sim, Remover Colaborador'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
