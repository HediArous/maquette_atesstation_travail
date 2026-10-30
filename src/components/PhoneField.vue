<script setup>
import { computed } from 'vue';
import { onlyDigits } from '../utils/phone';

/** Champ téléphone : indicatif choisi parmi les pays paramétrés + numéro national limité au nombre de chiffres attendu. */
const props = defineProps({
  id: { type: String, required: true },
  countries: { type: Array, required: true },
  countryId: { type: String, default: undefined },
  value: { type: String, default: '' },
  invalid: Boolean,
});
const emit = defineEmits(['change']);

const country = computed(() => props.countries.find((c) => c.id === props.countryId));
const dial = computed({
  get: () => props.countryId ?? '',
  set: (v) => emit('change', v || undefined, props.value),
});
</script>

<template>
  <div :class="['phone-field', { invalid }]">
    <label :for="`${id}-dial`" class="sr-only">Indicatif</label>
    <select :id="`${id}-dial`" v-model="dial">
      <option v-if="!country" value="">Indicatif</option>
      <option v-for="c in countries" :key="c.id" :value="c.id" :title="c.name">+{{ c.dialCode }}</option>
    </select>
    <input
      :id="id" type="tel" inputmode="numeric" autocomplete="tel-national"
      :value="value" :maxlength="country?.digits ?? 15"
      :placeholder="country ? '•'.repeat(country.digits) : 'Numéro'"
      @input="emit('change', countryId, onlyDigits($event.target.value))"
    />
  </div>
</template>
