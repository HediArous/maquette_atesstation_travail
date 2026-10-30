<script setup>
import Avatar from './Avatar.vue';

defineProps({
  employee: { type: Object, default: undefined },
  sub: { type: String, default: '' },
  link: Boolean,
});
</script>

<template>
  <span v-if="!employee" class="text-muted">—</span>
  <span v-else class="person">
    <Avatar :employee="employee" />
    <span>
      <span :class="link ? 'person-name person-link' : 'person-name'">{{ employee.firstName }} {{ employee.lastName }}</span>
      <span v-if="$slots.sub || sub" class="person-sub"><slot name="sub">{{ sub }}</slot></span>
    </span>
  </span>
</template>
