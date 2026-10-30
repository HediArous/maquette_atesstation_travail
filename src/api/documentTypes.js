// API des types de documents du dossier employé (/api/document-types, RH-17), et correspondance avec le DocumentTypeDTO.
import { request } from './client';

/** Taille maximale d'un fichier par type de document, en Mo (backend : DocumentType). */
export const DEFAULT_MAX_SIZE_MB = 10;
export const MAX_SIZE_MB_LIMIT = 25;

export const documentTypesApi = {
  /** `activeOnly` : seuls les types proposés à l'ajout d'un document. */
  list: (activeOnly = false) => request('GET', `/document-types${activeOnly ? '?activeOnly=true' : ''}`),
  create: (dto) => request('POST', '/document-types', dto),
  update: (id, dto) => request('PUT', `/document-types/${id}`, dto),
  setActive: (id, active) => request('PATCH', `/document-types/${id}/status`, { active }),
  remove: (id) => request('DELETE', `/document-types/${id}`),
};

/** Type → DocumentTypeDTO ; le code est attribué par le backend à la création (numéro de souche), jamais envoyé. */
export const toDocumentTypeDto = (t) => ({
  name: t.name.trim(),
  required: t.required,
  formats: t.formats,
  maxSizeMb: Number(t.maxSizeMb) || DEFAULT_MAX_SIZE_MB,
});

/** DocumentTypeDTO → type de la société `companyId` ; « archivé » = désactivé dans le backend. */
export const fromDocumentTypeDto = (dto, companyId) => ({
  id: dto.id,
  companyId,
  name: dto.name,
  code: dto.code,
  required: dto.required === true,
  formats: dto.formats ?? [],
  maxSizeMb: dto.maxSizeMb ?? DEFAULT_MAX_SIZE_MB,
  archived: dto.active === false,
});
