<script setup>
import { computed, ref, watch } from 'vue';
import { Archive, ArchiveRestore, Banknote, ChevronLeft, ChevronRight, CloudOff, LoaderCircle, Pencil, Plus, Search, Trash2 } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import { fromSalaryDto, salariesApi } from '../../api/salaries';
import { formatDate } from '../../utils/dates';
import { formatAmount } from '../../utils/org';
import ArchivedBadge from '../../components/ui/ArchivedBadge.vue';
import Badge from '../../components/ui/Badge.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import Modal from '../../components/ui/Modal.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import Switch from '../../components/ui/Switch.vue';
import SalaryForm from './SalaryForm.vue';

/**
 * Salaires des employés (backend /api/salaries). Chaque période de salaire est couverte par un contrat actif de
 * l'employé (vérifié par le backend) ; seuls les salaires des employés de la société active sont affichés.
 */
const PAGE_SIZES = [5, 10, 25, 50];

const store = useStore();
const data = useCompanyData();

// ---------- Recherche, pagination : appliquées par le serveur (POST /api/salaries/search) ----------
const q = ref('');
const search = ref('');
let typing;
watch(q, (v) => { window.clearTimeout(typing); typing = window.setTimeout(() => { search.value = v.trim(); }, 300); });
// Archivés affichés (grisés) par défaut, comme dans Contrats.
const showArchived = ref(true);
const page = ref(0);
const size = ref(PAGE_SIZES[0]);

const EMPTY = { content: [], page: 0, size: PAGE_SIZES[0], totalElements: 0, totalPages: 0, archivedCount: 0 };
const result = ref(EMPTY);
const loading = ref(true);
const error = ref('');

const criteria = computed(() => ({
  search: search.value,
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
    const res = await salariesApi.search({ ...criteria.value, page: page.value, size: size.value });
    if (id !== requestId) return;
    result.value = { ...res, content: res.content.map(fromSalaryDto) };
    error.value = '';
    if (page.value > 0 && page.value >= res.totalPages) page.value = Math.max(res.totalPages - 1, 0);
  } catch (e) {
    if (id === requestId) error.value = e.message;
  } finally {
    if (id === requestId) loading.value = false;
  }
}
watch([() => JSON.stringify(criteria.value), page, size], load, { immediate: true });

const rows = computed(() => result.value.content);
const total = computed(() => result.value.totalElements);
const archivedCount = computed(() => result.value.archivedCount);
const hasFilters = computed(() => !!(q.value || !showArchived.value));
function reset() { q.value = ''; search.value = ''; showArchived.value = true; }

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
  store.toast(`Salaire de ${saved.employeeName} ${isNew ? 'ajouté' : 'mis à jour'}`);
  editing.value = undefined;
  load();
}

// ---------- Archivage (un salaire archivé reste consultable, grisé) ----------
const busyId = ref('');
async function toggleArchived(s) {
  if (busyId.value) return;
  busyId.value = s.id;
  try {
    await salariesApi.setActive(s.id, !s.active);
    store.toast(s.active ? 'Salaire archivé — il reste visible dans l’historique' : 'Salaire restauré', 'info');
    await load();
  } catch (e) {
    store.toast(e.message, 'danger');
  } finally {
    busyId.value = '';
  }
}

