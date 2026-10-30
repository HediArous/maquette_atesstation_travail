// API des accès RH des employés (/api/employee-access, RH-19) : rôle, permissions ajoutées hors rôle et permissions du rôle
// retirées. Permissions effectives = rôle + ajouts − retraits (calculées par le backend).
import { request } from './client';

const q = (companyId) => `companyId=${encodeURIComponent(companyId)}`;

/** Utilisateur de la session : employé lié au compte Core connecté et ses permissions effectives (GET /api/session/me). */
export const currentUserApi = { get: () => request('GET', '/session/me') };

export const employeeAccessApi = {
  /** Accès des employés dont le rôle appartient à la société. */
  list: (companyId) => request('GET', `/employee-access?${q(companyId)}`),
  get: (employeeId) => request('GET', `/employee-access/${employeeId}`),
  update: (companyId, employeeId, access) => request('PUT', `/employee-access/${employeeId}?${q(companyId)}`, {
    roleId: access.roleId || null,
    added: access.extraPermissions ?? [],
    removed: access.removedPermissions ?? [],
  }),
  /** Comptes du Core Tenant rattachés à l'Application RH dans la société, avec l'employé déjà lié à chacun. */
  coreUsers: (companyId) => request('GET', `/employee-access/core-users?${q(companyId)}`),
  /** Lie l'employé à un compte du Core Tenant (connexion avec ses identifiants Core) ; null délie le compte. */
  linkCoreAccount: (companyId, employeeId, coreUserId) =>
    request('PUT', `/employee-access/${employeeId}/core-account?${q(companyId)}`, { coreUserId: coreUserId || null }),
};

/** EmployeeAccessDTO → champs d'accès du profil employé. */
export const fromEmployeeAccessDto = (dto) => ({
  roleId: dto.roleId ?? '',
  extraPermissions: dto.added ?? [],
  removedPermissions: dto.removed ?? [],
  coreUserId: dto.coreUserId ?? '',
});

/** Nom affiché d'un compte du Core Tenant. */
export const coreUserLabel = (u) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
