<script setup>
/** Choix exclusif en boutons : `options` = [{ value, label }], valeur courante en v-model. */
defineProps({
  options: { type: Array, required: true },
  modelValue: { type: String, required: true },
  label: { type: String, required: true },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <div class="segmented" role="group" :aria-label="label">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      :aria-pressed="modelValue === o.value"
      :class="{ active: modelValue === o.value }"
      @click="$emit('update:modelValue', o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>
