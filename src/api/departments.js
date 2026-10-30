// API des départements et sous-départements (/api/departments, RH-14), et correspondance avec le DepartmentDTO.
import { request } from './client';

export const departmentsApi = {
  list: () => request('GET', '/departments'),
  create: (dto) => request('POST', '/departments', dto),
  update: (id, dto) => request('PUT', `/departments/${id}`, dto),
  setActive: (id, active) => request('PATCH', `/departments/${id}/status`, { active }),
};

/**
 * Champs portés par le backend : ceux de l'entité Department, et l'horaire organisationnel (`scheduleId`), déduit des
 * affectations de scénarios (/api/work-schedules, RH-21).
 */
const BACKEND_FIELDS = ['name', 'code', 'parentId', 'headId', 'archived', 'scheduleId'];

/** Partie locale d'un département : tout sauf les champs du backend. */
export const localDepartmentPart = (d) => Object.fromEntries(Object.entries(d).filter(([k]) => !BACKEND_FIELDS.includes(k)));

/** Département → DepartmentDTO (l'activation passe par setActive). */
export const toDepartmentDto = (d) => ({
  name: d.name.trim(),
  code: d.code.trim().toUpperCase(),
  parentId: d.parentId || null,
  headId: d.headId || null,
});

/** DepartmentDTO → champs du département ; « archivé » = désactivé dans le backend. */
export const fromDepartmentDto = (dto) => ({
  id: dto.id,
  name: dto.name,
  code: dto.code,
  parentId: dto.parentId ?? undefined,
  headId: dto.headId ?? undefined,
  archived: dto.active === false,
});
