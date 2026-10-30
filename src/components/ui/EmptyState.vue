<script setup>
import { Inbox } from '@lucide/vue';

defineProps({
  title: { type: String, required: true },
  text: { type: String, default: '' },
});
</script>

<template>
  <div class="empty">
    <div class="empty-icon"><slot name="icon"><Inbox :size="28" aria-hidden="true" /></slot></div>
    <p class="empty-title">{{ title }}</p>
    <p v-if="text" class="empty-text">{{ text }}</p>
    <slot name="action" />
  </div>
</template>
