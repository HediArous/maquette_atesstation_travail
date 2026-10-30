<script setup>
import {isCompanyModuleEnabled,numberOptions} from '../../maquette/companyModules';
import { computed, nextTick, ref, watch } from 'vue';
import { Briefcase, CalendarClock, CheckCircle2, Clock, FileSignature, FileText, GitBranch, Hash, KeyRound, Lock, Plus, Save, Trash2, Upload, UserCog, UserRound, Users } from '@lucide/vue';
import Badge from '../../components/ui/Badge.vue';
import ScheduleEditor from '../settings/ScheduleEditor.vue';
import { documentTypesApi, fromDocumentTypeDto } from '../../api/documentTypes';
import { employeeDocumentsApi, maxSizeMbOf, sizeError } from '../../api/employeeDocuments';
import { scheduleSummary } from '../../utils/hours';
import { useStore } from '../../store';
import { newId } from '../../store/ids';
import { useCompanyData } from '../../store/companyData';
import Alert from '../../components/ui/Alert.vue';
import Drawer from '../../components/ui/Drawer.vue';
import Field from '../../components/ui/Field.vue';
import PeriodEndFields from '../../components/ui/PeriodEndFields.vue';
import Switch from '../../components/ui/Switch.vue';
import { EMPLOYEE_FIELDS, legacyStatus, statusesApi } from '../../api/employees';
import { useCoreAccountOptions } from './coreAccounts';
import FormCard from '../../components/FormCard.vue';
import PhoneField from '../../components/PhoneField.vue';
import { formatDate, TODAY } from '../../utils/dates';
import { defaultProfile } from '../../utils/leave';
import { circuitForDepartment, circuitRequiresManager, formatAmount, MARITAL_LABEL, nextMatricule, organisationalSchedule } from '../../utils/org';
import { internationalPhone, phoneError } from '../../utils/phone';
import { PRIME_TYPE } from './constants';
import EmployeePermissions from './EmployeePermissions.vue';
import LinkCoreAccountDialog from './LinkCoreAccountDialog.vue';
import ManagerSelect from './ManagerSelect.vue';
import InitialSalaries from './InitialSalaries.vue';
import { defaultTrialEnd } from '../../api/contracts';
import { fromTypeContractDto, typeContractsApi } from '../../api/typeContracts';
import { salaryLinesErrors } from '../../utils/salaries';

/**
 * Création (RH-3) et modification (RH-5, RH-6) d'une fiche employé, en quatre sections (cinq à la création) :
 * état civil, profil professionnel et mode horaire, contrat et rémunération, compte et accès, documents (création).
 * Le matricule est attribué par le backend à la création, selon la numérotation, puis ne change plus ;
 * l'horaire et le circuit découlent du rattachement.
 */
const props = defineProps({
  open: Boolean,
  /** Fiche à modifier ; absente = création. */
  employee: { type: Object, default: undefined },
});
const emit = defineEmits(['close', 'saved']);

const clone = (x) => JSON.parse(JSON.stringify(x));

function blankEmployee(defaults = {}) {
  return {
    id: '', companyId: store.companyId, firstName: '', lastName: '', gender: 'HOMME', matricule: '', cin: '', cinIssueDate: '', haveCnss: false, cnss: '', internalNumber: '', email: '', phone: '', birthDate: '', address: '',
    departmentId: '', subDepartmentId: undefined, managerId: undefined, followsLeaveCircuit: true, functionId: '', jobTitle: '', hireDate: TODAY, contract: 'CDI', status: 'essai',
    account: { login: '', active: true },
    maritalStatus: 'celibataire', childrenCount: 0, scheduleMode: 'organisation',
    salaries: [], allowPrimes: false, primes: [], history: [],
    ...defaults,
  };
}

const store = useStore();
const data = useCompanyData();
const form = ref(blankEmployee());
const profile = ref(defaultProfile(store.db, form.value));
const salary = ref('');
const submitted = ref(false);
const saving = ref(false);
const isNew = computed(() => !props.employee);
// Compte Core, rôle et permissions (étape 4) : réservés à qui gère les rôles (le backend exige roles.gerer).
const canAccess = computed(() => store.can('acces.modifier'));

// ---------- Création : contrat initial (backend /api/contracts) et périodes de salaire ----------
const TRIAL_MAX = 120;
const types = ref([]);
const typesError = ref('');
async function loadTypes() {
  try {
    types.value = (await typeContractsApi.list(true)).map((dto) => fromTypeContractDto(dto));
    typesError.value = '';
  } catch (e) {
    typesError.value = `Types de contrat indisponibles : ${e.message}`;
  }
}
const blankContract = () => ({ typeContractId: '', start: '', end: '', trialMonths: null, startCustomized: false, trialCustomized: false });
const ct = ref(blankContract());
const salaryLines = ref([]);
const ctType = computed(() => types.value.find((t) => t.id === ct.value.typeContractId));
const fixedTerm = computed(() => ctType.value?.fixedTerm ?? false);
const ctStart = computed(() => (ct.value.startCustomized ? ct.value.start : form.value.hireDate));
const trialEnd = computed(() => defaultTrialEnd(ctStart.value, ct.value.trialMonths));
// Type choisi : fin vidée pour une durée indéterminée ; période d'essai du type reprise tant qu'elle n'est pas personnalisée.
watch(() => ct.value.typeContractId, () => {
  if (!ctType.value) return;
  if (!fixedTerm.value) ct.value.end = '';
  if (!ct.value.trialCustomized) ct.value.trialMonths = ctType.value.trialMonths;
});
function onContractStart(v) { ct.value.start = v; ct.value.startCustomized = true; }
function onTrial(v) { ct.value.trialMonths = v === '' ? null : Math.max(0, Number(v)); ct.value.trialCustomized = true; }
function blockNonDigit(event) { if (['-', '+', 'e', 'E', '.', ','].includes(event.key)) event.preventDefault(); }
const contractInfo = computed(() => ({ start: ctStart.value, end: fixedTerm.value ? ct.value.end : '', fixedTerm: fixedTerm.value }));
// Revérifiées à chaque changement des lignes ou des dates du contrat.
const salaryCheck = computed(() => salaryLinesErrors(salaryLines.value, contractInfo.value, TODAY));
/** Erreurs du backend rattachées à une ligne de salaire (salaries[i].champ) ou à la liste. */
const salaryServerErrors = ref({ rows: {}, general: '' });
watch([salaryLines, contractInfo], () => { salaryServerErrors.value = { rows: {}, general: '' }; }, { deep: true });
// Erreur du serveur sur un champ du contrat : effacée dès que le contrat ou la date d'embauche change.
watch([ct, () => form.value.hireDate], () => {
  const { typeContractId, contractStart, contractEnd, trialMonths, ...rest } = serverErrors.value;
  if (typeContractId || contractStart || contractEnd || trialMonths) serverErrors.value = rest;
}, { deep: true });
const salaryRowErrors = computed(() => ({ ...salaryServerErrors.value.rows, ...salaryCheck.value.rows }));
const salaryGeneral = computed(() => salaryCheck.value.general || salaryServerErrors.value.general);

