<script setup>
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useStore } from '../store';
import {isCompanyRouteEnabled} from '../maquette/companyModules';
import Shell from '../shell/Shell.vue';
import { SETTINGS_NAV } from '../pages/settings/nav';

/** Application RH : s'ouvre sur une société où elle est activée (le store en garantit toujours une). */
const route = useRoute();
const store = useStore();

const segments = computed(() => route.path.split('/').filter(Boolean));
const section = computed(() => segments.value[0] ?? 'tableau-de-bord');
const sub = computed(() => {
  const [s, a] = segments.value;
  return s === 'conges' ? (a ?? 'demandes') : s === 'parametres' ? (a ?? SETTINGS_NAV[0].id) : a ?? '';
});

const allowed = computed(() => store.companiesFor('rh'));
const enabled = computed(() => allowed.value.some((c) => c.id === store.companyId));

watch([enabled, allowed], () => {
  if (!enabled.value && allowed.value[0]) store.setCompanyId(allowed.value[0].id);
}, { immediate: true });

// Employés, départements, jours fériés, types de documents, fonctions, numérotation des matricules et devises viennent du backend.
// Les listes protégées ne sont lues que si l'utilisateur connecté a la permission (sinon le backend répond 403).
onMounted(async () => {
  await store.loadMe();
  // Notifications en temps réel (échéances de contrat…), filtrées par le backend selon les permissions.
  store.startNotifications();
  if (store.can('employes.consulter')) {
    store.loadEmployees();
    store.loadEmployeeAccess();
  }
  if (store.can('primes.consulter')) store.loadEmployeePrimes();
  store.loadDepartments();
  store.loadSchedules();
  store.loadHolidays();
  store.loadCircuits();
  store.loadPrimes();
  store.loadRoles();
  store.loadPermissionCatalog();
  store.loadDocumentTypes();
  store.loadContractTypes();
  store.loadFunctions();
  store.loadCodeNumberings();
  store.loadNumbering();
  store.loadPhoneCountries();
  store.loadDevises();
});
</script>

<template>
  <Shell :app="section" :section="sub">
    <!-- La clé remonte la page au changement de société pour réinitialiser filtres et sélections. -->
    <div :key="store.companyId" class="page"><RouterView v-if="isCompanyRouteEnabled(store.companyId,section,sub)" /><section v-else class="module-unavailable" role="status"><h1>Fonctionnalité indisponible</h1><p>Ce module est désactivé ou n’est pas disponible dans cette version pour votre société.</p><a v-if="store.can('modules_societe.consulter')" href="/parametres/modules-societe" class="btn btn-primary">Voir les modules de la société</a><a href="/tableau-de-bord" class="btn btn-ghost">Retour au tableau de bord</a></section></div>
  </Shell>
</template>

<style scoped>.module-unavailable{padding:35px 24px}.module-unavailable h1{font-size:22px}.module-unavailable p{margin:18px 0;color:var(--muted)}.module-unavailable a{margin:8px 10px 0 0}</style>
