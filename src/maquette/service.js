import { companyId, context, identities, createTables } from './fixtures.js';
import permissions from './permissions.js';

const tables = createTables(permissions);
const settings = { 'employee-numbering': { prefix: 'RH', separator: '-', withYear: true, digits: 4, next: 7 }, 'contract-alert-settings': { enabled: true, daysBefore: 30 } };
const documents = new Map();
const history = new Map(identities.map(([id, first, last]) => [id, [{ id: `hist-${id}`, changeDate: '2026-10-01T09:00:00', changeType: 'CREATION', fieldName: 'employee', fieldLabel: 'Dossier employé', changeDescription: `Création du dossier fictif de ${first} ${last}`, modifiedById: 'u1', modifiedByName: 'Amira Ben Salah' }]]));
const clone = value => value === undefined ? undefined : structuredClone(value);
const name = id => { const e = tables.employees.find(e => e.id === id); return e ? `${e.firstName} ${e.lastName}` : ''; };
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' });
let sequence = 100;
export const localEmployeeParts = () => identities.map(([id], i) => ({ id, companyId, functionId: `f${i}`, account: { login: `employe${i + 1}@example.test`, active: true }, scheduleMode: 'organisation', salaries: [], history: [] }));

function paginate(rows, criteria) {
  let filtered = [...rows];
  if (criteria.search) filtered = filtered.filter(r => Object.values(r).join(' ').toLowerCase().includes(String(criteria.search).toLowerCase()));
  for (const field of ['employeeId', 'typeContractId', 'statusId', 'gender', 'maritalStatus', 'haveCnss', 'etat', 'duree', 'lastName', 'firstName', 'cin', 'applicationNumber', 'internalNumber', 'email', 'phone', 'cnss', 'jobTitle']) {
    if (criteria[field] === undefined || criteria[field] === '') continue;
    filtered = filtered.filter(r => ['lastName', 'firstName', 'email', 'phone', 'jobTitle', 'cin', 'cnss', 'internalNumber'].includes(field) ? String(r[field] ?? '').toLowerCase().includes(String(criteria[field]).toLowerCase()) : String(r[field]) === String(criteria[field]));
  }
  if (criteria.matricule) filtered = filtered.filter(r => r.applicationNumber?.includes(criteria.matricule));
  if (criteria.ids) filtered = filtered.filter(r => criteria.ids.includes(r.id));
  if (criteria.employeeIds) filtered = filtered.filter(r => criteria.employeeIds.includes(r.employeeId));
  if (criteria.hireDateFrom) filtered = filtered.filter(r => r.hireDate >= criteria.hireDateFrom);
  if (criteria.hireDateTo) filtered = filtered.filter(r => r.hireDate <= criteria.hireDateTo);
  const page = Math.max(0, Number(criteria.page) || 0), size = Math.max(1, Number(criteria.size) || 20);
  return { content: filtered.slice(page * size, (page + 1) * size), page, size, totalElements: filtered.length, totalPages: Math.ceil(filtered.length / size), archivedCount: rows.filter(r => r.active === false || r.etat === false).length };
}

