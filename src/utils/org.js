// Règles métier du rattachement organisationnel : circuit hérité du département (RH-22, RH-23),
// horaire organisationnel ou tableau de chargement (RH-6, RH-21, RH-24 à RH-26), primes (RH-8, RH-27).
import { addDays, isoWeekday, TODAY } from './dates';

// ---------------------------------------------------------------- Départements

/** Département de premier niveau d'un département ou sous-département. */
export function rootDepartment(db, departmentId) {
  const d = db.departments.find((x) => x.id === departmentId);
  return d?.parentId ? db.departments.find((x) => x.id === d.parentId) : d;
}

export const subDepartmentsOf = (db, departmentId) =>
  db.departments.filter((d) => d.parentId === departmentId);

// ---------------------------------------------------------------- Circuit (RH-22, RH-23)

/** Le circuit s'applique-t-il à son département à cette date ? (du `effectiveFrom` au `effectiveTo` inclus) */

/** Version des étapes en vigueur à cette date : la plus récente déjà en effet (à défaut, la première). */
export const circuitVersionOn = (c, date = TODAY) =>
  [...(c?.versions ?? [])].reverse().find((v) => v.effectiveFrom <= date) ?? c?.versions?.[0];

/**
 * Circuit applicable au département (ou au département parent d'un sous-département) à cette date : un seul par
 * département à une date donnée (RH-22). Un circuit archivé par remplacement reste applicable jusqu'à la veille du
 * remplacement.
 */
/**
 * Circuit applicable à un département ou sous-département : le sien s'il en a un (actif), sinon celui de son département
 * parent. Un circuit s'applique dès sa création (plus de date d'effet).
 */
export function circuitForDepartment(db, departmentId) {
  let department = db.departments.find((d) => d.id === departmentId);
  while (department) {
    const own = db.circuits.find((c) => c.departmentId === department.id && !c.archived);
    if (own) return own;
    department = department.parentId ? db.departments.find((d) => d.id === department.parentId) : undefined;
  }
  return undefined;
}

/**
 * Circuit d'un employé : celui de son sous-département s'il en a un, sinon celui de son département. Aucun s'il ne suit
 * pas le circuit (option de sa fiche) : ses demandes sont alors validées par la RH.
 */
export const circuitOfEmployee = (db, e) => (e.followsLeaveCircuit === false ? undefined : circuitForDepartment(db, e.subDepartmentId ?? e.departmentId));

/** Le circuit a une étape de validation par le responsable N+1 du demandeur : celui-ci doit alors avoir un N+1 doté d'un compte. */
export const circuitRequiresManager = (circuit) => (circuit?.steps ?? [])
  .some((s) => s.kind === 'manager' && (s.intervention ?? 'validation') === 'validation');

/**
 * Étapes du circuit pour un employé (RH-23), d'après la version en vigueur à la date : approbateur résolu par niveau,
 * et saut automatique si le demandeur appartient au circuit — son niveau et les niveaux inférieurs sont sautés, la
 * demande part au niveau suivant.
 * Chaque étape : { label, approverId?, notify, intervention: 'validation' | 'consultation',
 * skipped?: 'requester' | 'below' | 'duplicate' | 'undefined' }.
 */
export function circuitStepsFor(db, employeeId, circuit, date = TODAY) {
  const e = db.employees.find((x) => x.id === employeeId);
  if (!e || !circuit) return [];
  const head = rootDepartment(db, e.subDepartmentId ?? e.departmentId)?.headId;
  const subHead = e.subDepartmentId ? db.departments.find((d) => d.id === e.subDepartmentId)?.headId : undefined;
  const steps = (circuitVersionOn(circuit, date)?.steps ?? circuit.steps ?? []).map((s) => ({
    label: s.label,
    notify: !!s.notify,
    intervention: s.intervention ?? 'validation',
    approverId: s.kind === 'manager' ? e.managerId : s.kind === 'departmentHead' ? (subHead ?? head) : s.employeeId,
  }));
  // Étape la plus élevée du demandeur : elle et toutes les étapes inférieures sont ignorées (il n'approuve jamais sa demande).
  const own = steps.map((s) => s.approverId).lastIndexOf(employeeId);
  const seen = new Set();
  return steps.map((s, i) => {
    if (own >= 0 && i < own) return { ...s, skipped: 'below' };
    if (i === own) return { ...s, skipped: 'requester' };
    if (!s.approverId) return { ...s, skipped: 'undefined' };
    if (seen.has(s.approverId)) return { ...s, skipped: 'duplicate' };
    seen.add(s.approverId);
    return s;
  });
}

