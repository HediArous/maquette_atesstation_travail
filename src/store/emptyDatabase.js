// État initial : aucune donnée. Tout est créé par l'utilisateur (ou, plus tard, chargé depuis le backend).
// « users » et « assignments » (activation de l'application RH par société) seront fournis par le backend.
// Les employés sont lus depuis le backend au démarrage (loadEmployees dans store/index.js).
export function emptyDatabase() {
  return {
    assignments: [],
    users: [],
    companies: [],
    departments: [],
    functions: [],
    functionLinks: [],
    presencePolicies: [],
    employees: [],
    profiles: [],
    schedules: [],
    /** Affectations des scénarios aux (sous-)départements, à une date d'effet (backend, RH-21). */
    scheduleAssignments: [],
    leaveTypes: [],
    leaveRules: [],
    holidays: [],
    countries: [],
    roles: [],
    circuits: [],
    primes: [],
    documentTypes: [],
    contractTypes: [],
    loadingPeriods: [],
    requests: [],
    events: [],
    notifications: [],
  };
}
