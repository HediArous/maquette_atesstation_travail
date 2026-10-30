<script setup>
defineProps({ value: Boolean });
</script>

<template>
  <span v-if="value" class="badge badge-success">Oui</span>
  <span v-else class="badge badge-neutral">Non</span>
</template>
