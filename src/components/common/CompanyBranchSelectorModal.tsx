import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  Layers,
  X,
  Users,
} from 'lucide-react';
import { useCopperOS } from '../../context/CopperOSContext';
import { soundEngine } from '../../services/soundEngine';
import { Company, CompanyBranch } from '../../types';

export const CompanyBranchSelectorModal: React.FC = () => {
  const {
    companies,
    currentCompanyId,
    setCurrentCompanyId,
    activeBranchId,
    setActiveBranchId,
    isCompanySelectorOpen,
    setIsCompanySelectorOpen,
    user,
    logoutSession,
    isDarkMode,
    toggleTheme,
  } = useCopperOS();

  // Controla qual card está com o menu "Filiais" expandido
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);

  if (!isCompanySelectorOpen) return null;

  const handleSelectBranch = (company: Company, branch: CompanyBranch | null) => {
    soundEngine.playSuccess();
    setCurrentCompanyId(company.id);
    setActiveBranchId(branch ? branch.id : null);
    setIsCompanySelectorOpen(false);
  };

  const handleSelectCompanyDefault = (company: Company) => {
    soundEngine.playSuccess();
    setCurrentCompanyId(company.id);
    if (company.branches && company.branches.length > 0) {
      setActiveBranchId(company.branches[0].id);
    } else {
      setActiveBranchId(null);
    }
    setIsCompanySelectorOpen(false);
  };

  const toggleFiliaisDropdown = (e: React.MouseEvent, companyId: string) => {
    e.stopPropagation();
    soundEngine.playClick();
    setExpandedCompanyId(prev => (prev === companyId ? null : companyId));
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#f4f7f9] dark:bg-night-950 text-gray-900 dark:text-gray-100 overflow-y-auto flex flex-col justify-between p-6 sm:p-10 font-sans animate-in fade-in duration-200">
      {/* ── BARRA SUPERIOR DIREITA (TEMA, VOLTAR AO PAINEL E SAIR) ── */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            toggleTheme();
            soundEngine.playClick();
          }}
          className="w-9 h-9 rounded-full bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:border-emerald-500 transition-colors cursor-pointer shadow-2xs"
          title={isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setIsCompanySelectorOpen(false);
            logoutSession();
          }}
          className="px-3 py-1.5 rounded-full bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          title="Voltar para a tela de Login"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Trocar Usuário</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setIsCompanySelectorOpen(false);
          }}
          className="w-9 h-9 rounded-full bg-white dark:bg-night-900 border border-gray-200 dark:border-night-800 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 transition-colors cursor-pointer shadow-2xs"
          title="Continuar na empresa atual"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── CONTEÚDO CENTRAL: BOAS-VINDAS + CARDS DE EMPRESAS E FILIAIS ── */}
      <div className="w-full max-w-4xl mx-auto my-auto py-8 flex flex-col items-center">
        {/* Cabeçalho Centralizado CopperOS */}
        <div className="relative flex flex-col items-center text-center">
          {/* Halo luminoso esmeralda suave atrás do ícone */}
          <div className="absolute -top-6 w-36 h-36 rounded-full bg-emerald-400/20 dark:bg-emerald-500/15 blur-2xl pointer-events-none" />

          {/* Ícone Oficial CopperOS em Card Branco */}
          <div className="relative w-14 h-14 rounded-2xl bg-white dark:bg-night-900 shadow-lg shadow-emerald-500/10 border border-gray-100 dark:border-night-800 flex items-center justify-center">
            <div className="w-5 h-5 rounded-[5px] border-2 border-[#10b981]" />
            <span className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-[#10b981]" />
          </div>

          <h2 className="mt-3 text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            CopperOS
          </h2>

          <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Bem-vindo, <span className="text-[#10b981]">{user?.name || 'Administrador'}.</span>
          </h1>

          <p className="mt-1.5 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Selecione a empresa ou filial que deseja acessar.
          </p>
        </div>

        {/* Grid de Cards das Empresas */}
        <div className="w-full mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {companies.map(company => {
            const isCurrentCompany = company.id === currentCompanyId;
            const isExpanded = expandedCompanyId === company.id;
            const branches = company.branches || [];
            const monogram =
              company.monogram || company.tradeName.slice(0, 2).toUpperCase();

            return (
              <div
                key={company.id}
                className={`bg-white dark:bg-night-900 rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isCurrentCompany
                    ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/5'
                    : 'border-gray-200/80 dark:border-night-800 shadow-sm hover:shadow-md hover:border-emerald-500/30'
                }`}
              >
                {/* Barra Superior Esmeralda */}
                <div className="h-1.5 w-full bg-[#10b981]" />

                <div className="p-5 sm:p-6">
                  {/* Linha 1: Badges de Ambiente e Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                      <span>AMBIENTE OPERACIONAL</span>
                    </span>

                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                      <span>Ativa</span>
                    </span>
                  </div>

                  {/* Linha 2: Avatar Monograma + Nome da Empresa (Clicável para entrar direto) */}
                  <div
                    onClick={() => handleSelectCompanyDefault(company)}
                    className="mt-4 flex items-center gap-3.5 cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#f8fafc] dark:bg-night-850 border border-gray-200 dark:border-night-700 group-hover:border-[#10b981] group-hover:bg-emerald-50/50 dark:group-hover:bg-emerald-950/40 flex items-center justify-center text-xs font-extrabold text-emerald-700 dark:text-emerald-400 shrink-0 transition-all">
                      {monogram}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-extrabold text-gray-900 dark:text-white group-hover:text-[#10b981] transition-colors truncate">
                        {company.tradeName}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {company.sector || 'Operações Metalúrgicas'}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5">
                        CNPJ {company.cnpj} • {company.city}/{company.state}
                      </p>
                    </div>
                  </div>

                  {/* Linha Divisória */}
                  <div className="my-4 border-t border-gray-100 dark:border-night-800" />

                  {/* Linha 3: Rodapé do Card com botão "Filiais ⌄" */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectCompanyDefault(company)}
                      className="text-xs font-semibold text-gray-500 hover:text-[#10b981] dark:text-gray-400 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                    >
                      Acessar Matriz →
                    </button>

                    <button
                      type="button"
                      onClick={e => toggleFiliaisDropdown(e, company.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200/70 dark:border-emerald-800/60 transition-colors cursor-pointer"
                    >
                      <Building2 className="w-3.5 h-3.5 text-[#10b981]" />
                      <span>Filiais ({branches.length})</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Menu Expansível de Filiais */}
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-night-800 space-y-2 animate-in fade-in duration-150">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">
                        Escolha a Unidade / Filial de Trabalho:
                      </span>

                      {/* Opção Consolidada */}
                      <button
                        type="button"
                        onClick={() => handleSelectBranch(company, null)}
                        className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                          isCurrentCompany && activeBranchId === null
                            ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500/50'
                            : 'bg-gray-50/70 dark:bg-night-850 border-gray-200/70 dark:border-night-800 hover:border-emerald-500/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <Layers className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                              Visão Consolidada (Todas as Filiais)
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                              {branches.length} plantas operacionais unificadas
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                      </button>

                      {/* Lista de Filiais Individuais */}
                      {branches.map(branch => {
                        const isBranchSelected =
                          isCurrentCompany && activeBranchId === branch.id;

                        return (
                          <button
                            key={branch.id}
                            type="button"
                            onClick={() => handleSelectBranch(company, branch)}
                            className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                              isBranchSelected
                                ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 shadow-2xs'
                                : 'bg-white dark:bg-night-850 border-gray-200/80 dark:border-night-800 hover:border-emerald-500/40 hover:bg-gray-50/60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                                  branch.type === 'MATRIZ'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-slate-100 text-slate-700 dark:bg-night-800 dark:text-gray-300'
                                }`}
                              >
                                {branch.code}
                              </span>

                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                  {branch.name}
                                </p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-2.5 h-2.5 shrink-0 text-emerald-500" />
                                  <span>
                                    {branch.city}/{branch.state}
                                  </span>
                                  <span>•</span>
                                  <Users className="w-2.5 h-2.5 shrink-0" />
                                  <span>{branch.activeEmployeesCount} colab.</span>
                                </p>
                              </div>
                            </div>

                            {isBranchSelected ? (
                              <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RODAPÉ ── */}
      <div className="text-center text-[11px] text-gray-400 dark:text-gray-500">
        CopperOS Multi-Tenant • Selecione uma unidade para carregar os indicadores e rotinas da planta
      </div>
    </div>
  );
};
