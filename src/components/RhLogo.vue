<script setup>
import { useId } from 'vue';

/** Logo de l'Application RH : même tuile que le core tenant, monogramme « RH ». */
defineProps({ size: { type: Number, default: 32 } });

const g = useId();
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 32 32" aria-hidden="true" class="logo">
    <defs>
      <linearGradient :id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#3b82f6" />
        <stop offset="1" stop-color="#0b3a7e" />
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="9" style="fill: var(--logo-bg, #fff)" />
    <text x="16" y="21" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" font-weight="800" font-size="13" letter-spacing="-.3"
      :style="{ fill: `var(--logo-fg, url(#${g}))` }">RH</text>
  </svg>
</template>
