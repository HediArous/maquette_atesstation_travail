<script setup>
import { computed, ref, watch } from 'vue';
import { Archive, ArchiveRestore, CloudOff, GitCommitHorizontal, LoaderCircle, Pencil, Plus, Trash2, TrendingDown, TrendingUp, Wallet } from '@lucide/vue';
import { useStore } from '../../store';
import { fromSalaryDto, salariesApi } from '../../api/salaries';
import { formatDate, TODAY } from '../../utils/dates';
import { formatAmount } from '../../utils/org';
import Alert from '../../components/ui/Alert.vue';
import Badge from '../../components/ui/Badge.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import Modal from '../../components/ui/Modal.vue';
import FormCard from '../../components/FormCard.vue';
import SalaryForm from '../salaries/SalaryForm.vue';

/**
 * Salaires de base de l'employé (backend /api/salaries, filtre employeeId) : évolution en parcours et historique.
 * Ajout et modification via SalaryForm (employé verrouillé) ; la couverture par un contrat, le chevauchement et les
 * règles CDD / CDI restent vérifiés par le backend. Montants affichés dans la devise active (symbole, décimales).
 */
const props = defineProps({ employee: { type: Object, required: true } });

const store = useStore();
const list = ref([]);
const loading = ref(true);
const error = ref('');

let requestId = 0;
async function load() {
  const id = ++requestId;
  loading.value = true;
  try {
    const res = await salariesApi.search({ employeeId: props.employee.id, size: 100 });
    if (id !== requestId) return;
    list.value = res.content.map(fromSalaryDto);
    error.value = '';
  } catch (e) {
    if (id === requestId) error.value = e.message;
  } finally {
    if (id === requestId) loading.value = false;
  }
}
watch(() => props.employee.id, () => { list.value = []; load(); }, { immediate: true });

