<script setup>
import {isCompanyModuleEnabled,numberOptions} from '../../maquette/companyModules';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, CloudOff, Eye, LoaderCircle, Pencil, Plus, RotateCcw, Search, SlidersHorizontal, Trash2, Users } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import { navigate } from '../../router/navigate';
import Badge from '../../components/ui/Badge.vue';
import EmployeeStatusBadge from '../../components/ui/EmployeeStatusBadge.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import Avatar from '../../components/ui/Avatar.vue';
import SelectFilter from '../../components/ui/SelectFilter.vue';
import { employeesApi, fromDto, statusesApi } from '../../api/employees';
import { MARITAL_LABEL } from '../../utils/org';

import DeleteEmployeeModal from './DeleteEmployeeModal.vue';
import EmployeeForm from './EmployeeForm.vue';

/** Liste des employés de la société active (backend) ; ajout via /employes/nouveau. */
defineProps({ addOpen: Boolean });

const store = useStore();
const data = useCompanyData();
const q = ref('');
const departmentId = ref('');
const functionId = ref('');
const mode = ref('');
// Filtres par champ appliqués par le serveur (GET /api/employees/search).
const EMPTY_FIELDS = {
  statusId: '', gender: '', maritalStatus: '', haveCnss: '', hireDateFrom: '', hireDateTo: '',
  lastName: '', firstName: '', cin: '', matricule: '', internalNumber: '', email: '', phone: '', cnss: '', jobTitle: '',
};
const fields = reactive({ ...EMPTY_FIELDS });
const TEXT_FIELDS = [
  ['lastName', 'Nom'], ['firstName', 'Prénom'], ['cin', 'CIN'], ['matricule', 'Matricule'], ['internalNumber', 'Matricule société'],
  ['email', 'E-mail'], ['phone', 'Téléphone'], ['cnss', 'N° CNSS'], ['jobTitle', 'Poste'],
];
const moreFilters = ref(false);
const PAGE_SIZES = [5,10, 20, 50, 100];
const page = ref(0);
const size = ref(20);
const editing = ref();
const deleting = ref();

// Premier chargement : RhLayout. Ensuite, chaque retour sur la liste la relit (modifications faites ailleurs).
onMounted(() => { if (store.employeesStatus === 'ready') store.loadEmployees(); });
// E-mail du compte Core Tenant lié, affiché dans la colonne « Compte utilisateur ».
onMounted(() => { if (store.coreUsersStatus === 'idle') store.loadCoreUsers(); });

// Statuts paramétrables : options du filtre « Statut ».
const statuses = ref([]);
onMounted(async () => { try { statuses.value = await statusesApi.list(); } catch { statuses.value = []; } });

// Département, fonction et mode horaire ne sont connus que du navigateur : ils restreignent la recherche du serveur
// à une liste d'identifiants. Sans eux, seule la société active est imposée (inutile si elle porte tous les employés).
const restrictedIds = computed(() => {
  const local = departmentId.value || functionId.value || mode.value;
  if (!local && data.employees.length === store.db.employees.length) return undefined;
  return data.employees
    .filter((e) => !departmentId.value || e.departmentId === departmentId.value)
    .filter((e) => !functionId.value || e.functionId === functionId.value)
    .filter((e) => !mode.value || (mode.value === 'non-planifie' ? e.scheduleMode === 'chargement' && !data.profile(e.id)?.scheduleId : e.scheduleMode === mode.value))
    .map((e) => e.id);
});

// Recherche saisie : envoyée après une courte pause de frappe.
const search = ref('');
let typing;
watch(q, (v) => { window.clearTimeout(typing); typing = window.setTimeout(() => { search.value = v.trim(); }, 300); });
onBeforeUnmount(() => window.clearTimeout(typing));

// Critères hors pagination (la clé sert à revenir en page 1 et à éviter les appels en double).
const criteria = computed(() => ({
  search: search.value,
  ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])),
  ids: restrictedIds.value,
}));
const criteriaKey = computed(() => JSON.stringify(criteria.value));

