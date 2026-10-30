<script setup>
defineProps({
  title: { type: String, default: '' },
  flush: Boolean,
});
</script>

<template>
  <section class="card">
    <div v-if="title || $slots.title || $slots.actions" class="card-header">
      <h2 v-if="title || $slots.title" class="card-title"><slot name="title">{{ title }}</slot></h2>
      <div v-if="$slots.actions" class="card-actions"><slot name="actions" /></div>
    </div>
    <div :class="flush ? 'card-body-flush' : 'card-body'"><slot /></div>
  </section>
</template>
