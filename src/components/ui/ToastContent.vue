<script setup>
// Contenu d'une notification (repris du Core Tenant) : pastille d'icône teintée, titre et message (voir assets/toast.css).
import { computed } from 'vue';
import { AlertTriangle, CheckCircle2, Info, XCircle } from '@lucide/vue';

const props = defineProps({
  type: { type: String, default: 'info' },
  title: { type: String, required: true },
  message: { type: String, default: '' },
});

const icons = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };
const icon = computed(() => icons[props.type] ?? Info);
</script>

<template>
  <div class="ct-toast">
    <span class="ct-toast-icon" aria-hidden="true"><component :is="icon" :size="13" :stroke-width="2.2" /></span>
    <div class="ct-toast-text">
      <p class="ct-toast-title">{{ title }}</p>
      <p v-if="message" class="ct-toast-message">{{ message }}</p>
    </div>
  </div>
</template>
