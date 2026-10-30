<script setup>
import { computed, ref, watch } from 'vue';
import { X } from '@lucide/vue';
import { useStore } from '../store';
import SectionTabs from './SectionTabs.vue';
import SideNav from './SideNav.vue';
import Topbar from './Topbar.vue';
import { isCompanyRouteEnabled } from '../maquette/companyModules';
import { SECTION_TABS } from './nav';
import { SETTINGS_PERMISSIONS } from '../config/access';

/** Shell de l'Application RH : barre supérieure, navigation latérale et, pour les Paramètres, onglets de section. */
const props = defineProps({
  app: { type: String, required: true },
  section: { type: String, default: '' },
});

const store = useStore();
const mobileOpen = ref(false);
// Onglets des paramètres : seulement les sections que l'utilisateur connecté peut gérer.
const sub = computed(() => {
  const tabs = SECTION_TABS[props.app];
  if (!tabs || props.app !== 'parametres') return tabs;
  return { ...tabs, items: tabs.items.filter((t) => isCompanyRouteEnabled(store.companyId,props.app,t.id)&&store.allows(SETTINGS_PERMISSIONS[t.id])) };
});
const toProcess = computed(() => {
  if (!store.currentUser.id) return 0;
  return store.db.requests.filter((r) => r.companyId === store.companyId && r.steps.some((s) => s.status === 'en_attente' && store.isStepApprover(s))).length;
});
const counts = computed(() => ({ demandes: toProcess.value, conges: toProcess.value }));

watch(() => [props.app, props.section], () => { mobileOpen.value = false; });

function focusMain() {
  document.getElementById('main')?.focus();
}
</script>

<template>
  <div class="shell shell-rh">
    <a href="#main" class="skip-link" @click.prevent="focusMain">Aller au contenu</a>
    <Topbar @menu="mobileOpen = true" />
    <div class="shell-body">
      <div :class="['nav-wrap', { open: mobileOpen }]">
        <SideNav :app="app" :section="section" :counts="counts" />
        <button type="button" class="icon-btn nav-close" aria-label="Fermer le menu" @click="mobileOpen = false"><X :size="18" /></button>
      </div>
      <div v-if="mobileOpen" class="nav-backdrop" aria-hidden="true" @click="mobileOpen = false" />
      <main id="main" :class="['content', { 'has-tabs': sub }]" tabindex="-1">
        <SectionTabs v-if="sub" :app="app" :section="section" :sub="sub" :counts="counts" />
        <div class="maquette-label" role="note">Maquette de l’application existante · Données fictives · Les changements sont remis à zéro au rechargement.</div>
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.maquette-label { margin: 16px 24px 0; padding: 9px 13px; color: #7b5b20; background: #fff7e7; border: 1px solid #f3e4bf; border-radius: 7px; font-size: 11px; line-height: 1.6; }
</style>
