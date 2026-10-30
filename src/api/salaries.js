// API des salaires des employés (/api/salaries), et correspondance avec le SalaryDTO.
import { request } from './client';

export const salariesApi = {
  list: () => request('GET', '/salaries'),
  /** Liste paginée et recherchée côté serveur : { content, page, size, totalElements, totalPages, archivedCount }. Critères vides ignorés. */
  search: (criteria) => request('POST', '/salaries/search',
    Object.fromEntries(Object.entries(criteria).filter(([, v]) => v !== '' && v != null))),
  get: (id) => request('GET', `/salaries/${id}`),
  create: (dto) => request('POST', '/salaries', dto),
  update: (id, dto) => request('PUT', `/salaries/${id}`, dto),
  setActive: (id, etat) => request('PATCH', `/salaries/${id}/status`, { etat }),
  remove: (id) => request('DELETE', `/salaries/${id}`),
};

/** Formulaire → SalaryDTO ; dates ISO (aaaa-mm-jj), une date de fin vide part à null. */
export const toSalaryDto = (f) => ({
  employeeId: f.employeeId,
  startDate: f.start,
  endDate: f.end || null,
  amount: f.amount,
  etat: f.active,
  // Absente : devise déjà enregistrée sur le salaire, sinon devise active (backend).
  deviseId: f.deviseId ? Number(f.deviseId) : null,
});

/** SalaryDTO → salaire affiché. */
export const fromSalaryDto = (dto) => ({
  id: dto.id,
  employeeId: dto.employeeId,
  employeeName: dto.employeeName,
  start: dto.startDate,
  end: dto.endDate ?? '',
  amount: dto.amount == null ? null : Number(dto.amount),
  active: dto.etat !== false,
  deviseId: dto.deviseId == null ? '' : String(dto.deviseId),
  // Devise historique du salaire, pour formatAmount ; undefined si le salaire n'en a pas.
  devise: dto.deviseId == null ? undefined
    : { id: String(dto.deviseId), symbol: dto.deviseSymbole, code: dto.deviseCodeISO, decimals: dto.deviseChiffreApresVirgule },
});