const result = ref({ content: [], totalElements: 0, totalPages: 0 });
const loading = ref(false);
const error = ref('');
let lastKey = '';
let seq = 0;

async function fetchPage(force = false) {
  const key = `${criteriaKey.value}|${page.value}|${size.value}`;
  if (!force && key === lastKey) return;
  lastKey = key;
  const ids = criteria.value.ids;
  if (ids && ids.length === 0) { result.value = { content: [], totalElements: 0, totalPages: 0 }; error.value = ''; return; }
  const mine = ++seq;
  loading.value = true;
  try {
    const res = await employeesApi.search({ ...criteria.value, page: page.value, size: size.value });
    if (mine !== seq) return;
    // Page devenue hors limites (suppressions) : dernière page existante.
    if (res.totalPages > 0 && page.value >= res.totalPages) { page.value = res.totalPages - 1; return; }
    result.value = res;
    error.value = '';
  } catch (err) {
    if (mine !== seq) return;
    error.value = err.message;
    lastKey = '';
  } finally {
    if (mine === seq) loading.value = false;
  }
}

watch(criteriaKey, () => { if (page.value === 0) fetchPage(); else page.value = 0; });
watch(size, () => { if (page.value === 0) fetchPage(); else page.value = 0; });
watch(page, () => fetchPage());
// Liste relue, employé créé, modifié ou supprimé : la page courante est actualisée.
watch(() => store.db.employees, () => { if (store.employeesStatus === 'ready') fetchPage(true); });
onMounted(() => fetchPage(true));

// Lignes : données du serveur complétées par la partie locale de la fiche (département, fonction, compte…).
const list = computed(() => result.value.content.map((dto) => data.employee(dto.id) ?? fromDto(dto)));
const total = computed(() => result.value.totalElements);
const pageCount = computed(() => result.value.totalPages);
const firstRow = computed(() => (total.value === 0 ? 0 : page.value * size.value + 1));
const lastRow = computed(() => Math.min((page.value + 1) * size.value, total.value));
// Numéros de page affichés : première, dernière et voisines de la page courante (… entre les trous).
const pages = computed(() => {
  const n = pageCount.value;
  const keep = [...new Set([0, n - 1, page.value - 1, page.value, page.value + 1])].filter((p) => p >= 0 && p < n).sort((a, b) => a - b);
  return keep.flatMap((p, i) => (i > 0 && p - keep[i - 1] > 1 ? ['…', p] : [p]));
});

const activeFieldCount = computed(() => TEXT_FIELDS.filter(([k]) => fields[k].trim()).length + (fields.hireDateFrom ? 1 : 0) + (fields.hireDateTo ? 1 : 0));
const hasFilters = computed(() => q.value || departmentId.value || functionId.value || mode.value || Object.values(fields).some((v) => v));
function reset() { q.value = ''; search.value = ''; departmentId.value = ''; functionId.value = ''; mode.value = ''; Object.assign(fields, EMPTY_FIELDS); }
// La fermeture du formulaire revient à la liste ; la fiche créée s'ouvre juste après.
const openSaved = (e) => window.setTimeout(() => navigate(`employes/${e.id}`), 0);
</script>

