<script setup>
import { computed, ref, watch } from 'vue';
import { useStore } from '../../store';
import Alert from '../../components/ui/Alert.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import { useCoreAccountOptions } from './coreAccounts';

/**
 * Liaison rapide d'un employé (ex. le responsable N+1 choisi dans le formulaire) à un compte du Core Tenant, sans quitter
 * le formulaire en cours : même contrôle que l'onglet Accès (compte actif, non lié à un autre employé).
 */
const props = defineProps({
  /** Employé à lier ; vide = fenêtre fermée. */
  employee: { type: Object, default: undefined },
});
const emit = defineEmits(['close', 'linked']);

const store = useStore();
const coreUserId = ref('');
const saving = ref(false);
const error = ref('');
const options = useCoreAccountOptions(coreUserId, () => props.employee?.id);
const name = computed(() => (props.employee ? `${props.employee.firstName} ${props.employee.lastName}` : ''));

watch(() => props.employee?.id, (id) => {
  coreUserId.value = '';
  error.value = '';
  if (id && store.coreUsersStatus !== 'ready') store.loadCoreUsers();
});

async function save() {
  if (!coreUserId.value) { error.value = 'Choisissez un compte.'; return; }
  saving.value = true;
  error.value = '';
  try {
    await store.linkCoreAccount(props.employee.id, coreUserId.value);
    store.toast(`Compte utilisateur associé à ${name.value}`);
    emit('linked', props.employee.id);
    emit('close');
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Modal :open="!!employee" size="sm" :title="`Associer un compte à ${name}`" @close="saving || emit('close')">
    <p class="small text-muted lca-intro">Le compte Core Tenant permet à {{ name }} de se connecter et de valider les demandes de congé de ses collaborateurs.</p>
    <Alert v-if="store.coreUsersStatus === 'error'" tone="warning" title="Comptes du Core Tenant indisponibles" class="mb-12">
      {{ store.coreUsersError }} <button type="button" class="link-btn" @click="store.loadCoreUsers()">Réessayer</button>
    </Alert>
    <Field v-slot="{ id }" label="Compte Core Tenant" required :error="error">
      <select :id="id" v-model="coreUserId" :disabled="store.coreUsersStatus === 'loading' && !options.length">
        <option value="">{{ store.coreUsersStatus === 'loading' ? 'Chargement des comptes…' : 'Choisir un compte' }}</option>
        <option v-for="o in options" :key="o.id" :value="o.id" :disabled="o.disabled">{{ o.label }}</option>
      </select>
    </Field>
    <template #footer>
      <button type="button" class="btn btn-ghost" :disabled="saving" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="saving || !coreUserId" @click="save">{{ saving ? 'Association…' : 'Associer le compte' }}</button>
    </template>
  </Modal>
</template>

<style scoped>
.lca-intro { margin: 0 0 12px; }
</style>
