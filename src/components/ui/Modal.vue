<script setup>
import Dialog from './Dialog.vue';

defineProps({
  open: Boolean,
  title: { type: String, required: true },
  /** sm | md | lg */
  size: { type: String, default: 'md' },
});
defineEmits(['close']);
</script>

<template>
  <Dialog :open="open" :title="title" :width="size" @close="$emit('close')">
    <slot />
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </Dialog>
</template>