<template>
  <PageHeader eyebrow="Application RH · Collaborateurs" title="Employés" :subtitle="`${data.employees.length} collaborateur${data.employees.length > 1 ? 's' : ''} · ${data.company.name}`">
    <template #icon><Users :size="20" :stroke-width="1.8" /></template>
    <template #actions>
      <button v-if="store.can('employes.creer')" type="button" class="btn btn-primary" :disabled="store.employeesStatus !== 'ready'" @click="navigate('employes/nouveau')"><Plus :size="15" aria-hidden="true" /> Ajouter un employé</button>
    </template>
  </PageHeader>
  <!-- Recherche et actions sur une ligne, puis les listes en colonnes de largeur égale. -->
  <section class="emp-filters" aria-label="Recherche et filtres">
    <div class="emp-filters-top">
      <div class="filter emp-search">
        <label for="emp-q">Recherche</label>
        <div class="input-icon">
          <Search :size="14" aria-hidden="true" />
          <input id="emp-q" v-model="q" type="search" placeholder="Nom, CIN, matricule, e-mail…" title="Nom, CIN, matricule, e-mail, téléphone, CNSS" />
        </div>
      </div>
      <button type="button" :class="['btn', 'btn-sm', 'btn-ghost', { 'is-on': moreFilters || activeFieldCount }]" :aria-expanded="moreFilters" aria-controls="emp-more-filters" @click="moreFilters = !moreFilters">
        <SlidersHorizontal :size="13" aria-hidden="true" /> {{ moreFilters ? 'Moins de filtres' : 'Plus de filtres' }}
        <span v-if="activeFieldCount" class="emp-filter-count">{{ activeFieldCount }}</span>
      </button>
      <button v-if="hasFilters" type="button" class="btn btn-sm btn-ghost" @click="reset"><RotateCcw :size="13" aria-hidden="true" /> Réinitialiser</button>
    </div>
    <div class="emp-filters-grid">
    <SelectFilter v-model="departmentId" label="Département" :options="data.departments.map((d) => ({ value: d.id, label: d.name + (d.archived ? ' (archivé)' : '') }))" />
    <SelectFilter v-model="functionId" label="Fonction" all-label="Toutes"
      :options="data.functions.filter((f) => !departmentId || f.departmentId === departmentId).map((f) => ({ value: f.id, label: f.name + (f.archived ? ' (archivée)' : '') }))" />
    <SelectFilter v-model="fields.statusId" label="Statut" :options="statuses.map((s) => ({ value: String(s.id), label: s.value + (s.isActive ? '' : ' (désactivé)') }))" />
    <SelectFilter v-model="mode" label="Mode horaire"
      :options="[{ value: 'organisation', label: 'Organisationnel' }, { value: 'chargement', label: 'Tableau de chargement' }, { value: 'non-planifie', label: 'Non planifié' }]" />
    <SelectFilter v-model="fields.gender" label="Genre" :options="[{ value: 'HOMME', label: 'Homme' }, { value: 'FEMME', label: 'Femme' }]" />
    <SelectFilter v-model="fields.maritalStatus" label="Situation" all-label="Toutes" :options="Object.entries(MARITAL_LABEL).map(([value, label]) => ({ value, label }))" />
    <SelectFilter v-model="fields.haveCnss" label="Affilié CNSS" :options="[{ value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' }]" />
    </div>
  <div v-show="moreFilters" id="emp-more-filters" class="emp-filters-grid emp-more">
    <div v-for="[key, label] in TEXT_FIELDS.filter(([key])=>key!=='internalNumber'||isCompanyModuleEnabled(store.companyId,'numero-interne'))" :key="key" class="filter">
      <label :for="`emp-f-${key}`">{{ label }}</label>
      <input :id="`emp-f-${key}`" v-model.lazy="fields[key]" type="search" :placeholder="`Contient…`" />
    </div>
    <div class="filter">
      <label for="emp-hire-from">Embauché du</label>
      <input id="emp-hire-from" v-model="fields.hireDateFrom" type="date" :max="fields.hireDateTo || undefined" />
    </div>
    <div class="filter">
      <label for="emp-hire-to">au</label>
      <input id="emp-hire-to" v-model="fields.hireDateTo" type="date" :min="fields.hireDateFrom || undefined" />
    </div>
  </div>
  </section>
  <EmptyState v-if="store.employeesStatus === 'loading' || (loading && !result.content.length && !error)" title="Chargement des employés…" text="Lecture des dossiers sur le serveur.">
    <template #icon><LoaderCircle :size="28" aria-hidden="true" /></template>
  </EmptyState>
  <EmptyState v-else-if="store.employeesStatus === 'error'" title="Employés indisponibles" :text="store.employeesError">
    <template #icon><CloudOff :size="28" aria-hidden="true" /></template>
    <template #action><button type="button" class="btn btn-sm btn-primary" @click="store.loadEmployees()">Réessayer</button></template>
  </EmptyState>
  <EmptyState v-else-if="error" title="Recherche indisponible" :text="error">
    <template #icon><CloudOff :size="28" aria-hidden="true" /></template>
    <template #action><button type="button" class="btn btn-sm btn-primary" @click="fetchPage(true)">Réessayer</button></template>
  </EmptyState>
  <template v-else>
    <p class="result-count" aria-live="polite">
      {{ total }} employé{{ total > 1 ? 's' : '' }}<template v-if="total"> · {{ firstRow }}–{{ lastRow }}</template>
      <LoaderCircle v-if="loading" :size="12" class="spin" aria-label="Actualisation…" />
    </p>
    <EmptyState v-if="list.length === 0" :title="data.employees.length === 0 && !hasFilters ? 'Aucun employé' : 'Aucun employé trouvé'"
      :text="data.employees.length === 0 && !hasFilters ? 'Créez le premier dossier employé. Pensez à paramétrer d’abord départements, fonctions et circuits (Paramètres).' : 'Modifiez la recherche ou les filtres.'">
      <template #action>
        <button v-if="hasFilters" type="button" class="btn btn-sm btn-ghost" @click="reset">Effacer les filtres</button>
        <button v-else-if="store.can('employes.creer')" type="button" class="btn btn-sm btn-primary" @click="navigate('employes/nouveau')">Ajouter un employé</button>
      </template>
    </EmptyState>
    <div v-else class="table-wrap" :class="{ 'is-loading': loading }">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Mat.</th>
            <th scope="col">Nom et prénom</th>
            <th v-if="isCompanyModuleEnabled(store.companyId,'numero-interne')" scope="col">N° interne</th>
            <th scope="col">Fonction</th>
            <th scope="col">Département</th>
            <th scope="col">Horaire</th>
            <th scope="col">Compte utilisateur</th>
            <th scope="col">Statut</th>
            <th scope="col">Rôles</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in list" :key="e.id" class="row-click" @click="navigate(`employes/${e.id}`)">
            <td class="nowrap"><span class="person"><Avatar :employee="e" /><span class="mono small text-muted">{{ e.matricule }}</span></span></td>
            <td><span class="person-name person-link">{{ e.firstName }} {{ e.lastName }}</span><span class="person-sub block">{{ e.email }}</span></td>
            <td v-if="isCompanyModuleEnabled(store.companyId,'numero-interne')" class="mono">{{ e.internalNumber || '—' }}</td>
            <td>{{ data.fn(e.functionId)?.name ?? '—' }}</td>
            <td>{{ data.department(e.departmentId)?.name ?? '—' }}<span v-if="e.subDepartmentId" class="block small text-muted">{{ data.department(e.subDepartmentId)?.name }}</span></td>
            <td>
              <span v-if="e.scheduleMode === 'organisation'" class="small">{{ data.schedule(data.profile(e.id)?.scheduleId)?.name ?? '—' }}</span>
              <Badge v-else-if="data.profile(e.id)?.scheduleId" tone="warning">Tableau de chargement</Badge>
              <Badge v-else tone="danger">Non planifié</Badge>
            </td>
            <td class="small">
              <span v-if="store.coreUserOf(e.id)" :title="'Compte Core Tenant'">{{ store.coreUserOf(e.id).email }}</span>
              <span v-else-if="data.profile(e.id)?.coreUserId">Compte Core lié</span>
              <span v-else class="text-muted">Non associé</span>
            </td>
            <td><EmployeeStatusBadge :status="e.status" :value="e.statusValue" /></td>
            <td><Badge v-if="data.role(data.profile(e.id)?.roleId)" tone="info">{{ data.role(data.profile(e.id)?.roleId).name }}</Badge><span v-else class="text-muted">—</span></td>
            <!-- <td class="actions">
              <button type="button" class="icon-btn icon-btn-sm" :aria-label="`Voir ${e.firstName} ${e.lastName}`" title="Voir la fiche" @click.stop="navigate(`employes/${e.id}`)"><Eye :size="14" /></button>
              <button v-if="store.can('employes.modifier')" type="button" class="icon-btn icon-btn-sm" :aria-label="`Modifier ${e.firstName} ${e.lastName}`" title="Modifier" @click.stop="editing = e"><Pencil :size="14" /></button>
              <button v-if="store.can('employes.supprimer')" type="button" class="icon-btn icon-btn-sm icon-btn-danger" :aria-label="`Supprimer ${e.firstName} ${e.lastName}`" title="Supprimer" @click.stop="deleting = e"><Trash2 :size="14" /></button>
            </td> -->
          </tr>
        </tbody>
      </table>
    </div>
    <nav v-if="total > 0" class="pager" aria-label="Pagination des employés">
      <label class="pager-size">Afficher
        <select v-model.number="size">
          <option v-for="n in PAGE_SIZES" :key="n" :value="n">{{ n }}</option>
        </select>
        par page
      </label>
      <div class="pager-pages">
        <button type="button" class="icon-btn icon-btn-sm" :disabled="page === 0 || loading" aria-label="Page précédente" @click="page--"><ChevronLeft :size="14" /></button>
        <template v-for="(p, i) in pages" :key="`${p}-${i}`">
          <span v-if="p === '…'" class="pager-gap" aria-hidden="true">…</span>
          <button v-else type="button" class="btn btn-sm" :class="p === page ? 'btn-primary' : 'btn-ghost'" :aria-current="p === page ? 'page' : undefined"
            :disabled="loading && p !== page" @click="page = p">{{ p + 1 }}</button>
        </template>
        <button type="button" class="icon-btn icon-btn-sm" :disabled="page >= pageCount - 1 || loading" aria-label="Page suivante" @click="page++"><ChevronRight :size="14" /></button>
      </div>
      <span class="pager-info">Page {{ page + 1 }} / {{ pageCount }}</span>
    </nav>
  </template>
  <EmployeeForm :open="addOpen" @close="navigate('employes')" @saved="openSaved" />
  <EmployeeForm :open="!!editing" :employee="editing" @close="editing = undefined" />
  <DeleteEmployeeModal :employee="deleting" @close="deleting = undefined" />
