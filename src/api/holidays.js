// API des jours fériés de la société (/api/holidays, RH-20), et correspondance avec le HolidayDTO.
import { request } from './client';

const q = (companyId) => `companyId=${encodeURIComponent(companyId)}`;

export const holidaysApi = {
  /** Jours fériés de la société, actifs et archivés. */
  list: (companyId) => request('GET', `/holidays?${q(companyId)}`),
  create: (dto) => request('POST', '/holidays', dto),
  update: (id, dto) => request('PUT', `/holidays/${id}`, dto),
  setActive: (companyId, id, active) => request('PATCH', `/holidays/${id}/status?${q(companyId)}`, { active }),
};

/** Jour férié → HolidayDTO (l'archivage passe par setActive). */
export const toHolidayDto = (h, companyId) => ({
  companyId,
  name: h.name.trim(),
  date: h.date,
  days: Number(h.days) || 1,
  recurring: !!h.recurring,
  toConfirm: !h.recurring && !!h.toConfirm,
});

/** HolidayDTO → jour férié ; « archivé » = désactivé dans le backend. */
export const fromHolidayDto = (dto) => ({
  id: dto.id,
  companyId: dto.companyId,
  name: dto.name,
  date: dto.date,
  days: dto.days ?? 1,
  recurring: dto.recurring === true,
  archived: dto.active === false,
  /** Date estimée (fête religieuse reportée), à confirmer à l'annonce officielle. */
  toConfirm: dto.toConfirm === true,
});