/**
 * Approbateurs effectifs (étapes « Validation requise »), dans l'ordre. Vide = aucun approbateur supérieur : validation
 * automatique, historisée. Les étapes « Consultation seule » ne valident pas.
 */
export const approversFor = (db, employeeId, circuit, date = TODAY) =>
  circuitStepsFor(db, employeeId, circuit, date).filter((s) => !s.skipped && s.intervention !== 'consultation').map((s) => s.approverId);

// ---------------------------------------------------------------- Horaire (RH-6, RH-21, RH-24)

/**
 * Période où une affectation s'applique (RH-21) : de sa date d'effet à sa fin, bornée par la période du scénario.
 * Retour : { start, end } ou undefined si elle est vide.
 */
export function assignmentWindow(db, a) {
  const s = db.schedules.find((x) => x.id === a.scheduleId);
  if (!s) return undefined;
  const start = a.from > s.startDate ? a.from : s.startDate;
  const end = a.to && a.to < s.endDate ? a.to : s.endDate;
  return start <= end ? { start, end } : undefined;
}

/** Scénario affecté au (sous-)département à une date : un seul est applicable à la fois (RH-21). */
export function departmentScheduleOn(db, departmentId, date = TODAY) {
  if (!departmentId) return undefined;
  const a = (db.scheduleAssignments ?? []).find((x) => {
    if (x.departmentId !== departmentId) return false;
    const w = assignmentWindow(db, x);
    return w && w.start <= date && w.end >= date;
  });
  return a ? db.schedules.find((s) => s.id === a.scheduleId) : undefined;
}

/** Affectations en cours ou à venir d'un scénario. */
export const liveAssignments = (db, scheduleId, date = TODAY) =>
  (db.scheduleAssignments ?? []).filter((a) => a.scheduleId === scheduleId && (assignmentWindow(db, a)?.end ?? '') >= date);

/**
 * Horaire organisationnel à une date : celui du sous-département s'il en a un, sinon celui du département
 * (le sous-département hérite automatiquement).
 */
export function organisationalSchedule(db, departmentId, subDepartmentId, date = TODAY) {
  const sub = db.departments.find((d) => d.id === subDepartmentId);
  const own = sub && departmentScheduleOn(db, sub.id, date);
  if (own) return { schedule: own, source: `Sous-département « ${sub.name} »` };
  const dep = rootDepartment(db, departmentId);
  const inherited = dep && departmentScheduleOn(db, dep.id, date);
  if (inherited) return { schedule: inherited, source: `Département « ${dep.name} »` };
  return { source: 'Aucun horaire défini pour le rattachement' };
}

/** Horaire spécial actif de l'employé (horaire d'employé qui remplace celui de son département), sinon undefined. */
export const specialScheduleOf = (db, employeeId) =>
  db.schedules.find((s) => s.departmentSchedule === false && !s.archived && (s.employeeIds ?? []).includes(employeeId));

export const periodsOf = (db, employeeId) =>
  db.loadingPeriods.filter((p) => p.employeeId === employeeId).sort((a, b) => a.start.localeCompare(b.start));

/**
 * Horaire applicable à une date : planifié dans le tableau de chargement, sinon horaire spécial de l'employé, sinon hérité
 * du rattachement (département).
 * Retour : { schedule?, source, period?, special?, unplanned? }.
 */
export function scheduleOn(db, e, date = TODAY) {
  if (e.scheduleMode === 'chargement' && (!e.loadingSince || date >= e.loadingSince)) {
    const period = periodsOf(db, e.id).find((p) => p.start <= date && p.end >= date);
    // Une période garde la version du scénario utilisée à sa création (RH-21).
    const schedule = period?.scheduleSnapshot ?? db.schedules.find((s) => s.id === period?.scheduleId);
    return period && schedule
      ? { schedule, period, source: `Tableau de chargement — ${period.label}` }
      : { source: 'Tableau de chargement — non planifié', unplanned: true };
  }
  // Horaire spécial : remplace celui du département pour cet employé, pendant sa période d'application.
  const special = specialScheduleOf(db, e.id);
  if (special && special.startDate <= date && special.endDate >= date) return { schedule: special, special: true, source: `Horaire spécial « ${special.name} »` };
  return organisationalSchedule(db, e.departmentId, e.subDepartmentId, date);
}

