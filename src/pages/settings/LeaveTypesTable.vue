<script setup>
import { computed } from 'vue';
import { Pencil, Star } from '@lucide/vue';
import { useCompanyData } from '../../store/companyData';
import Badge from '../../components/ui/Badge.vue';
import ArchivableTable from '../../components/ArchivableTable.vue';
import YesNo from '../../components/YesNo.vue';

/** Tableau des types de congé d'un même régime (imputés sur le solde annuel, ou hors solde avec plafond propre éventuel). */
const props = defineProps({
  title: { type: String, required: true },
  addLabel: { type: String, required: true },
  description: { type: String, required: true },
  emptyText: { type: String, required: true },
  rows: { type: Array, required: true },
  /** Affiche la colonne « Plafond propre » (types hors solde annuel). */
  withCap: Boolean,
});
const emit = defineEmits(['add', 'edit']);

const data = useCompanyData();
const columns = computed(() => [
  { key: 'name', header: 'Type' },
  ...(props.withCap ? [{ key: 'cap', header: 'Plafond propre' }] : []),
  { key: 'code', header: 'Code' },
  { key: 'unit', header: 'Unité' },
  { key: 'paid', header: 'Rémunéré' },
  { key: 'proof', header: 'Justificatif conseillé' },
  { key: 'half', header: 'Demi-journée' },
  { key: 'count', header: 'Demandes', className: 'num' },
]);

const quotaOf = (t) => data.leaveRules.find((r) => r.leaveTypeId === t.id && !r.archived)?.annualQuota;
const count = (t) => data.requests.filter((r) => r.leaveTypeId === t.id).length;
</script>

<template>
  <ArchivableTable :title="title" :add-label="addLabel" collection="leaveTypes" :description="description" :rows="rows" :columns="columns"
    :name-of="(t) => t.name" :empty-text="emptyText" @add="emit('add')">
    <template #cell-name="{ row: t }">
      <span class="type-tag">
        <span class="type-dot" :style="{ background: t.color }" aria-hidden="true" />
        <span class="person-name">{{ t.name }}</span>
        <Badge v-if="t.annualReference" tone="primary"><template #icon><Star :size="11" aria-hidden="true" /></template>Référence du solde</Badge>
      </span>
    </template>
    <template #cell-cap="{ row: t }">
      <template v-if="t.tracked && quotaOf(t) != null">{{ String(quotaOf(t)).replace('.', ',') }} j/an</template>
      <span v-else class="text-muted">Sans plafond</span>
    </template>
    <template #cell-code="{ row: t }"><span class="mono">{{ t.code }}</span></template>
    <template #cell-unit="{ row: t }"><span v-if="t.unit === 'heure'" class="unit-chip hours">Heures</span><span v-else class="unit-chip">Jours</span></template>
    <template #cell-paid="{ row: t }"><YesNo :value="t.paid" /></template>
    <template #cell-proof="{ row: t }"><YesNo :value="t.requiresProof" /></template>
    <template #cell-half="{ row: t }"><YesNo :value="t.allowHalfDay" /></template>
    <template #cell-count="{ row: t }">{{ count(t) }}</template>
    <template #row-actions="{ row: t }">
      <button type="button" class="btn btn-sm btn-ghost" :aria-label="`Modifier ${t.name}`" @click="emit('edit', t)"><Pencil :size="13" aria-hidden="true" /> Modifier</button>
    </template>
  </ArchivableTable>
</template>
