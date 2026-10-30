// API des rôles RH de la société (/api/roles, RH-18) et du catalogue des permissions (/api/permissions).
import { request } from './client';

const q = (companyId) => `companyId=${encodeURIComponent(companyId)}`;

export const rolesApi = {
  /** Rôles de la société, actifs et archivés ; le backend crée les rôles système à la première lecture. */
  list: (companyId) => request('GET', `/roles?${q(companyId)}`),
  create: (dto) => request('POST', '/roles', dto),
  update: (id, dto) => request('PUT', `/roles/${id}`, dto),
  setActive: (companyId, id, active) => request('PATCH', `/roles/${id}/status?${q(companyId)}`, { active }),
};

/** Catalogue : [{ key, label, group }]. */
export const permissionsApi = {
  list: () => request('GET', '/permissions'),
};

/** Rôle → RoleDTO (l'archivage passe par setActive). */
export const toRoleDto = (r, companyId) => ({
  companyId,
  name: r.name.trim(),
  description: r.description?.trim() || null,
  permissions: [...r.permissions],
});

/** RoleDTO → rôle ; « archivé » = désactivé dans le backend. */
export const fromRoleDto = (dto) => ({
  id: dto.id,
  companyId: dto.companyId,
  name: dto.name,
  description: dto.description ?? '',
  permissions: dto.permissions ?? [],
  archived: dto.active === false,
  /** Nombre d'employés à qui le rôle est affecté (RH-19). */
  users: dto.users ?? 0,
});
