<script setup>
import { computed, ref } from 'vue';
import { Trash2 } from '@lucide/vue';
import { useStore } from '../../store';
import Alert from '../../components/ui/Alert.vue';
import Modal from '../../components/ui/Modal.vue';
import { employeeUsage } from '../../utils/org';

/**
 * Suppression définitive d'un dossier employé (backend). Refusée tant que le dossier est utilisé :
 * l'employé passe alors au statut « Inactif », son historique est conservé. Le compteur de numérotation n'est pas modifié.
 */
const props = defineProps({ employee: { type: Object, default: undefined } });
const emit = defineEmits(['close', 'deleted']);

const store = useStore();
const busy = ref(false);
const usage = computed(() => (props.employee ? employeeUsage(store.db, props.employee.id) : []));

async function confirm() {
  const e = props.employee;
  busy.value = true;
  try {
    await store.deleteEmployee(e.id);
    store.toast(`Dossier de ${e.firstName} ${e.lastName} supprimé`, 'info');
    emit('deleted', e);
    emit('close');
  } catch (err) {
    store.toast(`Suppression impossible : ${err.message}`, 'danger');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal :open="!!employee" size="sm" :title="employee ? `Supprimer ${employee.firstName} ${employee.lastName}` : ''" @close="emit('close')">
    <template v-if="employee">
      <Alert v-if="usage.length" tone="warning" title="Ce dossier est encore utilisé">
        {{ usage.join(', ') }}. Passez plutôt l’employé au statut « Inactif » : son historique est conservé.
      </Alert>
      <p v-else>
        Le dossier <span class="mono">{{ employee.matricule }}</span> sera définitivement supprimé.
        Le compteur de numérotation n’est pas modifié : ce matricule ne sera pas réattribué.
      </p>
    </template>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="emit('close')">{{ usage.length ? 'Fermer' : 'Annuler' }}</button>
      <button v-if="!usage.length" type="button" class="btn btn-danger" :disabled="busy" @click="confirm">
        <Trash2 :size="15" aria-hidden="true" /> {{ busy ? 'Suppression…' : 'Supprimer' }}
      </button>
    </template>
  </Modal>
</template>
