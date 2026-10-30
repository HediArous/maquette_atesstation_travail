<script setup>
import { computed, ref, watch } from 'vue';
import { Archive, ArchiveRestore, CirclePause, CloudOff, FilePlus2, FileSignature, GitCommitHorizontal, LoaderCircle, Pencil, RefreshCw, Trash2 } from '@lucide/vue';
import { useStore } from '../../store';
import { contractsApi, fromContractDto } from '../../api/contracts';
import { fromTypeContractDto, typeContractsApi } from '../../api/typeContracts';
import { addDays, diffDays, formatDate, TODAY } from '../../utils/dates';
import Alert from '../../components/ui/Alert.vue';
import Badge from '../../components/ui/Badge.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import Modal from '../../components/ui/Modal.vue';
import FormCard from '../../components/FormCard.vue';
import ContractForm from '../contracts/ContractForm.vue';
import SuspendContractDialog from '../contracts/SuspendContractDialog.vue';
import EmployeeStatusCard from './EmployeeStatusCard.vue';

/**
 * Onglet « Contrats » de la fiche employé : parcours chronologique et liste des contrats de l'employé (backend
 * /api/contracts, filtre employeeId). Ajout, renouvellement (nouveau contrat pré-rempli), modification, suspension,
 * archivage et suppression passent par les endpoints existants ; le backend reste seul juge des règles métier
 * (chevauchement, statut temporel, statut de l'employé).
 */
const props = defineProps({ employee: { type: Object, required: true } });
const emit = defineEmits(['count']);

const store = useStore();
const list = ref([]);
const types = ref([]);
const loading = ref(true);
const error = ref('');

// La dernière requête lancée l'emporte (changement d'employé pendant un chargement).
let requestId = 0;
async function load() {
  const id = ++requestId;
  loading.value = true;
  try {
    const res = await contractsApi.search({ employeeId: props.employee.id, size: 100, sort: 'contractStart', direction: 'desc' });
    if (id !== requestId) return;
    list.value = res.content.map(fromContractDto);
    error.value = '';
    emit('count', res.totalElements);
  } catch (e) {
    if (id === requestId) error.value = e.message;
  } finally {
    if (id === requestId) loading.value = false;
  }
}
watch(() => props.employee.id, () => { list.value = []; load(); }, { immediate: true });

// Types (actifs et archivés) : nécessaires pour savoir si le dernier contrat est renouvelable.
watch(() => props.employee.id, async () => {
  try {
    types.value = (await typeContractsApi.list()).map((dto) => fromTypeContractDto(dto));
  } catch {
    types.value = [];
  }
}, { immediate: true });

/** Statut temporel calculé par le backend → libellé, ton du badge, état de l'étape du parcours. */
const STATUS = {
  PAS_ENCORE: { label: 'À venir', tone: 'info', step: 'next' },
  EN_COURS: { label: 'En cours', tone: 'success', step: 'current' },
  SUSPENDU: { label: 'Suspendu', tone: 'warning', step: 'stopped' },
  TERMINE: { label: 'Terminé', tone: 'muted', step: 'past' },
};
const statusOf = (c) => STATUS[c.status] ?? { label: '—', tone: 'neutral', step: 'past' };

const chronological = computed(() => [...list.value].sort((a, b) => a.start.localeCompare(b.start)));
const current = computed(() => list.value.find((c) => c.status === 'EN_COURS' && c.active));
const latest = computed(() => list.value[0]);
const daysLeft = (c) => (c.status === 'EN_COURS' && c.end ? diffDays(TODAY, c.end) : undefined);
const describe = (c) => `${c.typeCode} du ${formatDate(c.start)}${c.end ? ` au ${formatDate(c.end)}` : ' (durée indéterminée)'}`;
const subtitle = computed(() => {
  const n = list.value.length;
  const archived = list.value.filter((c) => !c.active).length;
  return `${n} contrat${n > 1 ? 's' : ''}${archived ? ` · ${archived} archivé${archived > 1 ? 's' : ''}` : ''}`;
});

// Renouvellement : dernier contrat à durée déterminée, actif, non suspendu, dont le type est renouvelable.
const renewable = computed(() => {
  const c = latest.value;
  if (!c || !c.end || !c.active || c.suspended) return false;
  return types.value.find((t) => t.id === c.typeContractId)?.renewable === true;
});
const renewTitle = computed(() => {
  const c = latest.value;
  if (!c) return 'Aucun contrat à renouveler.';
  if (!renewable.value) return 'Le dernier contrat n’est pas renouvelable (type non renouvelable, durée indéterminée, archivé ou suspendu).';
  return `Renouveler le contrat ${describe(c)} à partir du ${formatDate(addDays(c.end, 1))}`;
});

