<script setup>
import { computed, ref } from 'vue';
import { Scale, Search } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import { navigate } from '../../router/navigate';
import EmptyState from '../../components/ui/EmptyState.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import PersonCell from '../../components/ui/PersonCell.vue';
import SelectFilter from '../../components/ui/SelectFilter.vue';
import { formatDays } from '../../utils/dates';
import { balanceTypes, getAnnualBalance, getBalance } from '../../utils/leave';
import { dayHours, formatDaysHours, scheduleOf } from '../../utils/hours';

/** Vue d'ensemble des soldes de congé. */
const store = useStore();
const data = useCompanyData();
const q = ref('');
const departmentId = ref('');

const balanceInfo = computed(() => balanceTypes(store.db, data.company.id));
const ref_ = computed(() => balanceInfo.value.ref);
const types = computed(() => balanceInfo.value.own);

const list = computed(() => data.activePeople
  .filter((p) => !q.value || `${p.firstName} ${p.lastName} ${p.matricule}`.toLowerCase().includes(q.value.toLowerCase()))
  .filter((p) => !departmentId.value || p.departmentId === departmentId.value)
  .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr')));

const annualOf = (id) => getAnnualBalance(store.db, id);
const perDayOf = (id) => dayHours(scheduleOf(store.db, id));
</script>

<template>
  <PageHeader eyebrow="Application RH · Congés" title="Soldes de congé"
    :subtitle="`Solde annuel = quota « ${ref_?.name ?? '—'} » + report − tous les congés imputés. Les types hors solde à plafond propre ont leur colonne.`">
    <template #icon><Scale :size="20" :stroke-width="1.8" /></template>
  </PageHeader>
  <div class="filters">
    <div class="filter filter-search">
      <label for="bal-q">Recherche</label>
      <div class="input-icon"><Search :size="14" aria-hidden="true" /><input id="bal-q" v-model="q" type="search" placeholder="Nom, matricule…" /></div>
    </div>
    <SelectFilter v-model="departmentId" label="Département" :options="data.activeDepartments.map((d) => ({ value: d.id, label: d.name }))" />
  </div>
  <p class="result-count">{{ list.length }} employé{{ list.length > 1 ? 's' : '' }}</p>
  <EmptyState v-if="list.length === 0" title="Aucun employé" :text="data.employees.length === 0 ? 'Les soldes apparaissent dès qu’un employé est créé.' : 'Modifiez les filtres.'" />
  <div v-else class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th scope="col">Employé</th>
          <th scope="col">Horaire</th>
          <th scope="col" class="num">Solde annuel</th>
          <th v-for="t in types" :key="t.id" scope="col" class="num">{{ t.name }} <span class="th-sub">plafond</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in list" :key="p.id" class="row-click" @click="navigate(`employes/${p.id}`)">
          <td><PersonCell :employee="p" link :sub="p.departmentName" /></td>
          <td>{{ data.schedule(data.profile(p.id)?.scheduleId)?.name }}</td>
          <td class="num">
            <strong :class="annualOf(p.id).available < 0 ? 'text-danger' : 'text-primary'">{{ formatDaysHours(annualOf(p.id).available, perDayOf(p.id)) }}</strong>
            <span class="block small text-muted">sur {{ formatDays(annualOf(p.id).acquired) }}{{ annualOf(p.id).pending ? ` · ${formatDaysHours(annualOf(p.id).pending, perDayOf(p.id))} en attente` : '' }}</span>
          </td>
          <td v-for="t in types" :key="t.id" class="num">
            <strong :class="getBalance(store.db, p.id, t.id).available < 0 ? 'text-danger' : ''">{{ formatDays(getBalance(store.db, p.id, t.id).available) }}</strong>
            <span class="block small text-muted">sur {{ formatDays(getBalance(store.db, p.id, t.id).acquired) }}{{ getBalance(store.db, p.id, t.id).pending ? ` · ${formatDays(getBalance(store.db, p.id, t.id).pending)} en attente` : '' }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