/**
 * Jour travaillé selon l'horaire en vigueur : jours propres au (sous-)département s'il en a dans le scénario,
 * sinon jours par défaut ; un jour non travaillé exceptionnel du scénario est chômé (RH-21).
 */
export function isWorkingDay(db, e, date) {
  const { schedule, period } = scheduleOn(db, e, date);
  if (!schedule) return [1, 2, 3, 4, 5].includes(isoWeekday(date));
  const scope = period ? [] : [e.subDepartmentId, e.departmentId].filter((x) => !!x);
  const own = scope.map((id) => schedule.departmentWorkDays?.[id]).find(Boolean);
  if (!(own ?? schedule.workDays).includes(isoWeekday(date))) return false;
  return !(schedule.exceptionalOffDays ?? []).some((x) => x.date === date && (!x.departmentId || scope.includes(x.departmentId)));
}

/** Dernier jour de la période d'un jour férié commençant à `start` (`days` jours consécutifs, 1 par défaut). */
export const holidayEnd = (h, start = h.date) => addDays(start, Math.max(1, h.days || 1) - 1);

/**
 * La date tombe-t-elle dans la période du jour férié ? Ponctuel : cette période seulement ; annuel : mêmes jours et mêmes
 * mois chaque année (une période du 31/12 au 01/01 a pu commencer l'année précédente).
 */
export function holidayFallsOn(h, date) {
  const within = (start) => date >= start && date <= holidayEnd(h, start);
  if (!h.recurring) return within(h.date);
  const year = Number(date.slice(0, 4));
  return within(`${year}${h.date.slice(4)}`) || within(`${year - 1}${h.date.slice(4)}`);
}

/** Jour férié actif de la société à cette date (un jour férié archivé n'est plus appliqué). */
export const holidayOn = (db, companyId, date) =>
  db.holidays.find((h) => h.companyId === companyId && !h.archived && holidayFallsOn(h, date));

/**
 * Périodes non couvertes d'un employé en tableau de chargement, de `from` (au plus tôt sa date de bascule) jusqu'à
 * `horizon` jours plus tard (RH-24, RH-25). Sans période future, il reste « Non planifié » : aucun retour automatique.
 */
export function uncoveredRanges(db, e, from = TODAY, horizon = 30) {
  if (e.scheduleMode !== 'chargement') return [];
  const start = e.loadingSince && e.loadingSince > from ? e.loadingSince : from;
  const end = addDays(start, horizon - 1);
  const gaps = [];
  let cursor = start;
  for (const p of periodsOf(db, e.id)) {
    if (p.end < cursor) continue;
    if (p.start > end) break;
    if (p.start > cursor) gaps.push({ start: cursor, end: addDays(p.start, -1) });
    cursor = addDays(p.end, 1);
    if (cursor > end) break;
  }
  if (cursor <= end) gaps.push({ start: cursor, end });
  return gaps;
}

/** Période existante qui chevauche l'intervalle demandé (contrôle anti-chevauchement strict, RH-26). */
export const overlappingPeriod = (db, employeeId, start, end, exceptId) =>
  db.loadingPeriods.find((p) => p.employeeId === employeeId && p.id !== exceptId && start <= p.end && end >= p.start);

/**
 * Utilisation d'un horaire : départements et sous-départements (affectation en cours ou à venir) et périodes du tableau
 * de chargement à venir. Seuls les départements exigent un remplacement à l'archivage : les périodes gardent leur version.
 */
export function scheduleUsage(db, scheduleId) {
  const ids = new Set(liveAssignments(db, scheduleId).map((a) => a.departmentId));
  const departments = db.departments.filter((d) => ids.has(d.id));
  const periods = db.loadingPeriods.filter((p) => p.scheduleId === scheduleId && p.end >= TODAY);
  return { departments, periods, inUse: departments.length > 0 || periods.length > 0 };
}

/**
 * Employés actifs en horaire organisationnel dont l'horaire viendrait de ces (sous-)départements (RH-21) :
 * un sous-département concerné, ou un département concerné pour ses employés sans sous-département doté de son propre
 * scénario. Les employés gérés par le tableau de chargement ne sont pas concernés.
 */
export function impactedEmployees(db, departmentIds, scheduleId, date = TODAY) {
  const ids = new Set(departmentIds);
  return db.employees.filter((e) => {
    if (e.status === 'inactif' || e.scheduleMode !== 'organisation') return false;
    if (e.subDepartmentId && ids.has(e.subDepartmentId)) return true;
    if (!ids.has(e.departmentId)) return false;
    const own = e.subDepartmentId ? departmentScheduleOn(db, e.subDepartmentId, date) : undefined;
    return !own || own.id === scheduleId;
  });
}

