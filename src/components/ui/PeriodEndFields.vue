<script setup>
import { ref, watch } from 'vue';
import { PERIOD_MAX, formatDate, periodEnd, periodMonths } from '../../utils/dates';
import Field from './Field.vue';

/**
 * Périodicité (en mois) et date de fin calculée, non modifiable : fin = periodEnd(début, périodicité), recalculée quand
 * le début ou la périodicité change. Une date de fin reçue qui ne correspond à aucun nombre de mois entier (donnée
 * existante, fin du contrat proposée) est conservée et affichée telle quelle tant qu'aucune périodicité n'est choisie.
 * <PeriodEndFields v-model="f.end" :start="f.start" :required="fixedTerm" :error="err('end')" />
 */
const props = defineProps({
  /** Date de fin ISO ('' = aucune). */
  modelValue: { type: String, default: '' },
  start: { type: String, default: '' },
  required: Boolean,
  disabled: Boolean,
  endLabel: { type: String, default: 'Date de fin' },
  /** Erreur sur la période (date de fin calculée comprise), affichée sous la périodicité. */
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
  endHint: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

const months = ref(periodMonths(props.start, props.modelValue));

// Fin modifiée par le parent (ouverture, type indéterminé…) : périodicité déduite ; début modifié : fin recalculée.
// La fin émise ici n'est pas reprise comme une fin imposée par le parent (début modifié dans le même cycle).
let emitted;
watch(() => [props.start, props.modelValue], ([start, end], [prevStart, prevEnd]) => {
  const ours = end === emitted;
  emitted = undefined;
  if (end !== prevEnd && !ours) {
    if (end !== periodEnd(start, months.value)) months.value = periodMonths(start, end);
  } else if (start !== prevStart && months.value != null) {
    update(periodEnd(start, months.value));
  }
});

function update(end) {
  emitted = end;
  if (end !== props.modelValue) emit('update:modelValue', end);
}

function blockNonDigit(event) {
  if (['-', '+', 'e', 'E', '.', ','].includes(event.key)) event.preventDefault();
}

// Vide = aucune périodicité (fin vidée) ; sinon entier ramené entre 1 et PERIOD_MAX.
function choose(value) {
  months.value = value === '' ? null : Math.min(PERIOD_MAX, Math.max(1, Math.trunc(Number(value))));
  update(periodEnd(props.start, months.value));
}
</script>

<template>
  <Field v-slot="{ id }" label="Périodicité" :required="required" :error="error"
    :hint="hint || (disabled ? '' : !start ? 'Choisissez d’abord la date de début.' : `Durée en mois (1 à ${PERIOD_MAX}) ; la date de fin est calculée.`)">
    <span class="input-suffix">
      <input :id="id" type="number" min="1" :max="PERIOD_MAX" step="1" inputmode="numeric" :value="months ?? ''" :disabled="disabled" placeholder="Ex. 12"
        @keydown="blockNonDigit" @input="choose($event.target.value)" @blur="$event.target.value = months ?? ''" />
      <span aria-hidden="true">mois</span>
    </span>
  </Field>
  <Field v-slot="{ id }" :label="endLabel"
    :hint="endHint || (!disabled && modelValue && months == null ? `Fin conservée (${formatDate(modelValue)}), hors mois entiers ; choisir une périodicité la recalcule.` : disabled ? '' : 'Calculée : début + périodicité, veille du même jour.')">
    <input :id="id" type="date" :value="modelValue" disabled readonly />
  </Field>
</template>
