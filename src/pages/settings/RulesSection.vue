<script setup>
import { computed, ref } from 'vue';
import { useStore } from '../../store';
import { newId } from '../../store/ids';
import { useCompanyData } from '../../store/companyData';
import Badge from '../../components/ui/Badge.vue';
import ArchivableTable from '../../components/ArchivableTable.vue';
import QuickAddModal from '../../components/QuickAddModal.vue';

/** Règles et quotas : quota annuel, acquisition, report et préavis par type de congé. */
const store = useStore();
const data = useCompanyData();
const open = ref(false);

const types = computed(() => data.leaveTypes.filter((t) => !t.archived));
const columns = [
  { key: 'label', header: 'Règle' },
  { key: 'type', header: 'Type' },
  { key: 'quota', header: 'Quota annuel', className: 'num' },
  { key: 'accrual', header: 'Acquisition' },
  { key: 'carry', header: 'Report max', className: 'num' },
  { key: 'notice', header: 'Prévenance', className: 'num' },
  { key: 'scope', header: 'Portée' },
];
const fields = computed(() => [
  { key: 'label', label: 'Libellé', type: 'text', required: true },
  { key: 'leaveTypeId', label: 'Type de congé', type: 'select', options: types.value.map((t) => ({ value: t.id, label: t.name })) },
  { key: 'annualQuota', label: 'Quota annuel (jours)', type: 'number' },
  { key: 'maxCarryOver', label: 'Report maximum (jours)', type: 'number' },
  { key: 'minNoticeDays', label: 'Délai de prévenance (jours)', type: 'number' },
  { key: 'accrual', label: 'Mode d’acquisition', type: 'text' },
  { key: 'scope', label: 'Portée', type: 'text' },
]);
const initial = computed(() => ({ label: '', leaveTypeId: types.value[0]?.id ?? '', annualQuota: '0', accrual: 'Annuel', maxCarryOver: '0', minNoticeDays: '0', scope: 'Tous les employés' }));

function add(v) {
  store.addItem('leaveRules', {
    id: newId('r'), companyId: store.companyId, label: String(v.label), leaveTypeId: String(v.leaveTypeId), annualQuota: Number(v.annualQuota),
    accrual: String(v.accrual), maxCarryOver: Number(v.maxCarryOver), minNoticeDays: Number(v.minNoticeDays), scope: String(v.scope),
  });
  store.toast('Règle ajoutée');
}
</script>

<template>
  <ArchivableTable title="Règles et quotas" add-label="Ajouter une règle" collection="leaveRules" :rows="data.leaveRules" :columns="columns" :name-of="(r) => r.label"
    description="Quota annuel, mode d’acquisition, report maximal et délai de prévenance de chaque type de congé." @add="open = true">
    <template #cell-label="{ row: r }"><span class="person-name">{{ r.label }}</span></template>
    <template #cell-type="{ row: r }">{{ data.leaveType(r.leaveTypeId)?.name }}</template>
    <template #cell-quota="{ row: r }"><Badge v-if="r.annualQuota == null" tone="neutral">Sans plafond</Badge><template v-else>{{ String(r.annualQuota).replace('.', ',') }} j</template></template>
    <template #cell-accrual="{ row: r }"><span class="small">{{ r.accrual }}</span></template>
    <template #cell-carry="{ row: r }">{{ r.maxCarryOver }} j</template>
    <template #cell-notice="{ row: r }">{{ r.minNoticeDays }} j</template>
    <template #cell-scope="{ row: r }"><span class="small">{{ r.scope }}</span></template>
  </ArchivableTable>
  <QuickAddModal :open="open" title="Nouvelle règle" :fields="fields" :initial="initial" @close="open = false" @submit="add" />
</template>
