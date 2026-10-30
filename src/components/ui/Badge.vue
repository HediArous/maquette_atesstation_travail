<script setup>
defineProps({
  /** neutral | info | success | warning | danger | muted | primary */
  tone: { type: String, default: 'neutral' },
});
</script>

<template>
  <span :class="`badge badge-${tone}`"><slot name="icon" /><slot /></span>
</template>