// ---------------------------------------------------------------- Rémunération (RH-8, RH-27)

/**
 * Montant affiché dans une devise { symbol, decimals } : « 1 500,000 DT ». Toute l'application (salaires, primes, catalogue)
 * passe par ici avec la devise active de Paramètres › Devises, jamais une devise déduite du pays de la société. Seul l'affichage est arrondi
 * (le montant enregistré n'est pas modifié). Sans devise : nombre seul, 2 décimales.
 */
export function formatAmount(amount, devise) {
  if (amount == null || amount === '' || Number.isNaN(Number(amount))) return '—';
  const decimals = Number.isInteger(devise?.decimals) ? devise.decimals : 2;
  const n = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(amount));
  return devise?.symbol ? `${n} ${devise.symbol}` : n;
}

/** Salaire en vigueur : le plus récent dont la date d'effet est passée. */
export function currentSalary(e, date = TODAY) {
  return [...e.salaries].filter((s) => s.since <= date).sort((a, b) => b.since.localeCompare(a.since))[0];
}

// ---------------------------------------------------------------- Numérotation des matricules
// La souche ({ prefix, separator, withYear, digits, next }) et l'attribution des matricules sont portées par le backend
// (EmployeeNumberingService) ; ces fonctions n'en donnent que l'aperçu, avec les mêmes règles.

/** Matricule produit par la numérotation : préfixe, année éventuelle, compteur complété de zéros. */
export function formatMatricule(n, value, date = TODAY) {
  const parts = [n.prefix.trim().toUpperCase(), n.withYear ? date.slice(0, 4) : '', String(Math.max(0, value)).padStart(n.digits, '0')].filter(Boolean);
  return parts.join(n.separator);
}

/** Lettres significatives d'un nom : sans accents ni ponctuation, en majuscules (« Financier » → « FINANCIER »). */
const lettersOf = (name) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Code d'un département ou d'une fonction ({ prefix, separator, letters }, CodeNumberingService) : préfixe + premières
 * lettres du nom, ex. « DEP-FIN » pour « Financier ». Si le code est déjà pris, un numéro est ajouté (DEP-FIN2…).
 */
export function nameCode(n, name, taken = new Set()) {
  const letters = lettersOf(name).slice(0, n.letters ?? 3);
  if (!letters) return '';
  const base = [n.prefix.trim().toUpperCase(), letters].filter(Boolean).join(n.separator);
  let code = base;
  for (let i = 2; taken.has(code); i++) code = `${base}${i}`;
  return code;
}

/** Aperçu du prochain matricule : le compteur avance tant que le numéro est déjà pris. */
export function nextMatricule(n, employees, date = TODAY) {
  const taken = new Set(employees.map((e) => e.matricule.trim().toUpperCase()));
  let value = n.next;
  while (taken.has(formatMatricule(n, value, date))) value++;
  return formatMatricule(n, value, date);
}

/** Ce qui empêche de supprimer un employé (il passe alors « Inactif », son historique est conservé). Vide = suppression possible. */
export function employeeUsage(db, employeeId) {
  const count = (list, test) => list.filter(test).length;
  const usage = [
    [count(db.requests, (r) => r.employeeId === employeeId || r.steps.some((s) => s.approverId === employeeId)), (n) => `${n} demande(s) de congé`],
    [count(db.loadingPeriods, (p) => p.employeeId === employeeId), (n) => `${n} période(s) au tableau de chargement`],
    [count(db.employees, (e) => e.managerId === employeeId), (n) => `responsable de ${n} employé(s)`],
    [count(db.departments, (d) => d.headId === employeeId), (n) => `chef de ${n} département(s)`],
    [count(db.circuits, (c) => (c.versions ?? [{ steps: c.steps }]).some((v) => v.steps.some((s) => s.employeeId === employeeId))), (n) => `approbateur dans ${n} circuit(s)`],
  ];
  return usage.filter(([n]) => n > 0).map(([n, label]) => label(n));
}

// ---------------------------------------------------------------- Historique (RH-10)

export const historyEntry = (kind, label, actorId, at = TODAY) => ({ at, kind, label, actorId });

export const MARITAL_LABEL = { celibataire: 'Célibataire', marie: 'Marié(e)', divorce: 'Divorcé(e)' };