// ---------- Suppression ----------
const deleting = ref();
const busy = ref(false);
async function confirmDelete() {
  const s = deleting.value;
  busy.value = true;
  try {
    await salariesApi.remove(s.id);
    store.toast(`Salaire de ${s.employeeName} supprimé`, 'info');
    deleting.value = undefined;
    await load();
  } catch (e) {
    store.toast(`Suppression impossible : ${e.message}`, 'danger');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <PageHeader eyebrow="Application RH · Collaborateurs" title="Salaires" :subtitle="`${total} salaire${total > 1 ? 's' : ''} · ${data.company.name}`">
    <template #icon><Banknote :size="20" :stroke-width="1.8" /></template>
    <template #actions>
      <button v-if="store.can('salaires.creer')" type="button" class="btn btn-primary" @click="editing = {}"><Plus :size="15" aria-hidden="true" /> Ajouter un salaire</button>
    </template>
  </PageHeader>
  <div class="filters">
    <div class="filter filter-search">
      <label for="sl-q">Recherche</label>
      <div class="input-icon">
        <Search :size="14" aria-hidden="true" />
        <input id="sl-q" v-model="q" type="search" placeholder="Employé…" />
      </div>
    </div>
    <div class="archived-switch"><Switch v-model="showArchived" :label="`Afficher les archivés (${archivedCount})`" /></div>
  </div>

  <EmptyState v-if="loading && !rows.length && !error" title="Chargement des salaires…" text="Lecture des salaires sur le serveur.">
    <template #icon><LoaderCircle :size="28" aria-hidden="true" /></template>
  </EmptyState>
  <EmptyState v-else-if="error" title="Salaires indisponibles" :text="error">
    <template #icon><CloudOff :size="28" aria-hidden="true" /></template>
    <template #action><button type="button" class="btn btn-sm btn-primary" @click="load">Réessayer</button></template>
  </EmptyState>
  <template v-else>
    <p class="result-count" aria-live="polite">
      {{ total }} salaire{{ total > 1 ? 's' : '' }}<template v-if="total"> · {{ firstRow }}–{{ lastRow }}</template>
      <LoaderCircle v-if="loading" :size="12" class="spin" aria-label="Actualisation…" />
    </p>
    <EmptyState v-if="rows.length === 0" :title="hasFilters ? 'Aucun salaire trouvé' : 'Aucun salaire'"
      :text="hasFilters ? 'Modifiez la recherche, ou affichez les archivés.' : 'Ajoutez le premier salaire. Il doit être couvert par un contrat actif de l’employé.'">
      <template #action>
        <button v-if="hasFilters" type="button" class="btn btn-sm btn-ghost" @click="reset">Effacer les filtres</button>
        <button v-else-if="store.can('salaires.creer')" type="button" class="btn btn-sm btn-primary" @click="editing = {}">Ajouter un salaire</button>
      </template>
    </EmptyState>
    <div v-else class="table-wrap" :class="{ 'is-loading': loading }">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Employé</th>
            <th scope="col">Date de début</th>
            <th scope="col">Date de fin</th>
            <th scope="col">Montant</th>
            <th scope="col">Devise</th>
            <th scope="col">État</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in rows" :key="s.id" :class="{ 'row-archived': !s.active }">
            <td><span class="person-name">{{ s.employeeName }}</span></td>
            <td>{{ formatDate(s.start) }}</td>
            <td><template v-if="s.end">{{ formatDate(s.end) }}</template><span v-else class="text-muted">En cours</span></td>
            <td class="mono">{{ formatAmount(s.amount, s.devise ?? store.activeDevise) }}</td>
            <td><span class="mono">{{ (s.devise ?? store.activeDevise)?.code ?? '—' }}</span></td>
            <td><Badge v-if="s.active" tone="success">Actif</Badge><ArchivedBadge v-else /></td>
            <td class="actions">
              <button v-if="store.can('salaires.modifier')" type="button" class="btn btn-sm btn-ghost" :disabled="!s.active" :aria-label="`Modifier le salaire de ${s.employeeName}`" @click="editing = { salary: s }"><Pencil :size="13" aria-hidden="true" /> Modifier</button>
              <button v-if="store.can('salaires.supprimer')" type="button" class="btn btn-sm btn-ghost" :disabled="busyId === s.id" :aria-label="`${s.active ? 'Archiver' : 'Restaurer'} le salaire de ${s.employeeName}`" @click="toggleArchived(s)">
                <template v-if="s.active"><Archive :size="14" aria-hidden="true" /> Archiver</template>
                <template v-else><ArchiveRestore :size="14" aria-hidden="true" /> Restaurer</template>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <nav v-if="total > 0" class="pager" aria-label="Pagination des salaires">
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

  <SalaryForm :open="!!editing" :salary="editing?.salary" @close="editing = undefined" @saved="onSaved" />

  <Modal :open="!!deleting" size="sm" :title="deleting ? `Supprimer le salaire de ${deleting.employeeName}` : ''" @close="deleting = undefined">
    <p v-if="deleting">
      Le salaire de {{ formatAmount(deleting.amount, deleting.devise ?? store.activeDevise) }} du {{ formatDate(deleting.start) }}{{ deleting.end ? ` au ${formatDate(deleting.end)}` : ' (en cours)' }} sera définitivement supprimé.
    </p>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="deleting = undefined">Annuler</button>
      <button type="button" class="btn btn-danger" :disabled="busy" @click="confirmDelete">
        <Trash2 :size="15" aria-hidden="true" /> {{ busy ? 'Suppression…' : 'Supprimer' }}
      </button>
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
.actions { white-space: nowrap; text-align: right; }
.archived-switch { align-self: flex-end; padding-bottom: 8px; margin-left: auto; }
</style>
