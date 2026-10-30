// API des contrats des employés (/api/contracts), et correspondance avec le ContractDTO.
import { request } from './client';
import { addDays, plusMonths } from '../utils/dates';

export const contractsApi = {
  list: () => request('GET', '/contracts'),
  /**
   * Liste paginée, recherchée et filtrée côté serveur : { content, page, size, totalElements, totalPages, archivedCount }.
   * Critères vides ignorés ; envoyés en JSON (POST) car la liste `employeeIds` dépasserait la longueur d'une URL.
   */
  search: (criteria) => request('POST', '/contracts/search',
    Object.fromEntries(Object.entries(criteria).filter(([, v]) => v !== '' && v != null))),
  get: (id) => request('GET', `/contracts/${id}`),
  create: (dto) => request('POST', '/contracts', dto),
  update: (id, dto) => request('PUT', `/contracts/${id}`, dto),
  setActive: (id, etat) => request('PATCH', `/contracts/${id}/status`, { etat }),
  /** Suspend le contrat et passe l'employé au statut `statusType` (SUSPENDU, DEMISSIONNAIRE, LICENCIE, RETRAITE, DECEDE). */
  suspend: (id, statusType) => request('PATCH', `/contracts/${id}/suspend`, { statusType }),
  remove: (id) => request('DELETE', `/contracts/${id}`),
};

/** Formulaire → ContractDTO ; dates ISO (aaaa-mm-jj), une date vide part à null. */
export const toContractDto = (f) => ({
  employeeId: f.employeeId,
  typeContractId: f.typeContractId,
  contractStart: f.start,
  contractEnd: f.end || null,
  periodeEssai: f.trialMonths,
  etat: f.active,
});

/** ContractDTO → contrat affiché. `trialMonths` = durée de l'essai en mois ; `trialEnd` = date de FIN de l'essai (déduite). */
export const fromContractDto = (dto) => ({
  id: dto.id,
  employeeId: dto.employeeId,
  employeeName: dto.employeeName,
  typeContractId: dto.typeContractId,
  typeCode: dto.typeContractCode,
  typeName: dto.typeContractNom,
  fixedTerm: dto.duree === true,
  start: dto.contractStart,
  end: dto.contractEnd ?? '',
  trialMonths: dto.periodeEssai ?? null,
  trialEnd: dto.dateEssai ?? '',
  active: dto.etat !== false,
  suspended: dto.suspendu === true,
  // Statut temporel calculé par le backend : PAS_ENCORE | EN_COURS | SUSPENDU | TERMINE.
  status: dto.statut ?? null,
});


/** Fin de période d'essai proposée : début + N mois − 1 jour (même règle que le backend) ; '' sans période d'essai. */
export const defaultTrialEnd = (start, months) => (start && months > 0 ? addDays(plusMonths(start, months), -1) : '');

/**
 * Premier contrat de `contracts` dont la période (hors contrats suspendus, qui ne bloquent pas) (inclusive, fin vide = ouverte) partage un jour avec [start, end].
 * Indication immédiate seulement : le backend fait la vérification finale.
 */
export function overlappingContract(contracts, { id, employeeId, start, end }) {
  if (!employeeId || !start) return undefined;
  const until = end || '9999-12-31';
  return contracts.find((c) => c.id !== id && !c.suspended && c.employeeId === employeeId && c.start <= until && (!c.end || c.end >= start));
}