function dashboard() {
  const employees = tables.employees, contracts = tables.contracts.filter(c => c.etat && !c.suspendu), salaries = tables.salaries.filter(s => s.etat), totalPay = salaries.reduce((sum, s) => sum + Number(s.amount), 0);
  const year = today().slice(0, 4);
  return { today: today(), workforce: { total: employees.length, present: employees.filter(e => e.isActive !== false).length, trial: employees.filter(e => Number(e.statusId) === 2).length, leaving: 0, exited: employees.filter(e => e.isActive === false).length, women: employees.filter(e => e.gender === 'femme').length, men: employees.filter(e => e.gender === 'homme').length, hiredLast30Days: employees.filter(e => e.hireDate >= `${year}-10-01`).length, hiredThisYear: employees.filter(e => e.hireDate.startsWith(year)).length, cnssAffiliated: employees.filter(e => e.haveCnss).length, linkedAccounts: tables['employee-access'].filter(a => a.coreUserId).length, byStatus: tables['employee-statuses'].map(s => ({ label: s.value, count: employees.filter(e => Number(e.statusId) === s.id).length })), hiresByMonth: Array.from({ length: 12 }, (_, i) => { const month = `${year}-${String(i + 1).padStart(2, '0')}`; return { month, count: employees.filter(e => e.hireDate.startsWith(month)).length }; }), recentHires: [...employees].sort((a, b) => b.hireDate.localeCompare(a.hireDate)).slice(0, 4).map(e => ({ id: e.id, name: name(e.id), jobTitle: e.jobTitle, hireDate: e.hireDate, status: e.statusValue })) }, contracts: { inForce: contracts.length, fixedTerm: contracts.filter(c => c.duree).length, openEnded: contracts.filter(c => !c.duree).length, suspended: tables.contracts.filter(c => c.suspendu).length, alertDays: settings['contract-alert-settings'].daysBefore, endingSoon: 0, byType: tables['type-contracts'].map(t => ({ label: t.nom, count: contracts.filter(c => c.typeContractId === t.id).length })), ending: [] }, payroll: { monthlyTotal: totalPay, average: salaries.length ? totalPay / salaries.length : 0, employeesPaid: salaries.length, employeesWithoutSalary: employees.length - salaries.length }, primes: { catalogActive: tables.primes.filter(p => p.active).length, assignments: tables['employee-primes'].reduce((n, p) => n + p.primes.length, 0), employeesWithPrimes: tables['employee-primes'].length, employeesAllowed: tables['employee-primes'].filter(p => p.allowPrimes).length }, organisation: { departments: tables.departments.length, jobPositions: tables['job-positions'].length, circuits: tables['approval-circuits'].length, upcomingHolidays: [] }, attention: [] };
}

function decorate(resource, row) {
  if (resource === 'employees') { const status = tables['employee-statuses'].find(s => String(s.id) === String(row.statusId)); row.statusValue = status?.value ?? 'Actif'; }
  if (resource === 'contracts') { const type = tables['type-contracts'].find(t => t.id === row.typeContractId); Object.assign(row, { employeeName: name(row.employeeId), typeContractCode: type?.code, typeContractNom: type?.nom, duree: type?.duree, statut: row.suspendu ? 'SUSPENDU' : row.contractStart > today() ? 'PAS_ENCORE' : row.contractEnd && row.contractEnd < today() ? 'TERMINE' : 'EN_COURS' }); }
  if (resource === 'salaries') { const currency = tables.devises.find(d => d.id === Number(row.deviseId || 1)); Object.assign(row, { employeeName: name(row.employeeId), deviseId: currency?.id, deviseSymbole: currency?.symbole, deviseCodeISO: currency?.codeISO, deviseChiffreApresVirgule: currency?.chiffreApresVirgule }); }
  return row;
}

