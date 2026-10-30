// État de l'application : une base unique (`db`) remplacée de façon immuable à chaque modification.
// Les employés (identité, état civil, matricule…), la numérotation des matricules, les départements et les types de documents
// viennent du backend (src/api) ;
// le reste n'a pas encore d'API et est conservé dans le navigateur (voir persistence.js).
// Pour brancher une API, remplacer le corps des actions ci-dessous : les écrans ne dépendent que de cette interface.
import { shallowReactive, watch } from 'vue';
import { useToast } from 'vue-toastification';
import ToastContent from '../components/ui/ToastContent.vue';
import { employeesApi, fromDto, localPart, numberingApi, toDto } from '../api/employees';
import { departmentsApi, fromDepartmentDto, localDepartmentPart, toDepartmentDto } from '../api/departments';
import { codeNumberingApi } from '../api/codeNumbering';
import { documentTypesApi, fromDocumentTypeDto, toDocumentTypeDto } from '../api/documentTypes';
import { fromHolidayDto, holidaysApi, toHolidayDto } from '../api/holidays';
import { approvalCircuitsApi, fromApprovalCircuitDto, toApprovalCircuitDto } from '../api/approvalCircuits';
import { employeePrimesApi, fromEmployeePrimesDto, fromPrimeDto, primesApi, toPrimeDto } from '../api/primes';
import { fromRoleDto, permissionsApi, rolesApi, toRoleDto } from '../api/roles';
import { currentUserApi, employeeAccessApi, fromEmployeeAccessDto } from '../api/employeeAccess';
import { allows } from '../config/access';
import { notificationsApi } from '../api/notifications';
import { ALL_PERMISSIONS, permissionCatalog, setPermissionCatalog } from '../config/permissions';
import { fromTypeContractDto, toTypeContractDto, typeContractsApi } from '../api/typeContracts';
import { fromJobPositionDto, jobPositionsApi, toJobPositionDto } from '../api/jobPositions';
import { fromPhoneCountryDto, phoneCountriesApi, toPhoneCountryDto } from '../api/phoneCountries';
import { devisesApi, fromDeviseDto, toDeviseDto } from '../api/devises';
import { assignmentsOfDto, fromScheduleDto, toScheduleDto, workSchedulesApi } from '../api/workSchedules';
import { DEFAULT_COUNTRY } from '../config/countries';
import { formatDate, formatRange, nowStamp, TODAY } from '../utils/dates';
import { countLeaveDays, defaultProfile, deriveProfiles } from '../utils/leave';
import { countAuthorization } from '../utils/hours';
import {
  assignmentWindow, circuitForDepartment, circuitStepsFor, circuitVersionOn, departmentScheduleOn, formatAmount, historyEntry, MARITAL_LABEL, organisationalSchedule,
  rootDepartment, scheduleOn,
} from '../utils/org';
import { getSeq, newId, setSeq } from './ids';
import { loadDatabase, saveDatabase } from './persistence';
import { coreSession, setCoreCompany } from '../session/coreSession';

export { newId } from './ids';

/**
 * L'Application RH s'ouvre directement : il lui faut une société où elle est activée.
 * À défaut, on l'active pour la première société existante, ou on crée une société par défaut.
 */
function ensureRhCompany(db) {
  const active = db.companies.filter((c) => !c.archived);
  if (active.some((c) => db.assignments.some((a) => a.appId === 'rh' && a.companyId === c.id && a.enabled))) return db;
  const company = active[0] ?? {
    id: newId('c'), name: 'Ma société', legalName: 'Ma société', taxId: '', city: '', country: DEFAULT_COUNTRY, color: '#2f5bd3', createdAt: TODAY,
  };
  const isRh = (a) => a.appId === 'rh' && a.companyId === company.id;
  return {
    ...db,
    companies: active[0] ? db.companies : [...db.companies, company],
    assignments: [
      ...db.assignments.filter((a) => !isRh(a)),
      { ...db.assignments.find(isRh), appId: 'rh', companyId: company.id, enabled: true, activatedAt: TODAY },
    ],
  };
}

/**
 * Ouverture depuis le Core Tenant : les sociétés où l'Application RH est ouverte à l'utilisateur deviennent les sociétés
 * de l'application (mêmes identifiants que dans le Core), avec l'Application RH activée ; leurs rôles viennent du backend.
 */
function withCoreCompanies(db, context) {
  if (!context?.companies?.length) return db;
  const ids = new Set(context.companies.map((c) => c.id));
  const companies = context.companies.map((c) => ({
    ...db.companies.find((x) => x.id === c.id),
    id: c.id, name: c.name, legalName: c.name, code: c.code ?? '', color: c.color || '#2f5bd3', fromCore: true, archived: false,
    taxId: '', city: '', country: DEFAULT_COUNTRY, createdAt: db.companies.find((x) => x.id === c.id)?.createdAt ?? TODAY,
  }));
  return {
    ...db,
    companies: [...db.companies.filter((c) => !ids.has(c.id)), ...companies],
    assignments: [
      ...db.assignments.filter((a) => !(a.appId === 'rh' && ids.has(a.companyId))),
      ...companies.map((c) => ({ appId: 'rh', companyId: c.id, enabled: true, activatedAt: TODAY })),
    ],
  };
}

const loaded = loadDatabase();
setSeq(loaded.seq);

/**
 * Parties locales des fiches lues dans le navigateur, en attente de la liste du backend. Un employé n'existe que s'il est
 * renvoyé par l'API : les fiches locales sans équivalent (anciennes données simulées) sont écartées au chargement.
 */
let pendingLocal = loaded.db.employees;
/** Idem pour les départements : seule leur partie locale (horaire) est lue dans le navigateur. */
let pendingLocalDepartments = loaded.db.departments;
/** Compte les écritures d'employés : une lecture commencée avant une écriture est relancée (pas de liste périmée). */
let writes = 0;

const state = shallowReactive({
  db: deriveProfiles(ensureRhCompany(withCoreCompanies(
    { ...loaded.db, employees: [], departments: [], functions: [], countries: [], schedules: [], scheduleAssignments: [] }, coreSession.context))),
  /** Société active : celle choisie dans le Core à l'ouverture, sinon la première société ayant l'Application RH. */
  companyId: coreSession.context?.companyId ?? '',
  /** Chargement des employés depuis le backend : 'loading' | 'ready' | 'error'. */
  employeesStatus: 'loading',
  employeesError: '',
  /** Souche de numérotation des matricules (backend) ; undefined tant qu'elle n'est pas chargée. */
  numbering: undefined,
  numberingError: '',
  /** Chargement des départements depuis le backend : 'loading' | 'ready' | 'error'. */
  departmentsStatus: 'loading',
  departmentsError: '',
  /** Chargement des fonctions depuis le backend : 'loading' | 'ready' | 'error'. */
  functionsStatus: 'loading',
  functionsError: '',
  /** Numéro de souche des codes (backend) : { departement, fonction } ; undefined tant qu'il n'est pas chargé. */
  codeNumberings: undefined,
  codeNumberingsError: '',
  /** Chargement du paramétrage des pays (indicatifs téléphoniques) depuis le backend. */
  countriesError: '',
  /** Devises (backend, communes à toutes les sociétés) ; une seule est active. 'loading' | 'ready' | 'error'. */
  devises: [],
  devisesStatus: 'loading',
  devisesError: '',
  /** Chargement des types de contrat depuis le backend : 'loading' | 'ready' | 'error'. */
  contractTypesStatus: 'loading',
  contractTypesError: '',
  /** Chargement des scénarios d'horaires depuis le backend : 'loading' | 'ready' | 'error'. */
  schedulesStatus: 'loading',
  schedulesError: '',
  /** Chargement des jours fériés de la société active depuis le backend : 'loading' | 'ready' | 'error'. */
  holidaysStatus: 'loading',
  holidaysError: '',
  /** Chargement des circuits d'approbation de la société active depuis le backend : 'loading' | 'ready' | 'error'. */
  circuitsStatus: 'loading',
  circuitsError: '',
  /** Chargement du catalogue des primes de la société active depuis le backend : 'loading' | 'ready' | 'error'. */
  primesStatus: 'loading',
  primesError: '',
  /** Chargement des rôles de la société active depuis le backend : 'loading' | 'ready' | 'error'. */
  rolesStatus: 'loading',
  rolesError: '',
  /**
   * Comptes du Core Tenant rattachés à l'Application RH dans la société active (liaison employé ↔ compte, connexion) :
   * relus à la demande, jamais conservés dans le navigateur. Statut : 'idle' | 'loading' | 'ready' | 'error'.
   */
  coreUsers: [],
  coreUsersStatus: 'idle',
  coreUsersError: '',
  /**
   * Utilisateur connecté (GET /api/session/me) : { coreUserId, companyAdmin, employeeId, roleId, permissions } ; ses
   * permissions décident de ce que l'interface affiche. Statut : 'loading' | 'ready' | 'error'.
   */
  me: null,
  meStatus: 'loading',
  /** Notifications du backend (échéances de contrat…) de l'utilisateur connecté, tenues à jour en temps réel. */
  serverNotifications: [],
});

/**
 * Seule la partie locale des fiches et des départements est conservée dans le navigateur ; le reste est relu depuis le backend.
 * Les types de documents sont entièrement portés par le backend.
 */
const persistable = (db) => ({
  ...db,
  employees: pendingLocal ?? db.employees.map(localPart),
  departments: pendingLocalDepartments ?? db.departments.map(localDepartmentPart),
  // Pays et fonctions : relus depuis le backend à chaque ouverture.
  countries: [],
  functions: [],
  // Types de contrat : entièrement portés par le backend.
  contractTypes: [],
  // Scénarios d'horaires et leurs affectations : entièrement portés par le backend (RH-21).
  schedules: [],
  scheduleAssignments: [],
  // Jours fériés : entièrement portés par le backend, propres à chaque société (RH-20).
  holidays: [],
  // Circuits d'approbation et leurs versions : entièrement portés par le backend (RH-22).
  circuits: [],
  // Catalogue des primes : entièrement porté par le backend (RH-25).
  primes: [],
  // Rôles RH : entièrement portés par le backend (RH-18).
  roles: [],
});

