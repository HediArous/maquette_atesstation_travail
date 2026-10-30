<script setup>
import { computed, ref, watch } from 'vue';
import { Check, ChevronDown } from '@lucide/vue';
import { PERMISSIONS, permissionCatalog, permissionGroups } from '../../config/permissions';
import PermissionSelectAll from './PermissionSelectAll.vue';
import PermissionSummary from './PermissionSummary.vue';

/**
 * Matrice des permissions d'un rôle : un tableau par fonctionnalité, une ligne par ressource (dossiers employés,
 * contrats…), une colonne par action (consulter, créer, modifier, supprimer ou archiver). Cocher une action coche aussi
 * « Consulter » de la ressource ; décocher « Consulter » retire ses autres actions. v-model : permissions cochées.
 */
const props = defineProps({
  disabled: Boolean,
  withSummary: { type: Boolean, default: true },
  /** Permissions du rôle (accès d'un employé) : cochées et verrouillées ; une case cochée hors rôle est « ajoutée ». */
  base: { type: Array, default: undefined },
});
const value = defineModel({ type: Array, required: true });

// Ordre et libellés des colonnes ; « Ajouter » pour le paramétrage (éléments archivables).
const ACTIONS = ['consulter', 'creer', 'modifier', 'suspendre', 'supprimer', 'archiver', 'demander', 'voir_soi', 'traiter', 'generer', 'imprimer'];
// « supprimer » des employés : archivage et suppression d'un élément jamais utilisé, affiché « Archiver ».
const ACTION_LABEL = { consulter: 'Consulter', creer: 'Créer', modifier: 'Modifier', suspendre: 'Suspendre', supprimer: 'Archiver', archiver: 'Archiver', demander:'Demander pour soi', voir_soi:'Voir ses demandes', traiter:'Traiter', generer:'Générer', imprimer:'Imprimer / PDF' };

const groups = computed(() => permissionGroups().map((name) => {
  const perms = PERMISSIONS.filter((p) => p.group === name);
  const actions = ACTIONS.filter((a) => perms.some((p) => p.action === a));
  const resources = [...new Set(perms.map((p) => p.resource))].map((resource) => {
    const list = perms.filter((p) => p.resource === resource);
    return { name: resource, keys: list.map((p) => p.key), byAction: Object.fromEntries(list.map((p) => [p.action, p])) };
  });
  return { name, actions, resources, keys: perms.map((p) => p.key), archivable: actions.includes('archiver') };
}));
const actionLabel = (g, a) => (a === 'creer' && g.archivable ? 'Ajouter' : ACTION_LABEL[a]);
const countOf = (keys) => keys.filter((k) => value.value.includes(k)).length;
// Écart avec le rôle : 'added' | 'removed' | undefined.
function diffOf(key) {
  if (!props.base) return undefined;
  const inRole = props.base.includes(key);
  const on = value.value.includes(key);
  return on && !inRole ? 'added' : !on && inRole ? 'removed' : undefined;
}
const DIFF_TITLE = { added: ' — ajoutée individuellement', removed: ' — retirée individuellement (donnée par le rôle)', locked: ' — donnée par le rôle' };
// Permission du rôle (accès d'un employé) : non modifiable ici.
const lockedKey = (key) => !!props.base?.includes(key);

// Catégories repliables : seule la première est ouverte au départ, la liste étant longue.
const closed = ref(new Set());
let initialized = false;
watch(() => groups.value.length, (n) => {
  if (!n || initialized) return;
  initialized = true;
  closed.value = new Set(groups.value.slice(1).map((x) => x.name));
}, { immediate: true });
const isOpen = (g) => !closed.value.has(g.name);
function toggleGroup(g) {
  const next = new Set(closed.value);
  if (next.has(g.name)) next.delete(g.name); else next.add(g.name);
  closed.value = next;
}

function toggle(resource, perm, on) {
  const consult = resource.byAction.consulter?.key;
  let next = value.value.filter((k) => k !== perm.key);
  if (on) {
    next.push(perm.key);
    // Une action sans consultation n'a pas de sens : « Consulter » est coché avec elle.
    if (consult && perm.key !== consult && !next.includes(consult)) next.push(consult);
  } else if (perm.key === consult) {
    next = next.filter((k) => !resource.keys.includes(k));
  }
  value.value = next;
}
</script>

