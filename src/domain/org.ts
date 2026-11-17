import { Department, Employee, User } from '../types';

let liveDepartments: Department[] = [];
let liveEmployees: Employee[] = [];

/**
 * Sincroniza o organograma ativo diretamente a partir dos registros do PostgreSQL
 * retornados por `/api/system/bootstrap`.
 */
export const setLiveOrgData = (
  departments: Array<{ id: string; companyId: string; code: string; name: string; active?: boolean }>,
  users: User[]
): void => {
  liveDepartments = (departments || [])
    .filter(d => d.active !== false)
    .map(d => ({
      id: d.id,
      companyId: d.companyId,
      code: d.code,
      name: d.name,
    }));

  const expandedEmployees: Employee[] = [];
  for (const u of users || []) {
    const deptId = u.departmentId || '';
    const dept = liveDepartments.find(d => d.id === deptId);
    const primaryCompanyId = dept?.companyId || 'emp-copper-group';
    const accessList = Array.isArray(u.companyAccess) ? u.companyAccess : ['emp-copper-group'];

    if (accessList.includes('*')) {
      const companyIds = Array.from(new Set(liveDepartments.map(d => d.companyId)));
      for (const cid of companyIds.length > 0 ? companyIds : [primaryCompanyId]) {
        expandedEmployees.push({
          id: u.id,
          companyId: cid,
          departmentId: deptId,
          name: u.name,
          email: u.email,
          role: u.jobTitle || u.role,
          active: true,
        });
      }
    } else {
      for (const cid of accessList) {
        expandedEmployees.push({
          id: u.id,
          companyId: cid,
          departmentId: deptId,
          name: u.name,
          email: u.email,
          role: u.jobTitle || u.role,
          active: true,
        });
      }
    }
  }

  liveEmployees = expandedEmployees;
};

export const getDepartments = (companyId?: string | null): Department[] => {
  if (!companyId) return liveDepartments;
  const filtered = liveDepartments.filter(d => d.companyId === companyId);
  return filtered.length > 0 ? filtered : liveDepartments;
};

export const getEmployees = (companyId?: string | null): Employee[] => {
  if (!companyId) return liveEmployees;
  const filtered = liveEmployees.filter(e => e.companyId === companyId);
  // Deduplica por id caso o usuário tenha acesso curinga
  const seen = new Set<string>();
  return (filtered.length > 0 ? filtered : liveEmployees).filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
};

/** Colaboradores ativos de um departamento — os destinatários de uma rotina. */
export const getActiveEmployeesOfDepartment = (
  companyId: string | null | undefined,
  departmentId: string
): Employee[] =>
  getEmployees(companyId).filter(e => e.departmentId === departmentId && e.active);

export const getDepartmentName = (
  companyId: string | null | undefined,
  departmentId?: string
): string => {
  if (!departmentId) return '';
  return (
    getDepartments(companyId).find(d => d.id === departmentId)?.name ||
    liveDepartments.find(d => d.id === departmentId)?.name ||
    'Departamento'
  );
};