// Statuts paramétrables (backend) ; à la création, « En période d’essai » est proposé par défaut.
const statuses = ref([]);
const statusesError = ref('');
async function loadStatuses() {
  try {
    statuses.value = await statusesApi.list();
    statusesError.value = '';
    if (!form.value.statusId) {
      const def = statuses.value.find((s) => s.isActive && legacyStatus(s.value) === 'essai') ?? statuses.value.find((s) => s.isActive);
      if (def) onStatus(def.id);
    }
  } catch (e) {
    statusesError.value = `Statuts indisponibles : ${e.message}`;
  }
}
function onStatus(id) {
  const s = statuses.value.find((x) => String(x.id) === String(id));
  form.value = { ...form.value, statusId: s?.id, statusValue: s?.value, status: legacyStatus(s?.value) ?? form.value.status };
}

// Indicatif proposé par défaut : pays actif de la société, à défaut le premier pays actif paramétré.
const defaultPhoneCountryId = () => data.countries.find((c) => !c.archived && c.name === data.company.country)?.id ?? data.countries.find((c) => !c.archived)?.id;
// Le paramétrage des pays arrive du backend : il peut être chargé après l'ouverture du formulaire.
watch(() => data.countries, () => {
  if (props.open && !form.value.phoneCountryId) form.value = { ...form.value, phoneCountryId: defaultPhoneCountryId() };
});

// ---------- Création : mode horaire ----------
// « departement » et « special » gardent le mode organisationnel : l'horaire spécial est affecté après la création
// (/api/work-schedules/employee-assignment) et remplace alors celui du département ; rien n'est recopié.
const scheduleChoice = ref('departement');
const specialScheduleId = ref('');
const creatingSchedule = ref(false);
const specialSchedules = computed(() => data.schedules.filter((s) => s.departmentSchedule === false && !s.archived));
watch(scheduleChoice, (v) => { form.value.scheduleMode = v === 'chargement' ? 'chargement' : 'organisation'; });
// Nouvel horaire créé depuis le formulaire : la liste est relue par le store, il est sélectionné aussitôt.
const onScheduleCreated = (s) => { specialScheduleId.value = s.id; };

// ---------- Création : documents de l'employé (envoyés après la création de la fiche) ----------
const docTypes = ref([]);
const docTypesError = ref('');
const docs = ref([]);
async function loadDocTypes() {
  try {
    // Types actifs seulement (filtre du backend) : un type archivé n'est plus proposé au dépôt.
    docTypes.value = (await documentTypesApi.list(true)).map((dto) => fromDocumentTypeDto(dto)).filter((t) => !t.archived);
    docTypesError.value = '';
  } catch (e) {
    docTypesError.value = `Types de documents indisponibles : ${e.message}`;
  }
}
const docType = (id) => docTypes.value.find((t) => t.id === id);
const extOf = (name) => { const x = name.split('.').pop()?.toLowerCase() ?? ''; return x === 'jpeg' ? 'jpg' : x; };
const acceptOf = (t) => t?.formats.flatMap((f) => (f === 'jpg' ? ['.jpg', '.jpeg'] : [`.${f}`])).join(',');
const addDoc = () => { docs.value = [...docs.value, { key: newId('doc'), typeId: '', file: null }]; };
const removeDoc = (key) => { docs.value = docs.value.filter((d) => d.key !== key); };
const docErrors = computed(() => Object.fromEntries(docs.value.flatMap((d) => {
  const t = docType(d.typeId);
  const e = !d.typeId ? 'Type requis.' : !d.file ? 'Fichier requis.'
    : t && !t.formats.includes(extOf(d.file.name)) ? `Formats acceptés : ${t.formats.join(', ')}.`
      : sizeError(d.file, t);
  return e ? [[d.key, e]] : [];
})));
const requiredDocTypes = computed(() => docTypes.value.filter((t) => t.required));

/** Erreurs renvoyées par le backend, rattachées à un champ ; effacées dès que le champ change. */
const serverErrors = ref({});

watch(() => [props.open, props.employee, store.companyId], () => {
  if (!props.open) return;
  submitted.value = false;
  salary.value = '';
  ct.value = blankContract();
  salaryLines.value = [];
  salaryServerErrors.value = { rows: {}, general: '' };
  if (!props.employee) { loadTypes(); loadDocTypes(); }
  scheduleChoice.value = 'departement';
  specialScheduleId.value = '';
  docs.value = [];
  const base = props.employee
    ? clone(props.employee)
    : blankEmployee({ phoneCountryId: defaultPhoneCountryId() });
  form.value = base;
  serverErrors.value = {};
  profile.value = clone(data.profile(base.id) ?? defaultProfile(store.db, base));
  // Comptes du Core Tenant proposés à la liaison (étape 4), relus à chaque ouverture.
  if (canAccess.value) store.loadCoreUsers();
  // Compteur à jour pour l'aperçu du matricule (il a pu avancer depuis le dernier chargement).
  if (!props.employee) store.loadNumbering();
  loadStatuses();
}, { immediate: true });

// Nouveau dossier : aperçu du matricule que le backend attribuera (il dépend de l'année d'embauche si elle y figure) ;
// le numéro définitif est celui renvoyé à la création.
const matricule = computed(() => {
  if (!isNew.value) return form.value.matricule;
  return store.numbering ? nextMatricule(store.numbering, store.db.employees, form.value.hireDate || TODAY) : '';
});

const deps = computed(() => data.departments.filter((d) => !d.archived));
const subs = computed(() => data.subDepartments(form.value.departmentId).filter((d) => !d.archived || d.id === form.value.subDepartmentId));
const fns = computed(() => data.functions.filter((f) => !f.archived && (!form.value.departmentId || !f.departmentId || f.departmentId === form.value.departmentId)));
const managers = computed(() => data.employees.filter((e) => e.id !== form.value.id && e.status !== 'inactif'));
const selectedFn = computed(() => data.fn(form.value.functionId));
const soloTakenBy = computed(() => (selectedFn.value?.interim && selectedFn.value.kind === 'solo'
  ? data.employees.find((e) => e.id !== form.value.id && e.functionId === selectedFn.value.id && e.status !== 'inactif') : undefined));
const fnHint = computed(() => {
  if (soloTakenBy.value) return `Fonction solo déjà occupée par ${soloTakenBy.value.firstName} ${soloTakenBy.value.lastName}.`;
  if (!selectedFn.value) return '';
  if (!selectedFn.value.interim) return 'Sans règle d’intérim.';
  return selectedFn.value.kind === 'solo' ? 'Intérim solo (une seule personne).' : 'Intérim groupe (plusieurs personnes).';
});

// Rattachement automatique (RH-3, RH-6, RH-23).
const circuit = computed(() => (form.value.departmentId ? circuitForDepartment(store.db, form.value.subDepartmentId || form.value.departmentId) : undefined));
// Le circuit est suivi et commence par (ou comporte) une validation du N+1 : responsable obligatoire, avec un compte utilisateur.
const followsCircuit = computed(() => !!circuit.value && form.value.followsLeaveCircuit !== false);
const needsManager = computed(() => followsCircuit.value && circuitRequiresManager(circuit.value));
const hasAccount = (employeeId) => !!data.profile(employeeId)?.coreUserId;
const manager = computed(() => data.employees.find((e) => e.id === form.value.managerId));
// Circuit suivi : le N+1 doit avoir un compte ; un employé sans compte s'associe à un compte depuis sa ligne, puis il est sélectionné.
const managerToLink = ref();
function onManagerLinked(employeeId) {
  form.value = { ...form.value, managerId: employeeId };
}
// Précisions du bloc hérité (une ligne, texte complet en info-bulle).
const scheduleDetail = computed(() => {
  if (isNew.value && scheduleChoice.value === 'special') return 'horaire spécial de l’employé';
  if (loading.value) return isNew.value ? `« non planifié » dès le ${formatDate(form.value.hireDate || TODAY)}` : moved.value ? 'inchangé par le rattachement' : 'géré par périodes';
  if (orgSchedule.value.schedule) return `${orgSchedule.value.source}${moved.value ? ' · nouvel horaire' : ''}`;
  return '';
});
const circuitDetail = computed(() => {
  if (!circuit.value || !followsCircuit.value) return 'congés validés par la RH';
  return needsManager.value ? 'validation par le N+1' : 'appliqué automatiquement';
});

