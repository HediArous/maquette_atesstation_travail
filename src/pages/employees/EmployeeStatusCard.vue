<script setup>
import { computed, ref } from 'vue';
import { BadgeCheck } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Alert from '../../components/ui/Alert.vue';
import EmployeeStatusBadge from '../../components/ui/EmployeeStatusBadge.vue';
import FormCard from '../../components/FormCard.vue';
import InlineField from '../../components/InlineField.vue';
import { legacyStatus, statusesApi } from '../../api/employees';
import { defaultProfile } from '../../utils/leave';

/**
 * Statut de l'employé (onglet Contrats) : statut paramétrable (/api/employee-statuses), modifiable sur place comme
 * l'onglet « Infos générales » et enregistré par la fiche (PATCH statusId). Tant qu'un contrat est en cours, les statuts
 * posés par les contrats ne se choisissent pas ici : un statut de sortie (suspendu, démission, licenciement, retraite,
 * décès) passe par « Suspendre » le contrat, et « Fin de contrat » est posé automatiquement à l'échéance.
 */
const props = defineProps({
  employee: { type: Object, required: true },
  /** Contrat en cours et actif de l'employé, s'il y en a un. */
  current: { type: Object, default: undefined },
});

// Mêmes ensembles que le backend (ContractService.SUSPENSION_STATUSES, ContractEndService).
const CONTRACT_DRIVEN = new Set(['SUSPENDU', 'DEMISSIONNAIRE', 'LICENCIE', 'RETRAITE', 'DECEDE', 'FIN_CONTRAT']);

const store = useStore();
const data = useCompanyData();
const statuses = ref([]);
const loadError = ref('');

async function loadStatuses() {
  try {
    statuses.value = await statusesApi.list();
    loadError.value = '';
  } catch (e) {
    loadError.value = `Statuts indisponibles : ${e.message}`;
  }
}
loadStatuses();

const statusOf = (id) => statuses.value.find((s) => String(s.id) === String(id));
const blocked = (s) => !!props.current && CONTRACT_DRIVEN.has(s?.type);
const options = computed(() => statuses.value.filter((s) => s.isActive || s.id === props.employee.statusId));

function validate(id) {
  const s = statusOf(id);
  if (!s) return 'Statut requis.';
  if (s.id !== props.employee.statusId && blocked(s)) return 'Posé par le contrat : utilisez « Suspendre » sur le contrat en cours.';
  return undefined;
}
async function save(id) {
  const s = statusOf(id);
  await store.saveEmployee(
    { ...props.employee, statusId: s.id, statusValue: s.value, status: legacyStatus(s.value) ?? props.employee.status },
    data.profile(props.employee.id) ?? defaultProfile(store.db, props.employee),
  );
  store.toast(`Statut mis à jour : ${s.value}`);
}
</script>

<template>
  <FormCard title="Statut de l’employé"
    :subtitle="current ? 'Un contrat est en cours : les statuts de sortie passent par la suspension du contrat.' : 'Statuts paramétrés dans Paramètres › Statuts des employés.'">
    <template #icon><BadgeCheck :size="16" /></template>
    <Alert v-if="loadError" tone="danger" class="mb-12">{{ loadError }} <button type="button" class="btn btn-sm btn-ghost" @click="loadStatuses">Réessayer</button></Alert>
    <div class="if-grid">
      <InlineField label="Statut" required :value="employee.statusId ?? ''" :empty="!employee.statusValue" :validate="validate" :save="save"
        hint="Cliquez pour modifier : Entrée enregistre, Échap annule.">
        <EmployeeStatusBadge :status="employee.status" :value="employee.statusValue" />
        <template #editor="{ draft, set, id }">
          <select :id="id" :value="draft" :disabled="!!loadError" @change="set(Number($event.target.value) || $event.target.value)">
            <option value="" disabled>Sélectionner un statut…</option>
            <option v-for="s in options" :key="s.id" :value="s.id" :disabled="blocked(s) && s.id !== employee.statusId">
              {{ s.value }}{{ blocked(s) && s.id !== employee.statusId ? ' — via le contrat' : '' }}
            </option>
          </select>
        </template>
      </InlineField>
    </div>
  </FormCard>
</template>
