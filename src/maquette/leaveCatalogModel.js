// Modèle de présentation autonome. Les réglages horaires, circuits et jours fériés restent dans le store existant.
export const FAMILIES = ['Repos', 'Santé', 'Naissance et parentalité', 'Événement familial', 'Absence personnelle', 'Récupération', 'Autre'];
export const UNITS = ['jours', 'minutes'];
export const MODES = ['Demande à approuver', 'Déclaration à vérifier par RH', 'Saisie par RH'];
export const EXTRA_FIELDS = ['Date de l’événement', 'Lien familial', 'Date prévue de naissance', 'Date réelle de naissance'];
export function createLeaveCatalog() {
  const types = [
    ['ca', 'CA', 'Congé annuel', 'Repos', 'jours', MODES[0], true, '#0b62c4'],
    ['mal', 'MAL', 'Maladie', 'Santé', 'jours', MODES[1], false, '#25836b'],
    ['pat', 'PAT', 'Paternité', 'Naissance et parentalité', 'jours', MODES[1], false, '#8064ad'],
    ['pre', 'PRE', 'Congé prénatal', 'Naissance et parentalité', 'jours', MODES[1], false, '#8064ad'],
    ['aut', 'AUT', 'Autorisation de sortie', 'Absence personnelle', 'minutes', MODES[0], false, '#b28037'],
    ['mat', 'MAT', 'Congé postnatal', 'Naissance et parentalité', 'jours', MODES[1], false, '#9761b4'],
    ['mar', 'MAR', 'Congé pour mariage', 'Événement familial', 'jours', MODES[0], false, '#c47c42'],
    ['dec', 'DEC', 'Congé pour décès', 'Événement familial', 'jours', MODES[1], false, '#667085'],
    ['rec', 'REC', 'Récupération', 'Récupération', 'minutes', MODES[0], false, '#397d8c'],
    ['css', 'CSS', 'Congé sans solde', 'Absence personnelle', 'jours', MODES[0], true, '#748294'],
  ].map(([id, code, name, family, unit, mode, halfday, color]) => ({ id, code, name, family, unit, mode, halfday, color, description: '', instruction: '', shape: unit === 'minutes' ? 'Créneau horaire' : 'Période continue', extraFields: ['pat','mat'].includes(id) ? ['Date réelle de naissance'] : id === 'pre' ? ['Date prévue de naissance'] : ['mar','dec'].includes(id) ? ['Date de l’événement', 'Lien familial'] : [], archived: false, companyId: 'societe-demo', createdAt: '2026-10-01T09:00:00', modifiedAt: '2026-10-01T09:00:00' }));
  const policy = (id, name, typeId, departmentIds, changes = {}) => ({ id, name, typeId, departmentIds, scope: departmentIds.length ? 'departments' : 'all', employeeIds: [], from: '2026-01-01', to: '', status: 'active', reference: 'Exemple de configuration — à valider par la société', counter: 'annual', quota: 24, entitlementUnit: 'jours', accrual: 'Annuelle', counting: 'worked', excludeHolidays: true, carry: 0, notice: 0, proof: 'Facultatif', eligibility: 'Tous les employés concernés', pay: 'À préciser selon les dispositions applicables', negative: false, version: 1, ...changes });
  const legalSource='https://www.jurisitetunisie.com/download_jort.php?f=L2024_0044-F2024_099.pdf';
  const event=(id,name,typeId,changes={})=>policy(id,name,typeId,[],{status:'draft',counter:'none',quota:null,limitPeriod:'event',accrual:'Par événement',counting:'calendar',excludeHolidays:false,proof:'Obligatoire au dépôt',...changes});
  return { types, policies: [
    policy('pol1', 'Congé annuel · Administration', 'ca', ['d1']),
    policy('pol2', 'Congé annuel · Production', 'ca', ['d2'], { quota: 18 }),
    policy('pol3', 'Maladie · Déclaration', 'mal', [], { counter: 'none', quota: null, accrual: 'Selon justificatif', counting: 'calendar', excludeHolidays: false, proof: 'Régularisation possible' }),
    policy('pol4', 'Autorisation · Suivi en minutes', 'aut', [], { counter: 'own', quota: 120, entitlementUnit: 'minutes', counting: 'worked', accrual: 'Mensuelle' }),
    event('pol5', 'Prénatal · modèle Tunisie', 'pre', {quota:15, reference:'Loi n° 2024-44 · article 3', sourceUrl:legalSource, eligibility:'Femme enceinte : maximum de 15 jours dans le dernier mois de grossesse, certificat précisant la date prévue de naissance. Affiliation et déclaration sociales selon l’article 1. Vérification RH ; conditions non automatisées.'}),
    event('pol6', 'Paternité · naissance · modèle Tunisie', 'pat', {quota:7, reference:'Loi n° 2024-44 · article 5', sourceUrl:legalSource, eligibility:'Père : congé dans les 30 jours suivant la naissance, justificatif requis. Durée portée à 10 jours dans les cas particuliers prévus par la loi ; 3 jours en cas d’enfant mort-né. Ces variantes nécessitent une adaptation RH, elles ne sont pas cumulables. Affiliation selon article 1.'}),
    event('pol7', 'Postnatal · cas général · modèle Tunisie', 'mat', {quota:3, entitlementUnit:'mois', reference:'Loi n° 2024-44 · article 4', sourceUrl:legalSource, eligibility:'Mère après accouchement, certificat indiquant la date. Cas général : 3 mois ; 4 mois dans les cas particuliers prévus ; 1 mois en cas d’enfant mort-né. Vérification RH des conditions et de l’affiliation (article 1). Les mois ne sont pas convertis en 90 jours.'}),
    event('pol8', 'Mariage · exemple interne à adapter', 'mar', {quota:3, counting:'worked',excludeHolidays:true,reference:'Exemple fictif : durée à remplacer selon la convention et les dispositions applicables',eligibility:'Mariage du salarié : 3 jours illustratifs, pas un droit universel tunisien. Vérifier bénéficiaire, justificatif, délai de prise et texte applicable.'}),
    event('pol9', 'Décès · durée à définir par RH', 'dec', {counting:'worked',excludeHolidays:true,reference:'Convention collective et dispositions applicables à préciser',eligibility:'Préciser le lien familial et le plafond correspondant avant activation. Aucun plafond universel préchargé.'}),
    policy('pol10','Sans solde · sur accord','css',[],{status:'draft',counter:'none',quota:null,reference:'Accord et dispositions applicables à préciser',eligibility:'Durée et conditions à convenir ; validation par le circuit existant.',pay:'Non rémunéré, selon dispositions applicables'}),
    policy('pol11','Récupération · temps validé','rec',[],{status:'draft',counter:'none',quota:null,entitlementUnit:'minutes',reference:'Organisation interne et dispositions applicables à préciser',eligibility:'Selon les heures de récupération préalablement validées. Aucun solde réel calculé dans cette maquette.'}),
  ], requests: [
    { id: 'EX-001', employeeId: 'e1', typeId: 'ca', policyId: 'pol1', policyVersion: 1, start: '2026-10-05', end: '2026-10-06', status: 'Approuvée', typeSnapshot: { code: 'CA', name: 'Congé annuel', unit: 'jours' } },
    { id: 'EX-002', employeeId: 'e2', typeId: 'mal', policyId: 'pol3', policyVersion: 1, start: '2026-10-12', end: '2026-10-12', status: 'À vérifier', typeSnapshot: { code: 'MAL', name: 'Maladie', unit: 'jours' } },
  ], history: types.map(t => ({ id: `creation-${t.id}`, typeId: t.id, at: t.createdAt, actor: 'RH · démonstration', action: 'Création du type', detail: `${t.code} — ${t.name}` })), policyVersions: [], sequence: 100 };
}
const clone = value => JSON.parse(JSON.stringify(value));
const norm = value => String(value || '').trim().toLocaleLowerCase('fr');
export const usedType = (db, id) => db.requests.some(r => r.typeId === id);
function log(db, typeId, action, detail, actor) { db.history.unshift({ id: `hist-${++db.sequence}`, typeId, action, detail, actor, at: new Date().toISOString() }); }
export function validateType(db, input, originalId) {
  const errors = {};
  if (!/^[A-Z0-9_-]{2,12}$/.test(String(input.code).trim().toUpperCase())) errors.code = 'Utilisez 2 à 12 lettres, chiffres, tirets ou caractères « _ ».';
  if (!String(input.name || '').trim()) errors.name = 'Le libellé est requis.';
  for (const t of db.types.filter(t => t.id !== originalId)) {
    if (norm(t.code) === norm(input.code)) errors.code = 'Code déjà utilisé, y compris parmi les types archivés.';
    if (norm(t.name) === norm(input.name)) errors.name = 'Libellé déjà utilisé, y compris parmi les types archivés.';
  }
  if (!FAMILIES.includes(input.family)) errors.family = 'Choisissez une famille.';
  if (!UNITS.includes(input.unit)) errors.unit = 'Choisissez une unité.';
  if (!MODES.includes(input.mode)) errors.mode = 'Choisissez un mode de traitement.';
  if (!/^#[0-9a-f]{6}$/i.test(input.color)) errors.color = 'Couleur invalide.';
  const original = db.types.find(t => t.id === originalId);
  if (original && usedType(db, originalId) && ['code', 'family', 'unit', 'mode', 'shape', 'halfday'].some(k => original[k] !== input[k])) errors.general = 'Ce type est utilisé : ses caractéristiques structurantes sont protégées. Dupliquez-le pour créer un nouveau fonctionnement.';
  if (original && db.policies.some(p => p.typeId === originalId) && original.unit !== input.unit) errors.unit = 'Des politiques utilisent cette unité. Dupliquez le type pour changer d’unité.';
  return errors;
}
export function saveType(db, input, originalId, actor = 'RH · démonstration') {
  const errors = validateType(db, input, originalId);
  if (Object.keys(errors).length) return { errors };
  const original = db.types.find(t => t.id === originalId), at = new Date().toISOString();
  const item = { ...clone(input), code: input.code.trim().toUpperCase(), name: input.name.trim(), halfday: input.unit === 'jours' && !!input.halfday, extraFields: [...new Set((input.extraFields || []).filter(f => EXTRA_FIELDS.includes(f)))], id: originalId || `type-${++db.sequence}`, companyId: 'societe-demo', createdAt: original?.createdAt || at, modifiedAt: at };
  if (original) {
    const changes = Object.keys(item).filter(k => !['modifiedAt'].includes(k) && JSON.stringify(original[k]) !== JSON.stringify(item[k])).map(k => `${({name:'Libellé', description:'Description', instruction:'Consigne', color:'Couleur', extraFields:'Informations complémentaires', archived:'Archivage'})[k] || k} : ${String(original[k] ?? '—')} → ${String(item[k])}`);
    if (changes.length) { db.types.splice(db.types.indexOf(original), 1, item); log(db, item.id, 'Modification', changes.join(' ; '), actor); }
  } else { db.types.push(item); log(db, item.id, 'Création du type', `${item.code} — ${item.name}`, actor); }
  return { item };
}
export function archiveType(db, id, archived, actor = 'RH · démonstration') {
  const type = db.types.find(t => t.id === id);
  if (!type || type.archived === archived) return;
  type.archived = archived; type.modifiedAt = new Date().toISOString();
  log(db, id, archived ? 'Archivage' : 'Réactivation', archived ? 'Retiré des nouvelles demandes ; demandes et politiques historiques conservées.' : 'Réactivé ; utilisation soumise à une politique valide.', actor);
}
export function policyApplies(policy, employee, date, departments = []) {
  const hierarchy = new Set([employee.departmentId, employee.subDepartmentId]);
  let dep = departments.find(d => d.id === (employee.subDepartmentId || employee.departmentId));
  while (dep?.parentId && !hierarchy.has(dep.parentId)) { hierarchy.add(dep.parentId); dep = departments.find(d => d.id === dep.parentId); }
  return policy.status === 'active' && policy.from <= date && (!policy.to || date <= policy.to) && (policy.scope === 'all' || policy.scope === 'employees' && policy.employeeIds.includes(employee.id) || policy.scope === 'departments' && policy.departmentIds.some(id => hierarchy.has(id)));
}
// Chaque nouvelle version remplace les suivantes à sa date d'effet ; les versions antérieures restent consultables.
export function policyIntervals(db) {
  const all = [...db.policies, ...db.policyVersions];
  return all.flatMap(p => {
    const newer = all.filter(n => n.id === p.id && n.version > p.version);
    if (newer.some(n => n.from <= p.from)) return [];
    const next = newer.map(n => n.from).sort()[0];
    if (!next) return [p];
    const date = new Date(`${next}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 1);
    const until = date.toISOString().slice(0, 10);
    return [{ ...p, to: p.to && p.to < until ? p.to : until }];
  });
}
export const applicablePolicies = (db, typeId, employee, date, departments = []) => policyIntervals(db).filter(p => p.typeId === typeId && policyApplies(p, employee, date, departments));
export function savePolicy(db, input, employees = [], departments = [], actor = 'RH · démonstration') {
  input=clone(input);
  if(input.entitlementUnit==='heures'){
    input.displayUnit='heures';input.entitlementUnit='minutes';
    if(input.quota!==''&&input.quota!=null) input.quota=Math.round(Number(input.quota)*60*1e8)/1e8;
    input.carry=Math.round(Number(input.carry||0)*60*1e8)/1e8;
  }else input.displayUnit=input.entitlementUnit;

  if (!input.name.trim() || !input.from) return { error: 'Renseignez le nom et la date de début de la politique.' };
  const type = db.types.find(t => t.id === input.typeId);
  if (!type || type.archived) return { error: 'Sélectionnez un type actif.' };
  if (input.to && input.to < input.from) return { error: 'La fin de validité doit suivre le début.' };
  if ((input.counter !== 'none' || input.quota !== '' && input.quota != null) && !(Number(input.quota) > 0)) return { error: 'Le quota du compteur doit être positif.' };
  if (Number(input.carry) < 0 || Number(input.notice) < 0) return { error: 'Report et prévenance doivent être positifs ou nuls.' };
  if(input.entitlementUnit==='mois' && input.quota!=null && input.quota!=='' && !Number.isInteger(Number(input.quota))) return {error:'Saisissez un nombre entier de mois ; aucun mois n’est converti en jours.'};
  if(type.unit==='jours' && !['jours','mois'].includes(input.entitlementUnit)) return {error:'Pour ce type, choisissez une durée en jours ou en mois.'};
  if(type.unit==='minutes' && input.quota!=null && input.quota!=='' && !Number.isInteger(Number(input.quota))) return {error:'Saisissez un nombre entier de minutes.'};
  if (type.unit === 'minutes' && (input.entitlementUnit !== 'minutes' || input.counting !== 'worked')) return { error: 'Une autorisation horaire utilise les minutes et les créneaux de travail existants.' };
  if (input.scope === 'departments' && !input.departmentIds.length || input.scope === 'employees' && !input.employeeIds.length) return { error: 'Choisissez la population concernée.' };
  const other = policyIntervals(db).filter(p => p.id !== input.id && p.typeId === input.typeId && p.status === 'active');
  if (input.status === 'active') for (const p of other) {
    const overlap = input.from <= (p.to || '9999-12-31') && p.from <= (input.to || '9999-12-31');
    const checkDate = p.from > input.from ? p.from : input.from;
    const samePopulation = p.scope === 'all' || input.scope === 'all' || p.scope === input.scope && (p.scope === 'departments' ? p.departmentIds.some(id => input.departmentIds.includes(id)) : p.employeeIds.some(id => input.employeeIds.includes(id))) || employees.some(e => policyApplies(p, e, checkDate, departments) && policyApplies(input, e, checkDate, departments));
    if (overlap && samePopulation) return { error: `Une politique active existe déjà sur cette période et cette population : « ${p.name} ».` };
  }
  const old = db.policies.find(p => p.id === input.id);
  if (old) db.policyVersions.push(clone(old));
  const item = { ...clone(input), id: old?.id || `policy-${++db.sequence}`, version: (old?.version || 0) + 1, quota: input.quota === '' || input.quota == null ? null : Number(input.quota), carry: Number(input.carry), notice: Number(input.notice) };
  if (old) db.policies.splice(db.policies.indexOf(old), 1, item); else db.policies.push(item);
  log(db, item.typeId, old ? 'Nouvelle version de politique' : 'Politique associée', `${item.name} · version ${item.version} · effet ${item.from}. Les demandes enregistrées conservent leur version.`, actor);
  return { item };
}