const orgSchedule = computed(() => organisationalSchedule(store.db, form.value.departmentId, form.value.subDepartmentId));
const loading = computed(() => form.value.scheduleMode === 'chargement');
const moved = computed(() => !!props.employee && (props.employee.departmentId !== form.value.departmentId || props.employee.subDepartmentId !== form.value.subDepartmentId));
const activePrimes = computed(() => data.primes.filter((p) => !p.archived));
const needsEnd = computed(() => form.value.contract !== 'CDI');
const phoneCountry = computed(() => data.country(form.value.phoneCountryId));
const roleOf = computed(() => data.role(profile.value.roleId));

/** Âge en années révolues à la date du jour (dates « AAAA-MM-JJ »). */
function ageOn(birth, today) {
  const [by, bm, bd] = birth.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}
// CIN obligatoire au-delà de 18 ans, ou tant que la date de naissance n'est pas renseignée (âge inconnu).
const cinRequired = computed(() => !form.value.birthDate || ageOn(form.value.birthDate, TODAY) > 18);

// Une erreur du serveur disparaît dès que le champ concerné est modifié.
watch(() => ({ ...form.value }), (f, before) => {
  const keys = Object.keys(serverErrors.value).filter((k) => f[k] !== before?.[k] || (k === 'phone' && f.phoneCountryId !== before?.phoneCountryId));
  if (keys.length) serverErrors.value = Object.fromEntries(Object.entries(serverErrors.value).filter(([k]) => !keys.includes(k)));
});

// TEST CRUD : passer à false pour réactiver toutes les validations.
const TEST_MODE = true;

const errors = computed(() => {
  const f = form.value;
  const e = {};
  if (!f.firstName.trim()) e.firstName = 'Prénom requis.';
  if (!f.lastName.trim()) e.lastName = 'Nom requis.';
  // Circuit d'approbation des congés : N+1 doté d'un compte, s'il le valide (mêmes règles que le backend).
  if (needsManager.value && !f.managerId) e.managerId = `Le circuit « ${circuit.value.name} » demande la validation du responsable N+1 : choisissez-le.`;
  else if (followsCircuit.value && f.managerId && !hasAccount(f.managerId)) {
    e.managerId = `${manager.value ? `${manager.value.firstName} ${manager.value.lastName}` : 'Ce responsable'} n’a pas de compte utilisateur : associez-lui un compte (« Associer » dans la liste), ou désactivez le suivi du circuit.`;
  }
  // Employé qui utilise l'application : compte Core exigé (seulement si la liste du Core a pu être lue).
  if (canAccess.value && f.account.active && store.coreUsersStatus === 'ready' && !profile.value.coreUserId) e.coreUser = 'Choisissez le compte Core Tenant de l’employé.';
  const others = store.db.employees.filter((x) => x.id !== f.id);
  // Mêmes règles que le backend (source de vérité) : les doublons sont contrôlés ici sur la liste chargée, puis par le serveur.
  const email = f.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Adresse e-mail invalide.';
  else if (others.some((x) => (x.email ?? '').trim().toLowerCase() === email)) e.email = 'Cette adresse e-mail est déjà utilisée par un autre employé.';
  if (!f.statusId) e.statusId = 'Choisissez un statut.';
  if (f.birthDate && f.birthDate > TODAY) e.birthDate = 'La date de naissance ne peut pas être dans le futur.';
  const cin = f.cin.replace(/\s/g, '');
  if (!cin) {
    if (cinRequired.value) e.cin = f.birthDate ? 'CIN requise pour un employé de plus de 18 ans.' : 'CIN requise (facultative seulement pour un employé mineur : renseignez sa date de naissance).';
  } else if (!/^\d{8}$/.test(cin)) e.cin = 'La CIN doit contenir exactement 8 chiffres.';
  else if (others.some((x) => (x.cin ?? '').replace(/\s/g, '') === cin)) e.cin = 'Cette CIN est déjà attribuée à un autre employé.';
  const cnss = (f.cnss ?? '').replace(/\s/g, '');
  if (f.haveCnss && !cnss) e.cnss = 'N° CNSS requis pour un employé affilié.';
  else if (f.haveCnss && !/^\d{10}$/.test(cnss)) e.cnss = 'Le numéro CNSS doit contenir exactement 10 chiffres.';
  if(f.cinIssueDate&&(f.cinIssueDate>TODAY||f.birthDate&&f.cinIssueDate<f.birthDate))e.cinIssueDate='Date de délivrance incohérente.';
  const internal = (f.internalNumber ?? '').trim().toLowerCase();
  if(isCompanyModuleEnabled(store.companyId,'numero-interne')&&numberOptions(store.companyId).required&&!internal)e.internalNumber='Le N° interne est obligatoire pour cette société.';
  if (isCompanyModuleEnabled(store.companyId,'numero-interne') && internal && others.some((x) => (x.internalNumber ?? '').trim().toLowerCase() === internal)) e.internalNumber = 'Ce N° interne est déjà attribué à un autre employé.';
  const phoneErr = phoneError(phoneCountry.value, f.phone);
  if (phoneErr) e.phone = phoneErr;
  else {
    const intl = internationalPhone(phoneCountry.value, f.phone);
    if (intl && others.some((x) => internationalPhone(data.country(x.phoneCountryId), x.phone) === intl)) e.phone = 'Ce numéro de téléphone est déjà utilisé par un autre employé.';
  }
  if (isNew.value) {
    const c = ct.value;
    if (!c.typeContractId) e.typeContractId = 'Choisissez un type de contrat.';
    if (!ctStart.value) e.contractStart = 'Date de début du contrat requise.';
    if (fixedTerm.value && !c.end) e.contractEnd = 'Périodicité requise pour un contrat à durée déterminée.';
    else if (fixedTerm.value && c.end && ctStart.value && c.end < ctStart.value) e.contractEnd = 'La date de fin ne peut pas précéder la date de début.';
    const m = c.trialMonths;
    if (ctType.value && (m == null || !Number.isInteger(m) || m < 0 || m > TRIAL_MAX)) e.trialMonths = `Nombre entier de mois, de 0 à ${TRIAL_MAX}.`;
    else if (trialEnd.value && fixedTerm.value && c.end && trialEnd.value > c.end) e.trialMonths = 'La période d’essai dépasse la date de fin du contrat.';
    const rowKeys = Object.keys(salaryRowErrors.value);
    if (rowKeys.length) e.salaryLines = `${rowKeys.length} salaire(s) à corriger.`;
    if (salaryGeneral.value) e.salaries = salaryGeneral.value;
    if (scheduleChoice.value === 'special' && !specialScheduleId.value) e.specialScheduleId = 'Choisissez un horaire spécial ou créez-en un.';
    const docCount = Object.keys(docErrors.value).length;
    if (docCount) e.documents = `${docCount} document(s) à corriger.`;
  }
  Object.assign(e, serverErrors.value);
  // Champs secondaires ignorés en mode test.
  if (TEST_MODE) return e;
  if (!Number.isInteger(f.childrenCount) || f.childrenCount < 0) e.childrenCount = 'Nombre entier positif ou nul.';
  else if (f.maritalStatus === 'celibataire' && f.childrenCount !== 0) e.childrenCount = 'Un employé célibataire doit avoir 0 enfant à charge.';
  if (!f.departmentId) e.departmentId = 'Choisissez un département.';
  if (!f.functionId) e.functionId = 'Choisissez une fonction.';
  if (!f.hireDate) e.hireDate = 'Date d’embauche requise.';
  if (needsEnd.value && !f.contractEnd) e.contractEnd = `Date de fin requise pour un contrat ${f.contract}.`;
  else if (needsEnd.value && f.contractEnd && f.hireDate && f.contractEnd <= f.hireDate) e.contractEnd = 'La fin doit suivre la date d’embauche.';
  return e;
});
const err = (k) => (submitted.value ? errors.value[k] : undefined);
const errorCount = computed(() => Object.keys(errors.value).length);

