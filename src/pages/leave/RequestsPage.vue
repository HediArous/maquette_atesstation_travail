<script setup>
import { computed, ref } from 'vue';
import { ClipboardList, Plus, RotateCcw } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import { navigate } from '../../router/navigate';
import Card from '../../components/ui/Card.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import SelectFilter from '../../components/ui/SelectFilter.vue';
import Tabs from '../../components/ui/Tabs.vue';
import { overlaps } from '../../utils/dates';
import LeaveDetail from './LeaveDetail.vue';
import LeaveForm from './LeaveForm.vue';
import LeaveTable from './LeaveTable.vue';

/** Demandes de congé : /conges/demandes[/nouvelle|/:id]. */
const props = defineProps({ param: { type: String, default: undefined } });

const store = useStore();
const data = useCompanyData();
const view = ref('toutes');
const from = ref('');
const to = ref('');
const employeeId = ref('');
const departmentId = ref('');
const typeId = ref('');
const status = ref('');

const formOpen = computed(() => props.param === 'nouvelle');
const detailId = computed(() => (props.param && props.param !== 'nouvelle' ? props.param : undefined));

const mine = (r) => r.steps.some((s) => s.status === 'en_attente' && store.isStepApprover(s));
const toProcess = computed(() => data.requests.filter((r) => r.status === 'en_attente' && mine(r)));
const myCount = computed(() => data.requests.filter((r) => r.employeeId === store.currentUser.id).length);

const filtered = computed(() => {
  let list = data.requests;
  if (view.value === 'a_traiter') list = list.filter((r) => r.status === 'en_attente' && mine(r));
  if (view.value === 'miennes') list = list.filter((r) => r.employeeId === store.currentUser.id);
  return list
    .filter((r) => (!from.value && !to.value) || overlaps(r.start, r.end, from.value || '0000-01-01', to.value || '9999-12-31'))
    .filter((r) => !employeeId.value || r.employeeId === employeeId.value)
    .filter((r) => !departmentId.value || data.person(r.employeeId)?.departmentId === departmentId.value)
    .filter((r) => !typeId.value || r.leaveTypeId === typeId.value)
    .filter((r) => !status.value || r.status === status.value)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});

const hasFilters = computed(() => from.value || to.value || employeeId.value || departmentId.value || typeId.value || status.value);
function reset() { from.value = ''; to.value = ''; employeeId.value = ''; departmentId.value = ''; typeId.value = ''; status.value = ''; }
</script>

<template>
  <PageHeader eyebrow="Application RH · Congés" title="Congés" subtitle="Suivi des demandes, décisions et circuits d’approbation.">
    <template #icon><ClipboardList :size="20" :stroke-width="1.8" /></template>
    <template #actions>
      <button type="button" class="btn btn-primary" @click="navigate('conges/demandes/nouvelle')"><Plus :size="16" aria-hidden="true" /> Nouvelle demande</button>
    </template>
  </PageHeader>

  <Card flush>
    <Tabs v-model="view" label="Vues des demandes" :tabs="[
      { id: 'toutes', label: 'Toutes les demandes', count: data.requests.length },
      { id: 'a_traiter', label: 'À traiter par moi', count: toProcess.length },
      { id: 'miennes', label: 'Mes demandes', count: myCount },
    ]" />
    <div class="filters">
      <div class="filter">
        <label for="lf-from">Du</label>
        <input id="lf-from" v-model="from" type="date" />
      </div>
      <div class="filter">
        <label for="lf-to">Au</label>
        <input id="lf-to" v-model="to" type="date" :min="from || undefined" />
      </div>
      <SelectFilter v-model="employeeId" label="Employé" :options="data.people.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))" />
      <SelectFilter v-model="departmentId" label="Département" :options="data.activeDepartments.map((d) => ({ value: d.id, label: d.name }))" />
      <SelectFilter v-model="typeId" label="Type" :options="data.leaveTypes.map((t) => ({ value: t.id, label: t.name + (t.archived ? ' (archivé)' : '') }))" />
      <SelectFilter v-model="status" label="Statut"
        :options="[{ value: 'en_attente', label: 'En attente' }, { value: 'approuve', label: 'Approuvée' }, { value: 'refuse', label: 'Refusée' }, { value: 'annule', label: 'Annulée' }]" />
      <button v-if="hasFilters" type="button" class="btn btn-sm btn-ghost filter-reset" @click="reset"><RotateCcw :size="14" aria-hidden="true" /> Réinitialiser</button>
    </div>
    <p class="result-count">{{ filtered.length }} demande{{ filtered.length > 1 ? 's' : '' }}</p>
    <LeaveTable :requests="filtered" :empty-text="view === 'a_traiter' && !hasFilters ? 'Rien à traiter pour le moment : toutes vos validations sont à jour.' : ''"
      @open="(id) => navigate(`conges/demandes/${id}`)" />
  </Card>

  <LeaveForm :open="formOpen" @close="navigate('conges/demandes')" @created="(id) => navigate(`conges/demandes/${id}`)" />
  <LeaveDetail v-if="detailId" :request-id="detailId" @close="navigate('conges/demandes')" />
</template>
