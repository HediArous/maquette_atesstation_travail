<script setup>
/** Onglets : `tabs` = [{ id, label, count? }], valeur courante en v-model. */
defineProps({
  tabs: { type: Array, required: true },
  modelValue: { type: String, required: true },
  label: { type: String, required: true },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <div class="tabs" role="tablist" :aria-label="label">
    <button
      v-for="t in tabs"
      :key="t.id"
      role="tab"
      type="button"
      :aria-selected="modelValue === t.id"
      :class="['tab', { active: modelValue === t.id }]"
      @click="$emit('update:modelValue', t.id)"
    >
      {{ t.label }}
      <span v-if="t.count != null" class="tab-count">{{ t.count }}</span>
    </button>
  </div>
</template>
