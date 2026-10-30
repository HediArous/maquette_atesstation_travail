<script setup>
import { computed } from 'vue';

/** Logo de société : monogramme sur la couleur de la société, avec reflet et liseré discrets. */
const props = defineProps({
  /** { name, color } */
  company: { type: Object, required: true },
  size: { type: Number, default: 30 },
});

const initials = computed(() => {
  const words = props.company.name.split(/[\s-]+/).filter((w) => w && w[0] === w[0].toUpperCase());
  return (words.length ? words.slice(0, 2).map((w) => w[0]).join('') : props.company.name.slice(0, 2)).toUpperCase();
});
</script>

<template>
  <span class="company-logo" aria-hidden="true"
    :style="{ '--co': company.color, width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.36)}px`, borderRadius: `${Math.max(6, Math.round(size * 0.26))}px` }">
    {{ initials }}
  </span>
</template>