async function save() {
  submitted.value = true;
  if (errorCount.value || saving.value) return;
  const f = form.value;
  const creating = isNew.value;
  const lines = salaryLines.value;
  const initial = creating ? {
    contract: {
      typeContractId: ct.value.typeContractId,
      contractStart: ctStart.value,
      contractEnd: fixedTerm.value ? ct.value.end : null,
      periodeEssai: ct.value.trialMonths ?? 0,
      etat: true,
    },
    salaries: lines.map((l) => ({ startDate: l.start, endDate: l.end || null, amount: l.amount, etat: l.active })),
  } : undefined;
  const draft = {
    ...f,
    contract: creating ? ctType.value?.code ?? f.contract : f.contract,
    contractEnd: creating ? (fixedTerm.value ? ct.value.end : undefined) : needsEnd.value ? f.contractEnd : undefined,
    loadingSince: creating && loading.value ? f.hireDate : f.loadingSince,
    salaries: creating ? lines.filter((l) => l.active).map((l) => ({ id: newId('sal'), amount: l.amount, since: l.start, reason: 'Salaire d’embauche' })) : f.salaries,
    primes: f.allowPrimes ? f.primes.map((p) => ({ ...p, since: creating ? f.hireDate : p.since })) : [],
  };
  saving.value = true;
  try {
    const accessBefore = creating ? undefined : data.profile(draft.id);
    const coreBefore = accessBefore?.coreUserId ?? '';
    const saved = await store.saveEmployee(draft, clone(profile.value), initial);
    // Compte du Core Tenant (connexion) : lié après la fiche, délié si l'accès est désactivé.
    const coreAfter = f.account.active ? (profile.value.coreUserId ?? '') : '';
    let linked = coreAfter;
    if (canAccess.value && coreAfter !== coreBefore) {
      try {
        await store.linkCoreAccount(saved.id, coreAfter);
      } catch (e) {
        linked = coreBefore;
        store.toast(`Fiche enregistrée, mais compte Core Tenant non lié : ${e.message}`, 'danger');
      }
    }
    // Rôle et permissions individuelles (RH-19) : seulement pour un employé associé à un compte Core, s'ils ont changé.
    const access = { roleId: profile.value.roleId, extraPermissions: profile.value.extraPermissions, removedPermissions: [] };
    const sig = (a) => JSON.stringify([a?.roleId ?? '', [...(a?.extraPermissions ?? [])].sort(), [...(a?.removedPermissions ?? [])].sort()]);
    if (canAccess.value && linked && access.roleId && sig(access) !== sig(accessBefore)) {
      try {
        await store.saveEmployeeAccess(saved.id, access);
      } catch (e) {
        store.toast(`Fiche enregistrée, mais accès non enregistrés : ${e.message}. Reprenez-les dans l’onglet Accès.`, 'danger');
      }
    }
    store.toast(creating ? `Dossier de ${saved.firstName} ${saved.lastName} créé — matricule ${saved.matricule}` : 'Fiche employé mise à jour');
    // Primes choisies à la création : autorisation puis attributions, enregistrées après la fiche (/api/employee-primes).
    if (creating && f.allowPrimes) {
      try {
        await store.setPrimesAllowed(saved.id, true);
        for (const p of draft.primes) await store.assignPrime(saved.id, p.primeId, p.since);
      } catch (e) {
        store.toast(`Dossier créé, mais primes non enregistrées : ${e.message}. Reprenez-les dans l’onglet Rémunération.`, 'danger');
      }
    }
    // Horaire spécial choisi à la création : associé à l'employé qui vient d'être créé.
    if (creating && scheduleChoice.value === 'special') {
      try {
        await store.assignEmployeeSchedule(saved.id, specialScheduleId.value);
      } catch (e) {
        store.toast(`Dossier créé, mais horaire spécial non affecté : ${e.message}. Reprenez-le dans l’onglet Temps de travail.`, 'danger');
      }
    }
    // Documents joints à la création : envoyés un par un ; un échec n'annule pas les autres.
    if (creating && docs.value.length) {
      const failed = [];
      for (const d of docs.value) {
        try {
          await employeeDocumentsApi.create(saved.id, { documentTypeId: d.typeId, file: d.file });
        } catch (e) {
          failed.push(`${d.file.name} (${e.message})`);
        }
      }
      if (failed.length) store.toast(`Dossier créé, mais documents non enregistrés : ${failed.join(', ')}. Reprenez-les dans l’onglet Documents.`, 'danger');
    }
    emit('saved', saved);
    emit('close');
  } catch (err) {
    // Erreur rattachée à un champ (doublon, format…) : affichée près du champ ; sinon, notification.
    // Contrat (contract.champ) et salaires (salaries[i].champ, salaries) : erreur affichée sur la partie concernée.
    const row = /^salaries\[(\d+)\]/.exec(err.field ?? '');
    if (row && salaryLines.value[Number(row[1])]) salaryServerErrors.value = { rows: { [salaryLines.value[Number(row[1])].key]: err.message }, general: '' };
    else if (err.field === 'salaries') salaryServerErrors.value = { rows: {}, general: err.message };
    const CONTRACT_FIELDS = { 'contract.typeContractId': 'typeContractId', 'contract.contractStart': 'contractStart', 'contract.contractEnd': 'contractEnd', 'contract.periodeEssai': 'trialMonths' };
    if (CONTRACT_FIELDS[err.field]) serverErrors.value = { ...serverErrors.value, [CONTRACT_FIELDS[err.field]]: err.message };
    const field = err.field && (EMPLOYEE_FIELDS[err.field] ?? err.field);
    if (field && field in form.value) serverErrors.value = { ...serverErrors.value, [field]: err.message };
    store.toast(`Enregistrement impossible : ${err.message}`, 'danger');
  } finally {
    saving.value = false;
  }
}

/**
 * Comptes du Core Tenant proposés : un compte lié à un autre employé ou désactivé n'est pas sélectionnable ; le compte
 * actuel reste affiché même s'il n'est plus rattaché à l'Application RH dans le Core.
 */
