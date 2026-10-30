// API des types de contrat (/api/type-contracts), et correspondance avec le TypeContractDTO.
import { request } from './client';

export const typeContractsApi = {
  /** `activeOnly` : seuls les types proposés pour un nouveau contrat. */
  list: (activeOnly = false) => request('GET', `/type-contracts${activeOnly ? '?activeOnly=true' : ''}`),
  get: (id) => request('GET', `/type-contracts/${id}`),
  create: (dto) => request('POST', '/type-contracts', dto),
  update: (id, dto) => request('PUT', `/type-contracts/${id}`, dto),
  setActive: (id, etat) => request('PATCH', `/type-contracts/${id}/status`, { etat }),
  remove: (id) => request('DELETE', `/type-contracts/${id}`),
};

/** Type → TypeContractDTO ; le code est attribué par le backend à la création (numéro de souche), jamais envoyé. */
export const toTypeContractDto = (t) => ({
  nom: t.name.trim(),
  duree: t.fixedTerm,
  renouvelable: t.renewable,
  periodeEssai: t.trialMonths,
});

/** TypeContractDTO → type de la société `companyId` ; « archivé » = désactivé dans le backend. */
export const fromTypeContractDto = (dto, companyId) => ({
  id: dto.id,
  companyId,
  code: dto.code,
  name: dto.nom,
  fixedTerm: dto.duree === true,
  renewable: dto.renouvelable === true,
  trialMonths: dto.periodeEssai ?? 0,
  contractCount: dto.nombreContrats ?? 0,
  archived: dto.etat === false,
});
