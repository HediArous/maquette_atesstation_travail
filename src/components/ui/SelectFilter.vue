<script setup>
import { useId } from 'vue';

defineProps({
  label: { type: String, required: true },
  /** [{ value, label }] */
  options: { type: Array, required: true },
  allLabel: { type: String, default: 'Tous' },
});
const model = defineModel({ type: String, default: '' });

const id = useId();
</script>

<template>
  <div class="filter">
    <label :for="id">{{ label }}</label>
    <select :id="id" v-model="model">
      <option value="">{{ allLabel }}</option>
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
  </div>
</template>
