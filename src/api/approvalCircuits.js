// API des circuits d'approbation de la société (/api/approval-circuits, RH-22), et correspondance avec l'ApprovalCircuitDTO.
import { request } from './client';
import { TODAY } from '../utils/dates';

const q = (companyId) => `companyId=${encodeURIComponent(companyId)}`;

export const approvalCircuitsApi = {
  /** Circuits de la société, actifs et archivés, avec l'historique de leurs versions. */
  list: (companyId) => request('GET', `/approval-circuits?${q(companyId)}`),
  create: (dto) => request('POST', '/approval-circuits', dto),
  update: (id, dto) => request('PUT', `/approval-circuits/${id}`, dto),
  setActive: (companyId, id, active) => request('PATCH', `/approval-circuits/${id}/status?${q(companyId)}`, { active }),
};

/** Type d'approbateur : frontend ↔ backend. */
const KIND_TO_API = { manager: 'MANAGER', departmentHead: 'DEPARTMENT_HEAD', employee: 'EMPLOYEE' };
const KIND_FROM_API = Object.fromEntries(Object.entries(KIND_TO_API).map(([k, v]) => [v, k]));

/** Type d'intervention d'une étape (indépendant de la notification) : frontend ↔ backend. */
export const INTERVENTION_LABEL = {
  validation: 'Validation requise (bloquant)',
  consultation: 'Consultation seule (pour info)',
};
const INTERVENTION_TO_API = { validation: 'VALIDATION', consultation: 'CONSULTATION' };

export const KIND_LABEL = {
  manager: 'Manager direct (N+1)',
  departmentHead: 'Responsable du département',
  employee: 'Personne nommée',
};

const fromStep = (s) => ({
  kind: KIND_FROM_API[s.approverType] ?? 'employee',
  employeeId: s.employeeId ?? undefined,
  notify: s.notifyApprover === true,
  intervention: s.interventionType === 'CONSULTATION' ? 'consultation' : 'validation',
  label: KIND_LABEL[KIND_FROM_API[s.approverType]] ?? KIND_LABEL.employee,
});

/**
 * Circuit → ApprovalCircuitDTO. Avec `replacesId`, le circuit remplace (et archive) celui du département à partir de sa
 * date d'effet ; `versionEffectiveFrom` : date d'effet de la nouvelle version si les étapes changent.
 */
export const toApprovalCircuitDto = (c, companyId) => ({
  companyId,
  name: c.name.trim(),
  departmentId: c.departmentId,
  steps: c.steps.map((s) => ({
    approverType: KIND_TO_API[s.kind],
    employeeId: s.kind === 'employee' ? s.employeeId || null : null,
    notifyApprover: !!s.notify,
    interventionType: INTERVENTION_TO_API[s.intervention] ?? 'VALIDATION',
  })),
});

/**
 * ApprovalCircuitDTO → circuit. `steps` : étapes de la version en vigueur aujourd'hui (à défaut, la première) ;
 * « archivé » = désactivé dans le backend (un circuit remplacé reste applicable jusqu'à la veille du remplacement).
 */
export function fromApprovalCircuitDto(dto) {
  const versions = (dto.versions ?? []).map((v) => ({
    number: v.number,
    effectiveFrom: v.effectiveFrom,
    createdAt: v.createdAt,
    steps: (v.steps ?? []).map(fromStep),
  }));
  const current = [...versions].reverse().find((v) => v.effectiveFrom <= TODAY) ?? versions[0];
  return {
    id: dto.id,
    companyId: dto.companyId,
    name: dto.name,
    departmentId: dto.departmentId,
    effectiveFrom: dto.effectiveFrom,
    effectiveTo: dto.effectiveTo ?? undefined,
    replacedById: dto.replacedById ?? undefined,
    archived: dto.active === false,
    versions,
    version: current?.number ?? 1,
    steps: current?.steps ?? [],
  };
}
