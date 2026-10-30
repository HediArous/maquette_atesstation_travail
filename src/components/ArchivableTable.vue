<script setup>
import { useSettingsRights } from '../pages/settings/settingsRights';
import { computed, ref } from 'vue';
import { Archive, ArchiveRestore, Plus } from '@lucide/vue';
import { useStore } from '../store';
import ArchivedBadge from './ui/ArchivedBadge.vue';
import Card from './ui/Card.vue';
import EmptyState from './ui/EmptyState.vue';
import Switch from './ui/Switch.vue';

/**
 * Tableau d'éléments archivables : les archivés restent consultables, grisés.
 * Cellules : slot `cell-<clé de colonne>` (reçoit `row`), à défaut `colonne.value(row)`. Actions de ligne : slot `row-actions`.
 */
const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  rows: { type: Array, required: true },
  /** [{ key, header, className?, value?: (row) => string | number }] */
  columns: { type: Array, required: true },
  /** Collection de la base concernée (archivage). */
  collection: { type: String, required: true },
  addLabel: { type: String, required: true },
  nameOf: { type: Function, required: true },
  emptyText: { type: String, default: '' },
  /** Motif empêchant l'archivage (élément encore utilisé) ; l'archivage est alors refusé avec ce message. */
  archiveBlockedBy: { type: Function, default: undefined },
  /** Archivage / restauration propre à la collection : (row) => void, à la place de store.setArchived. */
  onToggleArchived: { type: Function, default: undefined },
  rowClassName: { type: Function, default: undefined },
});
const emit = defineEmits(['add']);
// Boutons masqués sans la permission de la section : ajouter, actions de ligne (modifier…), archiver / restaurer.
const { canCreate, canEdit, canArchive } = useSettingsRights();

const store = useStore();
const showArchived = ref(true);
const archivedCount = computed(() => props.rows.filter((r) => r.archived).length);
const visible = computed(() => props.rows.filter((r) => showArchived.value || !r.archived));

function toggle(r) {
  const blocked = !r.archived ? props.archiveBlockedBy?.(r) : undefined;
  if (blocked) store.toast(blocked, 'danger');
  else if (props.onToggleArchived) props.onToggleArchived(r);
  else store.setArchived(props.collection, r.id, !r.archived);
}
</script>

<template>
  <Card :title="title" flush>
    <template #actions>
      <button v-if="canCreate" type="button" class="btn btn-primary btn-sm" @click="emit('add')"><Plus :size="15" aria-hidden="true" /> {{ addLabel }}</button>
    </template>
    <div class="settings-intro">
      <p class="small text-muted">{{ description }}</p>
      <Switch v-model="showArchived" :label="`Afficher les archivés (${archivedCount})`" />
    </div>
    <EmptyState v-if="visible.length === 0" title="Aucun élément" :text="emptyText || 'Ajoutez un premier élément pour commencer.'" />
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th v-for="c in columns" :key="c.key" scope="col" :class="c.className">{{ c.header }}</th>
            <th scope="col">État</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in visible" :key="r.id" :class="[r.archived ? 'row-archived' : '', rowClassName?.(r) ?? '']">
            <td v-for="c in columns" :key="c.key" :class="c.className">
              <slot :name="`cell-${c.key}`" :row="r">{{ c.value?.(r) }}</slot>
            </td>
            <td><ArchivedBadge v-if="r.archived" /><span v-else class="badge badge-success">Actif</span></td>
            <td class="actions">
              <slot v-if="canEdit" name="row-actions" :row="r" />
              <button v-if="canArchive" type="button" class="btn btn-sm btn-ghost" :aria-label="`${r.archived ? 'Restaurer' : 'Archiver'} ${nameOf(r)}`" @click="toggle(r)">
                <template v-if="r.archived"><ArchiveRestore :size="14" aria-hidden="true" /> Restaurer</template>
                <template v-else><Archive :size="14" aria-hidden="true" /> Archiver</template>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </Card>
</template>