const coreAccounts = useCoreAccountOptions(() => profile.value.coreUserId, () => form.value.id);

// Nouveau rattachement : le circuit du département est suivi par défaut.
function onDepartment(e) {
  form.value = { ...form.value, departmentId: e.target.value, subDepartmentId: undefined, functionId: '', followsLeaveCircuit: true };
}

function togglePrime(primeId, on) {
  const f = form.value;
  f.primes = on ? [...f.primes, { primeId, since: f.hireDate }] : f.primes.filter((p) => p.primeId !== primeId);
}

function onRole(roleId) {
  const perms = data.role(roleId)?.permissions ?? [];
  profile.value = { ...profile.value, roleId, extraPermissions: profile.value.extraPermissions.filter((k) => !perms.includes(k)), removedPermissions: [] };
}

function onPhone(countryId, phone) {
  form.value = { ...form.value, phoneCountryId: countryId, phone };
}

// CNSS : le numéro saisi est gardé en mémoire si l'on repasse « Non affilié » puis « Affilié » par erreur.
const cnssInput = ref(null);
let cnssDraft = '';
const cnssDigits = computed(() => (form.value.cnss ?? '').length);
function setCnss(on) {
  const f = form.value;
  if (on === f.haveCnss) return;
  if (on) {
    f.haveCnss = true;
    f.cnss = f.cnss || cnssDraft;
    nextTick(() => cnssInput.value?.focus());
  } else {
    cnssDraft = f.cnss;
    f.haveCnss = false;
    f.cnss = '';
  }
}
function onCnss(e) {
  // Chiffres uniquement : espaces, tirets et lettres sont retirés à la saisie.
  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
  form.value.cnss = digits;
  if (e.target.value !== digits) e.target.value = digits;
}

function onChildren(e) {
  form.value.childrenCount = e.target.value === '' ? 0 : Number(e.target.value);
}
</script>