watch(() => state.db, (db) => saveDatabase(persistable(db), getSeq()), { flush: 'post' });

/** Toute modification recalcule les champs dérivés des profils (horaire en vigueur, circuit, approbateurs). */
const setDb = (fn) => { state.db = deriveProfiles(fn(state.db)); };

const activeCompanyId = () => state.companyId || store.companiesFor('rh')[0]?.id || '';

/** Fiche complète : champs du backend + partie locale (valeurs par défaut pour un employé sans partie locale). */
/** Primes des employés lues du backend (RH-8), par employé : { allowPrimes, primes }. */
let employeePrimesById = new Map();
let employeePrimesLoaded = false;

function mergeEmployee(dto, local) {
  return {
    companyId: activeCompanyId(), departmentId: '', functionId: '', contract: 'CDI', account: { login: '', active: false },
    scheduleMode: 'organisation', salaries: [], history: [],
    ...local,
    ...fromDto(dto, local?.status),
    allowPrimes: false, primes: [],
    ...employeePrimesById.get(dto.id),
  };
}

/** Retire des employés et ce qui ne concerne qu'eux ; leurs mentions (responsable, chef, approbateur, événement) sont vidées. */
function withoutEmployees(db, ids) {
  if (ids.size === 0) return db;
  const gone = (id) => ids.has(id);
  return {
    ...db,
    employees: db.employees.filter((e) => !gone(e.id)).map((e) => (gone(e.managerId) ? { ...e, managerId: undefined } : e)),
    profiles: db.profiles.filter((p) => !gone(p.employeeId)),
    requests: db.requests.filter((r) => !gone(r.employeeId)),
    loadingPeriods: db.loadingPeriods.filter((p) => !gone(p.employeeId)),
    departments: db.departments.map((d) => (gone(d.headId) ? { ...d, headId: undefined } : d)),
    circuits: db.circuits.map((c) => (c.steps.some((s) => gone(s.employeeId))
      ? { ...c, steps: c.steps.map((s) => (gone(s.employeeId) ? { ...s, employeeId: undefined } : s)) } : c)),
    events: db.events.map((ev) => (ev.employeeIds?.some(gone) ? { ...ev, employeeIds: ev.employeeIds.filter((id) => !gone(id)) } : ev)),
  };
}

// Rattachement porté par le backend : il doit revenir tel qu'envoyé. Un serveur qui ne le connaît pas (version antérieure,
// pas encore redémarré) l'ignore silencieusement et le renvoie absent.
const ATTACHMENT_FIELDS = ['departmentId', 'subDepartmentId', 'managerId'];
const ATTACHMENT_NOT_SAVED = 'Le département et le responsable hiérarchique n’ont pas été enregistrés par le serveur RH : il doit être mis à jour (ou redémarré).';
const lostAttachment = (sent, res) => ATTACHMENT_FIELDS.filter((k) => k in sent && (sent[k] ?? null) !== (res?.[k] ?? null));

/** Lit les employés du backend (GET /api/employees) et les fusionne avec leur partie locale. */
async function loadEmployees() {
  if (state.employeesStatus !== 'ready') { state.employeesStatus = 'loading'; state.employeesError = ''; }
  const started = writes;
  let dtos;
  try {
    dtos = await employeesApi.list();
  } catch (err) {
    state.employeesError = err.message;
    if (state.employeesStatus === 'ready') toast(`Liste des employés non actualisée : ${err.message}`, 'danger');
    else state.employeesStatus = 'error';
    return;
  }
  if (started !== writes) { await loadEmployees(); return; }
  const locals = pendingLocal ?? state.db.employees.map(localPart);
  const localOf = new Map(locals.map((e) => [e.id, e]));
  const known = new Set(dtos.map((dto) => dto.id));
  setDb((d) => {
    const referenced = [...locals.map((e) => e.id), ...d.profiles.map((p) => p.employeeId), ...d.requests.map((r) => r.employeeId), ...d.loadingPeriods.map((p) => p.employeeId)];
    const db = withoutEmployees({ ...d, employees: dtos.map((dto) => mergeEmployee(dto, localOf.get(dto.id))) }, new Set(referenced.filter((id) => !known.has(id))));
    const withoutProfile = db.employees.filter((e) => !db.profiles.some((p) => p.employeeId === e.id));
    return { ...db, profiles: [...db.profiles, ...withoutProfile.map((e) => defaultProfile(db, e))] };
  });
  pendingLocal = undefined;
  state.employeesStatus = 'ready';
  state.employeesError = '';
  migrateAttachments(dtos, localOf);
}

/**
 * Reprise unique des rattachements saisis avant leur enregistrement au backend (département, sous-département, N+1
 * conservés dans le navigateur) : envoyés une fois pour les fiches qui n'en ont pas encore côté serveur. Si le circuit
 * du département exige un N+1 avec compte qui manque, le suivi du circuit est désactivé (demandes validées par la RH) :
 * la fiche reste à compléter.
 */
async function migrateAttachments(dtos, localOf) {
  const exists = (list, id) => !!id && list.some((x) => x.id === id);
  const pending = dtos.flatMap((dto) => {
    const local = localOf.get(dto.id);
    if (!local || dto.departmentId || dto.managerId) return [];
    const departmentId = exists(state.db.departments, local.departmentId) ? local.departmentId : null;
    const managerId = exists(state.db.employees, local.managerId) && local.managerId !== dto.id ? local.managerId : null;
    if (!departmentId && !managerId) return [];
    const subDepartmentId = departmentId && state.db.departments.find((d) => d.id === local.subDepartmentId)?.parentId === departmentId
      ? local.subDepartmentId : null;
    return [{ id: dto.id, changes: { departmentId, subDepartmentId, managerId } }];
  });
  let incomplete = 0;
  for (const { id, changes } of pending) {
    let res;
    try {
      res = await employeesApi.patch(id, changes);
    } catch {
      try {
        res = await employeesApi.patch(id, { ...changes, followsLeaveCircuit: false });
        incomplete++;
      } catch {
        continue;
      }
    }
    writes++;
    setDb((d) => mapEmployee(d, id, (e) => mergeEmployee(res, localPart(e))));
  }
  if (incomplete) toast(`${incomplete} employé(s) sans responsable N+1 doté d’un compte : suivi du circuit d’approbation désactivé, à compléter dans leur fiche.`, 'warning');
}

/**
 * Département complet : champs du backend + partie locale. Le backend n'a pas encore de société pour les départements :
 * ils appartiennent toujours à la société active (une société mémorisée dans le navigateur ne doit pas les masquer).
 */
const mergeDepartment = (dto, local) => ({ ...local, ...fromDepartmentDto(dto), companyId: activeCompanyId() });

/**
 * Lit les départements du backend (GET /api/departments) et les fusionne avec leur partie locale.
 * Un département local sans équivalent dans le backend (ancienne donnée du navigateur) est écarté.
 */
async function loadDepartments() {
  if (state.departmentsStatus !== 'ready') { state.departmentsStatus = 'loading'; state.departmentsError = ''; }
  let dtos;
  try {
    dtos = await departmentsApi.list();
  } catch (err) {
    state.departmentsError = err.message;
    if (state.departmentsStatus === 'ready') toast(`Liste des départements non actualisée : ${err.message}`, 'danger');
    else state.departmentsStatus = 'error';
    return;
  }
  const locals = pendingLocalDepartments ?? state.db.departments.map(localDepartmentPart);
  const localOf = new Map(locals.map((d) => [d.id, d]));
  setDb((d) => withDepartmentSchedules({ ...d, departments: dtos.map((dto) => mergeDepartment(dto, localOf.get(dto.id))) }));
  pendingLocalDepartments = undefined;
  state.departmentsStatus = 'ready';
  state.departmentsError = '';
}

/** Remplace (ou ajoute) un département dans la base. */
const putDepartment = (saved) => setDb((d) => withDepartmentSchedules({
  ...d,
  departments: d.departments.some((x) => x.id === saved.id) ? d.departments.map((x) => (x.id === saved.id ? saved : x)) : [...d.departments, saved],
}));

/**
 * Scénario de chaque département (`scheduleId`), déduit des affectations du backend : celui en vigueur aujourd'hui,
 * à défaut le prochain programmé. Sert aux écrans qui affichent l'horaire d'un département.
 */
function withDepartmentSchedules(db) {
  const next = (id) => (db.scheduleAssignments ?? [])
    .filter((a) => a.departmentId === id && (assignmentWindow(db, a)?.end ?? '') >= TODAY)
    .sort((a, b) => assignmentWindow(db, a).start.localeCompare(assignmentWindow(db, b).start))[0]?.scheduleId;
  return {
    ...db,
    departments: db.departments.map((d) => {
      const scheduleId = departmentScheduleOn(db, d.id)?.id ?? next(d.id);
      return d.scheduleId === scheduleId ? d : { ...d, scheduleId };
    }),
  };
}

/** Remplace les scénarios de la société et leurs affectations par la liste du backend. */
const putSchedules = (dtos) => setDb((d) => withDepartmentSchedules({
  ...d,
  schedules: dtos.map(fromScheduleDto),
  scheduleAssignments: dtos.flatMap(assignmentsOfDto),
}));

/** Lit les scénarios d'horaires de la société active (GET /api/work-schedules), actifs et archivés (RH-21). */
async function loadSchedules() {
  if (state.schedulesStatus !== 'ready') { state.schedulesStatus = 'loading'; state.schedulesError = ''; }
  const companyId = activeCompanyId();
  let dtos;
  try {
    dtos = await workSchedulesApi.list(companyId);
  } catch (err) {
    state.schedulesError = err.message;
    if (state.schedulesStatus === 'ready') toast(`Liste des scénarios d’horaires non actualisée : ${err.message}`, 'danger');
    else state.schedulesStatus = 'error';
    return;
  }
  // Société changée pendant la lecture : la liste ne la concerne plus.
  if (companyId !== activeCompanyId()) return;
  putSchedules(dtos);
  state.schedulesStatus = 'ready';
  state.schedulesError = '';
}

