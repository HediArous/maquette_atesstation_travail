<script setup>
import EmployeeDetail from './EmployeeDetail.vue';
import EmployeeList from './EmployeeList.vue';

/** Section Employés : liste, ajout (/employes/nouveau) et fiche (/employes/:id). */
defineProps({ param: { type: String, default: undefined } });
</script>

<template>
  <EmployeeDetail v-if="param && param !== 'nouveau'" :employee-id="param" />
  <EmployeeList v-else :add-open="param === 'nouveau'" />
</template>