export async function mockRequest(method, path, body = {}) {
  const url = new URL(path, 'http://maquette.invalid');
  const parts = url.pathname.split('/').filter(Boolean), [resource, id, action] = parts;
  if (resource === 'session') return id === 'me' ? { coreUserId: 'u1', companyAdmin: true, employeeId: 'e1', roleId: 'r1', permissions: permissions.map(p => p.key) } : context;
  if (resource === 'dashboard') return dashboard();
  if (resource === 'employee-access' && id === 'core-users') return tables.employees.map((e, i) => ({ id: `u${i + 1}`, firstName: e.firstName, lastName: e.lastName, email: e.email, status: 'ACTIVE', employeeId: e.id, employeeName: name(e.id) }));
  if (resource === 'employees' && ['history', 'recent-activity'].includes(action)) {
    const rows = history.get(id) || [];
    if (parts.includes('filters')) return { fields: [{ value: 'employee', label: 'Dossier employé' }], authors: [{ value: 'u1', label: 'Amira Ben Salah' }], users: [{ value: 'u1', label: 'Amira Ben Salah' }] };
    return parts.includes('search') ? paginate(rows, body) : clone(rows.slice(0, Number(url.searchParams.get('limit')) || 5));
  }
  if (resource === 'employees' && action === 'documents') {
    const rows = documents.get(id) || [];
    if (method === 'DELETE') { documents.set(id, rows.filter(r => r.id !== parts[3])); return; }
    return clone(rows);
  }
  if (settings[resource]) { if (method !== 'GET') Object.assign(settings[resource], body); return clone(settings[resource]); }
  const rows = tables[resource];
  if (!rows) throw new Error('Action non simulée dans cette maquette. Aucun appel au serveur RH.');
  if (resource === 'work-schedules' && ['department-assignment', 'employee-assignment'].includes(id)) {
    const schedule = rows.find(s => s.id === body.scheduleId);
    if (!schedule) return clone(rows);
    if (id === 'department-assignment') schedule.assignments.push({ id: `as${++sequence}`, departmentId: body.departmentId, effectiveFrom: body.effectiveFrom || body.effectiveDate || today() });
    else schedule.employeeIds = [...new Set([...(schedule.employeeIds || []), body.employeeId])];
    return clone(rows);
  }
  if (resource === 'notifications' && id === 'read-all') { rows.forEach(r => r.read = true); return; }
  if (id === 'search') return clone(paginate(rows.map(r => decorate(resource, r)), { ...Object.fromEntries(url.searchParams), ...body }));
  if (resource === 'devises' && id === 'active') return clone(rows.find(r => r.etat));
  if (method === 'GET') {
    if (id) return clone(decorate(resource, rows.find(r => String(r.id ?? r.employeeId) === id) || {}));
    const activeOnly = url.searchParams.get('activeOnly') === 'true';
    return clone(rows.filter(r => !activeOnly || (r.active !== false && r.etat !== false && r.isActive !== false)).map(r => decorate(resource, r)));
  }
  if (method === 'DELETE') { if (id) { const index = rows.findIndex(r => String(r.id ?? r.employeeId) === id); if (index >= 0) rows.splice(index, 1); } else rows.splice(0); return; }
  if (method === 'POST' && !id) {
    const numericId = ['employee-statuses', 'devises', 'phone-country-settings'].includes(resource);
    const row = { ...body, id: numericId ? ++sequence : `demo-${++sequence}`, companyId, active: true, etat: true, isActive: true };
    if (resource === 'employees') row.applicationNumber = `RH-DEMO-${++sequence}`;
    if (['job-positions', 'departments', 'type-contracts', 'primes', 'document-types'].includes(resource)) row.code = String(body.name || body.nom || 'DEMO').slice(0, 3).toUpperCase() + sequence;
    if (resource === 'roles') row.users = 0;
    if (resource === 'approval-circuits') { row.effectiveFrom = today(); row.versions = [{ number: 1, effectiveFrom: today(), createdAt: new Date().toISOString(), steps: body.steps || [] }]; }
    if (resource === 'work-schedules') { row.assignments = []; row.version = 1; }
    rows.push(decorate(resource, row)); return clone(row);
  }
  let row = rows.find(r => String(r.id ?? r.employeeId) === id);
  if (!row && ['employee-access', 'employee-primes'].includes(resource)) { row = { employeeId: id, primes: [], added: [], removed: [] }; rows.push(row); }
  if (!row) throw new Error('Élément fictif introuvable.');
  if (resource === 'employee-primes' && action === 'authorization') row.allowPrimes = !!body.allowed;
  else if (resource === 'employee-primes' && method === 'POST') row.primes.push({ id: `ep${++sequence}`, ...body });
  else Object.assign(row, body);
  if (resource === 'devises' && action === 'activate') rows.forEach(r => r.etat = r === row);
  if (resource === 'approval-circuits' && body.steps) row.versions.push({ number: row.versions.length + 1, effectiveFrom: today(), createdAt: new Date().toISOString(), steps: body.steps });
  if (action === 'suspend') { row.suspendu = true; const employee = tables.employees.find(e => e.id === row.employeeId); if (employee) employee.statusValue = 'Suspendu'; }
  if (action === 'read') row.read = true;
  return clone(decorate(resource, row));
}

export async function mockUpload(path, formData) {
  const employeeId = path.split('/')[2], file = formData.get('file');
  const type = tables['document-types'].find(t => t.id === formData.get('documentTypeId'));
  const record = { id: `doc${++sequence}`, documentTypeId: type?.id, documentTypeName: type?.name, name: file.name, description: formData.get('description') || '', mimeType: file.type, size: file.size, createdAt: new Date().toISOString(), file };
  documents.set(employeeId, [...(documents.get(employeeId) || []), record]);
  const { file: _, ...dto } = record; return clone(dto);
}
export async function mockDownload(path) {
  const [, , employeeId, , id] = path.split('/');
  const document = (documents.get(employeeId) || []).find(d => d.id === id);
  if (!document?.file) throw new Error('Aucun fichier de démonstration disponible.');
  return document.file;
}
