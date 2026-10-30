<script setup>
import { computed } from 'vue';
import { AVATAR_COLORS } from './labels';

const props = defineProps({
  /** Toute personne : { id, firstName, lastName, gender? } — bleu (HOMME) / rose (FEMME). */
  employee: { type: Object, default: undefined },
  size: { type: Number, default: 28 },
});

const initials = computed(() => {
  const p = props.employee;
  return p ? `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase() || '?' : '?';
});
const GENDER_COLORS = { HOMME: '#2f5bd3', FEMME: '#db2777' };
const color = computed(() => GENDER_COLORS[props.employee?.gender] ?? AVATAR_COLORS[[...(props.employee?.id ?? '')].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length]);
</script>

<template>
  <span v-if="!employee" class="avatar" :style="{ width: `${size}px`, height: `${size}px` }" aria-hidden="true">?</span>
  <span v-else class="avatar" :style="{ width: `${size}px`, height: `${size}px`, background: color, fontSize: `${size * 0.38}px` }" aria-hidden="true">{{ initials }}</span>
</template>
