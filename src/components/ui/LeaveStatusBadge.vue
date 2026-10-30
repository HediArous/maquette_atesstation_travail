<script setup>
import Badge from './Badge.vue';
import { LEAVE_STATUS } from './labels';

defineProps({ status: { type: String, required: true } });
</script>

<template>
  <Badge :tone="LEAVE_STATUS[status][1]">{{ LEAVE_STATUS[status][0] }}</Badge>
</template>
