
<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, CloudOff, FilePen, CalendarClock, CircleCheck, CircleMinus, CirclePause, CirclePlay, CircleStop, LoaderCircle, Pencil, Plus, Search, Trash2 } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import { contractsApi, fromContractDto } from '../../api/contracts';
import { fromTypeContractDto, typeContractsApi } from '../../api/typeContracts';
import { diffDays, formatDate, TODAY } from '../../utils/dates';
import Badge from '../../components/ui/Badge.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import Modal from '../../components/ui/Modal.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import SelectFilter from '../../components/ui/SelectFilter.vue';
import Switch from '../../components/ui/Switch.vue';
import ContractForm from './ContractForm.vue';
import SuspendContractDialog from './SuspendContractDialog.vue';

/**
 * Contrats des employés (backend /api/contracts). Un employé n'a jamais deux contrats dont les périodes se chevauchent
 * (vérifié par le backend) ; seuls les contrats des employés de la société active sont affichés.
 */
const PAGE_SIZES = [5,10, 25, 50];

const store = useStore();
const data = useCompanyData();

// ---------- Recherche, filtres, pagination : appliqués par le serveur (POST /api/contracts/search) ----------
const q = ref('');
// Recherche envoyée au serveur après une courte pause de frappe.
const search = ref('');
let typing;
watch(q, (v) => { window.clearTimeout(typing); typing = window.setTimeout(() => { search.value = v.trim(); }, 300); });
const typeId = ref('');
const duration = ref('');
// Archivés affichés (grisés) par défaut, comme dans les paramètres.
const showArchived = ref(true);
const page = ref(0);
const size = ref(PAGE_SIZES[0]);

const EMPTY = { content: [], page: 0, size: PAGE_SIZES[0], totalElements: 0, totalPages: 0, archivedCount: 0 };
const result = ref(EMPTY);
const loading = ref(true);
const error = ref('');

// Critères hors pagination : seuls les contrats des employés de la société active.
const criteria = computed(() => ({
  search: search.value,
  typeContractId: typeId.value,
  duree: duration.value ? duration.value === 'true' : '',
  etat: showArchived.value ? '' : true,
  employeeIds: data.employees.map((e) => e.id),
}));
watch(() => JSON.stringify(criteria.value), () => { page.value = 0; });
watch(size, () => { page.value = 0; });

// La dernière requête lancée l'emporte (réponses arrivées dans le désordre ignorées).
let requestId = 0;
async function load() {
  const id = ++requestId;
  loading.value = true;
  try {
    const res = await contractsApi.search({ ...criteria.value, page: page.value, size: size.value });
    if (id !== requestId) return;
    result.value = { ...res, content: res.content.map(fromContractDto) };
    error.value = '';
    // Page devenue vide (dernier contrat archivé masqué…) : retour à la dernière page existante.
    if (page.value > 0 && page.value >= res.totalPages) page.value = Math.max(res.totalPages - 1, 0);
  } catch (e) {
    if (id === requestId) error.value = e.message;
  } finally {
    if (id === requestId) loading.value = false;
  }
}
watch([() => JSON.stringify(criteria.value), page, size], load, { immediate: true });

// Types de contrat (actifs et archivés) proposés dans le filtre.
const types = ref([]);
onMounted(async () => {
  try {
    types.value = (await typeContractsApi.list()).map((dto) => fromTypeContractDto(dto));
  } catch {
    types.value = [];
  }
});
const typeOptions = computed(() => types.value.map((t) => ({ value: t.id, label: `${t.name}${t.archived ? ' (archivé)' : ''}` })));

const rows = computed(() => result.value.content);
const total = computed(() => result.value.totalElements);

const archivedCount = computed(() => result.value.archivedCount);
const hasFilters = computed(() => !!(q.value || typeId.value || duration.value || !showArchived.value));
function reset() { q.value = ''; search.value = ''; typeId.value = ''; duration.value = ''; showArchived.value = true; }

const pageCount = computed(() => Math.max(1, result.value.totalPages));
const firstRow = computed(() => page.value * size.value + 1);
const lastRow = computed(() => Math.min(total.value, (page.value + 1) * size.value));
const pages = computed(() => {
  const n = pageCount.value;
  const keep = [...new Set([0, n - 1, page.value - 1, page.value, page.value + 1])].filter((p) => p >= 0 && p < n).sort((a, b) => a - b);
  return keep.flatMap((p, i) => (i > 0 && p - keep[i - 1] > 1 ? ['…', p] : [p]));
});

