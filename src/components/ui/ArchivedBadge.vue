<script setup>
import { Archive } from '@lucide/vue';
import Badge from './Badge.vue';
</script>

<template>
  <Badge tone="muted">
    <template #icon><Archive :size="12" aria-hidden="true" /></template>
    Archivé
  </Badge>
</template>
