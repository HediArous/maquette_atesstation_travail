<script setup>
import { RotateCcw, Save } from '@lucide/vue';

/** Barre d'enregistrement : « Annuler » rétablit la valeur enregistrée, « Enregistrer » valide. Inactive tant qu'il n'y a rien à enregistrer. */
defineProps({ dirty: Boolean });
const emit = defineEmits(['reset', 'save']);
</script>

<template>
  <div class="save-bar">
    <button type="button" class="btn btn-ghost" :disabled="!dirty" @click="emit('reset')"><RotateCcw :size="14" aria-hidden="true" /> Annuler</button>
    <button type="button" class="btn btn-primary" :disabled="!dirty" @click="emit('save')"><Save :size="14" aria-hidden="true" /> Enregistrer</button>
  </div>
</template>