</template>

<style scoped>
/* Barre de filtres fine, sur une ligne : recherche compacte, listes étroites alignées en bas, actions au bout. */
.emp-filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px 10px; padding: 0 0 12px; border-bottom: 1px solid var(--border, #e2e8f0); }
.emp-filters-top, .emp-filters-grid:not(.emp-more) { display: contents; }
.emp-search { order: 0; flex: 0 1 250px; min-width: 190px; }
.emp-search .input-icon :deep(svg) { left: 9px; color: #94a3b8; }
.emp-search input { width: 100%; height: 30px; padding-left: 29px; font-size: 12.5px; }
.emp-filters-grid:not(.emp-more) :deep(.filter) { order: 1; width: 132px; min-width: 0; }
.emp-filters :deep(.filter select), .emp-filters :deep(.filter input) { width: 100%; height: 30px; }
.emp-filters-top .btn { order: 2; height: 30px; white-space: nowrap; }
.emp-filters-top .btn.is-on { color: var(--primary, #1d4ed8); }
.emp-filter-count { display: inline-grid; place-items: center; min-width: 16px; height: 16px; padding: 0 4px; margin-left: 2px; border-radius: 8px; background: var(--primary, #1d4ed8); color: #fff; font-size: 10px; font-weight: 700; }
.emp-more { order: 3; flex-basis: 100%; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px 10px; padding-top: 10px; border-top: 1px dashed var(--border, #e2e8f0); }
.emp-more :deep(.filter) { min-width: 0; }
.table-wrap.is-loading { opacity: .6; transition: opacity .15s; }
.result-count .spin { margin-left: 6px; vertical-align: -2px; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0 4px; font-size: 12px; color: var(--muted); }
.pager-size { display: inline-flex; align-items: center; gap: 6px; }
.pager-size select { height: 28px; padding: 0 6px; border: 1px solid var(--border, #dbe2ea); border-radius: 6px; background: transparent; color: inherit; }
.pager-pages { display: inline-flex; align-items: center; gap: 4px; }
.pager-pages .btn { min-width: 30px; justify-content: center; }
.pager-gap { padding: 0 4px; }
</style>
