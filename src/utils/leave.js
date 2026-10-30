// Calculs des congés : décompte des jours, soldes, conflits d'événements, profils dérivés.
import { eachDay, overlaps, YEAR } from './dates';
import { approversFor, circuitOfEmployee, holidayOn, isWorkingDay, rootDepartment, scheduleOn } from './org';

export const profileOf = (db, employeeId) =>
  db.profiles.find((p) => p.employeeId === employeeId);

/**
 * Décompte d'un congé en jours.
 * Retour : { calendarDays, nonWorkingDays, holidays: [{ date, name }], halfDayDeduction, total }.
 */
export function countLeaveDays(db, employeeId, start, end, startPart, endPart) {
  const empty = { calendarDays: 0, nonWorkingDays: 0, holidays: [], halfDayDeduction: 0, total: 0 };
  const profile = profileOf(db, employeeId);
  const employee = db.employees.find((e) => e.id === employeeId);
  if (!profile || !employee || !start || !end || end < start) return empty;
  // Jours travaillés selon l'horaire en vigueur chaque jour (il peut changer d'une période de chargement à l'autre).
  const isWorkDay = (d) => isWorkingDay(db, employee, d);
  const days = eachDay(start, end);
  let nonWorking = 0;
  const holidays = [];
  const counted = [];
  for (const d of days) {
    // Jour férié actif de la société (ponctuel ou annuel) : non décompté ; un jour férié archivé n'est plus appliqué.
    const holiday = isWorkDay(d) && holidayOn(db, profile.companyId, d);
    if (!isWorkDay(d)) nonWorking++;
    else if (holiday) holidays.push({ date: d, name: holiday.name });
    else counted.push(d);
  }
  let deduction = 0;
  if (start === end) {
    if (startPart !== 'full' && counted.includes(start)) deduction = 0.5;
  } else {
    if (startPart === 'pm' && counted.includes(start)) deduction += 0.5;
    if (endPart === 'am' && counted.includes(end)) deduction += 0.5;
  }
  return { calendarDays: days.length, nonWorkingDays: nonWorking, holidays, halfDayDeduction: deduction, total: Math.max(0, counted.length - deduction) };
}

/** Type de référence portant le solde annuel d'une société (ex. « Congé annuel »). */
export function annualReferenceType(db, companyId) {
  return db.leaveTypes.find((t) => t.companyId === companyId && t.annualReference && !t.archived)
    ?? db.leaveTypes.find((t) => t.companyId === companyId && t.annualReference);
}

function sumDays(db, employeeId, match, excludeRequestId) {
  const reqs = db.requests.filter((r) => r.employeeId === employeeId && match(r.leaveTypeId) && r.id !== excludeRequestId && r.start.startsWith(YEAR));
  return {
    taken: reqs.filter((r) => r.status === 'approuve').reduce((s, r) => s + r.days, 0),
    pending: reqs.filter((r) => r.status === 'en_attente').reduce((s, r) => s + r.days, 0),
  };
}

/**
 * Solde annuel : quota du type de référence + report, moins tous les types « déduits du solde annuel ».
 * Retour : { scope: 'annuel' | 'propre' | 'aucun', tracked, label, acquired, taken, pending, available }.
 */
export function getAnnualBalance(db, employeeId, excludeRequestId) {
  const companyId = db.employees.find((e) => e.id === employeeId)?.companyId ?? '';
  const ref = annualReferenceType(db, companyId);
  const rule = ref && db.leaveRules.find((r) => r.leaveTypeId === ref.id && !r.archived);
  const acquired = (rule?.annualQuota ?? 0) + (ref ? profileOf(db, employeeId)?.carryOver[ref.id] ?? 0 : 0);
  const deducting = new Set(db.leaveTypes.filter((t) => t.companyId === companyId && t.deductsFromAnnual).map((t) => t.id));
  const { taken, pending } = sumDays(db, employeeId, (id) => deducting.has(id), excludeRequestId);
  return { scope: 'annuel', tracked: !!rule, label: 'Solde annuel', acquired, taken, pending, available: acquired - taken - pending };
}