// ---------- Ajout / renouvellement / modification (ContractForm, employé verrouillé) ----------
const editing = ref();
const openNew = () => { editing.value = { title: 'Nouveau contrat' }; };
const openRenew = () => {
  if (!renewable.value) return;
  const c = latest.value;
  editing.value = { title: 'Renouveler le contrat', preset: { typeContractId: c.typeContractId, start: addDays(c.end, 1) }, renew: true };
};
const openEdit = (c) => { editing.value = { title: 'Modifier le contrat', contract: c }; };
function onSaved(saved, isNew) {
  store.toast(editing.value?.renew ? 'Contrat renouvelé' : isNew ? 'Contrat ajouté' : 'Contrat mis à jour');
  editing.value = undefined;
  load();
}

// ---------- Suspension (contrat suspendu + statut de sortie de l'employé) ----------
const suspending = ref();
function onSuspended() {
  suspending.value = undefined;
  load();
  store.loadEmployees?.();
}

// ---------- Archivage / restauration : PATCH /api/contracts/{id}/status ----------
const busyId = ref('');
async function toggleArchived(c) {
  if (busyId.value) return;
  busyId.value = c.id;
  try {
    await contractsApi.setActive(c.id, !c.active);
    store.toast(c.active ? 'Contrat archivé' : 'Contrat restauré', 'info');
    await load();
  } catch (e) {
    store.toast(`Opération impossible : ${e.message}`, 'danger');
  } finally {
    busyId.value = '';
  }
}

