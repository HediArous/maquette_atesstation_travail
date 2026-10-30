// API des employés (/api/employees) et de la numérotation de leurs matricules (/api/employee-numbering),
// et correspondance entre la fiche du frontend et l'EmployeeDTO du backend.
import { request } from './client';

export const employeesApi = {
  list: () => request('GET', '/employees'),
  /**
   * Liste paginée, recherchée et filtrée côté serveur : { content, page, size, totalElements, totalPages }.
   * Critères vides ignorés. Avec une restriction `ids`, les critères partent en JSON (POST) : une longue liste
   * d'identifiants dépasserait la longueur maximale d'une URL.
   */
  search: (criteria) => {
    const params = Object.fromEntries(Object.entries(criteria).filter(([, v]) => v !== '' && v != null));
    if (params.ids) return request('POST', '/employees/search', params);
    return request('GET', `/employees/search?${new URLSearchParams(params)}`);
  },
  create: (dto) => request('POST', '/employees', dto),
  /** Mise à jour partielle : seuls les champs présents dans `changes` sont modifiés (null = effacer). */
  patch: (id, changes) => request('PATCH', `/employees/${id}`, changes),
  remove: (id) => request('DELETE', `/employees/${id}`),
};

/** Statuts paramétrables (/api/employee-statuses) : [{ id, value, isActive }]. */
export const statusesApi = {
  list: (activeOnly = false) => request('GET', `/employee-statuses${activeOnly ? '?activeOnly=true' : ''}`),
  create: (dto) => request('POST', '/employee-statuses', dto),
  update: (id, dto) => request('PUT', `/employee-statuses/${id}`, dto),
  setActive: (id, isActive) => request('PATCH', `/employee-statuses/${id}/status`, { isActive }),
  remove: (id) => request('DELETE', `/employee-statuses/${id}`),
};

/** Statut historique de la fiche (essai / actif / inactif) déduit du libellé du statut paramétrable. */
export const legacyStatus = (value) => (!value ? undefined : value === 'Actif' ? 'actif' : /essai/i.test(value) ? 'essai' : 'inactif');

/** Souche : { prefix, separator, withYear, digits, next }. */
export const numberingApi = {
  get: () => request('GET', '/employee-numbering'),
  update: (numbering) => request('PUT', '/employee-numbering', numbering),
};

/**
 * Champs de la fiche portés par l'entité Employee (dont le rattachement : département, sous-département, N+1 et suivi du
 * circuit d'approbation). Les autres (société, fonction, contrat, rémunération, compte,
 * historique…) n'ont pas encore d'API : ils restent conservés dans le navigateur, rattachés à l'identifiant de l'employé.
 */
const BACKEND_FIELDS = [
  'cin', 'cinIssueDate', 'haveCnss', 'cnss', 'gender', 'firstName', 'lastName', 'email', 'phone', 'birthDate', 'address', 'maritalStatus', 'childrenCount',
  'hireDate', 'matricule', 'jobTitle', 'internalNumber', 'statusId', 'statusValue', 'phoneCountryId',
  'departmentId', 'subDepartmentId', 'managerId', 'followsLeaveCircuit',
  // Portés par /api/employee-primes (RH-8) : jamais conservés dans le navigateur.
  'allowPrimes', 'primes',
];

/** Partie locale d'une fiche : tout sauf les champs du backend. */
export const localPart = (e) => Object.fromEntries(Object.entries(e).filter(([k]) => !BACKEND_FIELDS.includes(k)));

const optional = (v) => (typeof v === 'string' ? v.trim() || null : v ?? null);

/** Fiche → EmployeeDTO. Le matricule n'est jamais envoyé : le backend l'attribue à la création et le conserve ensuite. */
export function toDto(e, jobTitle) {
  return {
    cin: optional(e.cin),
    cinIssueDate: e.cinIssueDate || null,
    haveCnss: !!e.haveCnss,
    cnss: e.haveCnss ? optional(e.cnss) : null,
    gender: optional(e.gender),
    firstName: e.firstName.trim(),
    lastName: e.lastName.trim(),
    email: optional(e.email),
    adresse: optional(e.address),
    phone: optional(e.phone),
    phoneCountryId: e.phoneCountryId ? Number(e.phoneCountryId) : null,
    dateOfBirth: e.birthDate || null,
    maritalStatus: e.maritalStatus,
    numberOfChildren: e.childrenCount,
    isActive: e.status !== 'inactif',
    hireDate: e.hireDate || null,
    jobTitle: optional(jobTitle),
    internalNumber: optional(e.internalNumber),
    statusId: e.statusId ? Number(e.statusId) : null,
    departmentId: e.departmentId || null,
    subDepartmentId: e.subDepartmentId || null,
    managerId: e.managerId || null,
    followsLeaveCircuit: e.followsLeaveCircuit !== false,
  };
}

/** EmployeeDTO → champs de la fiche. « Inactif » vient du backend (isActive) ; « période d'essai » reste une précision locale. */
export function fromDto(dto, localStatus) {
  return {
    id: dto.id,
    cin: dto.cin ?? '',
    cinIssueDate: dto.cinIssueDate ?? '',
    haveCnss: !!dto.haveCnss,
    cnss: dto.cnss ?? '',
    gender: dto.gender ?? undefined,
    firstName: dto.firstName ?? '',
    lastName: dto.lastName ?? '',
    email: dto.email ?? '',
    address: dto.adresse ?? '',
    phone: dto.phone ?? '',
    phoneCountryId: dto.phoneCountryId != null ? String(dto.phoneCountryId) : undefined,
    birthDate: dto.dateOfBirth ?? '',
    maritalStatus: dto.maritalStatus || 'celibataire',
    childrenCount: dto.numberOfChildren ?? 0,
    hireDate: dto.hireDate ?? '',
    matricule: dto.applicationNumber ?? '',
    jobTitle: dto.jobTitle ?? '',
    internalNumber: dto.internalNumber ?? undefined,
    statusId: dto.statusId ?? undefined,
    statusValue: dto.statusValue ?? undefined,
    departmentId: dto.departmentId ?? '',
    subDepartmentId: dto.subDepartmentId ?? undefined,
    managerId: dto.managerId ?? undefined,
    followsLeaveCircuit: dto.followsLeaveCircuit !== false,
    status: legacyStatus(dto.statusValue) ?? (dto.isActive === false ? 'inactif' : localStatus === 'essai' ? 'essai' : 'actif'),
  };
}

/** Champs de l'EmployeeDTO (propriété « field » des erreurs du backend) → champs de la fiche. */
export const EMPLOYEE_FIELDS = { dateOfBirth: 'birthDate', adresse: 'address', numberOfChildren: 'childrenCount' };
