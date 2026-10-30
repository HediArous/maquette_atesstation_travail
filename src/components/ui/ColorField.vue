<script setup>
import { COLOR_PRESETS } from './labels';

/** Petite pastille de couleur + code hexadécimal + couleurs prédéfinies (remplace le grand champ natif). */
defineProps({
  id: { type: String, required: true },
  modelValue: { type: String, required: true },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <div class="color-field">
    <span class="color-swatch" :style="{ background: modelValue }" title="Choisir une couleur personnalisée">
      <input :id="id" type="color" class="color-native" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />
    </span>
    <span class="color-hex">{{ modelValue.toUpperCase() }}</span>
    <span class="color-presets" role="group" aria-label="Couleurs prédéfinies">
      <button
        v-for="c in COLOR_PRESETS"
        :key="c"
        type="button"
        :class="['color-preset', { active: c.toLowerCase() === modelValue.toLowerCase() }]"
        :style="{ background: c }"
        :aria-label="`Couleur ${c}`"
        :aria-pressed="c.toLowerCase() === modelValue.toLowerCase()"
        @click="$emit('update:modelValue', c)"
      />
    </span>
  </div>
</template>
