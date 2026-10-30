<script setup>
import Badge from './Badge.vue';
import { STEP_STATUS } from './labels';

defineProps({ status: { type: String, required: true } });
</script>

<template>
  <Badge :tone="STEP_STATUS[status][1]">{{ STEP_STATUS[status][0] }}</Badge>
</template>