/** Rôle lu du backend, rattaché à la société active. */
const mergeRole = (dto) => ({ ...fromRoleDto(dto), companyId: activeCompanyId() });

/** Lit les rôles de la société active (GET /api/roles, RH-18), avec leur nombre d'utilisateurs. */
async function loadRoles() {
  if (state.rolesStatus !== 'ready') { state.rolesStatus = 'loading'; state.rolesError = ''; }
  const companyId = activeCompanyId();
  let dtos;
  try {
    dtos = await rolesApi.list(companyId);
  } catch (err) {
    state.rolesError = err.message;
    if (state.rolesStatus === 'ready') toast(`Liste des rôles non actualisée : ${err.message}`, 'danger');
    else state.rolesStatus = 'error';
    return;
  }
  if (companyId !== activeCompanyId()) return;
  const roles = dtos.map(mergeRole);
  setDb((d) => ({ ...d, roles: [...d.roles.filter((r) => r.companyId !== companyId), ...roles] }));
  state.rolesStatus = 'ready';
  state.rolesError = '';
}

/** Remplace (ou ajoute) un rôle. */
const putRole = (saved) => setDb((d) => ({
  ...d,
  roles: d.roles.some((x) => x.id === saved.id) ? d.roles.map((x) => (x.id === saved.id ? saved : x)) : [...d.roles, saved],
}));

/**
 * Lit les accès RH des employés de la société (GET /api/employee-access, RH-19) : rôle, permissions ajoutées et retirées.
 * Un employé sans accès enregistré n'a aucun rôle (aucune permission) tant qu'on ne lui en affecte pas.
 */
async function loadEmployeeAccess() {
  const companyId = activeCompanyId();
  let dtos;
  try {
    dtos = await employeeAccessApi.list(companyId);
  } catch (err) {
    if (employeeAccessLoaded) toast(`Accès des employés non actualisés : ${err.message}`, 'danger');
    return;
  }
  if (companyId !== activeCompanyId()) return;
  employeeAccessLoaded = true;
  const byEmployee = new Map(dtos.map((dto) => [dto.employeeId, fromEmployeeAccessDto(dto)]));
  const none = { roleId: '', extraPermissions: [], removedPermissions: [], coreUserId: '' };
  setDb((d) => {
    const ofCompany = new Set(d.employees.filter((e) => e.companyId === companyId).map((e) => e.id));
    return { ...d, profiles: d.profiles.map((p) => (ofCompany.has(p.employeeId) ? { ...p, ...(byEmployee.get(p.employeeId) ?? none) } : p)) };
  });
}
let employeeAccessLoaded = false;

let mePromise;
/** Lit l'utilisateur connecté et ses permissions (une fois par session de page ; `force` relit). */
function loadMe(force = false) {
  if (mePromise && !force) return mePromise;
  if (!coreSession.context) {
    state.meStatus = 'ready';
    mePromise = Promise.resolve(null);
    return mePromise;
  }
  mePromise = currentUserApi.get()
    .then((me) => { state.me = me; state.meStatus = 'ready'; return me; })
    .catch((err) => {
      state.me = null;
      state.meStatus = 'error';
      toast(`Permissions non chargées : ${err.message}`, 'danger');
      return null;
    });
  return mePromise;
}

/**
 * Notifications du backend : relues à chaque événement du flux temps réel. Une notification non lue qui apparaît après le
 * premier chargement est aussi annoncée par un toast.
 */
let notificationsLoaded = false;
let stopNotificationStream;
async function loadNotifications() {
  let list;
  try {
    list = await notificationsApi.list();
  } catch {
    return;
  }
  const known = new Set(state.serverNotifications.map((n) => n.id));
  const fresh = notificationsLoaded ? list.filter((n) => !n.read && !known.has(n.id)) : [];
  state.serverNotifications = list;
  notificationsLoaded = true;
  if (fresh.length === 1) toast(fresh[0].message, 'info', fresh[0].title);
  else if (fresh.length > 1) toast(`${fresh.length} nouvelles notifications`, 'info');
}

/** Ouvre le flux temps réel (une fois par page) ; la liste est relue à chaque changement et à chaque reconnexion. */
function startNotifications() {
  if (stopNotificationStream || !coreSession.context) return;
  stopNotificationStream = notificationsApi.subscribe(loadNotifications);
}

/** Applique localement, puis au backend ; en cas d'échec, la liste est relue. */
async function updateNotifications(apply, call) {
  state.serverNotifications = apply(state.serverNotifications);
  try {
    await call();
  } catch (err) {
    toast(err.message, 'danger');
    loadNotifications();
  }
}

/** L'utilisateur connecté a-t-il cette permission ? Hors session Core (développement), tout est permis. */
function can(permission) {
  if (!coreSession.context) return true;
  // Permission absente du catalogue (module pas encore développé : planning, congés, calendrier, événements) :
  // réservée à l'administrateur de la société, aucun rôle ne pouvant la porter.
  if (permissionCatalog.status === 'ready' && !ALL_PERMISSIONS.includes(permission)) return !!state.me?.companyAdmin;
  return !!state.me?.permissions?.includes(permission);
}

/** Lit les comptes du Core Tenant rattachés à l'Application RH dans la société active (GET /api/employee-access/core-users). */
async function loadCoreUsers() {
  const companyId = activeCompanyId();
  if (state.coreUsersStatus !== 'ready') { state.coreUsersStatus = 'loading'; state.coreUsersError = ''; }
  try {
    const users = await employeeAccessApi.coreUsers(companyId);
    if (companyId !== activeCompanyId()) return;
    state.coreUsers = users;
    state.coreUsersStatus = 'ready';
    state.coreUsersError = '';
  } catch (err) {
    if (companyId !== activeCompanyId()) return;
    state.coreUsersStatus = 'error';
    state.coreUsersError = err.message;
  }
}

/** Lit le catalogue des permissions (GET /api/permissions), commun à toutes les sociétés. */
async function loadPermissionCatalog() {
  try {
    setPermissionCatalog(await permissionsApi.list());
  } catch (err) {
    // Un catalogue déjà chargé reste affiché ; seul un premier chargement raté est signalé.
    if (permissionCatalog.status === 'ready') return;
    permissionCatalog.status = 'error';
    permissionCatalog.error = err.message;
  }
}

/** Prime du catalogue lue du backend, rattachée à la société active. */
const mergePrime = (dto) => ({ ...fromPrimeDto(dto), companyId: activeCompanyId() });

/** Lit le catalogue des primes de la société active (GET /api/primes), actives et archivées (RH-25). */
async function loadPrimes() {
  if (state.primesStatus !== 'ready') { state.primesStatus = 'loading'; state.primesError = ''; }
  const companyId = activeCompanyId();
  let dtos;
  try {
    dtos = await primesApi.list(companyId);
  } catch (err) {
    state.primesError = err.message;
    if (state.primesStatus === 'ready') toast(`Catalogue des primes non actualisé : ${err.message}`, 'danger');
    else state.primesStatus = 'error';
    return;
  }
  if (companyId !== activeCompanyId()) return;
  setDb((d) => ({ ...d, primes: dtos.map(mergePrime) }));
  state.primesStatus = 'ready';
  state.primesError = '';
}

/** Remplace (ou ajoute) une prime du catalogue. */
const putPrime = (saved) => setDb((d) => ({
  ...d,
  primes: d.primes.some((x) => x.id === saved.id) ? d.primes.map((x) => (x.id === saved.id ? saved : x)) : [...d.primes, saved],
}));

/** Lit l'autorisation et les primes attribuées des employés (GET /api/employee-primes, RH-8). */
async function loadEmployeePrimes() {
  const companyId = activeCompanyId();
  let dtos;
  try {
    dtos = await employeePrimesApi.list(companyId);
  } catch (err) {
    // Backend injoignable au démarrage : signalé par le catalogue (Paramètres) ; une actualisation ratée est notifiée.
    if (employeePrimesLoaded) toast(`Primes des employés non actualisées : ${err.message}`, 'danger');
    return;
  }
  if (companyId !== activeCompanyId()) return;
  employeePrimesLoaded = true;
  employeePrimesById = new Map(dtos.map((dto) => [dto.employeeId, fromEmployeePrimesDto(dto)]));
  setDb((d) => ({ ...d, employees: d.employees.map((e) => ({ ...e, allowPrimes: false, primes: [], ...employeePrimesById.get(e.id) })) }));
}

/** Applique la réponse du backend à la fiche (avec une entrée d'historique) et recharge le catalogue (nombre d'attributions). */
function putEmployeePrimes(dto, historyLabel, since) {
  const value = fromEmployeePrimesDto(dto);
  employeePrimesById.set(dto.employeeId, value);
  const actorId = currentUserId();
  setDb((d) => mapEmployee(d, dto.employeeId, (e) => ({
    ...e, ...value,
    history: historyLabel ? [historyEntry('primes', historyLabel, actorId, since), ...e.history] : e.history,
  })));
  loadPrimes();
}

/** Circuit lu du backend, rattaché à la société active. */
const mergeCircuit = (dto) => ({ ...fromApprovalCircuitDto(dto), companyId: activeCompanyId() });

/** Lit les circuits d'approbation de la société active (GET /api/approval-circuits), actifs et archivés (RH-22). */
async function loadCircuits() {
  if (state.circuitsStatus !== 'ready') { state.circuitsStatus = 'loading'; state.circuitsError = ''; }
  const companyId = activeCompanyId();
  let dtos;
  try {
    dtos = await approvalCircuitsApi.list(companyId);
  } catch (err) {
    state.circuitsError = err.message;
    if (state.circuitsStatus === 'ready') toast(`Liste des circuits non actualisée : ${err.message}`, 'danger');
    else state.circuitsStatus = 'error';
    return;
  }
  // Société changée pendant la lecture : la liste ne la concerne plus.
  if (companyId !== activeCompanyId()) return;
  setDb((d) => ({ ...d, circuits: dtos.map(mergeCircuit) }));
  state.circuitsStatus = 'ready';
  state.circuitsError = '';
}

