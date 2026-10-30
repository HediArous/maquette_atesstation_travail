// API du catalogue des primes (/api/primes, RH-25) et des primes des employés (/api/employee-primes, RH-8).
import { request } from './client';

const q = (companyId) => `companyId=${encodeURIComponent(companyId)}`;

export const primesApi = {
  /** Catalogue de la société, primes actives et archivées, avec leur nombre d'attributions. */
  list: (companyId) => request('GET', `/primes?${q(companyId)}`),
  create: (dto) => request('POST', '/primes', dto),
  update: (id, dto) => request('PUT', `/primes/${id}`, dto),
  setActive: (companyId, id, active) => request('PATCH', `/primes/${id}/status?${q(companyId)}`, { active }),
  /** Refusée (409) tant que la prime est attribuée à un employé. */
  remove: (companyId, id) => request('DELETE', `/primes/${id}?${q(companyId)}`),
};

export const employeePrimesApi = {
  /** Employés dont les primes sont autorisées ou qui ont une prime du catalogue de la société. */
  list: (companyId) => request('GET', `/employee-primes?${q(companyId)}`),
  /** Retirer l'autorisation révoque toutes les primes attribuées. */
  setAllowed: (employeeId, allowed) => request('PUT', `/employee-primes/${employeeId}/authorization`, { allowed }),
  assign: (companyId, employeeId, primeId, since) => request('POST', `/employee-primes/${employeeId}?${q(companyId)}`, { primeId, since }),
  remove: (employeeId, primeId) => request('DELETE', `/employee-primes/${employeeId}/${primeId}`),
};

/** Prime → PrimeDTO ; le code est attribué par le backend à la création (numéro de souche), jamais envoyé. */
export const toPrimeDto = (p, companyId) => ({
  companyId,
  name: p.name.trim(),
  type: p.type.toUpperCase(),
  amount: Number(p.amount),
});

/** PrimeDTO → prime du catalogue ; « archivée » = désactivée dans le backend. */
export const fromPrimeDto = (dto) => ({
  id: dto.id,
  companyId: dto.companyId,
  name: dto.name,
  code: dto.code,
  type: String(dto.type ?? '').toLowerCase(),
  amount: Number(dto.amount),
  assignments: dto.assignments ?? 0,
  archived: dto.active === false,
});

/** EmployeePrimesDTO → { allowPrimes, primes: [{ id, primeId, since }] } de la fiche employé. */
export const fromEmployeePrimesDto = (dto) => ({
  allowPrimes: dto.allowPrimes === true,
  primes: (dto.primes ?? []).map((p) => ({ id: p.id, primeId: p.primeId, since: p.since })),
});
