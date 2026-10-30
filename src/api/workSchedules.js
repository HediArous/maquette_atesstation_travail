// API des scénarios d'horaires (/api/work-schedules, RH-21), et correspondance avec le WorkScheduleDTO.
import { request } from './client';

const q = (companyId) => `companyId=${encodeURIComponent(companyId)}`;

export const workSchedulesApi = {
  /** Scénarios de la société, actifs et archivés, avec l'historique de leurs affectations. */
  list: (companyId) => request('GET', `/work-schedules?${q(companyId)}`),
  create: (dto) => request('POST', '/work-schedules', dto),
  update: (id, dto) => request('PUT', `/work-schedules/${id}`, dto),
  /** Archivage : `replacementId` et `effectiveDate` sont exigés si le scénario est encore affecté. */
  setStatus: (companyId, id, body) => request('PATCH', `/work-schedules/${id}/status?${q(companyId)}`, body),
  /** Affectation depuis la fiche d'un département ; renvoie les scénarios de la société. */
  assignDepartment: (companyId, body) => request('PUT', `/work-schedules/department-assignment?${q(companyId)}`, body),
  /** Horaire spécial d'un employé ({ employeeId, scheduleId|null }) ; null = retour à l'horaire du département. */
  assignEmployee: (companyId, body) => request('PUT', `/work-schedules/employee-assignment?${q(companyId)}`, body),
};

/**
 * Scénario → WorkScheduleDTO. Horaire de département : `departmentIds` (à compter du début de la période) ;
 * horaire spécial : `employeeIds`. Un horaire n'est jamais des deux types.
 */
export const toScheduleDto = (s, departmentIds, employeeIds) => ({
  companyId: s.companyId,
  name: s.name.trim(),
  startDate: s.startDate,
  endDate: s.endDate,
  timezone: s.timezone,
  weeklyHours: Number(s.weeklyHours),
  slots: s.slots.map((x) => ({ label: x.label.trim(), start: x.start, end: x.end, days: [...(x.days ?? [])].sort() })),
  exceptionalOffDays: (s.exceptionalOffDays ?? []).map((o) => ({ date: o.date, label: o.label.trim(), departmentId: o.departmentId || null })),
  departmentSchedule: s.departmentSchedule !== false,
  departmentIds: s.departmentSchedule !== false ? departmentIds : [],
  employeeIds: s.departmentSchedule !== false ? [] : employeeIds ?? [],
});

/**
 * WorkScheduleDTO → scénario. `workDays` (jours couverts par un créneau) sert aux écrans qui ne lisent pas les
 * journées types ; « archivé » = désactivé dans le backend. Les jours exceptionnels reçoivent un identifiant d'affichage.
 */
export const fromScheduleDto = (dto) => {
  const slots = (dto.slots ?? []).map((x) => ({ label: x.label, start: x.start, end: x.end, days: x.days ?? [] }));
  return {
    id: dto.id,
    companyId: dto.companyId,
    name: dto.name,
    startDate: dto.startDate,
    endDate: dto.endDate,
    timezone: dto.timezone,
    weeklyHours: dto.weeklyHours,
    slots,
    workDays: [...new Set(slots.flatMap((x) => x.days))].sort(),
    departmentWorkDays: {},
    exceptionalOffDays: (dto.exceptionalOffDays ?? []).map((o, i) => ({ id: `x${i}-${o.date}`, date: o.date, label: o.label, departmentId: o.departmentId ?? undefined })),
    version: dto.version,
    archived: dto.active === false,
    // true = horaire de département ; false = horaire spécial d'employé (affecté à `employeeIds`).
    departmentSchedule: dto.departmentSchedule !== false,
    employeeIds: dto.employeeIds ?? [],
  };
};

/** Affectations du DTO : { id, scheduleId, departmentId, from, to? } (to vide = jusqu'à la fin du scénario). */
export const assignmentsOfDto = (dto) => (dto.assignments ?? []).map((a) => ({
  id: a.id, scheduleId: dto.id, departmentId: a.departmentId, from: a.effectiveFrom, to: a.effectiveTo ?? undefined,
}));
