<script setup>
import {isCompanyModuleEnabled} from '../../maquette/companyModules';
import { computed, ref, watch } from 'vue';
import { AlertTriangle, AtSign, Briefcase, CalendarCheck, Clock, Eye, FileSignature, FileText, History, KeyRound, MapPin, Paperclip, Phone, UserRound, Wallet } from '@lucide/vue';
import { contractsApi, fromContractDto } from '../../api/contracts';
import { documentTypesApi, fromDocumentTypeDto } from '../../api/documentTypes';
import { employeeDocumentsApi, fromEmployeeDocumentDto, saveEmployeeDocument } from '../../api/employeeDocuments';
import { fromSalaryDto, salariesApi } from '../../api/salaries';
import { recentActivity } from '../../composables/useEmployeeHistory';
import { PERMISSIONS } from '../../config/permissions';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Badge from '../../components/ui/Badge.vue';
import { diffDays, formatDate, formatDateTime, formatRange, TODAY } from '../../utils/dates';
import { dayHours, formatDaysHours } from '../../utils/hours';
import { getAnnualBalance } from '../../utils/leave';
import { circuitForDepartment, formatAmount, MARITAL_LABEL, scheduleOn } from '../../utils/org';
import { formatPhone } from '../../utils/phone';
import { PRIME_TYPE, seniority } from './constants';
import ReportRow from './ReportRow.vue';
import ReportSection from './ReportSection.vue';
import DocumentViewer from './DocumentViewer.vue';

/**
 * Vue d'ensemble de la fiche (RH-4), présentée comme un rapport : complétude du dossier, puis identité, poste,
 * horaire et contrat à gauche ; coordonnées, rémunération, congés, compte et activité récente à droite.
 */
const props = defineProps({
  employee: { type: Object, required: true },
  profile: { type: Object, required: true },
});
const emit = defineEmits(['tab']);

const store = useStore();
const data = useCompanyData();
// Compte du Core Tenant lié à l'employé (connexion), lu à la demande.
if (store.coreUsersStatus === 'idle') store.loadCoreUsers();
const coreAccount = computed(() => store.coreUserOf(props.employee.id));
const e = computed(() => props.employee);

const fn = computed(() => data.fn(e.value.functionId));
const manager = computed(() => data.employee(e.value.managerId));
const now = computed(() => scheduleOn(store.db, e.value));
const loading = computed(() => e.value.scheduleMode === 'chargement');
const circuit = computed(() => circuitForDepartment(store.db, e.value.subDepartmentId || e.value.departmentId));
const approvers = computed(() => props.profile.approverIds.map((id) => data.employee(id)).filter(Boolean));
// Contrats et salaires de l'employé, lus sur le serveur (archivés exclus).
const contracts = ref([]);
const salaries = ref([]);
const contractsLoading = ref(false);
const salariesLoading = ref(false);
// Documents du dossier (/api/employees/{id}/documents).
const docs = ref([]);
const docsLoading = ref(false);
const docsError = ref('');
const CONTRACT_STATUS = { PAS_ENCORE: ['À venir', 'info'], EN_COURS: ['En cours', 'success'], SUSPENDU: ['Suspendu', 'warning'], TERMINE: ['Terminé', 'muted'] };
// Contrats, salaires et documents ne sont lus que si l'utilisateur connecté peut les consulter (sinon 403).
watch(() => e.value.id, (employeeId) => {
  contracts.value = [];
  salaries.value = [];
  docs.value = [];
  docsError.value = '';
  if (store.can('contrats.consulter')) loadContracts(employeeId);
  if (store.can('salaires.consulter')) loadSalaries(employeeId);
  if (store.can('documents.consulter')) loadDocs(employeeId);
}, { immediate: true });

function loadContracts(employeeId) {
  contractsLoading.value = true;
  contractsApi.search({ employeeId, etat: true, size: 100 })
    .then((res) => { if (e.value.id === employeeId) contracts.value = res.content.map(fromContractDto).sort((a, b) => b.start.localeCompare(a.start)); })
    .catch(() => {})
    .finally(() => { if (e.value.id === employeeId) contractsLoading.value = false; });
}

