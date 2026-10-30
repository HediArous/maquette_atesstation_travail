<script setup>
import { computed, ref } from 'vue';
import { CornerDownRight, Pencil, Plus } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Alert from '../../components/ui/Alert.vue';
import Badge from '../../components/ui/Badge.vue';
import PersonCell from '../../components/ui/PersonCell.vue';
import ArchivableTable from '../../components/ArchivableTable.vue';
import { circuitForDepartment } from '../../utils/org';
import DepartmentModal from './DepartmentModal.vue';

/** Départements et sous-départements (RH-14) : responsable, horaire organisationnel, circuit obligatoire. */
const store = useStore();
const data = useCompanyData();
const editing = ref();

// Arborescence : chaque département suivi de ses sous-départements.
const rows = computed(() => data.departments.flatMap((d) => [d, ...data.subDepartments(d.id)]));
const staff = (d) => data.employees.filter((e) => (d.parentId ? e.subDepartmentId === d.id : e.departmentId === d.id) && e.status !== 'inactif');
const noCircuit = computed(() => data.activeDepartments.filter((d) => !circuitForDepartment(store.db, d.id)));

const columns = [
  { key: 'name', header: 'Nom' },
  { key: 'code', header: 'Code' },
  { key: 'head', header: 'Responsable' },
  { key: 'schedule', header: 'Horaire' },
  { key: 'circuit', header: 'Circuit' },
  { key: 'staff', header: 'Effectif', className: 'num' },
];

function archiveBlockedBy(d) {
  const n = staff(d).length;
  if (n > 0) return `« ${d.name} » compte encore ${n} employé(s) actif(s) : réaffectez-les avant de l’archiver.`;
  if (!d.parentId && data.subDepartments(d.id).some((s) => !s.archived)) return `Archivez d’abord les sous-départements de « ${d.name} ».`;
  return undefined;
}

const scheduleOf = (d) => data.schedule(d.scheduleId);
const parentScheduleOf = (d) => data.schedule(data.department(d.parentId)?.scheduleId);
const circuitOf = (d) => circuitForDepartment(store.db, d.id);
</script>

<template>
  <Alert v-if="store.departmentsStatus === 'error'" tone="danger" title="Départements non chargés">
    {{ store.departmentsError }} <button type="button" class="link-btn" @click="store.loadDepartments()">Réessayer</button>
  </Alert>
  <Alert v-else-if="noCircuit.length > 0" tone="warning" title="Département sans circuit d’approbation">
    {{ noCircuit.map((d) => d.name).join(', ') }} : aucun employé ne peut y être créé ni muté tant qu’un circuit actif ne lui est pas affecté (Paramètres › Circuits d’approbation).
  </Alert>
  <ArchivableTable title="Départements" add-label="Ajouter un département" collection="departments" :rows="rows" :columns="columns" :name-of="(d) => d.name"
    description="Arborescence de la société. Chaque département a un circuit d’approbation unique, hérité par ses sous-départements ; l’horaire d’un sous-département remplace celui de son département."
    :row-class-name="(d) => (d.parentId ? 'row-sub' : '')" :archive-blocked-by="archiveBlockedBy" @add="editing = {}">
    <template #cell-name="{ row: d }">
      <span v-if="d.parentId" class="sub-dep"><CornerDownRight :size="13" aria-hidden="true" /> {{ d.name }}</span>
      <span v-else class="person-name">{{ d.name }}</span>
    </template>
    <template #cell-code="{ row: d }"><span class="mono">{{ d.code }}</span></template>
    <template #cell-head="{ row: d }"><PersonCell :employee="data.employee(d.headId)" /></template>
    <template #cell-schedule="{ row: d }">
      <span v-if="scheduleOf(d)" class="small">{{ scheduleOf(d).name }}</span>
      <span v-else-if="d.parentId && parentScheduleOf(d)" class="small text-muted">Hérité : {{ parentScheduleOf(d).name }}</span>
      <span v-else class="small text-muted">Aucun</span>
    </template>
    <template #cell-circuit="{ row: d }">
      <span v-if="d.parentId" class="small text-muted">{{ circuitOf(d) ? `Hérité : ${circuitOf(d).name}` : 'Hérité : aucun' }}</span>
      <span v-else-if="circuitOf(d)" class="small">{{ circuitOf(d).name }}</span>
      <span v-else-if="d.archived" class="text-muted">—</span>
      <Badge v-else tone="danger">Aucun circuit</Badge>
    </template>
    <template #cell-staff="{ row: d }">{{ staff(d).length }}</template>
    <template #row-actions="{ row: d }">
      <button v-if="!d.parentId && !d.archived" type="button" class="btn btn-sm btn-ghost" :aria-label="`Ajouter un sous-département à ${d.name}`" @click="editing = { parentId: d.id }"><Plus :size="13" aria-hidden="true" /> Sous-département</button>
      <button type="button" class="btn btn-sm btn-ghost" :aria-label="`Modifier ${d.name}`" @click="editing = { dep: d }"><Pencil :size="13" aria-hidden="true" /> Modifier</button>
    </template>
  </ArchivableTable>
  <DepartmentModal :state="editing" @close="editing = undefined" />
</template>
