<script setup>
import { computed, ref, useId, watch } from 'vue';
import { Check, CirclePause, LoaderCircle } from '@lucide/vue';
import { useStore } from '../../store';
import { contractsApi } from '../../api/contracts';
import { statusesApi } from '../../api/employees';
import { statusColor } from '../../components/ui/statusColors';
import Alert from '../../components/ui/Alert.vue';
import Modal from '../../components/ui/Modal.vue';

/**
 * Motif de suspension d'un contrat (PATCH /api/contracts/{id}/suspend) : le contrat passe à « suspendu » et l'employé au
 * statut choisi. Seuls les statuts système autorisés et actifs (Paramètres › Statuts) sont proposés ; couleurs reprises
 * des badges de statut d'employé, toujours accompagnées du libellé.
 */
const ALLOWED = [
  ['SUSPENDU', 'Interruption temporaire du contrat'],
  ['DEMISSIONNAIRE', 'Départ à l’initiative de l’employé'],
  ['LICENCIE', 'Rupture à l’initiative de l’employeur'],
  ['RETRAITE', 'Départ en retraite'],
  ['DECEDE', 'Décès de l’employé'],
];

const props = defineProps({ contract: { type: Object, default: undefined } });
const emit = defineEmits(['close', 'suspended']);

const store = useStore();
const groupId = useId();
const statuses = ref([]);
const loading = ref(false);
const loadError = ref('');
const submitError = ref('');
const statusType = ref('');
const busy = ref(false);

const options = computed(() => ALLOWED.flatMap(([type, hint]) => {
  const s = statuses.value.find((x) => x.type === type && x.isActive !== false);
  return s ? [{ type, label: s.value, hint, color: statusColor(s.value) }] : [];
}));
const valid = computed(() => options.value.some((o) => o.type === statusType.value));

async function loadStatuses() {
  loadError.value = '';
  loading.value = true;
  try {
    statuses.value = await statusesApi.list(true);
  } catch (e) {
    statuses.value = [];
    loadError.value = e.message;
  } finally {
    loading.value = false;
  }
}

watch(() => props.contract, (c) => {
  if (!c) return;
  statusType.value = '';
  submitError.value = '';
  loadStatuses();
}, { immediate: true });

function close() {
  if (!busy.value) emit('close');
}

async function confirm() {
  if (busy.value || !valid.value) return;
  busy.value = true;
  submitError.value = '';
  try {
    await contractsApi.suspend(props.contract.id, statusType.value);
    store.toast(`Contrat de ${props.contract.employeeName} suspendu`);
    emit('suspended');
  } catch (e) {
    submitError.value = e.message;
    store.toast(`Suspension impossible : ${e.message}`, 'danger');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal :open="!!contract" size="sm" title="Motif de suspension" @close="close">
    <template v-if="contract">
      <p class="intro">
        Choisissez le motif de suspension du contrat de <strong>{{ contract.employeeName }}</strong>
        (<span class="mono">{{ contract.typeCode }}</span>). Le statut de l’employé sera mis à jour en conséquence.
      </p>

      <div v-if="loading" class="state" role="status"><LoaderCircle :size="16" class="spin" aria-hidden="true" /> Chargement des motifs…</div>
      <Alert v-else-if="loadError" tone="danger" title="Motifs indisponibles">
        {{ loadError }}
        <button type="button" class="btn btn-sm btn-ghost" @click="loadStatuses">Réessayer</button>
      </Alert>
      <Alert v-else-if="!options.length" tone="warning" title="Aucun motif disponible">
        Activez au moins un statut de sortie dans Paramètres › Statuts.
      </Alert>
      <fieldset v-else class="reasons" :disabled="busy" :aria-describedby="`${groupId}-req`">
        <legend class="sr-only">Motif de suspension</legend>
        <label v-for="o in options" :key="o.type" :class="['reason', { selected: statusType === o.type }]"
          :style="{ '--fg': o.color.fg, '--bg': o.color.bg, '--bd': o.color.border }">
          <input v-model="statusType" class="sr-only" type="radio" :name="groupId" :value="o.type" />
          <span class="reason-dot" aria-hidden="true" />
          <span class="reason-text">
            <span class="reason-label">{{ o.label }}</span>
            <span class="reason-hint">{{ o.hint }}</span>
          </span>
          <Check v-if="statusType === o.type" :size="16" class="reason-check" aria-hidden="true" />
        </label>
      </fieldset>
      <p :id="`${groupId}-req`" class="field-hint" :class="{ 'is-ok': valid }">
        {{ valid ? 'Motif sélectionné.' : 'Sélectionnez un motif pour continuer.' }}
      </p>
      <Alert v-if="submitError" tone="danger" title="La suspension a échoué">{{ submitError }}</Alert>
    </template>
    <template #footer>
      <button type="button" class="btn btn-ghost" :disabled="busy" @click="close">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="busy || !valid" :aria-busy="busy" @click="confirm">
        <LoaderCircle v-if="busy" :size="15" class="spin" aria-hidden="true" /><CirclePause v-else :size="15" aria-hidden="true" />
        {{ busy ? 'Suspension…' : 'Confirmer' }}
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.intro { margin: 0 0 14px; color: var(--muted); line-height: 1.5; }
.state { display: flex; align-items: center; gap: 8px; padding: 12px 0; color: var(--muted); }
.reasons { display: grid; gap: 8px; margin: 0; padding: 0; border: 0; min-width: 0; }
.reason {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer;
  border: 1px solid var(--border, #dbe2ea); border-radius: 10px; transition: border-color .15s, background .15s, box-shadow .15s;
}
.reason:hover { border-color: var(--bd); }
.reason.selected { border-color: var(--fg); background: var(--bg); box-shadow: 0 0 0 1px var(--fg); }
.reason:focus-within { outline: 2px solid var(--fg); outline-offset: 2px; }
fieldset:disabled .reason { cursor: not-allowed; opacity: .7; }
.reason-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; background: var(--fg); }
.reason-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.reason-label { font-weight: 600; color: var(--fg); }
.reason-hint { font-size: 12px; color: var(--muted); }
.reason-check { color: var(--fg); flex: none; }
.field-hint { margin: 10px 0 0; }
.field-hint.is-ok { color: #15803d; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
