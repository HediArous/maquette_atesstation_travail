// API des fonctions (/api/job-positions) et correspondance avec le JobPositionDTO.
// Le code est attribué par le backend à la création (numéro de souche « fonction ») et ne change plus.
import { request } from './client';

export const jobPositionsApi = {
  list: () => request('GET', '/job-positions'),
  create: (dto) => request('POST', '/job-positions', dto),
  update: (id, dto) => request('PUT', `/job-positions/${id}`, dto),
  setActive: (id, active) => request('PATCH', `/job-positions/${id}/status`, { active }),
  remove: (id) => request('DELETE', `/job-positions/${id}`),
};

const TO_TYPE = { solo: 'SOLO', groupe: 'GROUP' };
const FROM_TYPE = { SOLO: 'solo', GROUP: 'groupe' };

/** Fonction → JobPositionDTO : seuls les champs du type d'intérim choisi sont envoyés (le backend vérifie les mêmes règles). */
export const toJobPositionDto = (f) => ({
  name: f.name.trim(),
  departmentId: f.departmentId || null,
  isInterim: !!f.interim,
  interimType: f.interim ? TO_TYPE[f.kind] : null,
  minimumPresence: f.interim && f.kind === 'groupe' ? f.minPresent ?? null : null,
  relatedSoloJobPositionId: f.interim && f.kind === 'solo' ? f.relatedFunctionId || null : null,
});

/** JobPositionDTO → fonction ; « archivée » = désactivée dans le backend. */
export const fromJobPositionDto = (dto) => ({
  id: dto.id,
  name: dto.name,
  code: dto.code,
  departmentId: dto.departmentId ?? undefined,
  interim: !!dto.isInterim,
  kind: FROM_TYPE[dto.interimType] ?? 'solo',
  minPresent: dto.minimumPresence ?? undefined,
  relatedFunctionId: dto.relatedSoloJobPositionId ?? undefined,
  archived: dto.active === false,
});
