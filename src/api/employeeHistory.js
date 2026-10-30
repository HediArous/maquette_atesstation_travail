// API de l'historique du dossier employé (/api/employees/{employeeId}/history…), en lecture seule,
// et correspondance avec l'EmployeeHistoryDTO. Les événements sont écrits par le backend à chaque modification.
import { request } from './client';

const base = (employeeId) => `/employees/${employeeId}`;
const clean = (criteria) => Object.fromEntries(Object.entries(criteria).filter(([, v]) => v !== '' && v != null));

export const employeeHistoryApi = {
  /**
   * Page d'historique recherchée côté serveur (même principe que la liste des employés) :
   * { content, page, size, totalElements, totalPages }. Critères : search, type, field, authorId, from, to, sort, direction.
   */
  search: (employeeId, criteria = {}) => request('POST', `${base(employeeId)}/history/search`, clean(criteria)),
  /** Options des filtres : { fields: [{ value, label }], authors: [{ value, label }] }. */
  filters: (employeeId) => request('GET', `${base(employeeId)}/history/filters`),
  /** Derniers événements (5 par défaut). */
  recent: (employeeId, limit = 5) => request('GET', `${base(employeeId)}/recent-activity?limit=${limit}`),
};

/** Types d'événement (EmployeeChangeType). */
export const HISTORY_TYPE_LABEL = { CREATION: 'Création', MODIFICATION: 'Modification', SUPPRESSION: 'Suppression' };
export const HISTORY_TYPE_TONE = { CREATION: 'success', MODIFICATION: 'info', SUPPRESSION: 'danger' };

/** EmployeeHistoryDTO → événement affiché ; `at` : horodatage « AAAA-MM-JJTHH:mm:ss ». */
export const fromEmployeeHistoryDto = (dto) => ({
  id: dto.id,
  at: dto.changeDate,
  type: dto.changeType,
  field: dto.fieldName,
  fieldLabel: dto.fieldLabel ?? dto.fieldName,
  label: dto.changeDescription,
  oldValue: dto.oldValue,
  newValue: dto.newValue,
  authorId: dto.modifiedById,
  authorName: dto.modifiedByName,
});