<template>
  <Drawer :open="open" wide :title="employee ? `Modifier ${employee.firstName} ${employee.lastName}` : 'Créer le dossier d’un nouvel employé'" @close="emit('close')">
    <template #subtitle>Société active : <strong>{{ data.company.name }}</strong> · les champs marqués d’un astérisque sont obligatoires.</template>

    <div class="fstack">
      <!-- 1. Informations générales et état civil -->
      <FormCard>
        <template #icon><UserRound :size="16" /></template>
        <template #title><span class="fstep">1</span> Informations générales et état civil</template>
        <div class="form-grid">
          <Field v-slot="{ id }" label="Prénom" required :error="err('firstName')">
            <input :id="id" v-model="form.firstName" autocomplete="off" placeholder="Ex. : Mohamed" />
          </Field>
          <Field v-slot="{ id }" label="Nom" required :error="err('lastName')">
            <input :id="id" v-model="form.lastName" autocomplete="off" placeholder="Ex. : Bennani" />
          </Field>
          <Field label="Genre" required>
            <div class="segmented" role="radiogroup" aria-label="Genre">
              <button type="button" role="radio" :aria-checked="form.gender === 'HOMME'" :class="{ active: form.gender === 'HOMME' }" @click="form.gender = 'HOMME'">Homme</button>
              <button type="button" role="radio" :aria-checked="form.gender === 'FEMME'" :class="{ active: form.gender === 'FEMME' }" @click="form.gender = 'FEMME'">Femme</button>
            </div>
          </Field>
          <Field label="Matricule">
            <template #hint>{{ isNew ? 'Attribué automatiquement à la création (Paramètres › Numérotation des employés).' : 'Attribué à la création ; il ne change plus.' }}</template>
            <template #default="{ id }">
              <span class="input-locked">
                <Hash :size="13" aria-hidden="true" />
                <input :id="id" :value="matricule" readonly aria-readonly="true" :placeholder="isNew ? 'Numérotation indisponible' : ''" />
                <Lock :size="12" aria-hidden="true" />
              </span>
            </template>
          </Field>
          <Field label="Téléphone" :error="err('phone')"
            :hint="store.countriesError ? `Pays indisponibles : ${store.countriesError}` : phoneCountry ? `${phoneCountry.digits} chiffres attendus pour ${phoneCountry.name}.` : 'Indicatifs paramétrés dans Paramètres › Pays et téléphone.'">
            <template #default="{ id }">
              <PhoneField :id="id" :invalid="!!err('phone')" :value="form.phone" :country-id="form.phoneCountryId"
                :countries="data.countries.filter((c) => !c.archived || c.id === form.phoneCountryId)" @change="onPhone" />
            </template>
          </Field>
          <Field v-slot="{ id }" label="CIN" :required="cinRequired" :error="err('cin')"
            :hint="cinRequired ? 'Carte d’identité nationale : 8 chiffres, unique.' : 'Facultative pour un employé de 18 ans ou moins ; 8 chiffres si renseignée.'">
            <div class="cnss-input" :class="{ invalid: !!err('cin') }">
              <input :id="id" :value="form.cin" autocomplete="off" inputmode="numeric" maxlength="8" placeholder="00000000"
                @input="form.cin = ($event.target.value = $event.target.value.replace(/\D/g, '').slice(0, 8))" />
              <span class="cnss-count" :class="{ done: form.cin.length === 8 }">{{ form.cin.length }}/8</span>
            </div>
          </Field>
          <Field v-slot="{id}" label="Date de délivrance de la CIN" :error="err('cinIssueDate')" hint="Nécessaire pour générer une attestation de travail."><input :id="id" v-model="form.cinIssueDate" type="date" :max="TODAY" :min="form.birthDate||undefined" /></Field>
          <!-- Affiliation CNSS : bloc pleine largeur, hauteur stable (la grille ne bouge pas quand on bascule). -->
          <div class="cnss-block" :class="{ on: form.haveCnss }">
            <Field label="Affiliation CNSS" required>
              <div class="segmented" role="radiogroup" aria-label="Affiliation CNSS">
                <button type="button" role="radio" :aria-checked="form.haveCnss" :class="{ active: form.haveCnss }" @click="setCnss(true)">Affilié</button>
                <button type="button" role="radio" :aria-checked="!form.haveCnss" :class="{ active: !form.haveCnss }" @click="setCnss(false)">Non affilié</button>
              </div>
            </Field>
            <Field v-if="form.haveCnss" v-slot="{ id }" label="N° CNSS" required :error="err('cnss')">
              <div class="cnss-input" :class="{ invalid: !!err('cnss') }">
                <input :id="id" ref="cnssInput" :value="form.cnss" autocomplete="off" inputmode="numeric" maxlength="10" placeholder="0000000000"
                  :aria-describedby="`${id}-count`" @input="onCnss" />
                <span :id="`${id}-count`" class="cnss-count" :class="{ done: cnssDigits === 10 }">{{ cnssDigits }}/10</span>
              </div>
            </Field>
            <p v-else class="cnss-off">Aucun numéro CNSS n’est enregistré pour un employé non affilié.</p>
          </div>
          <Field v-if="isCompanyModuleEnabled(store.companyId,'numero-interne')" v-slot="{ id }" :required="numberOptions(store.companyId).required" label="N° interne" :error="err('internalNumber')" hint="Numéro interne propre à l’entreprise, unique."><input :id="id" v-model="form.internalNumber" autocomplete="off" /></Field>
          <div class="fhighlight">
            <Field v-slot="{ id }" label="Date de naissance" :error="err('birthDate')"><input :id="id" v-model="form.birthDate" type="date" :max="TODAY" /></Field>
            <Field v-slot="{ id }" label="Situation matrimoniale" required :hint="employee ? 'Historisée.' : ''">
              <select :id="id" v-model="form.maritalStatus" @change="form.maritalStatus === 'celibataire' && (form.childrenCount = 0)"><option v-for="(label, k) in MARITAL_LABEL" :key="k" :value="k">{{ label }}</option></select>
            </Field>
            <Field v-if="form.maritalStatus !== 'celibataire'" v-slot="{ id }" label="Enfants à charge" required :error="err('childrenCount')">
              <input :id="id" type="number" min="0" step="1" :value="form.childrenCount" @input="onChildren" />
            </Field>
          </div>
          <Field v-slot="{ id }" label="E-mail professionnel" required :error="err('email')"><input :id="id" v-model="form.email" type="email" placeholder="prenom.nom@societe.ma" /></Field>
          <Field v-slot="{ id }" :label="isNew ? 'Statut initial' : 'Statut'" required :error="err('statusId')"
            :hint="statusesError || 'Liste paramétrée dans Paramètres › Statuts des employés.'">
            <select :id="id" :value="form.statusId ?? ''" @change="onStatus($event.target.value)">
              <option value="">Sélectionner un statut…</option>
              <option v-for="s in statuses.filter((x) => x.isActive || x.id === form.statusId)" :key="s.id" :value="s.id">{{ s.value }}</option>
            </select>
          </Field>
          <Field v-slot="{ id }" label="Adresse postale"><input :id="id" v-model="form.address" placeholder="Rue, ville, code postal" /></Field>
        </div>
      </FormCard>

      <!-- 2. Profil professionnel et mode horaire -->
      <FormCard subtitle="L’horaire organisationnel et le circuit d’approbation découlent du rattachement.">
        <template #icon><Briefcase :size="16" /></template>
        <template #title><span class="fstep">2</span> Profil professionnel et mode horaire</template>
        <div class="form-grid">
          <Field v-slot="{ id }" label="Département" required :error="err('departmentId')">
            <select :id="id" :value="form.departmentId" @change="onDepartment">
              <option value="">Sélectionner un département…</option>
              <option v-for="d in deps" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </Field>
          <Field v-slot="{ id }" label="Sous-département" :hint="form.departmentId && subs.length === 0 ? 'Ce département n’a pas de sous-département.' : ''">
            <select :id="id" :value="form.subDepartmentId ?? ''" :disabled="subs.length === 0" @change="form.subDepartmentId = $event.target.value || undefined">
              <option value="">Aucun</option>
              <option v-for="d in subs" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </Field>
          <Field v-slot="{ id }" label="Fonction" required :error="err('functionId')" :hint="fnHint">
            <select :id="id" v-model="form.functionId">
              <option value="">Sélectionner…</option>
              <option v-for="f in fns" :key="f.id" :value="f.id">{{ f.name }}{{ f.interim ? ` (${f.kind === 'solo' ? 'solo' : 'groupe'})` : '' }}</option>
            </select>
          </Field>
          <Field v-slot="{ id }" label="Responsable hiérarchique (N+1)" :required="needsManager" :error="err('managerId')"
            :hint="needsManager ? 'Valide les congés de l’employé : il doit avoir un compte utilisateur.' : followsCircuit ? 'Circuit suivi : le responsable doit avoir un compte utilisateur.' : ''">
            <ManagerSelect :id="id" :model-value="form.managerId ?? ''" :options="managers" :has-account="hasAccount"
              :require-account="needsManager" :lock-without-account="followsCircuit" :can-link="canAccess" :invalid="!!err('managerId')"
              @update:model-value="form.managerId = $event || undefined" @link="managerToLink = $event" />
          </Field>
          <Field v-slot="{ id }" label="Titre d’emploi" hint="Facultatif : intitulé du poste sur les documents RH (distinct de la fonction).">
            <input :id="id" v-model="form.jobTitle" maxlength="255" autocomplete="off" placeholder="Ex. : Comptable senior" />
          </Field>
          <Field v-slot="{ id }" label="Date d’embauche" required :error="err('hireDate')"><input :id="id" v-model="form.hireDate" type="date" /></Field>
        </div>

        <!-- Mode horaire : horaire du département (par défaut), horaire spécial de l'employé, ou tableau de chargement -->
        <template v-if="isNew">
          <p class="finherit-title mt-12">Mode horaire</p>
          <div class="deduct-choice mode-choice" role="radiogroup" aria-label="Mode horaire">
            <label :class="['deduct-option', { checked: scheduleChoice === 'departement' }]">
              <input v-model="scheduleChoice" type="radio" name="emp-mode" value="departement" />
              <Clock :size="18" aria-hidden="true" />
              <span><span class="person-name">Horaire du département</span><span class="block small text-muted">Par défaut : l’horaire applicable au département ou au sous-département.</span></span>
            </label>
            <label v-if="store.can('horaires_employes.modifier')" :class="['deduct-option', { checked: scheduleChoice === 'special' }]">
              <input v-model="scheduleChoice" type="radio" name="emp-mode" value="special" />
              <UserCog :size="18" aria-hidden="true" />
              <span><span class="person-name">Horaire spécial de l’employé</span><span class="block small text-muted">Un horaire réservé aux employés, qui remplace celui du département.</span></span>
            </label>
            <!-- Tableau de chargement : masqué pour le moment (module pas encore proposé). Décommenter pour le réafficher.
            <label :class="['deduct-option', { checked: scheduleChoice === 'chargement' }]">
              <input v-model="scheduleChoice" type="radio" name="emp-mode" value="chargement" />
              <CalendarClock :size="18" aria-hidden="true" />
              <span><span class="person-name">Tableau de chargement</span><span class="block small text-muted">Horaire planifié par périodes (rotations), dès la date d’embauche.</span></span>
            </label>
            -->
          </div>
          <div v-if="scheduleChoice === 'special'" class="form-grid mt-12">
            <Field v-slot="{ id }" label="Horaire spécial" required :error="err('specialScheduleId')"
              :hint="specialSchedules.length ? 'Horaires de type « Horaire spécial d’employé » (Paramètres › Scénarios d’horaires).' : 'Aucun horaire spécial actif : créez-en un.'">
              <select :id="id" v-model="specialScheduleId">
                <option value="">Sélectionner un horaire…</option>
                <option v-for="s in specialSchedules" :key="s.id" :value="s.id">{{ s.name }} — {{ scheduleSummary(s) }}</option>
              </select>
            </Field>
            <div class="fspecial-new">
              <button type="button" class="btn btn-sm btn-ghost" @click="creatingSchedule = true"><Plus :size="13" aria-hidden="true" /> Créer un nouvel horaire</button>
            </div>
          </div>
        </template>
        <p v-else class="fnote mt-12"><Clock :size="13" aria-hidden="true" /> Mode horaire : <strong>{{ loading ? 'tableau de chargement' : 'organisationnel' }}</strong> — il se change depuis la fiche (onglet Temps de travail).</p>

        <!-- Horaire et circuit hérités du rattachement : une ligne compacte chacun (libellé | valeur · précision | option). -->
        <div class="finh" aria-label="Horaire et circuit d’approbation hérités">
          <p v-if="!form.departmentId" class="finh-empty">Horaire et circuit d’approbation : sélectionnez un département.</p>
          <template v-else>
            <div class="finh-row">
              <span class="finh-label"><Clock :size="13" aria-hidden="true" /> Horaire</span>
              <span class="finh-value" :title="scheduleDetail">
                <template v-if="isNew && scheduleChoice === 'special'">{{ data.schedule(specialScheduleId)?.name ?? 'Horaire spécial à choisir' }}</template>
                <template v-else-if="loading">Tableau de chargement</template>
                <template v-else-if="orgSchedule.schedule">{{ orgSchedule.schedule.name }}</template>
                <span v-else class="finh-warn">Aucun horaire défini</span>
                <span v-if="scheduleDetail" class="finh-detail"> · {{ scheduleDetail }}</span>
              </span>
            </div>
            <div class="finh-row">
              <span class="finh-label"><GitBranch :size="13" aria-hidden="true" /> Circuit</span>
              <span class="finh-value" :title="circuitDetail">
                {{ circuit ? circuit.name : 'Aucun circuit' }}
                <span class="finh-detail"> · {{ circuitDetail }}</span>
              </span>
              <Switch v-if="circuit" v-model="form.followsLeaveCircuit" class="finh-switch" label="Suivre" />
            </div>
          </template>
        </div>
      </FormCard>

      <!-- 3. Contrat, salaire et primes -->
      <FormCard :subtitle="isNew ? '' : 'Le salaire et les primes se gèrent dans l’onglet Rémunération de la fiche.'">
        <template #icon><FileSignature :size="16" /></template>
        <template #title><span class="fstep">3</span> Contrat, salaire et primes</template>
        <template v-if="isNew">
          <Alert v-if="typesError" tone="danger" title="Types de contrat non chargés" class="mb-12">{{ typesError }}</Alert>
          <div class="form-grid">
            <Field v-slot="{ id }" label="Type de contrat" required :error="err('typeContractId')"
              :hint="ctType ? `${ctType.fixedTerm ? 'Durée déterminée' : 'Durée indéterminée'} · ${ctType.trialMonths ? `essai de ${ctType.trialMonths} mois` : 'sans période d’essai'}` : 'Types paramétrés dans Paramètres › Types de contrat.'">
              <select :id="id" v-model="ct.typeContractId">
                <option value="" disabled>Choisir…</option>
                <option v-for="t in types" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </Field>
            <Field v-slot="{ id }" label="Date de début du contrat" required :error="err('contractStart')" :hint="ct.startCustomized ? '' : 'Par défaut : la date d’embauche.'">
              <input :id="id" type="date" :value="ctStart" @input="onContractStart($event.target.value)" />
            </Field>
            <PeriodEndFields v-model="ct.end" :start="ctStart" :required="fixedTerm" :disabled="!fixedTerm" :error="err('contractEnd')"
              end-label="Date de fin du contrat" :hint="ctType && !fixedTerm ? 'Sans objet pour un contrat à durée indéterminée.' : undefined" />
            <Field v-slot="{ id }" label="Période d’essai" :error="err('trialMonths')"
              :hint="trialEnd ? `Fin de l’essai le ${formatDate(trialEnd)}.` : ctType ? `Proposée par le type : ${ctType.trialMonths} mois ; modifiable.` : 'Proposée par le type de contrat ; modifiable.'">
              <span class="input-suffix">
                <input :id="id" type="number" min="0" :max="TRIAL_MAX" step="1" inputmode="numeric" :value="ct.trialMonths ?? ''" :disabled="!ctType" placeholder="0"
                  @keydown="blockNonDigit" @input="onTrial($event.target.value)" />
                <span aria-hidden="true">mois</span>
              </span>
            </Field>
          </div>
          <InitialSalaries v-model="salaryLines" :contract="contractInfo" :devise="store.activeDevise"
            :row-errors="salaryRowErrors" :general="salaryGeneral" :show-errors="submitted" />
        </template>
        <div v-else class="form-grid">
          <Field v-slot="{ id }" label="Type de contrat" required>
            <select :id="id" v-model="form.contract">
              <option value="CDI">Contrat à durée indéterminée (CDI)</option>
              <option value="CDD">Contrat à durée déterminée (CDD)</option>
              <option value="Stage">Convention de stage</option>
            </select>
          </Field>
          <Field v-slot="{ id }" label="Date de fin de contrat" :required="needsEnd" :error="err('contractEnd')" :hint="needsEnd ? '' : 'Sans objet pour un CDI.'">
            <input :id="id" type="date" :value="needsEnd ? form.contractEnd ?? '' : ''" :disabled="!needsEnd" :min="form.hireDate" @input="form.contractEnd = $event.target.value || undefined" />
          </Field>
        </div>
        <div v-if="isNew" class="fprimes">
          <Switch :model-value="form.allowPrimes" label="Autoriser les primes pour cet employé" @update:model-value="(v) => { form.allowPrimes = v; if (!v) form.primes = []; }" />
          <span class="small text-muted">Décoché par défaut.</span>
          <template v-if="form.allowPrimes">
            <p v-if="activePrimes.length === 0" class="small text-muted mt-8">Aucune prime active dans le catalogue (Paramètres › Catalogue des primes).</p>
            <div v-else class="perm-options">
              <label v-for="p in activePrimes" :key="p.id" :class="['perm-option', { on: form.primes.some((x) => x.primeId === p.id) }]">
                <input type="checkbox" :checked="form.primes.some((x) => x.primeId === p.id)" @change="togglePrime(p.id, $event.target.checked)" />
                <span>{{ p.name }} <span class="text-muted small">— {{ formatAmount(p.amount, store.activeDevise) }}, {{ PRIME_TYPE[p.type]?.toLowerCase() }}</span></span>
              </label>
            </div>
          </template>
        </div>
      </FormCard>

      <!-- 4. Compte utilisateur, rôle et permissions -->
      <FormCard v-if="canAccess">
        <template #icon><KeyRound :size="16" /></template>
        <template #title><span class="fstep">4</span> Compte utilisateur, rôle et permissions</template>
        <template #actions><Switch v-model="form.account.active" label="Accès activé" /></template>
        <p v-if="!form.account.active" class="fnote"><Users :size="13" aria-hidden="true" /> Sans compte, l’employé n’accède pas à l’application RH ; son dossier est géré par la RH.</p>
        <template v-else>
          <Alert v-if="store.coreUsersStatus === 'error'" tone="warning" title="Comptes du Core Tenant indisponibles" class="mb-12">
            {{ store.coreUsersError }} <button type="button" class="link-btn" @click="store.loadCoreUsers()">Réessayer</button>
          </Alert>
          <p v-else-if="store.coreUsersStatus === 'ready' && !store.coreUsers.length" class="fnote">
            <Users :size="13" aria-hidden="true" /> Aucun compte rattaché à l’Application RH dans cette société : rattachez d’abord l’utilisateur depuis le Core Tenant.
          </p>
        <div class="form-grid">
          <Field v-slot="{ id }" label="Compte Core Tenant" required :error="err('coreUser')"
            hint="L’employé se connecte au Core Tenant avec ses identifiants, puis ouvre l’application RH.">
            <select :id="id" v-model="profile.coreUserId" :disabled="store.coreUsersStatus === 'loading' && !coreAccounts.length">
              <option value="">{{ store.coreUsersStatus === 'loading' ? 'Chargement des comptes…' : 'Choisir un compte' }}</option>
              <option v-for="u in coreAccounts" :key="u.id" :value="u.id" :disabled="u.disabled">{{ u.label }}</option>
            </select>
          </Field>
          <Field v-slot="{ id }" label="Rôle" hint="Les permissions du rôle s’appliquent automatiquement.">
            <select :id="id" :value="profile.roleId" @change="onRole($event.target.value)">
              <option v-if="!roleOf" value="">Aucun rôle</option>
              <option v-for="r in data.roles.filter((x) => !x.archived || x.id === profile.roleId)" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
          </Field>
          <div class="span-2 extra-perms-field">
            <p class="extra-perms-title">Permissions <span class="text-muted">(celles du rôle, et des ajouts hors rôle)</span></p>
            <EmployeePermissions v-model="profile.extraPermissions" :role-permissions="roleOf?.permissions ?? []" />
          </div>
        </div>
        </template>
      </FormCard>

      <!-- 5. Documents de l'employé (création) : envoyés au dossier après sa création -->
      <FormCard v-if="isNew" subtitle="Facultatif : joignez les pièces déjà disponibles. Les types sont paramétrés dans Paramètres › Types de documents.">
        <template #icon><FileText :size="16" /></template>
        <template #title><span class="fstep">5</span> Documents de l’employé</template>
        <Alert v-if="docTypesError" tone="danger" title="Types de documents non chargés" class="mb-12">{{ docTypesError }}</Alert>
        <div v-if="requiredDocTypes.length" class="fdoc-required">
          <span class="small text-muted">Pièces obligatoires :</span>
          <Badge v-for="t in requiredDocTypes" :key="t.id" :tone="docs.some((d) => d.typeId === t.id && d.file) ? 'success' : 'muted'">
            <CheckCircle2 v-if="docs.some((d) => d.typeId === t.id && d.file)" :size="11" aria-hidden="true" /> {{ t.name }}
          </Badge>
        </div>
        <p v-if="docs.length === 0" class="fnote"><FileText :size="13" aria-hidden="true" /> Aucun document joint pour l’instant.</p>
        <!-- Une ligne par pièce : type, fichier (limite du type contrôlée dès le choix), suppression -->
        <div v-else class="fdocs">
          <div v-for="(d, i) in docs" :key="d.key" class="fdoc-row">
            <Field v-slot="{ id }" label="Type de document" :error="submitted && !d.typeId ? 'Type requis.' : undefined">
              <select :id="id" v-model="d.typeId">
                <option value="">Sélectionner…</option>
                <option v-for="t in docTypes" :key="t.id" :value="t.id">{{ t.name }}{{ t.required ? ' *' : '' }}</option>
              </select>
            </Field>
            <Field v-slot="{ id }" label="Fichier" :error="(d.file || submitted) && d.typeId ? docErrors[d.key] : undefined"
              :hint="docType(d.typeId) ? `Taille maximale : ${maxSizeMbOf(docType(d.typeId))} Mo · formats : ${docType(d.typeId).formats.join(', ')}` : 'La taille maximale dépend du type de document choisi.'">
              <label :class="['ffile', { 'has-file': d.file, invalid: d.file && docErrors[d.key], locked: !d.typeId }]" :for="id">
                <Upload :size="13" aria-hidden="true" />
                <span class="ffile-name">{{ d.file?.name || (docType(d.typeId) ? `Insérer un document (${maxSizeMbOf(docType(d.typeId))} Mo max)…` : 'Choisissez d’abord le type de document') }}</span>
                <input :id="id" type="file" :disabled="!d.typeId" :accept="acceptOf(docType(d.typeId))" @change="d.file = $event.target.files?.[0] ?? null" />
              </label>
            </Field>
            <button type="button" class="icon-btn icon-btn-danger fdoc-remove" :aria-label="`Supprimer le document ${i + 1}`" title="Retirer cette pièce" @click="removeDoc(d.key)"><Trash2 :size="14" /></button>
          </div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm fdoc-add" :disabled="docTypes.length === 0" @click="addDoc"><Plus :size="13" aria-hidden="true" /> Ajouter un document</button>
      </FormCard>
    </div>
    <!-- Création d'un horaire spécial : éditeur de scénario existant, sans fermer le formulaire -->
    <ScheduleEditor v-if="creatingSchedule" special @saved="onScheduleCreated" @close="creatingSchedule = false" />

    <template #footer>
      <span v-if="submitted && errorCount > 0" class="footer-note text-danger">{{ errorCount }} champ(s) à corriger</span>
      <span v-else-if="isNew && matricule" class="footer-note">Matricule prévu : <strong class="mono">{{ matricule }}</strong></span>
      <span class="spacer" />
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
        <Save :size="15" aria-hidden="true" /> {{ saving ? 'Enregistrement…' : isNew ? 'Créer le dossier' : 'Enregistrer' }}
      </button>
    </template>
  </Drawer>
  <LinkCoreAccountDialog :employee="managerToLink" @close="managerToLink = undefined" @linked="onManagerLinked" />
