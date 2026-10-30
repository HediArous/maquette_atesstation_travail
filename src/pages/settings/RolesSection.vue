<script setup>
import { useSettingsRights } from './settingsRights';
import { computed, ref, watch } from 'vue';
import { Archive, ArchiveRestore, Lock, Pencil, Plus, RotateCcw, Save, ShieldCheck } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import { knownPermissions } from '../../config/permissions';
import Alert from '../../components/ui/Alert.vue';
import ArchivedBadge from '../../components/ui/ArchivedBadge.vue';
import Card from '../../components/ui/Card.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import Field from '../../components/ui/Field.vue';
import Switch from '../../components/ui/Switch.vue';
import NewRoleModal from './NewRoleModal.vue';
import PermissionMatrix from './PermissionMatrix.vue';

/**
 * Rôles RH de la société (RH-18, backend /api/roles) : liste avec nombre de permissions et de titulaires, matrice des
 * permissions regroupées par fonctionnalité. Les permissions sont verrouillées jusqu'au clic sur « Modifier » (comme la
 * maquette) ; l'affectation des rôles aux employés se fait depuis leur dossier (RH-19), jamais ici.
 */
const store = useStore();
const { canCreate, canEdit, canArchive } = useSettingsRights();
const data = useCompanyData();
const selectedId = ref('');
const showArchived = ref(false);
const open = ref(false);
const editing = ref(false);
const saving = ref(false);
const saveError = ref('');
const submitted = ref(false);

const roles = computed(() => data.roles.filter((r) => showArchived.value || !r.archived));
const archivedCount = computed(() => data.roles.filter((r) => r.archived).length);
const role = computed(() => data.role(selectedId.value) ?? roles.value[0]);
// Nombre d'employés titulaires, calculé par le backend (RH-19).
const countOf = (r) => r.users ?? 0;
const holders = computed(() => (role.value ? countOf(role.value) : 0));

// Brouillon du rôle sélectionné (nom, description, permissions), réinitialisé à chaque changement de rôle.
const f = ref({ name: '', description: '', permissions: [] });
function reset() {
  f.value = { name: role.value?.name ?? '', description: role.value?.description ?? '', permissions: knownPermissions(role.value?.permissions ?? []) };
  editing.value = false;
  submitted.value = false;
  saveError.value = '';
}
watch(() => [role.value?.id, role.value?.name, role.value?.permissions], reset, { immediate: true });

const sig = (r) => JSON.stringify([r.name.trim(), (r.description ?? '').trim(), [...r.permissions].sort()]);
const dirty = computed(() => !!role.value && sig(f.value) !== sig({ ...role.value, permissions: knownPermissions(role.value.permissions) }));

const nameError = computed(() => {
  const name = f.value.name.trim();
  if (!name) return 'Nom du rôle requis.';
  if (!/\p{L}/u.test(name)) return 'Le nom doit contenir au moins une lettre.';
  if (data.roles.some((r) => r.id !== role.value?.id && r.name.trim().toLowerCase() === name.toLowerCase())) return 'Un rôle porte déjà ce nom dans la société.';
  return '';
});

async function save() {
  submitted.value = true;
  if (nameError.value || saving.value) return;
  saving.value = true;
  saveError.value = '';
  try {
    const saved = await store.saveRole({ ...role.value, ...f.value });
    store.toast(`Rôle « ${saved.name} » mis à jour`);
    editing.value = false;
  } catch (e) {
    saveError.value = e.message;
  } finally {
    saving.value = false;
  }
}

function toggleArchive() {
  store.setArchived('roles', role.value.id, !role.value.archived);
}

const onCreated = (id) => { selectedId.value = id; };
</script>

