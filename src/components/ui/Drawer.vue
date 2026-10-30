<script setup>
import Dialog from './Dialog.vue';

/** Formulaires de création / détail : affichés en fenêtre centrée (plus large si « wide »). */
defineProps({
  open: Boolean,
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  wide: Boolean,
});
defineEmits(['close']);
</script>

<template>
  <Dialog :open="open" :title="title" :subtitle="subtitle" :width="wide ? 'xl' : 'lg'" @close="$emit('close')">
    <template v-if="$slots.subtitle" #subtitle><slot name="subtitle" /></template>
    <slot />
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </Dialog>
</template>