</template>

<style scoped>
/* Horaire et circuit hérités : bandeau compact, une ligne par élément. */
.finh { margin-top: 12px; padding: 4px 12px; border-radius: 8px; background: #f6f8fb; border: 1px solid #e8ecf2; }
.finh-empty { margin: 0; padding: 5px 0; font-size: 12.5px; color: #64748b; }
.finh-row { display: flex; align-items: center; gap: 10px; min-height: 30px; font-size: 12.5px; }
.finh-row + .finh-row { border-top: 1px solid #e8ecf2; }
.finh-label { display: inline-flex; align-items: center; gap: 5px; flex: 0 0 82px; font-size: 11.5px; font-weight: 600; color: #8a96a8; }
.finh-label svg { color: #0b5cc0; }
.finh-value { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: #0f172a; }
.finh-detail { font-weight: 400; color: #64748b; }
.finh-warn { color: #b45309; }
.finh-switch { flex: none; font-size: 12px; }
/* Étape 5 : pièces jointes, une ligne compacte par document (type | fichier | retirer), alignées sur la ligne des champs. */
.fdoc-required { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 10px; }
.fdocs { display: flex; flex-direction: column; gap: 8px; }
.fdoc-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) 32px; gap: 10px; align-items: start; padding: 10px 12px; border: 1px solid #e8ecf2; border-radius: 10px; background: #fcfdfe; }
.fdoc-row :deep(.field) { margin: 0; min-width: 0; }
.fdoc-row :deep(select) { width: 100%; height: 32px; }
.fdoc-row .ffile { position: relative; }
.fdoc-row .ffile.locked { cursor: not-allowed; opacity: .7; }
.fdoc-row .ffile.invalid { border-color: var(--danger, #dc2626); border-style: solid; background: #fff6f5; color: #b42318; }
/* Bouton de suppression aligné sur les champs (sous les libellés). */
.fdoc-remove { margin-top: 21px; }
.fdoc-add { margin-top: 10px; }
@media (max-width: 640px) {
  .fdoc-row { grid-template-columns: minmax(0, 1fr); }
  .fdoc-remove { justify-self: end; margin-top: 0; }
}
</style>