/** Jour férié lu du backend, rattaché à la société active. */
const mergeHoliday = (dto) => ({ ...fromHolidayDto(dto), companyId: activeCompanyId() });

/** Lit les jours fériés de la société active (GET /api/holidays), actifs et archivés (RH-20). */
async function loadHolidays() {
  if (state.holidaysStatus !== 'ready') { state.holidaysStatus = 'loading'; state.holidaysError = ''; }
  const companyId = activeCompanyId();
  let dtos;
  try {
    dtos = await holidaysApi.list(companyId);
  } catch (err) {
    state.holidaysError = err.message;
    if (state.holidaysStatus === 'ready') toast(`Liste des jours fériés non actualisée : ${err.message}`, 'danger');
    else state.holidaysStatus = 'error';
    return;
  }
  // Société changée pendant la lecture : la liste ne la concerne plus.
  if (companyId !== activeCompanyId()) return;
  setDb((d) => ({ ...d, holidays: dtos.map(mergeHoliday) }));
  state.holidaysStatus = 'ready';
  state.holidaysError = '';
}

/** Remplace (ou ajoute) un jour férié dans la base. */
const putHoliday = (saved) => setDb((d) => ({
  ...d,
  holidays: d.holidays.some((x) => x.id === saved.id) ? d.holidays.map((x) => (x.id === saved.id ? saved : x)) : [...d.holidays, saved],
}));

/** Lit les types de documents du backend (GET /api/document-types), actifs et désactivés. */
async function loadDocumentTypes() {
  if (state.documentTypesStatus !== 'ready') { state.documentTypesStatus = 'loading'; state.documentTypesError = ''; }
  let dtos;
  try {
    dtos = await documentTypesApi.list();
  } catch (err) {
    state.documentTypesError = err.message;
    if (state.documentTypesStatus === 'ready') toast(`Liste des types de documents non actualisée : ${err.message}`, 'danger');
    else state.documentTypesStatus = 'error';
    return;
  }
  setDb((d) => ({ ...d, documentTypes: dtos.map((dto) => fromDocumentTypeDto(dto, activeCompanyId())) }));
  state.documentTypesStatus = 'ready';
  state.documentTypesError = '';
}

/** Remplace (ou ajoute) un type de document dans la base. */
const putDocumentType = (saved) => setDb((d) => ({
  ...d,
  documentTypes: d.documentTypes.some((x) => x.id === saved.id) ? d.documentTypes.map((x) => (x.id === saved.id ? saved : x)) : [...d.documentTypes, saved],
}));

/** Lit les types de contrat du backend (GET /api/type-contracts), actifs et désactivés. */
async function loadContractTypes() {
  if (state.contractTypesStatus !== 'ready') { state.contractTypesStatus = 'loading'; state.contractTypesError = ''; }
  let dtos;
  try {
    dtos = await typeContractsApi.list();
  } catch (err) {
    state.contractTypesError = err.message;
    if (state.contractTypesStatus === 'ready') toast(`Liste des types de contrat non actualisée : ${err.message}`, 'danger');
    else state.contractTypesStatus = 'error';
    return;
  }
  setDb((d) => ({ ...d, contractTypes: dtos.map((dto) => fromTypeContractDto(dto, activeCompanyId())) }));
  state.contractTypesStatus = 'ready';
  state.contractTypesError = '';
}

/** Remplace (ou ajoute) un type de contrat dans la base. */
const putContractType = (saved) => setDb((d) => ({
  ...d,
  contractTypes: d.contractTypes.some((x) => x.id === saved.id) ? d.contractTypes.map((x) => (x.id === saved.id ? saved : x)) : [...d.contractTypes, saved],
}));

/** Fonction complète : champs du backend, rattachée à la société active. */
const mergeFunction = (dto) => ({ companyId: activeCompanyId(), ...fromJobPositionDto(dto) });

/** Lit les fonctions du backend (GET /api/job-positions). */
async function loadFunctions() {
  if (state.functionsStatus !== 'ready') { state.functionsStatus = 'loading'; state.functionsError = ''; }
  try {
    const dtos = await jobPositionsApi.list();
    setDb((d) => ({ ...d, functions: dtos.map(mergeFunction) }));
    state.functionsStatus = 'ready';
    state.functionsError = '';
  } catch (err) {
    state.functionsError = err.message;
    if (state.functionsStatus === 'ready') toast(`Liste des fonctions non actualisée : ${err.message}`, 'danger');
    else state.functionsStatus = 'error';
  }
}

/** Remplace (ou ajoute) une fonction dans la base. */
const putFunction = (saved) => setDb((d) => ({
  ...d,
  functions: d.functions.some((x) => x.id === saved.id) ? d.functions.map((x) => (x.id === saved.id ? saved : x)) : [...d.functions, saved],
}));

/** Lit le numéro de souche des codes de départements et de fonctions (GET /api/code-numbering). */
async function loadCodeNumberings() {
  try {
    const list = await codeNumberingApi.list();
    state.codeNumberings = Object.fromEntries(list.map(({ entity, ...n }) => [entity, n]));
    state.codeNumberingsError = '';
  } catch (err) {
    state.codeNumberingsError = err.message;
  }
}

/** Lit le paramétrage des pays et indicatifs téléphoniques (GET /api/phone-country-settings). */
async function loadPhoneCountries() {
  try {
    const list = await phoneCountriesApi.list();
    setDb((d) => ({ ...d, countries: list.map(fromPhoneCountryDto) }));
    state.countriesError = '';
  } catch (err) {
    state.countriesError = err.message;
  }
}

/** Remplace (ou ajoute) un pays dans la base. */
const putCountry = (saved) => setDb((d) => ({
  ...d,
  countries: d.countries.some((x) => x.id === saved.id) ? d.countries.map((x) => (x.id === saved.id ? saved : x)) : [...d.countries, saved],
}));

/** Lit la souche de numérotation (GET /api/employee-numbering). */
async function loadNumbering() {
  try {
    state.numbering = await numberingApi.get();
    state.numberingError = '';
  } catch (err) {
    state.numberingError = err.message;
  }
}

/**
 * Fiche employé de l'utilisateur dans la société active : celle liée à son compte Core Tenant (session) ; hors session Core
 * (développement), l'administrateur RH, à défaut le premier employé actif.
 */
function resolveCurrentUser() {
  const { db, companyId } = state;
  if (coreSession.context) return db.employees.find((e) => e.id === state.me?.employeeId) ?? placeholderEmployee();
  const adminUser = db.users.find((u) => u.id === db.assignments.find((a) => a.appId === 'rh' && a.companyId === companyId)?.adminUserId);
  return db.employees.find((e) => e.id === adminUser?.employeeLinks[companyId])
    ?? db.employees.find((e) => e.companyId === companyId && e.status !== 'inactif')
    ?? placeholderEmployee();
}

/** Utilisé seulement si la société n'a encore aucune fiche. */
function placeholderEmployee() {
  return {
    id: '', companyId: state.companyId, firstName: '', lastName: '', matricule: '', email: '', phone: '', birthDate: '', address: '',
    departmentId: '', functionId: '', hireDate: '', contract: 'CDI', status: 'actif', account: { login: '', active: false },
    maritalStatus: 'celibataire', childrenCount: 0, scheduleMode: 'organisation', salaries: [], allowPrimes: false, primes: [], history: [],
  };
}

const currentUserId = () => resolveCurrentUser().id;

const notify = (d, title, body, link) => ({
  ...d,
  notifications: [{ id: newId('n'), companyId: state.companyId, at: nowStamp(), title, body, read: false, link }, ...d.notifications],
});

/** Étape qui demande une notification : l'approbateur est prévenu quand la demande arrive à son niveau. */
const notifyStep = (d, req, step) => (step?.notify
  ? notify(d, 'Demande à approuver', `${personName(d, req.employeeId)} — étape ${step.order}, à valider par ${step.rh ? 'la RH' : personName(d, step.approverId)}`, `conges/demandes/${req.id}`)
  : d);

const personName = (d, id) => {
  const p = d.employees.find((x) => x.id === id);
  return p ? `${p.firstName} ${p.lastName}` : '';
};

const updateRequest = (requestId, fn) =>
  setDb((d) => ({ ...d, requests: d.requests.map((r) => (r.id === requestId ? fn(r) : r)) }));

/** Applique une transformation à une fiche employé. */
const mapEmployee = (d, employeeId, fn) => ({ ...d, employees: d.employees.map((e) => (e.id === employeeId ? fn(e) : e)) });

const STATUS_LABEL = { actif: 'Actif', essai: 'Période d’essai', inactif: 'Inactif' };

