<script setup>
import { ref } from 'vue';
import { Link2, Pencil } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Alert from '../../components/ui/Alert.vue';
import ArchivedBadge from '../../components/ui/ArchivedBadge.vue';
import Avatar from '../../components/ui/Avatar.vue';
import Badge from '../../components/ui/Badge.vue';
import ArchivableTable from '../../components/ArchivableTable.vue';
import FunctionKindBadge from './FunctionKindBadge.vue';
import FunctionModal from './FunctionModal.vue';

const store = useStore();
const data = useCompanyData();
const editing = ref();
const holders = (f) => data.employees.filter((e) => e.functionId === f.id && e.status !== 'inactif');

const columns = [
  { key: 'name', header: 'Fonction' },
  { key: 'code', header: 'Code' },
  { key: 'interim', header: 'Intérim' },
  { key: 'department', header: 'Département' },
  { key: 'holders', header: 'Titulaires' },
  { key: 'minPresent', header: 'Présence min. / fonction liée' },
];
</script>

<template>
  <Alert v-if="store.functionsStatus === 'error'" tone="danger" title="Fonctions non chargées">
    {{ store.functionsError }} <button type="button" class="link-btn" @click="store.loadFunctions()">Réessayer</button>
  </Alert>
  <ArchivableTable title="Fonctions" add-label="Ajouter une fonction" collection="functions" :rows="data.functions" :columns="columns" :name-of="(f) => f.name"
    description="Les règles d’intérim ne s’appliquent qu’aux fonctions qui les activent : solo (une seule personne, suppléance par une fonction liée) ou groupe (présence minimale). Les règles de présence se paramètrent dans « Règles et quotas »."
    @add="editing = {}">
    <template #cell-name="{ row: f }"><span class="person-name">{{ f.name }}</span></template>
    <template #cell-code="{ row: f }"><span class="mono">{{ f.code }}</span></template>
    <template #cell-interim="{ row: f }">
      <FunctionKindBadge v-if="f.interim" :kind="f.kind" />
      <span v-else class="text-muted small">Sans règle</span>
    </template>
    <template #cell-department="{ row: f }">{{ data.department(f.departmentId)?.name ?? '—' }} <ArchivedBadge v-if="data.department(f.departmentId)?.archived" /></template>
    <template #cell-holders="{ row: f }">
      <span class="holders">
        <span class="avatar-stack"><Avatar v-for="e in holders(f).slice(0, 4)" :key="e.id" :employee="e" :size="22" /></span>
        <span class="small">
          <span v-if="holders(f).length === 0" class="text-muted">Aucun</span>
          <template v-else-if="holders(f).length === 1">{{ holders(f)[0].firstName }} {{ holders(f)[0].lastName }}</template>
          <template v-else>{{ holders(f).length }} personnes</template>
        </span>
        <Badge v-if="f.interim && f.kind === 'solo' && holders(f).length > 1" tone="warning">{{ holders(f).length }} titulaires pour une fonction solo</Badge>
      </span>
    </template>
    <template #cell-minPresent="{ row: f }">
      <span v-if="f.interim && f.kind === 'groupe' && f.minPresent != null" class="small">{{ f.minPresent }} </span>
      <span v-else-if="f.interim && f.kind === 'solo' && data.linkedFunction(f)" class="linked-fn small" :title="`Suppléance assurée par la fonction solo « ${data.linkedFunction(f).name} »`">
        <Link2 :size="13" aria-hidden="true" class="text-muted" /><span class="sr-only">Fonction liée :</span>
        <span class="person-name">{{ data.linkedFunction(f).name }}</span>
        <span class="mono text-muted">{{ data.linkedFunction(f).code }}</span>
        <ArchivedBadge v-if="data.linkedFunction(f).archived" />
      </span>
      <span v-else class="text-muted small">—</span>
    </template>
    <template #row-actions="{ row: f }">
      <button type="button" class="btn btn-sm btn-ghost" :aria-label="`Modifier ${f.name}`" @click="editing = { fn: f }"><Pencil :size="13" aria-hidden="true" /> Modifier</button>
    </template>
  </ArchivableTable>
  <FunctionModal :state="editing" @close="editing = undefined" />
</template>

<style scoped>
.linked-fn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
