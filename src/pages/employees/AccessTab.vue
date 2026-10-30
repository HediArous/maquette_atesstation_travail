<script setup>
import { computed, onMounted, ref } from 'vue';
import { PERMISSIONS } from '../../config/permissions';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Alert from '../../components/ui/Alert.vue';
import Badge from '../../components/ui/Badge.vue';
import Field from '../../components/ui/Field.vue';
import SaveBar from '../../components/SaveBar.vue';
import { useCoreAccountOptions } from './coreAccounts';
import EmployeePermissions from './EmployeePermissions.vue';

/**
 * Accès d'un employé : compte du Core Tenant avec lequel il se connecte, rôle et permissions ajoutées ou retirées
 * individuellement. Un seul enregistrement pour le tout.
 */
const props = defineProps({
  profile: { type: Object, required: true },
});

const store = useStore();
const data = useCompanyData();
const roleId = ref(props.profile.roleId);
const extra = ref([...props.profile.extraPermissions]);
const removed = ref([...props.profile.removedPermissions]);
const coreUserId = ref(props.profile.coreUserId ?? '');
const coreAccounts = useCoreAccountOptions(coreUserId, () => props.profile.employeeId);
onMounted(() => { if (store.coreUsersStatus !== 'loading') store.loadCoreUsers(); });

const role = computed(() => data.role(roleId.value));
const accessDirty = computed(() => roleId.value !== props.profile.roleId
  || extra.value.join() !== props.profile.extraPermissions.join() || removed.value.join() !== props.profile.removedPermissions.join());
const accountDirty = computed(() => coreUserId.value !== (props.profile.coreUserId ?? ''));
const dirty = computed(() => accessDirty.value || accountDirty.value);
// Rôle et permissions : seulement pour un employé associé à un compte Core (choisi ici, même pas encore enregistré).
const hasAccount = computed(() => !!coreUserId.value);
const NO_ACCOUNT = 'Veuillez associer un compte utilisateur Core à cet employé pour configurer son rôle et ses permissions.';

const stateOf = (key) => {
  if (role.value?.permissions.includes(key)) return removed.value.includes(key) ? 'retire' : 'herite';
  return extra.value.includes(key) ? 'ajoute' : 'aucun';
};
const counts = computed(() => PERMISSIONS.reduce((acc, p) => { acc[stateOf(p.key)]++; return acc; }, { herite: 0, ajoute: 0, retire: 0, aucun: 0 }));

// Permissions du rôle : cochées et verrouillées dans la matrice (elles ne se retirent pas pour un employé).
const rolePerms = computed(() => role.value?.permissions ?? []);

function changeRole(id) {
  roleId.value = id;
  const perms = data.role(id)?.permissions ?? [];
  extra.value = extra.value.filter((k) => !perms.includes(k));
  removed.value = removed.value.filter((k) => perms.includes(k));
}

function reset() {
  roleId.value = props.profile.roleId;
  extra.value = [...props.profile.extraPermissions];
  removed.value = [...props.profile.removedPermissions];
  coreUserId.value = props.profile.coreUserId ?? '';
}

// Enregistré dans le backend (RH-19) ; un refus (rôle archivé…) est affiché.
const saving = ref(false);
async function save() {
  if (saving.value) return;
  if (accessDirty.value && !hasAccount.value) { store.toast(NO_ACCOUNT, 'danger'); return; }
  saving.value = true;
  try {
    if (accountDirty.value) await store.linkCoreAccount(props.profile.employeeId, coreUserId.value);
    if (accessDirty.value) {
      await store.saveEmployeeAccess(props.profile.employeeId, { roleId: roleId.value, extraPermissions: [...extra.value], removedPermissions: [] });
    }
    store.toast('Accès mis à jour');
  } catch (e) {
    store.toast(`Accès non enregistrés : ${e.message}`, 'danger');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="two-col access-layout">
    <section class="panel">
      <h2 class="panel-title">Compte et rôle</h2>
      <Field v-slot="{ id }" label="Compte Core Tenant" hint="L’employé se connecte au Core Tenant avec ces identifiants, puis ouvre l’application RH.">
        <select :id="id" v-model="coreUserId" :disabled="store.coreUsersStatus === 'loading' && !coreAccounts.length">
          <option value="">{{ store.coreUsersStatus === 'loading' ? 'Chargement des comptes…' : 'Aucun compte (pas d’accès à l’application)' }}</option>
          <option v-for="u in coreAccounts" :key="u.id" :value="u.id" :disabled="u.disabled">{{ u.label }}</option>
        </select>
      </Field>
      <p v-if="store.coreUsersStatus === 'error'" class="small text-danger mt-4">
        Comptes du Core Tenant indisponibles : {{ store.coreUsersError }} <button type="button" class="link-btn" @click="store.loadCoreUsers()">Réessayer</button>
      </p>
      <Alert v-if="!hasAccount" tone="warning" class="mt-12">{{ NO_ACCOUNT }}</Alert>
      <Field v-slot="{ id }" label="Rôle" class="mt-12">
        <select :id="id" :value="roleId" :disabled="!hasAccount" @change="changeRole($event.target.value)">
          <option v-if="!role" value="">Aucun rôle</option>
          <option v-for="r in data.roles.filter((x) => !x.archived || x.id === roleId)" :key="r.id" :value="r.id">{{ r.name }}{{ r.archived ? ' (archivé)' : '' }}</option>
        </select>
      </Field>
      <p class="small text-muted mt-8">{{ role?.description }}</p>
      <ul class="perm-summary">
        <li><Badge tone="success">{{ counts.herite }}</Badge> héritées du rôle</li>
        <li><Badge tone="primary">{{ counts.ajoute }}</Badge> ajoutées individuellement</li>
      </ul>
      <SaveBar :dirty="dirty && !saving" @reset="reset" @save="save" />
    </section>
    <section class="access-perms" :title="hasAccount ? undefined : NO_ACCOUNT">
      <EmployeePermissions v-model="extra" :role-permissions="rolePerms" :disabled="!hasAccount" />
    </section>
  </div>
</template>

<style scoped>
/* Matrice des permissions de l'employé : mêmes cases à cocher que les rôles (Paramètres › Rôles et permissions). */
.access-perms { min-width: 0; }
</style>