// ---------- Ajout / modification ----------
const editing = ref();
function onSaved(saved, isNew) {
  store.toast(`Contrat de ${saved.employeeName} ${isNew ? 'ajouté' : 'mis à jour'}`);
  editing.value = undefined;
  load();
}

// ---------- Archivage (comme les paramètres : un contrat archivé reste consultable, grisé) ----------
const busyId = ref('');

/**
 * Statut temporel : valeur calculée par le backend (référence métier) ; le navigateur ne calcule que le compte à rebours
 * avant le début, à partir de la date de début (aaaa-mm-jj, sans fuseau). Date invalide : pas de compte à rebours.
 */
const STATUS = {
  PAS_ENCORE: ['Pas encore', 'info', CalendarClock],
  EN_COURS: ['En cours', 'primary', CirclePlay],
  SUSPENDU: ['Suspendu', 'warning', CirclePause],
  TERMINE: ['Terminé', 'muted', CircleStop],
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function progressOf(c) {
  const daysLeft = c.status === 'PAS_ENCORE' && ISO_DATE.test(c.start ?? '') ? Math.max(diffDays(TODAY, c.start), 0) : 0;
  return { status: STATUS[c.status], inProgress: c.status === 'EN_COURS', daysLeft };
}

// ---------- Suspension (contrat suspendu + statut de sortie de l'employe) ----------
const suspending = ref();
function onSuspended() {
  suspending.value = undefined;
  load();
}

// ---------- Suppression (contrats a venir uniquement) : DELETE /api/contracts/{id} ----------
const deleting = ref();
async function confirmDelete() {
  const c = deleting.value;
  if (!c || busyId.value) return;
  busyId.value = c.id;
  try {
    await contractsApi.remove(c.id);
    store.toast(`Contrat de ${c.employeeName} supprimé`, 'info');
    deleting.value = undefined;
    await load();
  } catch (e) {
    store.toast(`Suppression impossible : ${e.message}`, 'danger');
  } finally {
    busyId.value = '';
  }
}

// Ligne grisee : contrat archive (etat = false) ; les archives sont masques par le serveur quand la case est decochee.
const isArchived = (c) => !c.active;
const visibleRows = rows;

// Archivage / restauration : PATCH /api/contracts/{id}/status (etat).
async function toggleArchived(c) {
  if (busyId.value) return;
  busyId.value = c.id;
  try {
    await contractsApi.setActive(c.id, !c.active);
    store.toast(c.active ? 'Contrat archivé — il reste visible dans l’historique' : 'Contrat restauré', 'info');
    await load();
  } catch (e) {
    store.toast(e.message, 'danger');
  } finally {
    busyId.value = '';
  }
}
</script>

<template>
  <PageHeader eyebrow="Application RH · Collaborateurs" title="Contrats" :subtitle="`${total} contrat${total > 1 ? 's' : ''} · ${data.company.name}`">
    <template #icon><FilePen :size="20" :stroke-width="1.8" /></template>
    <template #actions>
      <button v-if="store.can('contrats.creer')" type="button" class="btn btn-primary" @click="editing = {}"><Plus :size="15" aria-hidden="true" /> Ajouter un contrat</button>
    </template>
  </PageHeader>
  <div class="filters">
    <div class="filter filter-search">
      <label for="ct-q">Recherche</label>
      <div class="input-icon">
        <Search :size="14" aria-hidden="true" />
        <input id="ct-q" v-model="q" type="search" placeholder="Employé, type de contrat…" />
      </div>
    </div>
    <SelectFilter v-model="typeId" label="Type de contrat" :options="typeOptions" />
    <SelectFilter v-model="duration" label="Durée" all-label="Toutes" :options="[{ value: 'true', label: 'Déterminée' }, { value: 'false', label: 'Indéterminée' }]" />
    <div class="archived-switch"><Switch v-model="showArchived" :label="`Afficher les archivés (${archivedCount})`" /></div>
  </div>

  <EmptyState v-if="loading && !rows.length && !error" title="Chargement des contrats…" text="Lecture des contrats sur le serveur.">
    <template #icon><LoaderCircle :size="28" aria-hidden="true" /></template>
  </EmptyState>
  <EmptyState v-else-if="error" title="Contrats indisponibles" :text="error">
    <template #icon><CloudOff :size="28" aria-hidden="true" /></template>
    <template #action><button type="button" class="btn btn-sm btn-primary" @click="load">Réessayer</button></template>
  </EmptyState>
  <template v-else>
    <p class="result-count" aria-live="polite">
      {{ total }} contrat{{ total > 1 ? 's' : '' }}<template v-if="total"> · {{ firstRow }}–{{ lastRow }}</template>
      <LoaderCircle v-if="loading" :size="12" class="spin" aria-label="Actualisation…" />
    </p>
    <EmptyState v-if="visibleRows.length === 0" :title="hasFilters ? 'Aucun contrat trouvé' : 'Aucun contrat'"
      :text="hasFilters ? 'Modifiez la recherche ou les filtres, ou affichez les archivés.' : 'Ajoutez le premier contrat. Les types de contrat se paramètrent dans Paramètres › Types de contrat.'">
      <template #action>
        <button v-if="hasFilters" type="button" class="btn btn-sm btn-ghost" @click="reset">Effacer les filtres</button>
        <button v-else-if="store.can('contrats.creer')" type="button" class="btn btn-sm btn-primary" @click="editing = {}">Ajouter un contrat</button>
      </template>
    </EmptyState>
    <div v-else class="table-wrap" :class="{ 'is-loading': loading }">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Employé</th>
            <th scope="col">Type de contrat</th>
            <th scope="col">Date de début</th>
            <th scope="col">Date de fin</th>
            <th scope="col">Fin de période d’essai</th>
            <th scope="col">État</th>
            <th scope="col">Statut</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in visibleRows" :key="c.id" :class="{ 'row-archived': isArchived(c) }">
            <td><span class="person-name">{{ c.employeeName }}</span></td>
            <td>
              <div class="type-cell">
                <span><span class="mono"><strong>{{ c.typeCode }}</strong></span> <span class="small text-muted">{{ c.typeName }}</span></span>
                <Badge v-if="c.fixedTerm" tone="info">Déterminée</Badge><Badge v-else tone="success">Indéterminée</Badge>
              </div>
            </td>
            <td>{{ formatDate(c.start) }}</td>
            <td><template v-if="c.end">{{ formatDate(c.end) }}</template><span v-else class="text-muted">—</span></td>
            <td><template v-if="c.trialEnd">{{ formatDate(c.trialEnd) }}</template><span v-else class="text-muted">Aucune</span></td>
            <td>
              <Badge v-if="c.active" tone="success"><template #icon><CircleCheck :size="12" aria-hidden="true" /></template>Actif</Badge>
              <Badge v-else tone="muted"><template #icon><CircleMinus :size="12" aria-hidden="true" /></template>Inactif</Badge>
            </td>
            <td>
              <div v-if="progressOf(c).status" class="status-cell">
                <Badge :tone="progressOf(c).status[1]"><template #icon><component :is="progressOf(c).status[2]" :size="12" aria-hidden="true" /></template>{{ progressOf(c).status[0] }}</Badge>
                <span v-if="progressOf(c).daysLeft" class="small text-muted" :title="`Début le ${formatDate(c.start)}`">
                  Débute dans {{ progressOf(c).daysLeft }} jour{{ progressOf(c).daysLeft > 1 ? 's' : '' }}
                </span>
              </div>
              <span v-else class="text-muted">—</span>
            </td>
            <td class="actions">
              <button v-if="store.can('contrats.modifier')" type="button" class="btn btn-sm btn-ghost" :disabled="!c.active || progressOf(c).inProgress || c.status === 'SUSPENDU'" :title="progressOf(c).inProgress || c.status === 'SUSPENDU' ? 'Contrat en cours : non modifiable' : undefined" :aria-label="`Modifier le contrat de ${c.employeeName}`" @click="editing = { contract: c }"><Pencil :size="13" aria-hidden="true" /> Modifier</button>
              <button v-if="progressOf(c).inProgress && store.can('contrats.suspendre')" type="button" class="btn btn-sm btn-ghost" :disabled="!c.active" :title="!c.active ? 'Contrat inactif' : undefined" :aria-label="`Suspendre le contrat de ${c.employeeName}`" @click="suspending = c"><CirclePause :size="14" aria-hidden="true" /> Suspendre</button>
              <button v-else-if="c.status === 'PAS_ENCORE' && store.can('contrats.supprimer')" type="button" class="btn btn-sm btn-ghost text-danger" :disabled="busyId === c.id" :aria-label="`Supprimer le contrat de ${c.employeeName}`" @click="deleting = c"><Trash2 :size="14" aria-hidden="true" /> Supprimer</button>
              <button v-if="store.can('contrats.supprimer')" type="button" class="btn btn-sm btn-ghost" :disabled="busyId === c.id" :aria-label="`${c.active ? 'Archiver' : 'Restaurer'} le contrat de ${c.employeeName}`" @click="toggleArchived(c)">
                <template v-if="c.active"><Archive :size="14" aria-hidden="true" /> Archiver</template>
                <template v-else><ArchiveRestore :size="14" aria-hidden="true" /> Restaurer</template>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <nav v-if="total > 0" class="pager" aria-label="Pagination des contrats">
      <label class="pager-size">Afficher
        <select v-model.number="size">
          <option v-for="n in PAGE_SIZES" :key="n" :value="n">{{ n }}</option>
        </select>
        par page
      </label>
      <div class="pager-pages">
        <button type="button" class="icon-btn icon-btn-sm" :disabled="page === 0" aria-label="Page précédente" @click="page--"><ChevronLeft :size="14" /></button>
        <template v-for="(p, i) in pages" :key="`${p}-${i}`">
          <span v-if="p === '…'" class="pager-gap" aria-hidden="true">…</span>
          <button v-else type="button" class="btn btn-sm" :class="p === page ? 'btn-primary' : 'btn-ghost'" :aria-current="p === page ? 'page' : undefined" @click="page = p">{{ p + 1 }}</button>
        </template>
        <button type="button" class="icon-btn icon-btn-sm" :disabled="page >= pageCount - 1" aria-label="Page suivante" @click="page++"><ChevronRight :size="14" /></button>
      </div>
      <span class="pager-info">Page {{ page + 1 }} / {{ pageCount }}</span>
    </nav>
  </template>

  <ContractForm :open="!!editing" :contract="editing?.contract" @close="editing = undefined" @saved="onSaved" />
  <SuspendContractDialog :contract="suspending" @close="suspending = undefined" @suspended="onSuspended" />
  <Modal :open="!!deleting" size="sm" :title="deleting ? `Supprimer le contrat de ${deleting.employeeName}` : ''" @close="busyId || (deleting = undefined)">
    <p v-if="deleting">
      Le contrat <span class="mono">{{ deleting.typeCode }}</span> débutant le {{ formatDate(deleting.start) }} sera définitivement supprimé.
      Cette action est irréversible.
    </p>
    <template #footer>
      <button type="button" class="btn btn-ghost" :disabled="!!busyId" @click="deleting = undefined">Annuler</button>
      <button type="button" class="btn btn-danger" :disabled="!!busyId" @click="confirmDelete"><Trash2 :size="15" aria-hidden="true" /> {{ busyId ? 'Suppression…' : 'Supprimer' }}</button>
    </template>
  </Modal>

</template>

<style scoped>
.table-wrap.is-loading { opacity: .6; transition: opacity .15s; }
.result-count .spin { margin-left: 6px; vertical-align: -2px; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0 4px; font-size: 12px; color: var(--muted); }
.pager-size { display: inline-flex; align-items: center; gap: 6px; }
.pager-size select { height: 28px; padding: 0 6px; border: 1px solid var(--border, #dbe2ea); border-radius: 6px; background: transparent; color: inherit; }
.pager-pages { display: inline-flex; align-items: center; gap: 4px; }
.pager-pages .btn { min-width: 30px; justify-content: center; }
.pager-gap { padding: 0 4px; }
.type-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.actions { white-space: nowrap; text-align: right; }
.archived-switch { align-self: flex-end; padding-bottom: 8px; margin-left: auto; }
.status-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
</style>
