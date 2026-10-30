<script setup>
import { ChevronRight } from '@lucide/vue';

/** Section du rapport de la fiche : pictogramme, titre, lien vers l'onglet où l'on modifie, contenu. */
defineProps({
  title: { type: String, required: true },
  /** Libellé du lien d'ouverture ; sans libellé, pas de lien. */
  openLabel: { type: String, default: '' },
});
const emit = defineEmits(['open']);
</script>

<template>
  <section class="rp-sec">
    <header class="rp-sec-head">
      <span class="rp-sec-icon" aria-hidden="true"><slot name="icon" /></span>
      <h3>{{ title }}</h3>
      <button v-if="openLabel" type="button" class="rp-sec-link" @click="emit('open')">{{ openLabel }} <ChevronRight :size="12" aria-hidden="true" /></button>
    </header>
    <slot />
  </section>
</template>