/** Entrées d'historique déduites d'une modification de fiche (RH-5, RH-6, RH-12). */
function changesOf(d, before, after, actorId) {
  if (!before) {
    const circuit = circuitForDepartment(d, after.subDepartmentId || after.departmentId);
    const primes = after.primes.map((p) => d.primes.find((x) => x.id === p.primeId)?.name).filter(Boolean);
    return [
      ...(after.allowPrimes ? [historyEntry('primes', `Primes autorisées${primes.length ? ` : ${primes.join(', ')}` : ''}`, actorId, after.hireDate)] : []),
      historyEntry('circuit', `Circuit « ${circuit?.name ?? '—'} » appliqué automatiquement (département « ${rootDepartment(d, after.departmentId)?.name} »)`, actorId, after.hireDate),
      historyEntry('recrutement', `Création du dossier — ${scheduleOn(d, after, after.hireDate).source}`, actorId, after.hireDate),
    ];
  }
  const out = [];
  if (before.maritalStatus !== after.maritalStatus || before.childrenCount !== after.childrenCount) {
    out.push(historyEntry('information', `Situation familiale : ${MARITAL_LABEL[after.maritalStatus]}, ${after.childrenCount} enfant(s) (avant : ${MARITAL_LABEL[before.maritalStatus]}, ${before.childrenCount})`, actorId));
  }
  if (before.departmentId !== after.departmentId || before.subDepartmentId !== after.subDepartmentId) {
    const name = (id) => d.departments.find((x) => x.id === id)?.name;
    const target = [name(after.departmentId), name(after.subDepartmentId)].filter(Boolean).join(' › ');
    const circuit = circuitForDepartment(d, after.subDepartmentId || after.departmentId);
    const schedule = after.scheduleMode === 'organisation'
      ? `nouvel horaire appliqué : ${organisationalSchedule(d, after.departmentId, after.subDepartmentId).schedule?.name ?? 'aucun'}`
      : 'horaire inchangé, géré par le tableau de chargement';
    out.push(historyEntry('mutation', `Mutation vers « ${target} » — circuit « ${circuit?.name ?? '—'} », ${schedule}`, actorId));
  }
  if (before.functionId !== after.functionId) {
    out.push(historyEntry('mutation', `Changement de fonction : ${d.functions.find((f) => f.id === after.functionId)?.name}`, actorId));
  }
  if (before.status !== after.status) out.push(historyEntry('statut', `Statut : ${STATUS_LABEL[before.status]} → ${STATUS_LABEL[after.status]}`, actorId));
  return out;
}

/** Titres par défaut des notifications (comme le Core Tenant), quand l'appelant ne précise que le message. */
const TOAST_TITLES = { success: 'Opération réussie', error: 'Une erreur est survenue', warning: 'Attention', info: 'Information' };

/**
 * Notification (Vue Toastification, apparence du Core Tenant). `tone` : success | info | warning | danger ;
 * « danger » correspond au type « error » de la bibliothèque et reste affiché plus longtemps.
 */
function toast(message, tone = 'success', title) {
  const type = tone === 'danger' ? 'error' : tone;
  useToast()[type](
    { component: ToastContent, props: { type, title: title ?? TOAST_TITLES[type], message } },
    type === 'error' ? { timeout: 6000 } : {},
  );
}

