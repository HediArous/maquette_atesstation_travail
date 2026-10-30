<script setup>
import { computed } from 'vue';
import Badge from './Badge.vue';
import { EMP_STATUS } from './labels';
import { statusColor } from './statusColors';

/** Statut d'un employé : libellé paramétrable (value, backend) en couleur indicative, sinon statut historique (essai / actif / inactif). */
const props = defineProps({
  status: { type: String, default: undefined },
  value: { type: String, default: undefined },
});

const color = computed(() => (props.value ? statusColor(props.value) : undefined));
</script>

<template>
  <span v-if="color" class="badge status-badge" :style="{ color: color.fg, background: color.bg, borderColor: color.border }">
    <span class="status-dot" :style="{ background: color.fg }" aria-hidden="true" />{{ value }}
  </span>
  <Badge v-else-if="status && EMP_STATUS[status]" :tone="EMP_STATUS[status][1]">{{ EMP_STATUS[status][0] }}</Badge>
  <span v-else class="text-muted">—</span>
</template>

<style scoped>
.status-badge { border: 1px solid; gap: 5px; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; flex: none; }
</style>