/** Solde applicable à un type : le solde annuel s'il y est imputé, sinon son plafond propre éventuel. */
export function getBalance(db, employeeId, leaveTypeId, excludeRequestId) {
  const type = db.leaveTypes.find((t) => t.id === leaveTypeId);
  if (type?.deductsFromAnnual) return getAnnualBalance(db, employeeId, excludeRequestId);
  const rule = db.leaveRules.find((r) => r.leaveTypeId === leaveTypeId && !r.archived);
  if (!type?.tracked || rule?.annualQuota == null) {
    return { scope: 'aucun', tracked: false, label: type?.name ?? '', acquired: 0, taken: 0, pending: 0, available: 0 };
  }
  const acquired = rule.annualQuota + (profileOf(db, employeeId)?.carryOver[leaveTypeId] ?? 0);
  const { taken, pending } = sumDays(db, employeeId, (id) => id === leaveTypeId, excludeRequestId);
  return { scope: 'propre', tracked: true, label: type.name, acquired, taken, pending, available: acquired - taken - pending };
}

/** Compteurs à afficher pour un employé : solde annuel puis plafonds propres. */
export function balanceTypes(db, companyId) {
  const ref = annualReferenceType(db, companyId);
  const own = db.leaveTypes.filter((t) => t.companyId === companyId && !t.archived && !t.deductsFromAnnual && t.tracked
    && db.leaveRules.some((r) => r.leaveTypeId === t.id && !r.archived && r.annualQuota != null));
  return { ref, own };
}

export function eventTargets(ev, person) {
  return ev.allCompany || ev.departmentIds.includes(person.departmentId) || ev.employeeIds.includes(person.id);
}

export function findEventConflicts(db, employeeId, start, end) {
  const person = personView(db, employeeId);
  if (!person || !start || !end || end < start) return [];
  return db.events.filter(
    (ev) => ev.companyId === person.companyId && !ev.archived && ev.effect !== 'info' &&
      overlaps(ev.start, ev.end, start, end) && eventTargets(ev, person),
  );
}

export function currentStep(req) {
  return req.steps.find((s) => s.status === 'en_attente');
}

/** Approbateurs résolus à partir du circuit, du responsable et du département (saut automatique : voir utils/org). */
export function resolveApprovers(db, employeeId, circuitId) {
  return approversFor(db, employeeId, db.circuits.find((c) => c.id === circuitId));
}

/** Vue enrichie d'un employé (noms de département et de fonction). */
export function toPersonView(db, e) {
  const dep = rootDepartment(db, e.departmentId);
  return {
    id: e.id, companyId: e.companyId, firstName: e.firstName, lastName: e.lastName, matricule: e.matricule, email: e.email,
    departmentId: e.departmentId, departmentName: dep?.name ?? '', departmentHeadId: dep?.headId,
    functionName: db.functions.find((f) => f.id === e.functionId)?.name ?? '',
    managerId: e.managerId, hireDate: e.hireDate, status: e.status,
  };
}

export function personView(db, id) {
  const e = db.employees.find((x) => x.id === id);
  return e ? toPersonView(db, e) : undefined;
}

/** Profil congé par défaut d'un nouvel employé ; horaire, circuit et approbateurs sont ensuite dérivés (deriveProfiles). */
export function defaultProfile(db, e) {
  const by = (l) => l.filter((x) => x.companyId === e.companyId && !x.archived);
  return {
    employeeId: e.id, companyId: e.companyId, scheduleId: '',
    roleId: by(db.roles).find((r) => r.name.startsWith('Employ') || r.name.startsWith('Salari'))?.id ?? by(db.roles)[0]?.id ?? '',
    extraPermissions: [], removedPermissions: [], circuitId: '', approverIds: [], carryOver: {},
  };
}

/**
 * Recalcule les champs dérivés des profils : horaire en vigueur, circuit du département et approbateurs (RH-6, RH-23).
 * Appelé après chaque modification de l'état : un changement de rattachement, de circuit ou de planification
 * s'applique ainsi partout sans saisie.
 */
export function deriveProfiles(db) {
  let changed = false;
  const profiles = db.profiles.map((p) => {
    const e = db.employees.find((x) => x.id === p.employeeId);
    if (!e) return p;
    const circuit = circuitOfEmployee(db, e);
    const next = {
      scheduleId: scheduleOn(db, e).schedule?.id ?? '',
      circuitId: circuit?.id ?? '',
      approverIds: approversFor(db, e.id, circuit),
    };
    if (next.scheduleId === p.scheduleId && next.circuitId === p.circuitId && next.approverIds.join() === p.approverIds.join()) return p;
    changed = true;
    return { ...p, ...next };
  });
  return changed ? { ...db, profiles } : db;
}
