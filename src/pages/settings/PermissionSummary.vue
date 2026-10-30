<script setup>
import { computed } from 'vue';
import { ALL_PERMISSIONS } from '../../config/permissions';
import PermissionSelectAll from './PermissionSelectAll.vue';

/** En-tête de la matrice : progression et « Tout cocher » (à placer dans les actions d'une carte). v-model : permissions cochées. */
defineProps({ disabled: Boolean });
const value = defineModel({ type: Array, required: true });

const count = computed(() => ALL_PERMISSIONS.filter((k) => value.value.includes(k)).length);
</script>

<template>
  <div class="perm-head">
    <span class="perm-progress" :aria-label="`${count} permissions sur ${ALL_PERMISSIONS.length}`">
      <span class="perm-progress-value"><strong>{{ count }}</strong> / {{ ALL_PERMISSIONS.length }}</span>
      <span class="perm-progress-bar" aria-hidden="true"><span :style="{ width: `${ALL_PERMISSIONS.length ? (count / ALL_PERMISSIONS.length) * 100 : 0}%` }" /></span>
    </span>
    <PermissionSelectAll v-model="value" :keys="ALL_PERMISSIONS" :disabled="disabled" label="Tout cocher" class-name="perm-all-main" />
  </div>
</template>
