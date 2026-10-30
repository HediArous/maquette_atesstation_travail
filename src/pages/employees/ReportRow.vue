<script setup>
/** Information du rapport : libellé au-dessus de la valeur ; une valeur vide est signalée explicitement. */
defineProps({
  label: { type: String, required: true },
  hint: { type: String, default: '' },
  wide: Boolean,
  /** Valeur absente : affiche « Non renseigné ». */
  empty: Boolean,
});
</script>

<template>
  <div :class="['rp-row', { wide }]">
    <dt>{{ label }}</dt>
    <dd v-if="empty" class="is-empty">Non renseigné</dd>
    <dd v-else><slot /><span v-if="hint" class="rp-hint">{{ hint }}</span></dd>
  </div>
</template>
