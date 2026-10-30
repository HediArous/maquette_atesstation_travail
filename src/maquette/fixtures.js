// Données inventées pour reproduire les écrans existants. Aucun dossier réel.
export const companyId = 'societe-demo';
export const company = { id: companyId, name: 'Société Démo · Maquette', color: '#2f5bd3', role: 'COMPANY_ADMIN' };
export const context = { companyId, companies: [company], user: { id: 'u1', firstName: 'Amira', lastName: 'Ben Salah', email: 'amira@example.test' }, role: 'COMPANY_ADMIN', tenant: { name: 'Maquette locale' } };
export const identities = [
  ['e1', 'Amira', 'Ben Salah', 'd1', 'Gestionnaire RH', 'femme', '2025-01-06'],
  ['e2', 'Youssef', 'Trabelsi', 'd2', 'Technicien', 'homme', '2026-02-02'],
  ['e3', 'Inès', 'Mansour', 'd1', 'Responsable administratif', 'femme', '2024-06-03'],
  ['e4', 'Mehdi', 'Gharbi', 'd2', 'Responsable production', 'homme', '2023-09-04'],
  ['e5', 'Sarra', 'Ayari', 'd3', 'Commerciale', 'femme', '2026-10-01'],
  ['e6', 'Ahmed', 'Jaziri', 'd3', 'Responsable commercial', 'homme', '2024-01-08'],
  ['e7', 'Nadia', 'Ben Amor', 'd1', 'Assistante administrative', 'femme', '2022-03-01'],
];

