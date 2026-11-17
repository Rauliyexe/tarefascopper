import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Company, CompanyBranch, User } from '../types';
import { STORAGE_KEYS } from '../config/storage-keys';
import { systemApi } from '../services/systemApi';
import { authApi, setStoredAuthToken } from '../services/authApi';
import { setLiveOrgData } from '../domain/org';
import { DEFAULT_COMPANIES, DEFAULT_DEPARTMENTS, DEFAULT_USERS } from '../services/standaloneStore';

export interface CopperOSContextType {
  // Empresas e Filiais
  companies: Company[];
  currentCompanyId: string;
  setCurrentCompanyId: (id: string) => void;
  currentCompany: Company;
  activeBranchId: string | null;
  setActiveBranchId: (id: string | null) => void;
  activeBranch: CompanyBranch | null;
  isCompanySelectorOpen: boolean;
  setIsCompanySelectorOpen: (open: boolean) => void;
  addCompany: (newCompany: Company) => void;
  addBranch: (companyId: string, newBranch: CompanyBranch) => void;
  deleteBranch: (companyId: string, branchId: string) => void;

  // Usuário e Autenticação
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User>>;
  availableUsers: User[];
  switchUser: (userId: string) => void;
  updateUserProfile: (updates: Partial<User>) => void;
  addUserProfile: (newUser: User) => void;
  createEmployeeByAdmin: (newUser: User) => Promise<User>;
  updateEmployeeByAdmin: (updatedUser: User) => Promise<User>;
  deleteEmployeeByAdmin: (userId: string) => Promise<void>;
  isAuthenticated: boolean;
  loginSession: (token?: string, userData?: Partial<User>) => void;
  logoutSession: () => void;

  // Estado de Sincronização PostgreSQL
  isBootstrapping: boolean;
  bootstrapError: string | null;

  // UI Modals & Assistente
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isCopilotOpen: boolean;
  setIsCopilotOpen: (open: boolean) => void;
  isCopilotVoiceOpen: boolean;
  setIsCopilotVoiceOpen: (open: boolean) => void;
  isWakeWordListening: boolean;
  setIsWakeWordListening: (active: boolean) => void;
  isFechamentoModalOpen: boolean;
  setIsFechamentoModalOpen: (open: boolean) => void;

  // Tema & Som
  isDarkMode: boolean;
  toggleTheme: () => void;
  soundEnabled: boolean;
  toggleSound: () => void;
}

const EMPTY_COMPANY: Company = {
  id: 'emp-copper-group',
  monogram: 'CG',
  numericCode: '01',
  legalName: 'Carregando empresa do PostgreSQL...',
  tradeName: 'Copper Group',
  sector: 'Metalurgia',
  cnpj: '',
  status: 'OPERATIONAL',
  unitsCount: 0,
  state: 'SP',
  city: 'São Paulo',
  enabledModules: ['tarefas'],
  stats: {
    ordersCount: 0,
    inProductionCount: 0,
    pendingCount: 0,
    alertsCount: 0,
  },
  lastActivityAt: '',
  createdAt: '',
  updatedAt: '',
  branches: [],
};

const EMPTY_USER: User = {
  id: '',
  name: '',
  email: '',
  role: 'OPERATOR',
  organizationId: 'org-copper-group',
  companyAccess: [],
  permissions: [],
};

const CopperOSContext = createContext<CopperOSContextType | undefined>(undefined);

