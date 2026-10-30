<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from '@lucide/vue';
import { useStore } from '../store';
import { NAV_PERMISSIONS, SETTINGS_PERMISSIONS } from '../config/access';
import { SETTINGS_NAV } from '../pages/settings/nav';
import { isCompanyRouteEnabled } from '../maquette/companyModules';
import { SIDEBAR } from './nav';

/**
 * Navigation latérale : rubriques regroupées par domaine, sous-sections dépliables (Congés).
 * Rubriques fermées par défaut (la rubrique en cours reste signalée). Réductible en barre d'icônes (mémorisé dans le navigateur) ;
 * toujours dépliée dans le menu mobile.
 */
const props = defineProps({
  app: { type: String, required: true },
  section: { type: String, default: '' },
  /** Éléments à traiter par rubrique ou sous-section : { conges: 2, demandes: 2 }. */
  counts: { type: Object, default: () => ({}) },
});

const STORAGE_KEY = 'rh-sidebar-collapsed';
const read = () => { try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; } };
const collapsed = ref(read());
watch(collapsed, (v) => { try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch { /* stockage indisponible */ } });

// Menu mobile : la barre est toujours dépliée.
const mobileQuery = typeof window !== 'undefined' ? window.matchMedia('(max-width: 900px)') : undefined;
const mobile = ref(!!mobileQuery?.matches);
const onMedia = (e) => { mobile.value = e.matches; };
mobileQuery?.addEventListener('change', onMedia);
onBeforeUnmount(() => mobileQuery?.removeEventListener('change', onMedia));
const compact = computed(() => collapsed.value && !mobile.value);

// Rubriques et sous-sections permises à l'utilisateur connecté ; Paramètres s'il peut gérer au moins une section.
const store = useStore();
const visible = (id) => isCompanyRouteEnabled(store.companyId,id) && (id === 'parametres'
  ? SETTINGS_NAV.some((s) => isCompanyRouteEnabled(store.companyId,'parametres',s.id)&&store.allows(SETTINGS_PERMISSIONS[s.id]))
  : store.allows(NAV_PERMISSIONS[id]));
const groups = computed(() => SIDEBAR
  .map((g) => ({
    ...g,
    items: g.items
      .filter((item) => visible(item.id))
      .map((item) => (item.children ? { ...item, children: item.children.filter((c) => store.allows(NAV_PERMISSIONS[`${item.id}/${c.id}`])) } : item))
      .filter((item) => !item.children || item.children.length),
  }))
  .filter((g) => g.items.length));

/** Rubriques ouvertes : fermées par défaut, elles ne s'ouvrent qu'au clic. */
const open = reactive(new Set());
const isOpen = (key) => open.has(key);
const toggle = (key) => { if (open.has(key)) open.delete(key); else open.add(key); };
/** Rubrique réduite : lien direct vers sa sous-section en cours, sinon la première. */
const compactHref = (item) => `/${item.id}/${props.app === item.id && props.section ? props.section : item.children[0].id}`;
</script>

<template>
  <nav :class="['sidenav', { compact }]" aria-label="Navigation principale">
    <div class="sn-scroll">
      <section v-for="(g, gi) in groups" :key="gi" class="sn-group" :aria-label="g.title">
        <p v-if="g.title && !compact" class="sn-title">{{ g.title }}</p>
        <hr v-else-if="g.title" class="sn-sep" />
        <ul class="sn-list">
          <li v-for="item in g.items" :key="item.id">
            <!-- Rubrique simple, ou rubrique à sous-sections en barre réduite -->
            <a v-if="!item.children || compact" :href="item.children ? compactHref(item) : `/${item.id}`"
              :class="['sn-item', { active: app === item.id }]" :aria-current="app === item.id ? 'page' : undefined"
              :title="compact ? item.title ?? item.label : item.title"
              :aria-label="counts[item.id] > 0 ? `${item.label} (${counts[item.id]} à traiter)` : undefined">
              <span class="sn-icon"><component :is="item.icon" :size="16" :stroke-width="1.7" aria-hidden="true" /></span>
              <span class="sn-label">{{ item.label }}</span>
              <span v-if="counts[item.id] > 0" class="sn-count" aria-hidden="true">{{ counts[item.id] }}</span>
            </a>

            <!-- Rubrique dépliable -->
            <template v-else>
              <button type="button" :class="['sn-item', 'sn-parent', { current: app === item.id }]" :aria-expanded="isOpen(item.id)"
                :aria-controls="`sn-${item.id}`" @click="toggle(item.id)">
                <span class="sn-icon"><component :is="item.icon" :size="16" :stroke-width="1.7" aria-hidden="true" /></span>
                <span class="sn-label">{{ item.label }}</span>
                <span v-if="counts[item.id] > 0 && !isOpen(item.id)" class="sn-count" :aria-label="`${counts[item.id]} à traiter`">{{ counts[item.id] }}</span>
                <ChevronRight :size="13" class="sn-chevron" aria-hidden="true" />
              </button>
              <ul v-show="isOpen(item.id)" :id="`sn-${item.id}`" class="sn-sub">
                <li v-for="c in item.children" :key="c.id">
                  <a :href="`/${item.id}/${c.id}`" :class="['sn-link', { active: app === item.id && section === c.id }]"
                    :aria-current="app === item.id && section === c.id ? 'page' : undefined">
                    <span class="sn-label">{{ c.label }}</span>
                    <span v-if="counts[c.id] > 0" class="sn-count" :aria-label="`${counts[c.id]} à traiter`">{{ counts[c.id] }}</span>
                  </a>
                </li>
              </ul>
            </template>
          </li>
        </ul>
      </section>
    </div>
    <button type="button" class="sn-collapse" :aria-label="compact ? 'Déplier le menu' : 'Réduire le menu'" :title="compact ? 'Déplier le menu' : 'Réduire le menu'"
      @click="collapsed = !collapsed">
      <component :is="compact ? PanelLeftOpen : PanelLeftClose" :size="16" :stroke-width="1.7" aria-hidden="true" />
      <span class="sn-label">Réduire le menu</span>
    </button>
  </nav>
</template>