function loadSalaries(employeeId) {
  salariesLoading.value = true;
  salariesApi.search({ employeeId, etat: true, size: 100 })
    .then((res) => { if (e.value.id === employeeId) salaries.value = res.content.map(fromSalaryDto); })
    .catch(() => {})
    .finally(() => { if (e.value.id === employeeId) salariesLoading.value = false; });
}

function loadDocs(employeeId) {
  docsLoading.value = true;
  employeeDocumentsApi.list(employeeId)
    .then((list) => { if (e.value.id === employeeId) docs.value = list.map(fromEmployeeDocumentDto); })
    .catch((err) => { if (e.value.id === employeeId) docsError.value = err.message; })
    .finally(() => { if (e.value.id === employeeId) docsLoading.value = false; });
}

// Types de documents actifs (/api/document-types) : pièces obligatoires du dossier.
const docTypes = ref([]);
documentTypesApi.list(true).then((list) => { docTypes.value = list.map((dto) => fromDocumentTypeDto(dto)); }).catch(() => {});
const requiredTypes = computed(() => docTypes.value.filter((t) => t.required));
const missingDocs = computed(() => requiredTypes.value.filter((t) => !docs.value.some((d) => d.typeId === t.id)));
const viewing = ref();
async function saveDoc(d) {
  try {
    await saveEmployeeDocument(e.value.id, d);
  } catch (err) {
    store.toast(`Téléchargement impossible : ${err.message}`, 'danger');
  }
}
// Salaire en vigueur : le plus récent déjà commencé et non terminé.
const salary = computed(() => salaries.value
  .filter((s) => s.start <= TODAY && (!s.end || s.end >= TODAY))
  .sort((a, b) => b.start.localeCompare(a.start))[0]);
const salaryDevise = computed(() => salary.value?.devise ?? store.activeDevise);
const primes = computed(() => e.value.primes.map((p) => data.prime(p.primeId)).filter(Boolean));
const balance = computed(() => getAnnualBalance(store.db, e.value.id));
const requests = computed(() => data.requests.filter((r) => r.employeeId === e.value.id));
const pending = computed(() => requests.value.filter((r) => r.status === 'en_attente').length);
const nextLeave = computed(() => requests.value.filter((r) => r.status === 'approuve' && r.start > TODAY).sort((a, b) => a.start.localeCompare(b.start))[0]);
const role = computed(() => data.role(props.profile.roleId));
const perms = computed(() => {
  const set = new Set([...(role.value?.permissions ?? []), ...props.profile.extraPermissions]);
  props.profile.removedPermissions.forEach((k) => set.delete(k));
  return set;
});
const age = computed(() => (e.value.birthDate ? Math.floor(diffDays(e.value.birthDate, TODAY) / 365.25) : undefined));
// Activité récente lue sur le serveur (5 derniers événements), rechargée à chaque changement d'employé, de société ou de fiche.
const { items: recent, loading: recentLoading, error: recentError, load: loadRecent } = recentActivity(
  () => e.value.id, [() => store.companyId, () => props.employee]);
const phone = computed(() => formatPhone(data.country(e.value.phoneCountryId), e.value.phone));
const weekly = computed(() => (loading.value ? e.value.weeklyHours : now.value.schedule?.weeklyHours));
const slots = computed(() => now.value.schedule?.slots?.map((s) => `${s.start}–${s.end}`).join(' · ') ?? '');

// Complétude du dossier : informations attendues dans une fiche complète.
const checks = computed(() => [
  ['CIN', !!e.value.cin], ['N° CNSS', !!e.value.cnss], ['Date de naissance', !!e.value.birthDate], ['Téléphone', !!e.value.phone],
  ['Adresse', !!e.value.address], ['Responsable N+1', !!manager.value], ['Compte utilisateur', !!props.profile.coreUserId],
  ...requiredTypes.value.map((t) => [t.name, docs.value.some((d) => d.typeId === t.id)]),
]);
const done = computed(() => checks.value.filter(([, ok]) => ok).length);
const pct = computed(() => Math.round((done.value / checks.value.length) * 100));
const missing = computed(() => checks.value.filter(([, ok]) => !ok).map(([l]) => l));
</script>

