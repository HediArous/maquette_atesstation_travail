<script setup>
import { UserRound, Users } from '@lucide/vue';
import Badge from '../../components/ui/Badge.vue';

defineProps({
  /** solo | groupe */
  kind: { type: String, required: true },
});
</script>

<template>
  <Badge v-if="kind === 'solo'" tone="neutral"><template #icon><UserRound :size="11" aria-hidden="true" /></template>Solo</Badge>
  <Badge v-else tone="info"><template #icon><Users :size="11" aria-hidden="true" /></template>Groupe</Badge>
</template>
