<script setup>
import { computed, ref } from 'vue';
import { Pencil, Plus, Trash2 } from '@lucide/vue';
import { addDays, formatDate } from '../../utils/dates';
import { formatAmount } from '../../utils/org';
import Alert from '../../components/ui/Alert.vue';
import Badge from '../../components/ui/Badge.vue';
import Field from '../../components/ui/Field.vue';
import PeriodEndFields from '../../components/ui/PeriodEndFields.vue';
import Switch from '../../components/ui/Switch.vue';

/**
 * Périodes de salaire saisies à la création d'un employé : ajout, modification et suppression de lignes avant
 * l'enregistrement. Les erreurs (dates du contrat, chevauchements, salaire de début de contrat) viennent du formulaire.
 */
const props = defineProps({
  modelValue: { type: Array, required: true },
  /** { start, end, fixedTerm } du contrat saisi. */
  contract: { type: Object, required: true },
  /** Devise active { symbol, code, decimals } : affichage et saisie des montants. */
  devise: { type: Object, default: undefined },
  /** { [key]: message } */
  rowErrors: { type: Object, default: () => ({}) },
  general: { type: String, default: '' },
  showErrors: Boolean,
});
const emit = defineEmits(['update:modelValue']);

let seq = 0;
const draft = ref();
const draftError = ref('');

function startAdd() {
  const last = props.modelValue[props.modelValue.length - 1];
  // Proposé : lendemain de la dernière ligne, à défaut le début du contrat.
  const start = last ? (last.end ? addDays(last.end, 1) : '') : props.contract.start || '';
  draft.value = { key: '', start, end: props.contract.fixedTerm ? props.contract.end || '' : '', amount: null, active: true };
  draftError.value = '';
}
function startEdit(s) {
  draft.value = { ...s };
  draftError.value = '';
}
function commit() {
  const d = draft.value;
  if (!d.start || !(Number(d.amount) > 0)) { draftError.value = 'Renseignez au moins la date de début et un montant supérieur à 0.'; return; }
  const line = { ...d, amount: Number(d.amount), end: d.end || '' };
  const list = d.key
    ? props.modelValue.map((s) => (s.key === d.key ? line : s))
    : [...props.modelValue, { ...line, key: `l${Date.now()}-${++seq}` }];
  emit('update:modelValue', [...list].sort((a, b) => a.start.localeCompare(b.start)));
  draft.value = undefined;
}
function remove(s) {
  emit('update:modelValue', props.modelValue.filter((x) => x.key !== s.key));
  if (draft.value?.key === s.key) draft.value = undefined;
}
const editingKey = computed(() => draft.value?.key);
</script>

<template>
  <div class="isal">
    <div class="isal-head">
      <p class="finherit-title">Périodes de salaire</p>
      <button v-if="!draft" type="button" class="btn btn-sm btn-ghost" @click="startAdd"><Plus :size="14" aria-hidden="true" /> Ajouter un salaire</button>
    </div>
    <Alert v-if="showErrors && general" tone="danger" title="Salaire de début de contrat manquant" class="mb-12">{{ general }}</Alert>
    <p v-if="!modelValue.length && !draft" class="small text-muted">Aucun salaire saisi.</p>
    <div v-if="modelValue.length" class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">N°</th>
            <th scope="col">Date de début</th>
            <th scope="col">Date de fin</th>
            <th scope="col">Montant</th>
            <th scope="col">État</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(s, i) in modelValue" :key="s.key">
            <tr :class="{ 'row-archived': !s.active, 'isal-editing': editingKey === s.key }">
              <td>{{ i + 1 }}</td>
              <td>{{ formatDate(s.start) }}</td>
              <td><template v-if="s.end">{{ formatDate(s.end) }}</template><span v-else class="text-muted">En cours</span></td>
              <td class="mono">{{ formatAmount(s.amount, devise) }}</td>
              <td><Badge v-if="s.active" tone="success">Actif</Badge><Badge v-else tone="neutral">Désactivé</Badge></td>
              <td class="actions">
                <button type="button" class="btn btn-sm btn-ghost" :aria-label="`Modifier le salaire n°${i + 1}`" @click="startEdit(s)"><Pencil :size="13" aria-hidden="true" /> Modifier</button>
                <button type="button" class="btn btn-sm btn-ghost" :aria-label="`Supprimer le salaire n°${i + 1}`" @click="remove(s)"><Trash2 :size="13" aria-hidden="true" /> Supprimer</button>
              </td>
            </tr>
            <tr v-if="showErrors && rowErrors[s.key]" class="isal-error"><td colspan="6" class="small text-danger">{{ rowErrors[s.key] }}</td></tr>
          </template>
        </tbody>
      </table>
    </div>

    <div v-if="draft" class="isal-editor">
      <p class="small"><strong>{{ draft.key ? 'Modifier le salaire' : 'Nouveau salaire' }}</strong></p>
      <div class="form-grid">
        <Field v-slot="{ id }" label="Date de début" required :hint="contract.start ? `Au plus tôt le ${formatDate(contract.start)} (début du contrat).` : undefined">
          <input :id="id" v-model="draft.start" type="date" :min="contract.start || undefined" />
        </Field>
        <PeriodEndFields v-model="draft.end" :start="draft.start" :required="contract.fixedTerm"
          :hint="contract.fixedTerm ? (contract.end ? `Fin au plus tard le ${formatDate(contract.end)} (fin du contrat).` : 'Obligatoire : contrat à durée déterminée.') : 'Facultative : vide = salaire en cours.'" />
        <Field v-slot="{ id }" :label="`Montant${devise ? ` (${devise.symbol})` : ''}`" required>
          <span class="input-suffix"><input :id="id" v-model.number="draft.amount" type="number" min="0" step="0.01" /><span aria-hidden="true">{{ devise?.symbol }}</span></span>
        </Field>
        <Field label="État"><Switch v-model="draft.active" :label="draft.active ? 'Actif' : 'Désactivé'" /></Field>
      </div>
      <p v-if="draftError" class="small text-danger mt-8">{{ draftError }}</p>
      <div class="isal-editor-actions">
        <button type="button" class="btn btn-sm btn-ghost" @click="draft = undefined">Annuler</button>
        <button type="button" class="btn btn-sm btn-primary" @click="commit">{{ draft.key ? 'Mettre à jour la ligne' : 'Ajouter la ligne' }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.isal { margin-top: 14px; padding: 12px 14px; border-radius: 10px; background: #f6f8fb; border: 1px solid #e8ecf2; }
.isal-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.isal-head .finherit-title { margin: 0; }
.isal .table-wrap { background: #fff; }
.isal-error td { padding-top: 0; border-top: 0; }
.isal-editing { outline: 2px solid var(--primary, #2563eb); outline-offset: -2px; }
.isal-editor { margin-top: 12px; padding: 12px; border-radius: 9px; background: #fff; border: 1px dashed #cfd8e3; }
.isal-editor-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
.actions { white-space: nowrap; text-align: right; }
</style>
