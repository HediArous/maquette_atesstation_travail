<script setup>
import { computed } from 'vue';
import PermissionMatrix from '../settings/PermissionMatrix.vue';

/**
 * Permissions d'un employé (onglet Accès, création du dossier) : la matrice des rôles, avec les permissions du rôle
 * cochées et verrouillées (elles ne se retirent pas pour un employé) et des ajouts hors rôle.
 * v-model : permissions ajoutées hors rôle.
 */
const props = defineProps({
  /** Permissions du rôle attribué. */
  rolePermissions: { type: Array, default: () => [] },
  disabled: Boolean,
});
const extra = defineModel({ type: Array, required: true });

// Cases cochées : rôle + ajouts ; cocher / décocher ne change que les ajouts.
const effective = computed({
  get: () => [...props.rolePermissions, ...extra.value.filter((k) => !props.rolePermissions.includes(k))],
  set: (keys) => {
    if (props.disabled) return;
    extra.value = keys.filter((k) => !props.rolePermissions.includes(k));
  },
});
</script>

<template>
  <div class="emp-perms">
    <p class="emp-perms-legend small text-muted">
      <span class="lg-role" aria-hidden="true" /> donnée par le rôle (non modifiable ici) ·
      <span class="lg-added" aria-hidden="true" /> ajoutée hors rôle. « Consulter » est requis pour les autres actions.
    </p>
    <PermissionMatrix v-model="effective" :base="rolePermissions" :disabled="disabled" />
  </div>
</template>

<style scoped>
.emp-perms { min-width: 0; }
.emp-perms-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; margin: 0 0 10px; }
.lg-added { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #16a34a; }
.lg-role { display: inline-block; width: 11px; height: 11px; border-radius: 3px; background: #94a3b8; }
</style>