// ---------- Suppression (contrats à venir uniquement, comme la page Contrats) ----------
const removing = ref();
async function confirmRemove() {
  const c = removing.value;
  if (!c || busyId.value) return;
  busyId.value = c.id;
  try {
    await contractsApi.remove(c.id);
    store.toast('Contrat supprimé', 'info');
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
  <div class="fstack">
    <Alert v-if="error && list.length" tone="danger" title="Actualisation impossible">
      {{ error }} <button type="button" class="btn btn-sm btn-ghost" @click="load">Réessayer</button>
    </Alert>

    <FormCard v-if="list.length" title="Parcours des contrats" :subtitle="subtitle">
      <template #icon><GitCommitHorizontal :size="16" /></template>
      <ol class="wf" aria-label="Parcours des contrats">
        <li v-for="(c, i) in chronological" :key="c.id" :class="['wf-step', statusOf(c).step, { 'is-archived': !c.active }]" :aria-current="statusOf(c).step === 'current' ? 'step' : undefined">
          <span class="wf-rail" aria-hidden="true"><span class="wf-node">{{ i + 1 }}</span></span>
          <div class="wf-card">
            <div class="wf-card-top">
              <Badge :tone="c.fixedTerm ? 'info' : 'success'">{{ c.fixedTerm ? 'Déterminée' : 'Indéterminée' }}</Badge>
              <Badge :tone="statusOf(c).tone">{{ statusOf(c).label }}</Badge>
            </div>
            <p class="wf-title">{{ c.typeCode }} <span>{{ c.typeName }}</span></p>
            <p class="wf-dates">{{ formatDate(c.start) }} <span aria-hidden="true">→</span> {{ c.end ? formatDate(c.end) : 'Indéterminée' }}</p>
            <p v-if="daysLeft(c) !== undefined && daysLeft(c) >= 0" :class="['wf-meta', { warn: daysLeft(c) <= 30 }]">Échéance dans {{ daysLeft(c) }} jour{{ daysLeft(c) > 1 ? 's' : '' }}</p>
            <p v-if="c.trialEnd" class="wf-meta">Essai jusqu’au {{ formatDate(c.trialEnd) }}</p>
            <p v-if="!c.active" class="wf-meta">Archivé</p>
          </div>
        </li>
      </ol>
    </FormCard>

    <FormCard title="Parcours contractuel" subtitle="Tous les contrats de l’employé, du plus récent au plus ancien.">
      <template #icon><FileSignature :size="16" /></template>
      <template #actions>
        <button v-if="store.can('contrats.creer')" type="button" class="btn btn-sm btn-ghost" :disabled="!renewable || loading" :title="renewTitle" @click="openRenew"><RefreshCw :size="13" aria-hidden="true" /> Renouveler</button>
        <button v-if="store.can('contrats.suspendre')" type="button" class="btn btn-sm btn-ghost ct-danger" :disabled="!current || current.suspended" :title="current ? undefined : 'Aucun contrat en cours'" @click="suspending = current">
          <CirclePause :size="13" aria-hidden="true" /> Suspendre
        </button>
        <button v-if="store.can('contrats.creer')" type="button" class="btn btn-sm btn-primary" :disabled="loading && !list.length" @click="openNew"><FilePlus2 :size="13" aria-hidden="true" /> Nouveau contrat</button>
      </template>

      <EmptyState v-if="loading && !list.length" title="Chargement des contrats…">
        <template #icon><LoaderCircle :size="24" class="spin" aria-hidden="true" /></template>
      </EmptyState>
      <EmptyState v-else-if="error && !list.length" title="Contrats indisponibles" :text="error">
        <template #icon><CloudOff :size="24" aria-hidden="true" /></template>
        <template #action><button type="button" class="btn btn-primary" @click="load">Réessayer</button></template>
      </EmptyState>
      <EmptyState v-else-if="!list.length" title="Aucun contrat" text="Cet employé n’a encore aucun contrat enregistré.">
        <template #icon><FileSignature :size="24" aria-hidden="true" /></template>
        <template #action><button v-if="store.can('contrats.creer')" type="button" class="btn btn-primary" @click="openNew"><FilePlus2 :size="14" aria-hidden="true" /> Nouveau contrat</button></template>
      </EmptyState>
      <div v-else :class="['table-wrap', { 'is-loading': loading }]">
        <table class="table ct-table">
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col">Durée</th>
              <th scope="col">Début</th>
              <th scope="col">Fin</th>
              <th scope="col">Période d’essai</th>
              <th scope="col">Statut</th>
              <th scope="col"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in list" :key="c.id" :class="{ 'ct-current': c.id === current?.id, 'is-archived': !c.active }">
              <td><strong>{{ c.typeCode }}</strong><span class="block small text-muted">{{ c.typeName }}</span></td>
              <td><Badge :tone="c.fixedTerm ? 'info' : 'success'">{{ c.fixedTerm ? 'Déterminée' : 'Indéterminée' }}</Badge></td>
              <td class="nowrap">{{ formatDate(c.start) }}</td>
              <td class="nowrap"><template v-if="c.end">{{ formatDate(c.end) }}</template><span v-else class="text-muted">Indéterminée</span></td>
              <td class="nowrap">
                <template v-if="c.trialEnd">{{ formatDate(c.trialEnd) }}<span class="block small text-muted">{{ c.trialMonths }} mois</span></template>
                <span v-else class="text-muted">—</span>
              </td>
              <td>
                <Badge :tone="statusOf(c).tone">{{ statusOf(c).label }}</Badge>
                <span v-if="!c.active" class="block small text-muted">Archivé</span>
              </td>
              <td class="actions">
                <button v-if="store.can('contrats.creer') && (renewable && c.id === latest.id)" type="button" class="btn btn-sm btn-ghost ct-renew" :title="renewTitle" :aria-label="`Renouveler le contrat ${describe(c)}`" @click="openRenew">
                  <RefreshCw :size="13" aria-hidden="true" /> Renouveler
                </button>
                <button v-if="store.can('contrats.modifier')" type="button" class="icon-btn icon-btn-sm" title="Modifier" :aria-label="`Modifier le contrat ${describe(c)}`" :disabled="busyId === c.id" @click="openEdit(c)"><Pencil :size="14" /></button>
                <button v-if="store.can('contrats.suspendre') && (c.status === 'EN_COURS' && c.active)" type="button" class="icon-btn icon-btn-sm icon-btn-danger" title="Suspendre" :aria-label="`Suspendre le contrat ${describe(c)}`" :disabled="busyId === c.id" @click="suspending = c"><CirclePause :size="14" /></button>
                <button v-if="store.can('contrats.supprimer')" type="button" class="icon-btn icon-btn-sm" :title="c.active ? 'Archiver' : 'Restaurer'" :aria-label="`${c.active ? 'Archiver' : 'Restaurer'} le contrat ${describe(c)}`" :disabled="busyId === c.id" @click="toggleArchived(c)">
                  <Archive v-if="c.active" :size="14" /><ArchiveRestore v-else :size="14" />
                </button>
                <button v-if="store.can('contrats.supprimer') && (c.status === 'PAS_ENCORE')" type="button" class="icon-btn icon-btn-sm icon-btn-danger" title="Supprimer" :aria-label="`Supprimer le contrat ${describe(c)}`" :disabled="busyId === c.id" @click="removing = c"><Trash2 :size="14" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </FormCard>

    <ContractForm :open="!!editing" :contract="editing?.contract" :employee-id="employee.id" :preset="editing?.preset" :title="editing?.title"
      @close="editing = undefined" @saved="onSaved" />
    <EmployeeStatusCard :employee="employee" :current="current" />
    <SuspendContractDialog :contract="suspending" @close="suspending = undefined" @suspended="onSuspended" />
    <Modal :open="!!removing" size="sm" title="Supprimer ce contrat ?" @close="busyId || (removing = undefined)">
      <p v-if="removing">Le contrat <strong>{{ describe(removing) }}</strong> sera définitivement supprimé. Cette action est irréversible.</p>
      <template #footer>
        <button type="button" class="btn btn-ghost" :disabled="!!busyId" @click="removing = undefined">Annuler</button>
        <button type="button" class="btn btn-danger" :disabled="!!busyId" @click="confirmRemove"><Trash2 :size="15" aria-hidden="true" /> {{ busyId ? 'Suppression…' : 'Supprimer' }}</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.table-wrap.is-loading { opacity: .6; transition: opacity .15s; }
.is-archived { opacity: .6; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
