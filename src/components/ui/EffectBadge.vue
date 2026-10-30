<script setup>
import Badge from './Badge.vue';
import { EFFECTS } from './labels';

defineProps({ effect: { type: String, required: true } });
</script>

<template>
  <Badge :tone="EFFECTS[effect].tone">
    <template #icon><component :is="EFFECTS[effect].icon" :size="13" aria-hidden="true" /></template>
    {{ EFFECTS[effect].label }}
  </Badge>
</template>
