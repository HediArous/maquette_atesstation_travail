// Données de la société active et accesseurs pratiques (équivalent d'un « sélecteur » sur la base).
import { computed } from 'vue';
import { toPersonView } from '../utils/leave';
import { useStore } from './index';

/** Société factice utilisée tant qu'aucune société n'est active, pour que les écrans n'aient jamais à tester son existence. */
const NO_COMPANY = { id: '', name: '', legalName: '', taxId: '', city: '', country: '', color: '#2f5bd3', createdAt: '' };

function build(db, companyId) {
  const by = (list) => list.filter((x) => x.companyId === companyId);
  const employees = by(db.employees);
  const people = employees.map((e) => toPersonView(db, e));
  const peopleMap = new Map(people.map((p) => [p.id, p]));
  // « departments » : départements de premier niveau ; les sous-départements s'obtiennent par subDepartments(id).
  const allDepartments = by(db.departments);
  const departments = allDepartments.filter((d) => !d.parentId);
  const company = db.companies.find((c) => c.id === companyId);
  return {
    company: company ?? NO_COMPANY,
    employees,
    employee: (id) => db.employees.find((e) => e.id === id),
    /** Employés enrichis du nom de département et de fonction. */
    people,
    activePeople: people.filter((p) => p.status !== 'inactif'),
    person: (id) => (id ? peopleMap.get(id) : undefined),
    departments,
    activeDepartments: departments.filter((d) => !d.archived),
    subDepartments: (parentId) => allDepartments.filter((d) => parentId && d.parentId === parentId),
    department: (id) => db.departments.find((d) => d.id === id),
    departmentName: (id) => db.departments.find((d) => d.id === id)?.name,
    functions: by(db.functions),
    functionLinks: by(db.functionLinks),
    presencePolicy: db.presencePolicies.find((x) => x.companyId === companyId),
    fn: (id) => db.functions.find((f) => f.id === id),
    /** Fonction solo liée (liaison réciproque) ; repli sur le sens inverse pour les liaisons enregistrées d'un seul côté. */
    linkedFunction: (f) => (f.relatedFunctionId
      ? db.functions.find((x) => x.id === f.relatedFunctionId)
      : db.functions.find((x) => x.relatedFunctionId === f.id && x.interim && x.kind === 'solo')),
    profiles: by(db.profiles),
    profile: (id) => db.profiles.find((p) => p.employeeId === id),
    schedules: by(db.schedules),
    leaveTypes: by(db.leaveTypes),
    leaveRules: by(db.leaveRules),
    holidays: by(db.holidays),
    // Paramétrage commun à toutes les sociétés (backend : /api/phone-country-settings).
    countries: db.countries,
    country: (id) => db.countries.find((c) => c.id === id),
    roles: by(db.roles),
    circuits: by(db.circuits),
    primes: by(db.primes),
    documentTypes: by(db.documentTypes),
    contractTypes: by(db.contractTypes),
    prime: (id) => db.primes.find((p) => p.id === id),
    loadingPeriods: by(db.loadingPeriods),
    requests: by(db.requests),
    events: by(db.events),
    notifications: by(db.notifications),
    leaveType: (id) => db.leaveTypes.find((t) => t.id === id),
    role: (id) => db.roles.find((r) => r.id === id),
    circuit: (id) => db.circuits.find((c) => c.id === id),
    schedule: (id) => db.schedules.find((s) => s.id === id),
  };
}

const store = useStore();
const snapshot = computed(() => build(store.db, store.companyId));

/** Lecture réactive : chaque accès relit l'instantané courant (`data.employees`, `data.person(id)`…). */
const data = new Proxy({}, { get: (_, key) => snapshot.value[key] });

export const useCompanyData = () => data;
