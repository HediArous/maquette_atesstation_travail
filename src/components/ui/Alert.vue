<script setup>
import { computed } from 'vue';
import { AlertTriangle, CheckCircle2, Info, XCircle } from '@lucide/vue';

const props = defineProps({
  /** info | warning | danger | success */
  tone: { type: String, required: true },
  title: { type: String, default: '' },
});

const icon = computed(() => ({ info: Info, warning: AlertTriangle, danger: XCircle, success: CheckCircle2 })[props.tone]);
</script>

<template>
  <div :class="`alert alert-${tone}`" :role="tone === 'danger' ? 'alert' : 'status'">
    <span class="alert-icon" aria-hidden="true"><component :is="icon" :size="14" :stroke-width="2.2" /></span>
    <!-- Titre et texte à la suite, sur une ligne quand ils tiennent ; un contenu en bloc (liste, paragraphes) passe dessous. -->
    <div class="alert-content">
      <strong v-if="title" class="alert-title">{{ title }}</strong>
      <div v-if="$slots.default" class="alert-body"><slot /></div>
    </div>
  </div>
</template>