const trialEnd = (start, months) => { const d = new Date(`${start}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + months); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

export function createTables(permissions) {
  const employees = identities.map(([id, firstName, lastName, departmentId, jobTitle, gender, hireDate], i) => ({ id, companyId, firstName, lastName, departmentId, jobTitle, gender, hireDate, email: `employe${i + 1}@example.test`, phone: `2000000${i}`, phoneCountryId: 1, cin: `0000000${i}`, cinIssueDate: '2018-05-15', haveCnss: true, cnss: `DEMO-${i + 1}`, dateOfBirth: '1993-05-10', adresse: 'Adresse fictive · Tunis', maritalStatus: 'celibataire', numberOfChildren: 0, isActive: i !== 6, applicationNumber: `RH-2026-000${i + 1}`, statusId: i === 6 ? 4 : i === 4 ? 2 : 1, statusValue: i === 6 ? 'Contrat terminé' : i === 4 ? 'Période d’essai' : 'Actif', managerId: { d1: 'e3', d2: 'e4', d3: 'e6' }[departmentId] === id ? null : { d1: 'e3', d2: 'e4', d3: 'e6' }[departmentId], followsLeaveCircuit: true }));
  const departments = [{ id: 'd1', name: 'Administration', code: 'ADM', active: true, headId: 'e3' }, { id: 'd2', name: 'Production', code: 'PROD', active: true, headId: 'e4' }, { id: 'd3', name: 'Commercial', code: 'COM', active: true, headId: 'e6' }];
  return {
    employees, departments,
    'employee-statuses': [{ id: 1, value: 'Actif', isActive: true }, { id: 2, value: 'Période d’essai', isActive: true }, { id: 3, value: 'Suspendu', isActive: true }, { id: 4, value: 'Contrat terminé', isActive: true }],
    'type-contracts': [{ id: 'ct1', code: 'CDI', nom: 'CDI', duree: false, renouvelable: false, periodeEssai: 3, etat: true, nombreContrats: 5 }, { id: 'ct2', code: 'CDD', nom: 'CDD · exemple', duree: true, renouvelable: true, periodeEssai: 1, etat: true, nombreContrats: 1 }],
    contracts: [...employees.map((e, i) => ({ id: `c${i}`, employeeId: e.id, employeeName: `${e.firstName} ${e.lastName}`, typeContractId: [4,6].includes(i) ? 'ct2' : 'ct1', typeContractCode: [4,6].includes(i) ? 'CDD' : 'CDI', typeContractNom: [4,6].includes(i) ? 'CDD · exemple' : 'CDI', duree: [4,6].includes(i), contractStart: e.hireDate, contractEnd: i === 6 ? '2025-09-30' : i === 4 ? '2026-12-31' : null, periodeEssai: i === 4 ? 1 : 3, dateEssai: trialEnd(e.hireDate, i === 4 ? 1 : 3), etat: i !== 6, suspendu: false, statut: i === 6 ? 'TERMINE' : 'EN_COURS' })), {id:'c-ancien-e2',employeeId:'e2',employeeName:'Youssef Trabelsi',typeContractId:'ct2',typeContractCode:'CDD',typeContractNom:'CDD · ancien contrat',duree:true,contractStart:'2023-01-01',contractEnd:'2024-12-31',periodeEssai:0,etat:false,suspendu:false,statut:'TERMINE'}],
    salaries: employees.map((e, i) => ({ id: `s${i}`, employeeId: e.id, employeeName: `${e.firstName} ${e.lastName}`, startDate: e.hireDate, endDate: null, amount: [1800, 1500, 2600, 2800, 1600, 2400][i], etat: true, deviseId: 1, deviseSymbole: 'DT', deviseCodeISO: 'TND', deviseChiffreApresVirgule: 3 })),
    devises: [{ id: 1, symbole: 'DT', codeISO: 'TND', libelle: 'Dinar tunisien', chiffreApresVirgule: 3, etat: true }, { id: 2, symbole: '€', codeISO: 'EUR', libelle: 'Euro', chiffreApresVirgule: 2, etat: false }],
    'phone-country-settings': [{ id: 1, pays: 'Tunisie', indicatif: '+216', chiffresNumeroNational: 8, etat: true }],
    'job-positions': identities.map(([id, , , departmentId, name], i) => ({ id: `f${i}`, name, code: `FCT-${i + 1}`, departmentId, isInterim: false, active: true })),
    'work-schedules': [{ id: 'h1', companyId, name: 'Horaire administratif · 40 h', startDate: '2020-01-01', endDate: '2030-12-31', timezone: 'Africa/Tunis', weeklyHours: 40, active: true, departmentSchedule: true, version: 1, slots: [{ label: 'Matin', start: '08:00', end: '12:00', days: [1, 2, 3, 4, 5] }, { label: 'Après-midi', start: '13:00', end: '17:00', days: [1, 2, 3, 4, 5] }], assignments: departments.map(d => ({ id: `a-${d.id}`, departmentId: d.id, effectiveFrom: '2020-01-01' })) }],
    'document-types': [{ id: 'dt1', name: 'Pièce d’identité', code: 'ID', active: true, required: true, formats: ['pdf', 'jpg', 'png'], maxSizeMb: 10 }, { id: 'dt2', name: 'Diplôme', code: 'DIP', active: true, required: false, formats: ['pdf'], maxSizeMb: 10 }],
    roles: [{ id: 'r1', companyId, name: 'Administrateur RH', description: 'Profil fictif de revue', permissions: permissions.map(p => p.key), active: true, users: 1 }, { id: 'r2', companyId, name: 'Employé', description: 'Profil employé', permissions: ['employes.consulter','attestations.demander','attestations.voir_soi'], active: true, users: 5 }],
    'employee-access': employees.map((e, i) => ({ employeeId: e.id, roleId: i === 0 ? 'r1' : 'r2', added: [], removed: [], coreUserId: `u${i + 1}` })),
    'approval-circuits': departments.map(d => ({ id: `ci-${d.id}`, companyId, name: `Validation · ${d.name}`, departmentId: d.id, effectiveFrom: '2020-01-01', active: true, versions: [{ number: 1, effectiveFrom: '2020-01-01', createdAt: '2020-01-01T08:00:00', steps: [{ approverType: 'MANAGER', notifyApprover: true, interventionType: 'VALIDATION' }, { approverType: 'EMPLOYEE', employeeId: 'e1', notifyApprover: true, interventionType: 'VALIDATION' }] }] })),
    primes: [{ id: 'pr1', companyId, name: 'Transport · exemple', code: 'TRP', type: 'FIXE', amount: 100, assignments: 1, active: true }],
    'employee-primes': [{ employeeId: 'e2', allowPrimes: true, primes: [{ id: 'ep1', primeId: 'pr1', since: '2026-01-01' }] }],
    holidays: [{ id: 'j1', companyId, name: 'Fête de l’Indépendance', date: '2026-03-20', days: 1, recurring: true, active: true, toConfirm: false }],
    'code-numbering': ['departement', 'fonction', 'prime', 'type_document'].map(entity => ({ id: entity, entity, prefix: '', separator: '-', letters: 3 })),
    permissions, notifications: [],
  };
}
