<script setup>
import ArchivedBadge from './ArchivedBadge.vue';

defineProps({ type: { type: Object, default: undefined } });
</script>

<template>
  <span v-if="!type" class="text-muted">—</span>
  <span v-else class="type-tag">
    <span class="type-dot" :style="{ background: type.color }" aria-hidden="true" />
    {{ type.name }}
    <ArchivedBadge v-if="type.archived" />
  </span>
</template>