const devise = computed(() => store.activeDevise);
const money = (n) => formatAmount(n, devise.value);
const pct = (diff, base) => (base ? (diff / base) * 100 : 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const sign = (n) => (n > 0 ? '+' : '');

/** Situation : archivé (etat = false), à venir, actuel (période couvrant aujourd'hui) ou terminé. */
function stateOf(s) {
  if (!s.active) return 'archive';
  if (s.start > TODAY) return 'avenir';
  if (!s.end || s.end >= TODAY) return 'actuel';
  return 'termine';
}
const STATE = {
  actuel: { label: 'Actuel', tone: 'success', step: 'current' },
  avenir: { label: 'À venir', tone: 'info', step: 'next' },
  termine: { label: 'Terminé', tone: 'muted', step: 'past' },
  archive: { label: 'Archivé', tone: 'muted', step: 'stopped' },
};

// Du plus ancien au plus récent pour la progression (salaires archivés exclus du calcul).
const asc = computed(() => [...list.value].sort((a, b) => a.start.localeCompare(b.start)));
const rows = computed(() => {
  let prev;
  return asc.value.map((s) => {
    const base = s.active ? prev : undefined;
    const diff = base ? s.amount - base.amount : 0;
    const row = {
      s, base, diff, state: stateOf(s),
      nature: !s.active ? '—' : !base ? 'Salaire initial' : diff > 0 ? 'Revalorisation' : diff < 0 ? 'Ajustement à la baisse' : 'Reconduction',
      kindClass: !base ? 'ct-kind-initial' : diff > 0 ? 'ct-kind-renouvellement' : '',
    };
    if (s.active) prev = s;
    return row;
  });
});
const desc = computed(() => [...rows.value].reverse());
const current = computed(() => rows.value.find((r) => r.state === 'actuel')?.s);
const initial = computed(() => asc.value.find((s) => s.active));
const totalGain = computed(() => (current.value && initial.value && current.value !== initial.value ? current.value.amount - initial.value.amount : 0));

const evolutionSubtitle = computed(() => (current.value
  ? `Salaire actuel : ${money(current.value.amount)} / mois depuis le ${formatDate(current.value.start)}`
  : 'Aucun salaire en vigueur.'));
const historySubtitle = computed(() => (totalGain.value
  ? `Progression depuis l’embauche : ${sign(totalGain.value)}${money(totalGain.value)} (${sign(totalGain.value)}${pct(totalGain.value, initial.value.amount)} %)`
  : 'Chaque salaire doit être couvert par un contrat actif de l’employé, sans chevauchement de période.'));

// ---------- Ajout / modification ----------
const editing = ref();
function onSaved(saved, isNew) {
  store.toast(isNew ? 'Salaire enregistré' : 'Salaire mis à jour');
  editing.value = undefined;
  load();
}

// ---------- Archivage / suppression ----------
const busyId = ref('');
async function toggleArchived(s) {
  if (busyId.value) return;
  busyId.value = s.id;
  try {
    await salariesApi.setActive(s.id, !s.active);
    store.toast(s.active ? 'Salaire archivé' : 'Salaire restauré', 'info');
    await load();
  } catch (e) {
    store.toast(`Opération impossible : ${e.message}`, 'danger');
  } finally {
    busyId.value = '';
  }
}
const removing = ref();
async function confirmRemove() {
  const s = removing.value;
  if (!s || busyId.value) return;
  busyId.value = s.id;
  try {
    await salariesApi.remove(s.id);
    store.toast('Salaire supprimé', 'info');
    removing.value = undefined;
    await load();
  } catch (e) {
    store.toast(`Suppression impossible : ${e.message}`, 'danger');
  } finally {
    busyId.value = '';
  }
}
</script>

<template>
  <Alert v-if="!devise && store.devisesStatus !== 'loading'" tone="warning" title="Aucune devise active">
    Activez une devise dans Paramètres › Devises : les montants sont affichés sans symbole.
  </Alert>
  <Alert v-if="error && list.length" tone="danger" title="Actualisation impossible">
    {{ error }} <button type="button" class="btn btn-sm btn-ghost" @click="load">Réessayer</button>
  </Alert>

  <FormCard v-if="list.length" title="Évolution du salaire" :subtitle="evolutionSubtitle">
    <template #icon><GitCommitHorizontal :size="16" /></template>
    <ol class="wf" aria-label="Évolution du salaire">
      <li v-for="(r, i) in rows" :key="r.s.id" :class="['wf-step', STATE[r.state].step]" :aria-current="r.state === 'actuel' ? 'step' : undefined">
        <span class="wf-rail" aria-hidden="true"><span class="wf-node">{{ i + 1 }}</span></span>
        <div class="wf-card">
          <div class="wf-card-top">
            <span v-if="r.s.active" :class="['ct-kind', r.kindClass]">{{ r.nature }}</span>
            <Badge :tone="STATE[r.state].tone">{{ STATE[r.state].label }}</Badge>
          </div>
          <p class="wf-amount">{{ money(r.s.amount) }}<small> / mois</small></p>
          <p class="wf-dates">{{ formatDate(r.s.start) }} <span aria-hidden="true">→</span> {{ r.s.end ? formatDate(r.s.end) : 'en cours' }}</p>
          <span v-if="r.base" :class="['sal-delta', { up: r.diff > 0, down: r.diff < 0 }]">
            <TrendingUp v-if="r.diff > 0" :size="12" aria-hidden="true" /><TrendingDown v-else-if="r.diff < 0" :size="12" aria-hidden="true" />
            {{ sign(r.diff) }}{{ money(r.diff) }} <small>{{ sign(r.diff) }}{{ pct(r.diff, r.base.amount) }} %</small>
          </span>
          <p v-else-if="r.s.active" class="wf-meta">Salaire d’embauche</p>
        </div>
      </li>
    </ol>
  </FormCard>

  <FormCard title="Historique des salaires de base" :subtitle="historySubtitle">
    <template #icon><Wallet :size="16" /></template>
    <template #actions>
      <button v-if="store.can('salaires.creer')" type="button" class="btn btn-sm btn-primary" :disabled="loading && !list.length" @click="editing = { title: 'Nouveau salaire de base' }"><Plus :size="14" aria-hidden="true" /> Nouveau salaire</button>
    </template>

    <EmptyState v-if="loading && !list.length" title="Chargement des salaires…">
      <template #icon><LoaderCircle :size="24" class="spin" aria-hidden="true" /></template>
    </EmptyState>
    <EmptyState v-else-if="error && !list.length" title="Salaires indisponibles" :text="error">
      <template #icon><CloudOff :size="24" aria-hidden="true" /></template>
      <template #action><button type="button" class="btn btn-primary" @click="load">Réessayer</button></template>
    </EmptyState>
    <EmptyState v-else-if="!list.length" title="Aucun salaire enregistré" text="Ajoutez le salaire de base de l’employé ; sa période doit être couverte par un contrat actif.">
      <template #icon><Wallet :size="24" aria-hidden="true" /></template>
    </EmptyState>
    <div v-else :class="['table-wrap', { 'is-loading': loading }]">
      <table class="table sal-table">
        <thead>
          <tr>
            <th scope="col" class="num">Montant</th>
            <th scope="col">Nature</th>
            <th scope="col">Date de début</th>
            <th scope="col">Date de fin</th>
            <th scope="col">Progression</th>
            <th scope="col">Situation</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in desc" :key="r.s.id" :class="{ 'ct-current': r.state === 'actuel', 'is-archived': !r.s.active }">
            <td class="num">
              <strong class="sal-cell-amount">{{ money(r.s.amount) }}</strong>
              <span v-if="r.s.devise && devise && r.s.devise.id !== devise.id" class="block small text-muted" :title="`Enregistré en ${r.s.devise.code}`">Saisi en {{ r.s.devise.code }}</span>
            </td>
            <td><span v-if="r.s.active" :class="['ct-kind', r.kindClass]">{{ r.nature }}</span><span v-else class="text-muted">—</span></td>
            <td class="nowrap">{{ formatDate(r.s.start) }}</td>
            <td class="nowrap"><template v-if="r.s.end">{{ formatDate(r.s.end) }}</template><span v-else class="text-muted">En cours</span></td>
            <td class="nowrap">
              <span v-if="!r.base" class="text-muted">Base</span>
              <span v-else :class="['sal-delta', { up: r.diff > 0, down: r.diff < 0 }]">
                <TrendingUp v-if="r.diff > 0" :size="12" aria-hidden="true" /><TrendingDown v-else-if="r.diff < 0" :size="12" aria-hidden="true" />
                {{ sign(r.diff) }}{{ money(r.diff) }} <small>{{ sign(r.diff) }}{{ pct(r.diff, r.base.amount) }} %</small>
              </span>
            </td>
            <td><Badge :tone="STATE[r.state].tone">{{ STATE[r.state].label }}</Badge></td>
            <td class="actions">
              <button v-if="store.can('salaires.modifier')" type="button" class="icon-btn icon-btn-sm" title="Modifier" :aria-label="`Modifier le salaire du ${formatDate(r.s.start)}`" :disabled="busyId === r.s.id" @click="editing = { title: 'Modifier le salaire', salary: r.s }"><Pencil :size="14" /></button>
              <button v-if="store.can('salaires.supprimer')" type="button" class="icon-btn icon-btn-sm" :title="r.s.active ? 'Archiver' : 'Restaurer'" :aria-label="`${r.s.active ? 'Archiver' : 'Restaurer'} le salaire du ${formatDate(r.s.start)}`" :disabled="busyId === r.s.id" @click="toggleArchived(r.s)">
                <Archive v-if="r.s.active" :size="14" /><ArchiveRestore v-else :size="14" />
              </button>
              <button v-if="store.can('salaires.supprimer') && (r.s !== initial)" type="button" class="icon-btn icon-btn-sm icon-btn-danger" title="Supprimer" :aria-label="`Supprimer le salaire du ${formatDate(r.s.start)}`" :disabled="busyId === r.s.id" @click="removing = r.s"><Trash2 :size="14" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </FormCard>

  <SalaryForm :open="!!editing" :salary="editing?.salary" :employee-id="employee.id" :title="editing?.title" @close="editing = undefined" @saved="onSaved" />
  <Modal :open="!!removing" size="sm" title="Supprimer ce salaire ?" @close="busyId || (removing = undefined)">
    <p v-if="removing">Le salaire de <strong>{{ money(removing.amount) }}</strong> du {{ formatDate(removing.start) }} sera définitivement supprimé. Cette action est irréversible.</p>
    <template #footer>
      <button type="button" class="btn btn-ghost" :disabled="!!busyId" @click="removing = undefined">Annuler</button>
      <button type="button" class="btn btn-danger" :disabled="!!busyId" @click="confirmRemove"><Trash2 :size="15" aria-hidden="true" /> {{ busyId ? 'Suppression…' : 'Supprimer' }}</button>
    </template>
  </Modal>
</template>

<style scoped>
.table-wrap.is-loading { opacity: .6; transition: opacity .15s; }
.is-archived { opacity: .6; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