<template>
  <Alert v-if="store.rolesStatus === 'error'" tone="danger" title="Rôles non chargés">
    {{ store.rolesError }} <button type="button" class="link-btn" @click="store.loadRoles()">Réessayer</button>
  </Alert>
  <div class="roles-layout">
    <Card title="Rôles" flush>
      <template #actions><button v-if="canCreate" type="button" class="btn btn-primary btn-sm" @click="open = true"><Plus :size="15" aria-hidden="true" /> Nouveau rôle</button></template>
      <div class="settings-intro"><Switch v-model="showArchived" :label="`Afficher les archivés (${archivedCount})`" /></div>
      <p v-if="store.rolesStatus === 'loading'" class="fempty">Chargement des rôles…</p>
      <EmptyState v-else-if="roles.length === 0" title="Aucun rôle" text="Créez un premier rôle pour attribuer des permissions." />
      <ul v-else class="select-list" role="listbox" aria-label="Rôles">
        <li v-for="r in roles" :key="r.id">
          <button type="button" role="option" :aria-selected="r.id === role?.id" :class="['select-item', { selected: r.id === role?.id, archived: r.archived }]"
            :disabled="editing && r.id !== role?.id" @click="selectedId = r.id">
            <ShieldCheck :size="16" aria-hidden="true" />
            <span class="grow">
              <span class="person-name">{{ r.name }}</span> <ArchivedBadge v-if="r.archived" />
              <span class="block small text-muted">
                {{ knownPermissions(r.permissions).length }} permission{{ knownPermissions(r.permissions).length > 1 ? 's' : '' }}
                · {{ countOf(r) }} utilisateur{{ countOf(r) > 1 ? 's' : '' }}
              </span>
            </span>
          </button>
        </li>
      </ul>
    </Card>

    <Card v-if="role">
      <template #title>Permissions — {{ role.name }}</template>
      <template #actions>
        <!-- En modification : Annuler / Enregistrer en haut, visibles sans faire défiler la matrice. -->
        <template v-if="editing">
          <button type="button" class="btn btn-sm btn-ghost" :disabled="saving" @click="reset"><RotateCcw :size="14" aria-hidden="true" /> Annuler</button>
          <button type="button" class="btn btn-sm btn-primary" :disabled="!dirty || saving" @click="save">
            <Save :size="14" aria-hidden="true" /> {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
        </template>
        <template v-else>
          <button v-if="canEdit" type="button" class="btn btn-sm btn-ghost" :disabled="role.archived" title="Modifier le nom, la description et les permissions de ce rôle" @click="editing = true">
            <Pencil :size="14" aria-hidden="true" /> Modifier
          </button>
          <button v-if="canArchive" type="button" class="btn btn-sm btn-ghost" @click="toggleArchive">
            <template v-if="role.archived"><ArchiveRestore :size="14" aria-hidden="true" /> Restaurer</template>
            <template v-else><Archive :size="14" aria-hidden="true" /> Archiver</template>
          </button>
        </template>
      </template>
      <p v-if="editing" class="role-editing small"><Pencil :size="12" aria-hidden="true" /> Modification en cours : cochez ou décochez, puis enregistrez.</p>

      <Alert v-if="saveError" tone="danger" title="Enregistrement refusé" class="mb-12">{{ saveError }}</Alert>
      <Alert v-if="role.archived" tone="warning" title="Rôle archivé" class="mb-12">
        Il n’est plus attribuable. {{ holders }} utilisateur{{ holders > 1 ? 's le détiennent et le conservent' : ' le détient et le conserve' }} jusqu’à réaffectation depuis le dossier employé.
      </Alert>

      <div v-if="editing" class="form-grid mb-12">
        <Field v-slot="{ id }" label="Nom du rôle" required :error="submitted ? nameError : ''"><input :id="id" v-model="f.name" maxlength="100" autocomplete="off" /></Field>
        <Field v-slot="{ id }" label="Description"><input :id="id" v-model="f.description" maxlength="300" placeholder="À quoi sert ce rôle, à qui l’attribuer…" /></Field>
      </div>
      <p v-else-if="role.description" class="small text-muted mb-12">{{ role.description }}</p>

      <p v-if="!editing && !role.archived" class="perm-locked">
        <Lock :size="13" aria-hidden="true" /> Permissions verrouillées pour éviter les erreurs. Cliquez sur <strong>Modifier</strong> pour cocher ou décocher.
      </p>
      <div :class="editing ? 'perm-editing' : 'perm-readonly'">
        <PermissionMatrix v-model="f.permissions" :disabled="!editing || role.archived" />
      </div>
      <p class="small text-muted mt-12">
        Les permissions du rôle s’appliquent à {{ holders }} utilisateur{{ holders > 1 ? 's' : '' }}. Les rôles s’attribuent, et des permissions s’ajoutent ou se retirent individuellement, depuis l’onglet « Accès » de chaque dossier employé.
      </p>
    </Card>

    <NewRoleModal :open="open" @close="open = false" @created="onCreated" />
  </div>
</template>

<style scoped>
/* Bandeau discret sous l'en-tête pendant la modification (les boutons Annuler / Enregistrer sont dans l'en-tête). */
.role-editing { display: flex; align-items: center; gap: 6px; margin: 0 0 12px; padding: 6px 10px; border-radius: 8px; background: #fff7e6; border: 1px solid #f3dfb2; color: #8a5a0b; }
</style>