export const CopperOSProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [companies, setCompanies] = useState<Company[]>(DEFAULT_COMPANIES);
  const [availableUsers, setAvailableUsers] = useState<User[]>(DEFAULT_USERS);
  const [user, setUser] = useState<User>(DEFAULT_USERS[0]);
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  // Limpa caches legados de mocks que ficavam em localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('copperos_companies_v1');
      localStorage.removeItem('copperos_available_users_v1');
      localStorage.removeItem('copperos_active_user');
      localStorage.removeItem('copperos_tasks_v1');
    } catch {
      // noop
    }
  }, []);

  const [currentCompanyId, setCurrentCompanyIdState] = useState<string>('emp-copper-group');

  const currentCompany = useMemo(() => {
    return companies.find(c => c.id === currentCompanyId) || companies[0] || EMPTY_COMPANY;
  }, [companies, currentCompanyId]);

  const [activeBranchId, setActiveBranchIdState] = useState<string | null>('br-cg-matriz');

  const activeBranch = useMemo(() => {
    if (!currentCompany.branches || currentCompany.branches.length === 0) return null;
    return (
      currentCompany.branches.find(b => b.id === activeBranchId) ||
      currentCompany.branches[0] ||
      null
    );
  }, [currentCompany, activeBranchId]);

  const setActiveBranchId = (id: string | null) => {
    setActiveBranchIdState(id);
  };

  const setCurrentCompanyId = (id: string) => {
    setCurrentCompanyIdState(id);
    const targetComp = companies.find(c => c.id === id);
    if (targetComp && targetComp.branches && targetComp.branches.length > 0) {
      setActiveBranchId(targetComp.branches[0].id);
    }
  };

  const addCompany = (newCompany: Company) => {
    setCompanies(prev => [...prev, newCompany]);
    systemApi.upsertCompany(newCompany).catch(err => {
      console.error('[CopperOSContext] Erro ao persistir empresa no PostgreSQL:', err);
      setBootstrapError(err?.message || 'Erro ao salvar empresa no PostgreSQL.');
    });
  };

  const addBranch = (companyId: string, newBranch: CompanyBranch) => {
    let updatedCompany: Company | null = null;
    setCompanies(prev =>
      prev.map(c => {
        if (c.id !== companyId) return c;
        const branches = [...(c.branches || []), newBranch];
        updatedCompany = { ...c, branches, unitsCount: branches.length };
        return updatedCompany;
      })
    );
    if (updatedCompany) {
      systemApi.upsertCompany(updatedCompany).catch(err => {
        console.error('[CopperOSContext] Erro ao salvar filial no PostgreSQL:', err);
        setBootstrapError(err?.message || 'Erro ao salvar filial no PostgreSQL.');
      });
    }
  };

  const deleteBranch = (companyId: string, branchId: string) => {
    let updatedCompany: Company | null = null;
    setCompanies(prev =>
      prev.map(c => {
        if (c.id !== companyId) return c;
        const branches = (c.branches || []).filter(b => b.id !== branchId);
        updatedCompany = { ...c, branches, unitsCount: branches.length };
        return updatedCompany;
      })
    );
    if (updatedCompany) {
      systemApi.upsertCompany(updatedCompany).catch(err => {
        console.error('[CopperOSContext] Erro ao remover filial no PostgreSQL:', err);
        setBootstrapError(err?.message || 'Erro ao remover filial no PostgreSQL.');
      });
    }
  };

  const switchUser = (userId: string) => {
    const selected = availableUsers.find(u => u.id === userId);
    if (selected) {
      setUser(selected);
      authApi
        .login({ userId: selected.id, email: selected.email })
        .then(res => {
          if (res.user) {
            setUser(prev => ({ ...prev, ...res.user }) as User);
          }
        })
        .catch(err => {
          console.error('[CopperOSContext] Erro ao autenticar troca de usuário:', err);
        });
    }
  };

  const updateUserProfile = (updates: Partial<User>) => {
    setUser(prev => {
      const updated = { ...prev, ...updates } as User;
      setAvailableUsers(prevList => prevList.map(u => (u.id === updated.id ? updated : u)));
      systemApi.upsertUser(updated).catch(err => {
        console.error('[CopperOSContext] Erro ao atualizar perfil no PostgreSQL:', err);
        setBootstrapError(err?.message || 'Erro ao atualizar perfil no PostgreSQL.');
      });
      return updated;
    });
  };

  const addUserProfile = (newUser: User) => {
    setAvailableUsers(prev => [...prev, newUser]);
    setUser(newUser);
    systemApi.upsertUser(newUser).catch(err => {
      console.error('[CopperOSContext] Erro ao criar perfil no PostgreSQL:', err);
      setBootstrapError(err?.message || 'Erro ao criar perfil no PostgreSQL.');
    });
  };

  const createEmployeeByAdmin = async (newUser: User): Promise<User> => {
    const saved = await systemApi.upsertUser(newUser);
    setAvailableUsers(prev => [...prev.filter(u => u.id !== saved.id), saved]);
    return saved;
  };

  const updateEmployeeByAdmin = async (updatedUser: User): Promise<User> => {
    const saved = await systemApi.upsertUser(updatedUser);
    setAvailableUsers(prev => prev.map(u => (u.id === saved.id ? saved : u)));
    if (user.id === saved.id) {
      setUser(saved);
    }
    return saved;
  };

  const deleteEmployeeByAdmin = async (userId: string): Promise<void> => {
    await systemApi.deleteUser(userId);
    setAvailableUsers(prev => prev.filter(u => u.id !== userId));
  };

  // Carrega dados do sistema (PostgreSQL quando disponível, ou standalone local)
  useEffect(() => {
    setLiveOrgData(DEFAULT_DEPARTMENTS, DEFAULT_USERS);

    systemApi
      .bootstrap()
      .then(data => {
        const dbCompanies = Array.isArray(data.companies) && data.companies.length > 0 ? data.companies : DEFAULT_COMPANIES;
        const dbDepartments = Array.isArray(data.departments) && data.departments.length > 0 ? data.departments : DEFAULT_DEPARTMENTS;
        const dbUsers = Array.isArray(data.users) && data.users.length > 0 ? data.users : DEFAULT_USERS;

        setCompanies(dbCompanies);
        setAvailableUsers(dbUsers);
        setLiveOrgData(dbDepartments, dbUsers);

        if (dbCompanies.length > 0) {
          setCurrentCompanyIdState(prev =>
            dbCompanies.some(c => c.id === prev) ? prev : dbCompanies[0].id
          );
          const firstBranches = dbCompanies[0].branches || [];
          if (firstBranches.length > 0) {
            setActiveBranchIdState(firstBranches[0].id);
          }
        }

        if (dbUsers.length > 0) {
          setUser(prev => dbUsers.find(u => u.id === prev.id) || dbUsers[0]);
        }

        if (data.settings && typeof data.settings === 'object') {
          try {
            for (const [key, val] of Object.entries(data.settings)) {
              localStorage.setItem(key, String(val));
            }
          } catch {
            // noop
          }
        }
      })
      .catch(() => {
        // Fallback silencioso para o modo standalone (sem assustar o usuário com erros de conexão)
        setCompanies(DEFAULT_COMPANIES);
        setAvailableUsers(DEFAULT_USERS);
        setLiveOrgData(DEFAULT_DEPARTMENTS, DEFAULT_USERS);
      })
      .finally(() => {
        setIsBootstrapping(false);
      });
  }, []);

  // Autenticação: sempre inicia na tela de Login ao abrir a aplicação
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const loginSession = (token?: string, userData?: Partial<User>) => {
    setIsAuthenticated(true);
    try {
      sessionStorage.removeItem('copperos_logged_out');
      if (token) {
        setStoredAuthToken(token);
      }
      if (userData) {
        setUser(prev => ({ ...prev, ...userData }) as User);
      }
    } catch {
      // noop
    }
  };

  const logoutSession = () => {
    setIsAuthenticated(false);
    authApi.logout().catch(() => {});
    try {
      sessionStorage.setItem('copperos_logged_out', 'true');
      setStoredAuthToken(null);
    } catch {
      // noop
    }
  };

  // Modais globais
  const [isCompanySelectorOpen, setIsCompanySelectorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isCopilotVoiceOpen, setIsCopilotVoiceOpen] = useState(false);
  const [isWakeWordListening, setIsWakeWordListening] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem('copperos_wake_listening');
      return saved !== 'false';
    } catch {
      return true;
    }
  });
  const [isFechamentoModalOpen, setIsFechamentoModalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('copperos_wake_listening', String(isWakeWordListening));
    } catch {
      // noop
    }
  }, [isWakeWordListening]);

  // Tema Dark/Light
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return true;
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, String(isDarkMode));
    } catch {
      // noop
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  // Som de interface
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return true;
    const saved = localStorage.getItem('copperos_sound_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('copperos_sound_enabled', String(next));
      } catch {
        // noop
      }
      return next;
    });
  };

  const value: CopperOSContextType = {
    companies,
    currentCompanyId,
    setCurrentCompanyId,
    currentCompany,
    activeBranchId,
    setActiveBranchId,
    activeBranch,
    isCompanySelectorOpen,
    setIsCompanySelectorOpen,
    addCompany,
    addBranch,
    deleteBranch,
    user,
    setUser,
    availableUsers,
    switchUser,
    updateUserProfile,
    addUserProfile,
    createEmployeeByAdmin,
    updateEmployeeByAdmin,
    deleteEmployeeByAdmin,
    isAuthenticated,
    loginSession,
    logoutSession,
    isBootstrapping,
    bootstrapError,
    isSettingsOpen,
    setIsSettingsOpen,
    isCopilotOpen,
    setIsCopilotOpen,
    isCopilotVoiceOpen,
    setIsCopilotVoiceOpen,
    isWakeWordListening,
    setIsWakeWordListening,
    isFechamentoModalOpen,
    setIsFechamentoModalOpen,
    isDarkMode,
    toggleTheme,
    soundEnabled,
    toggleSound,
  };

  return <CopperOSContext.Provider value={value}>{children}</CopperOSContext.Provider>;
};

export function useCopperOS(): CopperOSContextType {
  const context = useContext(CopperOSContext);
  if (!context) {
    throw new Error('useCopperOS deve ser utilizado dentro de um CopperOSProvider');
  }
  return context;
}