const store = {
  // ---------- Lecture ----------
  /** L'utilisateur décide de cette étape : son approbateur, ou la RH (habilitée à approuver les congés) pour une étape « RH ». */
  isStepApprover(step) {
    return step.rh ? can('conges.approuver') : step.approverId === resolveCurrentUser().id;
  },
  get db() { return state.db; },
  get companyId() { return state.companyId; },
  get employeesStatus() { return state.employeesStatus; },
  get employeesError() { return state.employeesError; },
  get numbering() { return state.numbering; },
  get numberingError() { return state.numberingError; },
  get departmentsStatus() { return state.departmentsStatus; },
  get departmentsError() { return state.departmentsError; },
  get codeNumberings() { return state.codeNumberings; },
  get codeNumberingsError() { return state.codeNumberingsError; },
  get documentTypesStatus() { return state.documentTypesStatus; },
  get documentTypesError() { return state.documentTypesError; },
  get schedulesStatus() { return state.schedulesStatus; },
  get schedulesError() { return state.schedulesError; },
  get holidaysStatus() { return state.holidaysStatus; },
  get holidaysError() { return state.holidaysError; },
  get circuitsStatus() { return state.circuitsStatus; },
  get circuitsError() { return state.circuitsError; },
  get primesStatus() { return state.primesStatus; },
  get primesError() { return state.primesError; },
  get rolesStatus() { return state.rolesStatus; },
  get rolesError() { return state.rolesError; },
  get me() { return state.me; },
  get serverNotifications() { return state.serverNotifications; },
  loadNotifications,
  startNotifications,
  /** Marque lue (backend) ; une notification locale (démonstration) est marquée dans le navigateur. */
  markNotificationRead(n) {
    if (n.local) { setDb((d) => ({ ...d, notifications: d.notifications.map((x) => (x.id === n.id ? { ...x, read: true } : x)) })); return; }
    if (n.read) return;
    updateNotifications((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)), () => notificationsApi.markRead(n.id));
  },
  /** Retire la notification de la liste de l'utilisateur. */
  dismissNotification(n) {
    if (n.local) { setDb((d) => ({ ...d, notifications: d.notifications.filter((x) => x.id !== n.id) })); return; }
    updateNotifications((list) => list.filter((x) => x.id !== n.id), () => notificationsApi.dismiss(n.id));
  },
  dismissAllNotifications() {
    const { companyId } = state;
    setDb((d) => ({ ...d, notifications: d.notifications.filter((x) => x.companyId !== companyId) }));
    if (state.serverNotifications.length) updateNotifications(() => [], () => notificationsApi.dismissAll());
  },
  get meStatus() { return state.meStatus; },
  loadMe,
  can,
  /** `required` : clé, tableau « l'une de », ou rien (ouvert) — voir config/access.js. */
  allows: (required) => allows(can, required),
  get coreUsers() { return state.coreUsers; },
  get coreUsersStatus() { return state.coreUsersStatus; },
  get coreUsersError() { return state.coreUsersError; },
  /** Compte du Core Tenant lié à l'employé (si les comptes ont été lus). */
  coreUserOf(employeeId) {
    const id = (state.db.profiles ?? []).find((p) => p.employeeId === employeeId)?.coreUserId;
    return id ? state.coreUsers.find((u) => u.id === id) : undefined;
  },
  get contractTypesStatus() { return state.contractTypesStatus; },
  get contractTypesError() { return state.contractTypesError; },
  get devises() { return state.devises; },
  /** Devise active : utilisée par défaut pour la saisie et l'affichage des salaires. */
  get activeDevise() { return state.devises.find((d) => d.active); },
  get devisesStatus() { return state.devisesStatus; },
  get devisesError() { return state.devisesError; },
  /** Fiche employé de l'utilisateur dans l'application RH, pour la société active. */
  get currentUser() { return resolveCurrentUser(); },
  /**
   * Sociétés actives pour lesquelles une application est activée. Ouverture depuis le Core : seulement les sociétés où
   * l'Application RH est ouverte à l'utilisateur.
   */
  companiesFor(appId) {
    const { db } = state;
    const core = coreSession.context ? new Set(coreSession.context.companies.map((c) => c.id)) : null;
    return db.companies.filter((c) => !c.archived && (!core || core.has(c.id))
      && db.assignments.some((a) => a.appId === appId && a.companyId === c.id && a.enabled));
  },
  setCompanyId(id) {
    const changed = id !== state.companyId;
    if (changed && coreSession.context) {
      // Session Core : le backend ouvre une session pour la société choisie (si elle est ouverte à l'utilisateur), puis
      // toutes les données sont relues pour cette société (le tenant et la société sont portés par la session).
      setCoreCompany(id)
        .then(() => window.location.reload())
        .catch((err) => toast(`Changement de société impossible : ${err.message}`, 'danger'));
      return;
    }
    state.companyId = id;
    if (changed) {
      // Départements sans société côté backend : ils suivent la société active.
      setDb((d) => ({ ...d, departments: d.departments.map((x) => ({ ...x, companyId: id })) }));
      // Les scénarios d'horaires et les jours fériés sont propres à chaque société.
      loadSchedules();
      loadHolidays();
      loadCircuits();
      loadPrimes();
      loadEmployeePrimes();
      loadRoles();
      loadEmployeeAccess();
      state.coreUsers = [];
      state.coreUsersStatus = 'idle';
    }
  },

  toast,

  // ---------- Employés ----------
  loadEmployees,
  /**
   * Crée (POST, sans identifiant) ou modifie (PUT) la fiche dans le backend, puis enregistre sa partie locale et son profil.
   * Le matricule est attribué par le backend à la création et conservé ensuite. Rejette l'erreur de l'API (message affichable).
   * Les changements d'état civil, de rattachement et de statut sont historisés (RH-5, RH-6, RH-10).
   */
  /** `initial` (création seulement) : { contract, salaries } enregistrés par le backend dans la même transaction que la fiche. */
  async saveEmployee(employee, profile, initial) {
    if (state.employeesStatus !== 'ready') throw new Error('Les employés ne sont pas encore chargés depuis le serveur.');
    // Titre d'emploi : champ libre et facultatif de la fiche (Employee.jobTitle), distinct de la fonction.
    const dto = toDto(employee, employee.jobTitle);
    let res;
    if (employee.id) {
      // PATCH : on n'envoie que les champs réellement modifiés par rapport à la fiche connue.
      const current = state.db.employees.find((e) => e.id === employee.id);
      const previous = current
        ? toDto(current, current.jobTitle)
        : {};
      const changes = Object.fromEntries(Object.entries(dto).filter(([k, v]) => v !== previous[k]));
      res = await employeesApi.patch(employee.id, changes);
      // Pas de message de succès si le serveur n'a pas réellement enregistré le rattachement envoyé.
      if (lostAttachment(changes, res).length) throw new Error(ATTACHMENT_NOT_SAVED);
    } else {
      res = await employeesApi.create(initial ? { ...dto, ...initial } : dto);
      if (lostAttachment(dto, res).length) toast(`Dossier créé, mais ${ATTACHMENT_NOT_SAVED.charAt(0).toLowerCase()}${ATTACHMENT_NOT_SAVED.slice(1)}`, 'danger');
    }
    writes++;
    const actorId = currentUserId();
    let saved;
    setDb((d) => {
      const before = d.employees.find((e) => e.id === res.id);
      const after = mergeEmployee(res, { ...localPart(employee), id: res.id });
      saved = { ...after, history: [...changesOf(d, before, after, actorId), ...after.history] };
      const own = { ...profile, employeeId: res.id, companyId: saved.companyId };
      const hasProfile = d.profiles.some((p) => p.employeeId === res.id);
      return {
        ...d,
        employees: before ? d.employees.map((e) => (e.id === res.id ? saved : e)) : [...d.employees, saved],
        profiles: hasProfile ? d.profiles.map((p) => (p.employeeId === res.id ? own : p)) : [...d.profiles, own],
      };
    });
    // Le compteur a avancé côté backend : on relit la souche pour l'aperçu du prochain matricule.
    if (!employee.id) loadNumbering();
    return saved;
  },
  /** Supprime la fiche (DELETE) ; le contrôle d'utilisation (employeeUsage) est fait avant. Déjà supprimée ailleurs : retirée aussi. */
  async deleteEmployee(employeeId) {
    try {
      await employeesApi.remove(employeeId);
    } catch (err) {
      if (err.status !== 404) throw err;
    }
    writes++;
    setDb((d) => withoutEmployees(d, new Set([employeeId])));
  },
  saveProfile(profile) {
    setDb((d) => ({ ...d, profiles: d.profiles.map((p) => (p.employeeId === profile.employeeId ? profile : p)) }));
  },
  /** Bascule au tableau de chargement ou retour à l'horaire organisationnel, à une date d'effet (RH-24). */
  setScheduleMode(employeeId, mode, effectiveDate, reason) {
    const actorId = currentUserId();
    setDb((d) => mapEmployee(d, employeeId, (e) => {
      const motif = reason.trim() ? ` — motif : ${reason.trim()}` : '';
      const label = mode === 'chargement'
        ? `Passage au tableau de chargement à compter du ${formatDate(effectiveDate)} : fin de l’horaire hérité du département${motif}`
        : `Retour à l’horaire organisationnel à compter du ${formatDate(effectiveDate)} (${organisationalSchedule(d, e.departmentId, e.subDepartmentId).source})${motif}`;
      return {
        ...e, scheduleMode: mode, loadingSince: mode === 'chargement' ? effectiveDate : undefined,
        history: [historyEntry('horaire', label, actorId, effectiveDate), ...e.history],
      };
    }));
  },
  /** Ajoute ou modifie une période du tableau de chargement (RH-26) ; le contrôle de chevauchement est fait avant. */
  savePeriod(period) {
    const actorId = currentUserId();
    setDb((d) => {
      const exists = d.loadingPeriods.some((p) => p.id === period.id);
      const schedule = d.schedules.find((s) => s.id === period.scheduleId)?.name;
      const label = `${exists ? 'Période modifiée' : 'Période planifiée'} « ${period.label} » ${formatRange(period.start, period.end)} (${schedule})`;
      return mapEmployee({
        ...d,
        loadingPeriods: exists ? d.loadingPeriods.map((p) => (p.id === period.id ? period : p)) : [...d.loadingPeriods, period],
      }, period.employeeId, (e) => ({ ...e, history: [historyEntry('planification', label, actorId), ...e.history] }));
    });
  },
  cancelPeriod(periodId) {
    const actorId = currentUserId();
    setDb((d) => {
      const period = d.loadingPeriods.find((p) => p.id === periodId);
      if (!period) return d;
      return mapEmployee({ ...d, loadingPeriods: d.loadingPeriods.filter((p) => p.id !== periodId) }, period.employeeId, (e) => ({
        ...e, history: [historyEntry('planification', `Période annulée « ${period.label} » (${formatRange(period.start, period.end)})`, actorId), ...e.history],
      }));
    });
  },
  addSalary(employeeId, salary) {
    const actorId = currentUserId();
    setDb((d) => {
      return mapEmployee(d, employeeId, (e) => ({
        ...e, salaries: [...e.salaries, salary],
        history: [historyEntry('salaire', `Salaire de base ${formatAmount(salary.amount, state.devises.find((x) => x.active))} à compter du ${formatDate(salary.since)} — ${salary.reason}`, actorId, salary.since), ...e.history],
      }));
    });
  },
  // ---------- Primes des employés (RH-8, backend /api/employee-primes) ----------
  loadEmployeePrimes,
  /** Autorise ou retire les primes ; le retrait révoque toutes les primes attribuées. Rejette l'erreur de l'API. */
  async setPrimesAllowed(employeeId, allowed) {
    const count = state.db.employees.find((e) => e.id === employeeId)?.primes.length ?? 0;
    putEmployeePrimes(await employeePrimesApi.setAllowed(employeeId, allowed), allowed
      ? 'Autorisation des primes activée'
      : `Autorisation des primes retirée${count ? ` : ${count} prime(s) révoquée(s)` : ''}`);
  },
  /** Attribue une prime active du catalogue à compter d'une date ; rejette le refus du backend (non autorisée, déjà attribuée…). */
  async assignPrime(employeeId, primeId, since) {
    const prime = state.db.primes.find((p) => p.id === primeId);
    putEmployeePrimes(await employeePrimesApi.assign(activeCompanyId(), employeeId, primeId, since),
      `Attribution de la prime « ${prime?.name ?? ''} » à compter du ${formatDate(since)}`, since);
  },
  async removePrime(employeeId, primeId) {
    const prime = state.db.primes.find((p) => p.id === primeId);
    putEmployeePrimes(await employeePrimesApi.remove(employeeId, primeId), `Retrait de la prime « ${prime?.name ?? primeId} »`);
  },
  // ---------- Catalogue des primes (RH-25, backend /api/primes) ----------
  loadPrimes,
  /** Crée (POST) ou modifie (PUT) une prime ; rejette l'erreur de l'API (nom ou code déjà utilisé…). */
  async savePrime(prime) {
    const dto = toPrimeDto(prime, activeCompanyId());
    const saved = mergePrime(prime.id ? await primesApi.update(prime.id, dto) : await primesApi.create(dto));
    putPrime(saved);
    return saved;
  },
  /** Archive (plus attribuable) ou restaure une prime ; le refus du backend est affiché. */
  async setPrimeActive(id, active) {
    try {
      putPrime(mergePrime(await primesApi.setActive(activeCompanyId(), id, active)));
      toast(active ? 'Prime restaurée' : 'Prime archivée — elle n’est plus attribuable, les attributions existantes sont conservées', 'info');
    } catch (err) {
      toast(err.message, 'danger');
    }
  },
  /** Supprime une prime jamais attribuée ; rejette le refus du backend (409 : prime attribuée). */
  async deletePrime(id) {
    await primesApi.remove(activeCompanyId(), id);
    setDb((d) => ({ ...d, primes: d.primes.filter((x) => x.id !== id) }));
  },

  // ---------- Paramétrage ----------
  /** Supprime un élément jamais utilisé (ex. prime jamais attribuée). */
  removeItem(key, id) {
    setDb((d) => ({ ...d, [key]: d[key].filter((x) => x.id !== id) }));
  },
  // ---------- Scénarios d'horaires (RH-21) ----------
  loadSchedules,
  /**
   * Crée (POST) ou modifie (PUT) un scénario et l'affecte aux (sous-)départements choisis à compter du début de sa période ;
   * ceux qui en sont retirés le perdent. Relit ensuite la liste : un remplacement modifie l'affectation d'autres scénarios.
   * Rejette l'erreur de l'API (libellé déjà utilisé, chevauchement de scénarios sur un département…).
   */
  async saveSchedule(schedule, departmentIds, employeeIds) {
    const dto = toScheduleDto({ ...schedule, companyId: activeCompanyId() }, departmentIds, employeeIds);
    const res = schedule.id ? await workSchedulesApi.update(schedule.id, dto) : await workSchedulesApi.create(dto);
    putSchedules(await workSchedulesApi.list(activeCompanyId()));
    return fromScheduleDto(res);
  },
  /**
   * Active ou archive un scénario (PATCH). Un scénario encore affecté s'archive avec un scénario de remplacement,
   * appliqué à ses départements à la date d'effet. Rejette l'erreur de l'API.
   */
  async setScheduleStatus(id, active, replacementId, effectiveDate) {
    const companyId = activeCompanyId();
    await workSchedulesApi.setStatus(companyId, id, { active, replacementId: replacementId || null, effectiveDate: effectiveDate || null });
    putSchedules(await workSchedulesApi.list(companyId));
  },
  /** Affecte, remplace (scheduleId) ou retire (vide) le scénario d'un département à une date d'effet. Rejette l'erreur de l'API. */
  async assignDepartmentSchedule(departmentId, scheduleId, effectiveDate) {
    putSchedules(await workSchedulesApi.assignDepartment(activeCompanyId(), {
      departmentId, scheduleId: scheduleId || null, effectiveDate: effectiveDate || null,
    }));
  },
  /**
   * Affecte (scheduleId) ou retire (vide) l'horaire spécial d'un employé. Sans horaire spécial, l'employé reprend de
   * lui-même l'horaire de son département : rien n'est recopié. Rejette l'erreur de l'API.
   */
  async assignEmployeeSchedule(employeeId, scheduleId) {
    putSchedules(await workSchedulesApi.assignEmployee(activeCompanyId(), { employeeId, scheduleId: scheduleId || null }));
  },
  // ---------- Départements (RH-14) ----------
  loadDepartments,
  /**
   * Crée (POST) ou modifie (PUT) un département dans le backend, puis conserve sa partie locale (horaire).
   * Rejette l'erreur de l'API (message affichable : nom ou code déjà utilisé, responsable inactif…).
   */
  async saveDepartment(department) {
    const dto = toDepartmentDto(department);
    const res = department.id ? await departmentsApi.update(department.id, dto) : await departmentsApi.create(dto);
    const saved = mergeDepartment(res, { ...localDepartmentPart(department), id: res.id });
    putDepartment(saved);
    return saved;
  },
  /** Active ou désactive un département (PATCH) ; le refus du backend est affiché. */
  async setDepartmentActive(id, active) {
    try {
      const res = await departmentsApi.setActive(id, active);
      const local = state.db.departments.find((d) => d.id === id);
      putDepartment(mergeDepartment(res, local && localDepartmentPart(local)));
      toast(active ? 'Département réactivé' : 'Département désactivé — il reste visible et n’est plus proposé', 'info');
    } catch (err) {
      toast(err.message, 'danger');
    }
  },
  // ---------- Jours fériés (RH-20) ----------
  loadHolidays,
  /** Crée (POST) ou modifie (PUT) un jour férié de la société active ; rejette l'erreur de l'API (date déjà occupée…). */
  async saveHoliday(holiday) {
    const dto = toHolidayDto(holiday, activeCompanyId());
    const saved = mergeHoliday(holiday.id ? await holidaysApi.update(holiday.id, dto) : await holidaysApi.create(dto));
    putHoliday(saved);
    return saved;
  },
  /** Archive ou restaure un jour férié (PATCH) ; le refus du backend est affiché. */
  async setHolidayActive(id, active) {
    try {
      putHoliday(mergeHoliday(await holidaysApi.setActive(activeCompanyId(), id, active)));
      toast(active ? 'Jour férié restauré — il est de nouveau exclu du décompte des congés' : 'Jour férié archivé — il n’est plus appliqué aux nouveaux calculs', 'info');
    } catch (err) {
      toast(err.message, 'danger');
    }
  },
  // ---------- Types de documents (RH-17) ----------
  loadDocumentTypes,
  /** Crée (POST) ou modifie (PUT) un type de document ; rejette l'erreur de l'API (nom ou code déjà utilisé…). */
  async saveDocumentType(type) {
    const dto = toDocumentTypeDto(type);
    const res = type.id ? await documentTypesApi.update(type.id, dto) : await documentTypesApi.create(dto);
    const saved = fromDocumentTypeDto(res, activeCompanyId());
    putDocumentType(saved);
    return saved;
  },
  /** Active ou désactive un type de document (PATCH) ; le refus du backend est affiché. */
  async setDocumentTypeActive(id, active) {
    try {
      putDocumentType(fromDocumentTypeDto(await documentTypesApi.setActive(id, active), activeCompanyId()));
      toast(active ? 'Type de document réactivé' : 'Type de document désactivé — il n’est plus proposé à l’ajout d’un document', 'info');
    } catch (err) {
      toast(err.message, 'danger');
    }
  },
  /** Supprime un type de document (DELETE) ; rejette le refus du backend (type déjà utilisé). */
  async deleteDocumentType(id) {
    await documentTypesApi.remove(id);
    setDb((d) => ({ ...d, documentTypes: d.documentTypes.filter((x) => x.id !== id) }));
  },
  // ---------- Types de contrat ----------
  loadContractTypes,
  /** Crée (POST) ou modifie (PUT) un type de contrat ; rejette l'erreur de l'API (code déjà utilisé…). */
  async saveContractType(type) {
    const dto = toTypeContractDto(type);
    const res = type.id ? await typeContractsApi.update(type.id, dto) : await typeContractsApi.create(dto);
    const saved = fromTypeContractDto(res, activeCompanyId());
    putContractType(saved);
    return saved;
  },
  /** Active ou désactive un type de contrat (PATCH) ; le refus du backend est affiché. */
  async setContractTypeActive(id, active) {
    try {
      putContractType(fromTypeContractDto(await typeContractsApi.setActive(id, active), activeCompanyId()));
      toast(active ? 'Type de contrat réactivé' : 'Type de contrat désactivé — il n’est plus proposé pour un nouveau contrat', 'info');
    } catch (err) {
      toast(err.message, 'danger');
    }
  },
  /** Supprime un type de contrat (DELETE) ; rejette le refus du backend (type déjà utilisé). */
  async deleteContractType(id) {
    await typeContractsApi.remove(id);
    setDb((d) => ({ ...d, contractTypes: d.contractTypes.filter((x) => x.id !== id) }));
  },
  // ---------- Fonctions ----------
  loadFunctions,
  /**
   * Crée (POST) ou modifie (PUT) une fonction dans le backend ; le code est attribué par le backend.
   * Rejette l'erreur de l'API (règles d'intérim, fonction liée non solo…).
   */
  async saveFunction(fn) {
    const dto = toJobPositionDto(fn);
    const saved = mergeFunction(fn.id ? await jobPositionsApi.update(fn.id, dto) : await jobPositionsApi.create(dto));
    putFunction(saved);
    // La liaison solo est réciproque : le backend a aussi mis à jour la fonction partenaire (et détaché les anciennes).
    if (fn.relatedFunctionId || fn.id) await loadFunctions();
    return saved;
  },
  /** Supprime une fonction (DELETE) ; rejette le refus du backend (fonction encore liée). */
  async deleteFunction(id) {
    await jobPositionsApi.remove(id);
    setDb((d) => ({ ...d, functions: d.functions.filter((x) => x.id !== id) }));
  },
  /** Active ou désactive une fonction (PATCH) ; le refus du backend est affiché. */
  async setFunctionActive(id, active) {
    try {
      putFunction(mergeFunction(await jobPositionsApi.setActive(id, active)));
      toast(active ? 'Fonction réactivée' : 'Fonction archivée — elle reste visible dans l’historique', 'info');
    } catch (err) {
      toast(err.message, 'danger');
    }
  },
  loadNumbering,
  /** Enregistre la souche dans le backend (PUT) ; rejette l'erreur de validation éventuelle. */
  async saveNumbering(numbering) {
    state.numbering = await numberingApi.update(numbering);
  },
  loadCodeNumberings,
  /** Enregistre la souche d'une série (département, fonction, prime, type de contrat ou de document) dans le backend (PUT). */
  async saveCodeNumbering(entity, numbering) {
    const { entity: _, ...saved } = await codeNumberingApi.update(entity, numbering);
    state.codeNumberings = { ...state.codeNumberings, [entity]: saved };
  },
  /** Crée ou modifie un circuit ; s'il prend un département qui en avait déjà un, l'ancien est archivé (un circuit par département, RH-22). */
  loadCircuits,
  /**
   * Crée (POST) ou modifie (PUT) un circuit ; avec `replacesId`, le nouveau circuit remplace (et archive) celui du
   * département à partir de sa date d'effet. Rejette l'erreur de l'API (chevauchement, étape incomplète…).
   */
  async saveCircuit(circuit) {
    const dto = toApprovalCircuitDto(circuit, activeCompanyId());
    const saved = mergeCircuit(circuit.id ? await approvalCircuitsApi.update(circuit.id, dto) : await approvalCircuitsApi.create(dto));
    setDb((d) => ({ ...d, circuits: d.circuits.some((x) => x.id === saved.id) ? d.circuits.map((x) => (x.id === saved.id ? saved : x)) : [...d.circuits, saved] }));
    return saved;
  },
  /** Archive (circuit qui ne s'applique plus) ou restaure un circuit ; le refus du backend est rejeté. */
  async setCircuitActive(id, active) {
    const saved = mergeCircuit(await approvalCircuitsApi.setActive(activeCompanyId(), id, active));
    setDb((d) => ({ ...d, circuits: d.circuits.map((x) => (x.id === saved.id ? saved : x)) }));
    return saved;
  },
  // ---------- Rôles et permissions (RH-18, backend /api/roles) ----------
  loadRoles,
  loadEmployeeAccess,
  /**
   * Enregistre le rôle et les permissions individuelles d'un employé (PUT /api/employee-access, RH-19), puis relit les rôles
   * (nombre d'utilisateurs). Rejette le refus du backend (rôle archivé…).
   */
  async saveEmployeeAccess(employeeId, access) {
    const saved = fromEmployeeAccessDto(await employeeAccessApi.update(activeCompanyId(), employeeId, access));
    setDb((d) => ({ ...d, profiles: d.profiles.map((p) => (p.employeeId === employeeId ? { ...p, ...saved } : p)) }));
    loadRoles();
    return saved;
  },
  loadPermissionCatalog,
  loadCoreUsers,
  /**
   * Lie l'employé à un compte du Core Tenant (PUT /api/employee-access/{id}/core-account) ; '' délie. Rejette le refus du
   * backend (compte déjà lié, désactivé…), puis relit les comptes (employé lié à chacun).
   */
  async linkCoreAccount(employeeId, coreUserId) {
    const saved = fromEmployeeAccessDto(await employeeAccessApi.linkCoreAccount(activeCompanyId(), employeeId, coreUserId));
    setDb((d) => ({ ...d, profiles: d.profiles.map((p) => (p.employeeId === employeeId ? { ...p, coreUserId: saved.coreUserId } : p)) }));
    loadCoreUsers();
    return saved;
  },
  /** Crée (POST) ou modifie (PUT) un rôle : nom, description, permissions. Rejette l'erreur de l'API (nom déjà utilisé…). */
  async saveRole(role) {
    const dto = toRoleDto(role, activeCompanyId());
    const saved = mergeRole(role.id ? await rolesApi.update(role.id, dto) : await rolesApi.create(dto));
    putRole(saved);
    return saved;
  },
  /** Archive (plus attribuable) ou restaure un rôle ; le refus du backend est affiché. */
  async setRoleActive(id, active) {
    try {
      putRole(mergeRole(await rolesApi.setActive(activeCompanyId(), id, active)));
      toast(active ? 'Rôle restauré' : 'Rôle archivé — il n’est plus attribuable, ses titulaires le conservent jusqu’à réaffectation', 'info');
    } catch (err) {
      toast(err.message, 'danger');
    }
  },
  // ---------- Devises ----------
  /** Lit les devises (GET /api/devises). */
  async loadDevises() {
    if (state.devisesStatus !== 'ready') state.devisesStatus = 'loading';
    try {
      state.devises = (await devisesApi.list()).map(fromDeviseDto);
      state.devisesStatus = 'ready';
      state.devisesError = '';
    } catch (err) {
      state.devisesStatus = 'error';
      state.devisesError = err.message;
    }
  },
  /**
   * Crée (POST) ou modifie (PUT) une devise ; rejette l'erreur de l'API (doublon, valeur invalide…).
   * Activer une devise désactive l'ancienne côté backend : la liste est relue.
   */
  async saveDevise(devise) {
    const dto = toDeviseDto(devise);
    const res = devise.id ? await devisesApi.update(devise.id, dto) : await devisesApi.create(dto);
    await store.loadDevises();
    return fromDeviseDto(res);
  },
  /** Active la devise (l'ancienne devise active est désactivée par le backend). */
  async activateDevise(id) {
    await devisesApi.activate(id);
    await store.loadDevises();
  },
  async deleteDevise(id) {
    await devisesApi.remove(id);
    state.devises = state.devises.filter((d) => d.id !== id);
  },
  // ---------- Pays et téléphone ----------
  loadPhoneCountries,
  /** Crée (POST) ou modifie (PUT) un pays dans le backend ; rejette l'erreur de l'API (doublon, valeur invalide…). */
  async savePhoneCountry(country) {
    const dto = toPhoneCountryDto(country);
    const res = country.id ? await phoneCountriesApi.update(country.id, dto) : await phoneCountriesApi.create(dto);
    const saved = fromPhoneCountryDto(res);
    putCountry(saved);
    return saved;
  },
  /** Active ou désactive un pays (PUT) ; le refus du backend est affiché. */
  async setPhoneCountryActive(id, active) {
    const country = state.db.countries.find((c) => c.id === id);
    if (!country) return;
    try {
      putCountry(fromPhoneCountryDto(await phoneCountriesApi.update(id, toPhoneCountryDto({ ...country, archived: !active }))));
      toast(active ? 'Pays réactivé' : 'Pays désactivé — il n’est plus proposé pour les nouveaux numéros', 'info');
    } catch (err) {
      toast(err.message, 'danger');
    }
  },
  setArchived(key, id, archived) {
    if (key === 'departments') { store.setDepartmentActive(id, !archived); return; }
    if (key === 'countries') { store.setPhoneCountryActive(id, !archived); return; }
    if (key === 'functions') { store.setFunctionActive(id, !archived); return; }
    if (key === 'contractTypes') { store.setContractTypeActive(id, !archived); return; }
    if (key === 'documentTypes') { store.setDocumentTypeActive(id, !archived); return; }
    if (key === 'holidays') { store.setHolidayActive(id, !archived); return; }
    if (key === 'primes') { store.setPrimeActive(id, !archived); return; }
    if (key === 'roles') { store.setRoleActive(id, !archived); return; }
    if (key === 'circuits') {
      store.setCircuitActive(id, !archived)
        .then(() => toast(archived ? 'Circuit archivé' : 'Circuit restauré', 'info'))
        .catch((err) => toast(err.message, 'danger'));
      return;
    }
    if (key === 'schedules') {
      store.setScheduleStatus(id, !archived)
        .then(() => toast(archived ? 'Scénario archivé — il n’est plus proposé pour une nouvelle période' : 'Scénario réactivé', 'info'))
        .catch((err) => toast(err.message, 'danger'));
      return;
    }
    setDb((d) => ({ ...d, [key]: d[key].map((x) => (x.id === id ? { ...x, archived } : x)) }));
    toast(archived ? 'Élément archivé — il reste visible dans l’historique' : 'Élément restauré', 'info');
  },
  addItem(key, item) {
    setDb((d) => ({ ...d, [key]: [...d[key], item] }));
  },
  updateItem(key, item) {
    if (key === 'functions') { store.saveFunction(item).catch((err) => toast(err.message, 'danger')); return; }
    setDb((d) => ({ ...d, [key]: d[key].map((x) => (x.id === item.id ? item : x)) }));
  },
  setPresencePolicy(policy) {
    setDb((d) => ({ ...d, presencePolicies: [...d.presencePolicies.filter((x) => x.companyId !== policy.companyId), policy] }));
  },

  // ---------- Congés ----------
  submitLeave(input) {
    const { db, companyId } = state;
    const me = resolveCurrentUser();
    const profile = db.profiles.find((p) => p.employeeId === input.employeeId);
    const circuit = db.circuits.find((c) => c.id === profile?.circuitId);
    // Étapes figées à l'envoi (version en vigueur ce jour) : une modification ultérieure du circuit ne les change pas.
    const active = circuit ? circuitStepsFor(db, input.employeeId, circuit).filter((s) => !s.skipped) : [];
    // Seules les étapes « Validation requise » bloquent ; une « Consultation seule » reçoit la demande pour information.
    const firstBlocking = active.findIndex((s) => s.intervention !== 'consultation');
    // Sans circuit suivi (option de la fiche, ou département sans circuit) : une seule étape, validée par la RH.
    const byRh = !circuit;
    const exempt = !byRh && firstBlocking < 0;
    const at = nowStamp();
    const counted = input.startTime && input.endTime
      ? (() => { const a = countAuthorization(db, input.employeeId, input.start, input.startTime, input.endTime); return { days: a.days, hours: a.hours }; })()
      : { days: countLeaveDays(db, input.employeeId, input.start, input.end, input.startPart, input.endPart).total };
    const req = {
      id: newId('q'), companyId, ...input, ...counted,
      status: exempt ? 'approuve' : 'en_attente',
      createdAt: at, exempt,
      circuitId: circuit?.id, circuitName: circuit?.name, circuitVersion: circuit ? circuitVersionOn(circuit)?.number : undefined,
      steps: byRh
        ? [{ order: 1, rh: true, notify: true, intervention: 'validation', status: 'en_attente' }]
        : active.map((s, i) => ({
          order: i + 1, approverId: s.approverId, notify: s.notify, intervention: s.intervention,
          status: s.intervention === 'consultation' ? 'info' : i === firstBlocking ? 'en_attente' : 'a_venir',
        })),
      history: [{
        at, actorId: me.id,
        label: me.id === input.employeeId ? 'Demande envoyée' : `Demande saisie par ${me.firstName} ${me.lastName} pour le compte de l’employé`,
      }, ...(exempt ? [{
        at, actorId: me.id,
        label: `Aucun approbateur supérieur dans le circuit « ${circuit.name} » : demande approuvée automatiquement`,
      }] : []), ...(byRh ? [{
        at, actorId: me.id,
        label: 'Aucun circuit d’approbation suivi : demande transmise à la RH pour validation',
      }] : [])],
    };
    setDb((d) => {
      let next = notifyStep(notify({ ...d, requests: [req, ...d.requests] }, 'Demande envoyée', `${personName(d, req.employeeId)} — ${req.days} j`, `conges/demandes/${req.id}`), req, req.steps.find((s) => s.status === 'en_attente'));
      for (const s of req.steps.filter((x) => x.status === 'info' && x.notify)) {
        next = notify(next, 'Demande pour information', `${personName(next, req.employeeId)} — ${req.days} j, transmise à ${personName(next, s.approverId)} pour information`, `conges/demandes/${req.id}`);
      }
      return next;
    });
    return req;
  },
  decide(requestId, decision, comment) {
    const at = nowStamp();
    const me = resolveCurrentUser();
    setDb((d) => {
      const r = d.requests.find((x) => x.id === requestId);
      if (!r) return d;
      const idx = r.steps.findIndex((s) => s.status === 'en_attente');
      if (idx < 0) return d;
      const step = r.steps[idx];
      // Étape « RH » : décidée par un utilisateur habilité, enregistré comme auteur de la décision.
      const onBehalf = step.rh ? ` par la RH (${me.firstName} ${me.lastName})`
        : step.approverId !== me.id ? ` (saisie par ${me.firstName} ${me.lastName} pour ${personName(d, step.approverId)})` : '';
      // Prochaine étape bloquante : les étapes « pour information » ne s'intercalent pas dans la validation.
      const nextIdx = r.steps.findIndex((s, i) => i > idx && s.status === 'a_venir');
      const steps = r.steps.map((s, i) => {
        if (i === idx) return { ...s, status: decision === 'approve' ? 'approuve' : 'refuse', decidedAt: at, comment: comment || undefined, ...(s.rh ? { decidedBy: me.id } : {}) };
        if (decision === 'refuse' && i > idx && s.status === 'a_venir') return { ...s, status: 'ignore' };
        if (decision === 'approve' && i === nextIdx) return { ...s, status: 'en_attente' };
        return s;
      });
      const last = nextIdx < 0;
      const status = decision === 'refuse' ? 'refuse' : last ? 'approuve' : 'en_attente';
      const label = decision === 'refuse'
        ? `Demande refusée à l’étape ${idx + 1}${onBehalf}`
        : last ? `Étape ${idx + 1} approuvée — demande approuvée${onBehalf}` : `Étape ${idx + 1} approuvée${onBehalf}`;
      const updated = { ...r, steps, status, history: [...r.history, { at, actorId: step.rh ? me.id : step.approverId, label }] };
      const next = decision === 'approve' && !last ? steps[nextIdx] : undefined;
      return notifyStep({ ...d, requests: d.requests.map((x) => (x.id === requestId ? updated : x)) }, updated, next);
    });
    toast(decision === 'approve' ? 'Décision enregistrée : approuvée' : 'Décision enregistrée : refusée', decision === 'approve' ? 'success' : 'danger');
  },
  cancelLeave(requestId, reason) {
    const at = nowStamp();
    const actorId = currentUserId();
    updateRequest(requestId, (r) => ({
      ...r,
      status: 'annule',
      steps: r.steps.map((s) => (s.status === 'en_attente' || s.status === 'a_venir' ? { ...s, status: 'ignore' } : s)),
      history: [...r.history, { at, actorId, label: `Demande annulée${reason ? ` : ${reason}` : ''}` }],
    }));
    toast('Demande annulée', 'info');
  },

  // ---------- Événements et notifications ----------
  addEvent(event) {
    setDb((d) => ({ ...d, events: [...d.events, event] }));
  },
  markNotificationsRead() {
    const { companyId } = state;
    setDb((d) => ({ ...d, notifications: d.notifications.map((n) => (n.companyId === companyId ? { ...n, read: true } : n)) }));
    if (state.serverNotifications.some((n) => !n.read)) {
      updateNotifications((list) => list.map((x) => ({ ...x, read: true })), () => notificationsApi.markAllRead());
    }
  },
};

export const useStore = () => store;