<template>
  <PermissionSummary v-if="withSummary" v-model="value" :disabled="disabled" />
  <p v-if="permissionCatalog.status === 'loading'" class="small text-muted">Chargement du catalogue des permissions…</p>
  <p v-else-if="permissionCatalog.status === 'error'" class="small text-danger">Catalogue des permissions indisponible : {{ permissionCatalog.error }}</p>
  <div v-else class="pm">
    <section v-for="g in groups" :key="g.name" class="pm-card" :aria-label="g.name">
      <header :class="['pm-head', { closed: !isOpen(g) }]">
        <button type="button" class="pm-toggle" :aria-expanded="isOpen(g)" :aria-controls="`pm-${g.name}`" @click="toggleGroup(g)">
          <ChevronDown :size="15" class="pm-chevron" aria-hidden="true" />
          <span class="pm-title">{{ g.name }}</span>
        </button>
        <span :class="['perm-count', countOf(g.keys) === g.keys.length ? 'full' : countOf(g.keys) ? 'some' : '']">{{ countOf(g.keys) }}/{{ g.keys.length }}</span>
        <PermissionSelectAll v-model="value" :keys="g.keys" :disabled="disabled" label="Tout" />
      </header>
      <div v-show="isOpen(g)" :id="`pm-${g.name}`" class="pm-scroll">
        <table class="pm-table">
          <thead>
            <tr>
              <th scope="col" class="pm-res">Ressource</th>
              <th v-for="a in g.actions" :key="a" scope="col" class="pm-act">{{ actionLabel(g, a) }}</th>
              <th scope="col" class="pm-act pm-all-col">Tout</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in g.resources" :key="r.name" :class="{ on: countOf(r.keys) > 0 }">
              <th scope="row" class="pm-res">{{ r.name }}</th>
              <td v-for="a in g.actions" :key="a" class="pm-act">
                <label v-if="r.byAction[a]" :class="['pm-cell', diffOf(r.byAction[a].key), { on: value.includes(r.byAction[a].key), disabled: disabled || lockedKey(r.byAction[a].key), locked: lockedKey(r.byAction[a].key) }]"
                  :title="r.byAction[a].label + (DIFF_TITLE[lockedKey(r.byAction[a].key) ? 'locked' : diffOf(r.byAction[a].key)] ?? '')">
                  <input type="checkbox" :checked="value.includes(r.byAction[a].key)" :disabled="disabled || lockedKey(r.byAction[a].key)" :aria-label="r.byAction[a].label"
                    @change="toggle(r, r.byAction[a], $event.target.checked)" />
                  <span class="perm-tick" aria-hidden="true"><Check :size="11" :stroke-width="3" /></span>
                </label>
                <span v-else class="pm-none" aria-hidden="true">—</span>
              </td>
              <td class="pm-act pm-all-col">
                <PermissionSelectAll v-if="r.keys.length > 1" v-model="value" :keys="r.keys" :disabled="disabled" label="" class-name="pm-row-all" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pm { display: grid; gap: 12px; }
.pm-card { border: 1px solid #e3e8ef; border-radius: 10px; background: #fff; overflow: hidden; }
.pm-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f8fafc; border-bottom: 1px solid #eef1f5; }
.pm-head.closed { border-bottom-color: transparent; }
.pm-toggle { flex: 1; display: flex; align-items: center; gap: 6px; min-width: 0; padding: 0; border: 0; background: none; font: inherit; text-align: left; cursor: pointer; }
.pm-toggle:focus-visible { outline: 2px solid #0b5cc0; outline-offset: 2px; border-radius: 4px; }
.pm-chevron { flex: none; color: #8a96a8; transition: transform .15s; }
.closed .pm-chevron { transform: rotate(-90deg); }
.pm-title { font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #475569; }
.pm-scroll { overflow-x: auto; }
.pm-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.pm-table thead th { padding: 6px 8px; font-size: 11px; font-weight: 600; color: #8a96a8; text-align: center; border-bottom: 1px solid #eef1f5; white-space: nowrap; }
.pm-table thead th.pm-res { text-align: left; padding-left: 12px; }
.pm-table tbody tr + tr { border-top: 1px solid #f1f4f8; }
.pm-table tbody tr.on { background: #fafcff; }
.pm-res { padding: 6px 8px 6px 12px; font-weight: 500; color: #1e293b; text-align: left; white-space: nowrap; }
.pm-act { width: 92px; padding: 4px 6px; text-align: center; }
.pm-all-col { width: 56px; border-left: 1px solid #f1f4f8; }
.pm-cell { position: relative; display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; }
.pm-cell:hover { background: #f1f5fb; }
.pm-cell.disabled { cursor: default; }
.pm-cell input { position: absolute; opacity: 0; pointer-events: none; }
.pm-cell.on .perm-tick { background: #0b5cc0; border-color: #0b5cc0; color: #fff; }
.pm-cell input:focus-visible + .perm-tick { box-shadow: 0 0 0 3px rgba(11, 92, 192, .25); }
.pm-none { color: #cbd2dc; }
/* Écart avec le rôle : ajoutée (pastille verte), retirée (case rouge en pointillés). */
.pm-cell.added::after { content: ''; position: absolute; top: 3px; right: 3px; width: 7px; height: 7px; border-radius: 50%; background: #16a34a; box-shadow: 0 0 0 2px #fff; }
.pm-cell.locked.on .perm-tick { background: #94a3b8; border-color: #94a3b8; }
.pm-cell.removed .perm-tick { border-color: #dc2626; border-style: dashed; background: #fef2f2; }
:deep(.pm-row-all) { justify-content: center; }
</style>
