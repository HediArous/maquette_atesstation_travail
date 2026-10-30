<script setup>
import { useSettingsRights } from './settingsRights';
import { computed, onMounted, ref } from 'vue';
import { Archive, ArchiveRestore, CloudOff, LoaderCircle, Pencil, Plus, Tags } from '@lucide/vue';
import { useStore } from '../../store';
import { statusesApi } from '../../api/employees';
import ArchivedBadge from '../../components/ui/ArchivedBadge.vue';
import EmployeeStatusBadge from '../../components/ui/EmployeeStatusBadge.vue';
import Card from '../../components/ui/Card.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import Switch from '../../components/ui/Switch.vue';

/** Statuts des employés (backend /api/employee-statuses) : proposés dans le champ « Statut » de la fiche employé. */
const store = useStore();
const { canCreate, canEdit, canArchive } = useSettingsRights();
const statuses = ref([]);
const state = ref('loading');
const loadError = ref('');
const busy = ref(false);

async function load() {
  state.value = 'loading';
  try {
    statuses.value = await statusesApi.list();
    state.value = 'ready';
  } catch (e) {
    loadError.value = e.message;
    state.value = 'error';
  }
}
onMounted(load);

// ---------- Archivés (comme la page Fonctions) ----------
const showArchived = ref(true);
const archivedCount = computed(() => statuses.value.filter((s) => s.isActive === false).length);
const visible = computed(() => statuses.value.filter((s) => showArchived.value || s.isActive !== false));

// ---------- Formulaire (ajout / modification) ----------
const editing = ref();
const value = ref('');
const submitted = ref(false);
const current = computed(() => editing.value?.status);

function open(status) {
  editing.value = { status };
  value.value = status?.value ?? '';
  submitted.value = false;
}

const error = computed(() => {
  const v = value.value.trim().toLowerCase();
  if (!v) return 'Libellé requis.';
  if (statuses.value.some((s) => s.id !== current.value?.id && s.value.trim().toLowerCase() === v)) return 'Ce statut existe déjà.';
  return undefined;
});

async function run(action, message, tone) {
  busy.value = true;
  try {
    await action();
    store.toast(message, tone);
    await load();
    return true;
  } catch (e) {
    store.toast(`Opération impossible : ${e.message}`, 'danger');
    return false;
  } finally {
    busy.value = false;
  }
}

async function save() {
  submitted.value = true;
  if (error.value || busy.value) return;
  const v = value.value.trim();
  const ok = await run(
    () => (current.value ? statusesApi.update(current.value.id, { value: v }) : statusesApi.create({ value: v, isActive: true })),
    `Statut « ${v} » ${current.value ? 'mis à jour' : 'ajouté'}`,
  );
  if (ok) editing.value = undefined;
}

// ---------- Archiver / Restaurer (isActive) ----------
function toggle(s) {
  if (busy.value) return;
  const archive = s.isActive !== false;
  run(() => statusesApi.setActive(s.id, !archive), `Statut « ${s.value} » ${archive ? 'archivé' : 'restauré'}`, 'info');
}
</script>

<template>
  <Card flush>
    <template #title>Statuts des employés <span class="count-pill">{{ statuses.length }}</span></template>
    <template #actions>
      <button v-if="canCreate" type="button" class="btn btn-sm btn-primary" :disabled="state !== 'ready'" @click="open()"><Plus :size="14" aria-hidden="true" /> Ajouter un statut</button>
    </template>
    <div v-if="state === 'ready'" class="settings-intro">
      <p class="small text-muted">Un statut archivé n’est plus proposé dans la fiche employé ; les employés qui l’ont déjà le conservent.</p>
      <Switch v-model="showArchived" :label="`Afficher les archivés (${archivedCount})`" />
    </div>
    <EmptyState v-if="state === 'loading'" title="Chargement des statuts…">
      <template #icon><LoaderCircle :size="28" aria-hidden="true" /></template>
    </EmptyState>
    <EmptyState v-else-if="state === 'error'" title="Statuts indisponibles" :text="loadError">
      <template #icon><CloudOff :size="28" aria-hidden="true" /></template>
      <template #action><button type="button" class="btn btn-sm btn-primary" @click="load">Réessayer</button></template>
    </EmptyState>
    <EmptyState v-else-if="visible.length === 0" title="Aucun statut" text="Ajoutez le premier statut proposé dans la fiche employé.">
      <template #icon><Tags :size="28" aria-hidden="true" /></template>
    </EmptyState>
    <div v-else class="table-wrap">
      <table class="table status-table">
        <thead>
          <tr>
            <th scope="col">Libellé</th>
            <th scope="col">Aperçu dans la liste des employés</th>
            <th scope="col">État</th>
            <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in visible" :key="s.id" :class="{ 'row-archived': s.isActive === false }">
            <td><span class="person-name">{{ s.value }}</span></td>
            <td><EmployeeStatusBadge :value="s.value" /></td>
            <td><ArchivedBadge v-if="s.isActive === false" /><span v-else class="badge badge-success">Actif</span></td>
            <td class="col-actions">
              <div class="row-actions">
                <button v-if="canEdit" type="button" class="btn btn-sm btn-ghost" :disabled="busy" :aria-label="`Modifier ${s.value}`" @click="open(s)"><Pencil :size="13" aria-hidden="true" /> Modifier</button>
                <button v-if="canArchive" type="button" class="btn btn-sm btn-ghost" :disabled="busy" :aria-label="`${s.isActive === false ? 'Restaurer' : 'Archiver'} ${s.value}`" @click="toggle(s)">
                  <template v-if="s.isActive === false"><ArchiveRestore :size="14" aria-hidden="true" /> Restaurer</template>
                  <template v-else><Archive :size="14" aria-hidden="true" /> Archiver</template>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </Card>

  <Modal :open="!!editing" :title="current ? `Modifier « ${current.value} »` : 'Nouveau statut'" @close="editing = undefined">
    <Field v-slot="{ id }" label="Libellé" required :error="submitted ? error : undefined"
      :hint="current ? 'Le nouveau libellé s’applique aussi aux employés qui ont déjà ce statut.' : 'Il sera proposé dans le champ « Statut » de la fiche employé.'">
      <input :id="id" v-model="value" placeholder="Ex. : Détaché" @keydown.enter="save" />
    </Field>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="editing = undefined">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="busy" @click="save">{{ current ? 'Enregistrer' : 'Ajouter' }}</button>
    </template>
  </Modal>
</template>

<style scoped>
.count-pill { display: inline-block; margin-left: 6px; padding: 0 8px; border-radius: 999px; background: #eef2f7; color: #475569; font-size: 11.5px; font-weight: 600; vertical-align: middle; }
.status-table .col-actions { width: 1%; white-space: nowrap; text-align: right; }
.status-table tbody tr:hover { background: #f8fafc; }
.row-actions { display: inline-flex; align-items: center; gap: 6px; justify-content: flex-end; }
</style>