<template>
  <div class="rp">
    <div :class="['rp-complete', { ok: pct === 100 }]">
      <div class="rp-complete-main">
        <span class="rp-complete-pct">{{ pct }} %</span>
        <span class="rp-complete-text">
          <strong>Complétude du dossier</strong>
          <span class="rp-hint">{{ done }} élément{{ done > 1 ? 's' : '' }} sur {{ checks.length }} renseigné{{ done > 1 ? 's' : '' }}</span>
        </span>
        <span class="rp-meter" aria-hidden="true"><span :style="{ width: `${pct}%` }" /></span>
      </div>
      <div v-if="missing.length" class="rp-missing"><span>À compléter :</span><span v-for="m in missing" :key="m" class="rp-tag warn">{{ m }}</span></div>
    </div>

    <div class="rp-grid">
      <div class="rp-col">
        <ReportSection title="Identité et état civil" open-label="Infos générales" @open="emit('tab', 'infos')">
          <template #icon><UserRound :size="14" /></template>
          <dl class="rp-list">
            <ReportRow label="Matricule"><span class="mono">{{ e.matricule }}</span></ReportRow>
            <ReportRow label="CIN" :empty="!e.cin"><span class="mono">{{ e.cin }}</span></ReportRow>
            <ReportRow label="N° CNSS" :empty="!e.cnss"><span class="mono">{{ e.cnss }}</span></ReportRow>
            <ReportRow label="Date de naissance" :empty="!e.birthDate" :hint="age !== undefined ? `${age} ans` : ''">{{ e.birthDate && formatDate(e.birthDate) }}</ReportRow>
            <ReportRow label="Situation familiale">{{ MARITAL_LABEL[e.maritalStatus] }}</ReportRow>
            <ReportRow label="Enfants à charge">{{ e.childrenCount === 0 ? 'Aucun' : e.childrenCount }}</ReportRow>
          </dl>
        </ReportSection>

        <ReportSection title="Profil & Horaire" open-label="Profil & Horaire" @open="emit('tab', 'temps')">
          <template #icon><Briefcase :size="14" /></template>
          <h4 class="rp-subhead"><Briefcase :size="12" />Poste et rattachement</h4>
          <dl class="rp-list">
            <ReportRow label="Titre d’emploi" :empty="!e.jobTitle">{{ e.jobTitle }}</ReportRow>
            <ReportRow label="Fonction" :empty="!fn">
              {{ fn?.name }}
              <span v-if="fn" class="rp-tags"><span :class="['rp-tag', { info: fn.interim }]">{{ fn.interim ? `Intérim ${fn.kind}` : 'Sans intérim' }}</span></span>
            </ReportRow>
            <ReportRow label="Département" :empty="!data.department(e.departmentId)" :hint="e.subDepartmentId ? `› ${data.department(e.subDepartmentId)?.name ?? ''}` : ''">
              {{ data.department(e.departmentId)?.name }}
            </ReportRow>
            <ReportRow label="Responsable N+1" :empty="!manager" :hint="manager ? data.fn(manager.functionId)?.name ?? '' : ''">
              <a v-if="manager" class="link" :href="`/employes/${manager.id}`">{{ manager.firstName }} {{ manager.lastName }}</a>
            </ReportRow>
            <ReportRow label="Date d’embauche" :empty="!e.hireDate" :hint="e.hireDate ? seniority(e.hireDate) : ''">{{ e.hireDate && formatDate(e.hireDate) }}</ReportRow>
          </dl>
          <h4 class="rp-subhead"><Clock :size="12" />Horaire et approbation</h4>
          <dl class="rp-list">
            <ReportRow label="Mode horaire" :hint="loading ? (e.loadingSince ? `Depuis le ${formatDate(e.loadingSince)}` : '') : 'Hérité du rattachement'">
              {{ loading ? 'Tableau de chargement' : 'Organisationnel' }}
            </ReportRow>
            <ReportRow label="Horaire en vigueur" :empty="!now.schedule && !now.unplanned" :hint="slots">
              <template v-if="now.schedule">{{ now.schedule.name }}</template>
              <Badge v-else tone="danger">Non planifié</Badge>
            </ReportRow>
            <ReportRow :label="loading ? 'Régime contractuel' : 'Volume hebdo.'" :empty="!weekly">{{ weekly?.toLocaleString('fr-FR') }} h</ReportRow>
            <ReportRow label="Circuit d’approbation" wide>
              <span v-if="circuit" class="rp-circuit">
                <span class="rp-circuit-name">{{ circuit.name }}</span>
                <ol v-if="approvers.length" class="rp-steps">
                  <li v-for="(a, i) in approvers" :key="a.id"><span>{{ i + 1 }}</span>{{ a.firstName }} {{ a.lastName }}</li>
                </ol>
              </span>
              <Badge v-else tone="danger">Aucun circuit actif</Badge>
            </ReportRow>
          </dl>
        </ReportSection>

        <ReportSection v-if="isCompanyModuleEnabled(store.companyId,'contrats')" title="Contrat" open-label="contrat" @open="emit('tab', 'contrats')">
          <template #icon><FileSignature :size="14" /></template>
          <table class="rp-table">
            <thead><tr><th>Type</th><th>Début</th><th>Fin</th><th>État</th></tr></thead>
            <tbody>
              <tr v-if="contractsLoading"><td colspan="4" class="text-muted">Chargement…</td></tr>
              <tr v-else-if="contracts.length === 0"><td colspan="4" class="text-muted">Aucun contrat.</td></tr>
              <template v-else>
                <tr v-for="c in contracts" :key="c.id">
                  <td><strong>{{ c.typeName || c.typeCode || '—' }}</strong></td>
                  <td>{{ c.start ? formatDate(c.start) : '—' }}</td>
                  <td><template v-if="c.end">{{ formatDate(c.end) }}</template><span v-else class="text-muted">Indéterminée</span></td>
                  <td><Badge v-if="CONTRACT_STATUS[c.status]" :tone="CONTRACT_STATUS[c.status][1]">{{ CONTRACT_STATUS[c.status][0] }}</Badge><span v-else class="text-muted">—</span></td>
                </tr>
              </template>
            </tbody>
          </table>
        </ReportSection>

        <ReportSection title="Documents" open-label="Documents" @open="emit('tab', 'documents')">
          <template #icon><FileText :size="14" /></template>
          <p v-if="docsLoading" class="rp-empty">Chargement…</p>
          <p v-else-if="docsError" class="rp-empty">Documents indisponibles : {{ docsError }}</p>
          <p v-else-if="docs.length === 0" class="rp-empty">Aucun document joint au dossier.</p>
          <table v-else class="rp-table">
            <thead><tr><th>Type</th><th>Fichier</th><th>Ajouté le</th><th><span class="sr-only">Actions</span></th></tr></thead>
            <tbody>
              <tr v-for="d in docs" :key="d.id">
                <td><strong>{{ d.typeName ?? '—' }}</strong></td>
                <td class="rp-file"><Paperclip :size="12" aria-hidden="true" /> {{ d.fileName }}</td>
                <td>{{ d.addedAt ? formatDate(d.addedAt.slice(0, 10)) : '—' }}</td>
                <td class="actions">
                  <button type="button" class="icon-btn icon-btn-sm" title="Visualiser" :aria-label="`Visualiser ${d.fileName}`" @click="viewing = d"><Eye :size="14" /></button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!docsLoading && missingDocs.length" class="rp-alert"><AlertTriangle :size="13" aria-hidden="true" /> Pièces obligatoires manquantes : {{ missingDocs.map((t) => t.name).join(', ') }}.</p>
        </ReportSection>
      </div>

      <div class="rp-col">
        <ReportSection title="Coordonnées" open-label="Modifier" @open="emit('tab', 'infos')">
          <template #icon><AtSign :size="14" /></template>
          <ul class="rp-contact">
            <li><AtSign :size="13" aria-hidden="true" /><a v-if="e.email" class="link" :href="`mailto:${e.email}`">{{ e.email }}</a><span v-else class="rp-missing-val">E-mail non renseigné</span></li>
            <li><Phone :size="13" aria-hidden="true" /><template v-if="phone">{{ phone }}</template><span v-else class="rp-missing-val">Téléphone non renseigné</span></li>
            <li><MapPin :size="13" aria-hidden="true" /><template v-if="e.address">{{ e.address }}</template><span v-else class="rp-missing-val">Adresse non renseignée</span></li>
          </ul>
        </ReportSection>

        <ReportSection v-if="isCompanyModuleEnabled(store.companyId,'remuneration')" title="Rémunération" open-label="Rémunération" @open="emit('tab', 'remuneration')">
          <template #icon><Wallet :size="14" /></template>
          <div class="rp-figure">
            <span class="rp-figure-value">{{ salariesLoading ? '…' : salary ? formatAmount(salary.amount, salaryDevise) : '—' }}<small> brut / mois</small></span>
            <span v-if="salary" class="rp-hint">Depuis le {{ formatDate(salary.start) }}</span>
          </div>
          <div class="rp-sub">
            <span class="rp-sub-label">Primes</span>
            <span v-if="!e.allowPrimes" class="text-muted">Non autorisées</span>
            <span v-else-if="primes.length === 0" class="text-muted">Autorisées, aucune attribuée</span>
            <ul v-else class="rp-primes">
              <li v-for="p in primes" :key="p.id"><span>{{ p.name }} <small>{{ PRIME_TYPE[p.type]?.toLowerCase() }}</small></span><span>{{ formatAmount(p.amount, store.activeDevise) }}</span></li>
            </ul>
            <p v-if="primesMonthly > 0 && salary" class="rp-total"><span>Total mensuel estimé</span><strong>{{ formatAmount(salary.amount + primesMonthly, salaryDevise) }}</strong></p>
          </div>
        </ReportSection>

        <!-- <ReportSection title="Congés" open-label="Congés" @open="emit('tab', 'conges')">
          <template #icon><CalendarCheck :size="14" /></template>
          <div class="rp-kpis">
            <div><span :class="{ danger: balance.available < 0 }">{{ balance.tracked ? formatDaysHours(balance.available, dayHours(now.schedule)) : '—' }}</span><small>Disponible</small></div>
            <div><span>{{ balance.tracked ? `${balance.taken.toLocaleString('fr-FR')} j` : '—' }}</span><small>Pris</small></div>
            <div><span :class="{ warn: pending }">{{ pending }}</span><small>En attente</small></div>
          </div>
          <p class="rp-foot">
            <template v-if="nextLeave">Prochain congé : <strong>{{ formatRange(nextLeave.start, nextLeave.end) }}</strong></template>
            <template v-else>Aucun congé à venir.</template>
          </p>
        </ReportSection> -->

        <ReportSection title="Compte et rôle" open-label="Accès" @open="emit('tab', 'acces')">
          <template #icon><KeyRound :size="14" /></template>
          <div class="rp-account">
            <span class="rp-user">
              <span v-if="coreAccount"><strong>Compte Core Tenant</strong><span class="rp-hint">{{ coreAccount.email }}</span></span>
              <span v-else-if="profile.coreUserId"><strong>Compte Core Tenant</strong><span class="rp-hint">lié</span></span>
              <span v-else class="rp-missing-val">Aucun compte Core Tenant</span>
            </span>
            <Badge v-if="e.account.active" tone="success">Accès actif</Badge>
            <Badge v-else tone="muted">Accès désactivé</Badge>
          </div>
          <dl class="rp-list cols-2">
            <ReportRow label="Rôle" wide :empty="!role"><span class="rp-tags"><span class="rp-tag primary">{{ role?.name }}</span></span></ReportRow>
            <ReportRow label="Permissions" :hint="profile.extraPermissions.length ? `dont ${profile.extraPermissions.length} hors rôle` : ''">{{ perms.size }} / {{ PERMISSIONS.length }}</ReportRow>
            <ReportRow label="Dernière connexion">
              <template v-if="e.account.lastLogin">{{ formatDateTime(e.account.lastLogin) }}</template><span v-else class="text-muted">Jamais</span>
            </ReportRow>
          </dl>
        </ReportSection>

        <ReportSection title="Activité récente" open-label="Historique" @open="emit('tab', 'historique')">
          <template #icon><History :size="14" /></template>
          <p v-if="recentLoading && recent.length === 0" class="rp-empty">Chargement…</p>
          <p v-else-if="recentError" class="rp-empty">Activité indisponible : {{ recentError }} <button type="button" class="btn btn-sm btn-ghost" @click="loadRecent">Réessayer</button></p>
          <p v-else-if="recent.length === 0" class="rp-empty">Aucun événement.</p>
          <ol v-else class="emp-feed rp-pad">
            <li v-for="h in recent" :key="h.id"><span class="emp-feed-date">{{ formatDateTime(h.at) }}</span><span>{{ h.label }}</span></li>
          </ol>
        </ReportSection>
      </div>
    </div>
    <DocumentViewer :employee-id="e.id" :document="viewing" @close="viewing = undefined" @download="saveDoc" />
  </div>
</template>
