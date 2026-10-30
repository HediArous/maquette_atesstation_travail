<script setup>
/** Carte de section des formulaires longs : pictogramme, titre, sous-titre, actions à droite. */
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
});
</script>

<template>
  <section class="fcard">
    <header class="fcard-head">
      <span class="fcard-icon" aria-hidden="true"><slot name="icon" /></span>
      <div class="fcard-text">
        <h3 class="fcard-title"><slot name="title">{{ title }}</slot></h3>
        <p v-if="$slots.subtitle || subtitle" class="fcard-sub"><slot name="subtitle">{{ subtitle }}</slot></p>
      </div>
      <div v-if="$slots.actions" class="fcard-actions"><slot name="actions" /></div>
    </header>
    <div class="fcard-body"><slot /></div>
  </section>
</template>
