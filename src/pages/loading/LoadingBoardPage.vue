<script setup>
import { computed, ref } from 'vue';
import { CalendarClock, Plus, Search } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import { navigate } from '../../router/navigate';
import Alert from '../../components/ui/Alert.vue';
import Badge from '../../components/ui/Badge.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import PersonCell from '../../components/ui/PersonCell.vue';
import SelectFilter from '../../components/ui/SelectFilter.vue';
import { addDays, eachDay, formatDate, formatDayMonth, formatRange, formatWeekdayShort, TODAY } from '../../utils/dates';
import { periodsOf, scheduleOn, uncoveredRanges } from '../../utils/org';
import PeriodModal from './PeriodModal.vue';
import PeriodsPanel from './PeriodsPanel.vue';

/** Tableau de chargement (RH-25) et planification des horaires par période (RH-26). */
const HORIZON = 28;
/** Couleurs des horaires dans la frise (attribuées dans l'ordre du paramétrage). */
const PALETTE = ['#2f5bd3', '#0f8a7a', '#8a4fd1', '#c2410c', '#0e7490', '#a16207'];

const store = useStore();
const data = useCompanyData();
const q = ref('');
const departmentId = ref('');
const onlyAlerts = ref(false);
const selected = ref();
const editing = ref();

const days = eachDay(TODAY, addDays(TODAY, HORIZON - 1));
const axis = days.filter((_, i) => i % 7 === 0);
const colorOf = (scheduleId) => PALETTE[Math.max(0, data.schedules.findIndex((s) => s.id === scheduleId)) % PALETTE.length];

const rows = computed(() => data.employees
  .filter((e) => e.scheduleMode === 'chargement' && e.status !== 'inactif')
  .map((e) => ({ e, now: scheduleOn(store.db, e), gaps: uncoveredRanges(store.db, e, TODAY, HORIZON), next: periodsOf(store.db, e.id).find((p) => p.start > TODAY) }))
  .filter(({ e }) => !q.value || `${e.firstName} ${e.lastName} ${e.matricule}`.toLowerCase().includes(q.value.toLowerCase()))
  .filter(({ e }) => !departmentId.value || e.departmentId === departmentId.value)
  .filter(({ gaps }) => !onlyAlerts.value || gaps.length > 0)
  .sort((a, b) => a.e.lastName.localeCompare(b.e.lastName, 'fr')));

const unplannedNow = computed(() => rows.value.filter((r) => r.now.unplanned).length);
const current = computed(() => data.employee(selected.value) ?? rows.value[0]?.e);

const cellOf = (e, d) => {
  const s = scheduleOn(store.db, e, d);
  return {
    cls: s.unplanned ? 'unplanned' : s.period ? '' : 'org',
    style: s.period ? { background: colorOf(s.schedule?.id) } : undefined,
    title: `${formatWeekdayShort(d)} ${formatDayMonth(d)} — ${s.unplanned ? 'Non planifié' : s.period ? `${s.period.label} (${s.schedule?.name})` : 'Horaire du département (avant la bascule)'}`,
  };
};
</script>

<template>
  <PageHeader eyebrow="Application RH · Temps de travail" title="Tableau de chargement"
    :subtitle="`${rows.length} employé(s) dont l’horaire est planifié par périodes · ${data.company.name}`">
    <template #icon><CalendarClock :size="20" :stroke-width="1.8" /></template>
    <template #actions>
      <button type="button" class="btn btn-primary" :disabled="rows.length === 0" @click="editing = { employeeId: current?.id }"><Plus :size="15" aria-hidden="true" /> Planifier une période</button>
    </template>
  </PageHeader>

  <Alert v-if="unplannedNow > 0" tone="warning" :title="`${unplannedNow} employé(s) non planifié(s) aujourd’hui`">
    Sans période en cours, un employé reste « Non planifié » : il ne revient jamais automatiquement à l’horaire de son département.
  </Alert>

  <div class="filters">
    <div class="filter filter-search">
      <label for="lb-q">Recherche</label>
      <div class="input-icon">
        <Search :size="14" aria-hidden="true" />
        <input id="lb-q" v-model="q" type="search" placeholder="Nom, matricule…" />
      </div>
    </div>
    <SelectFilter v-model="departmentId" label="Département" :options="data.activeDepartments.map((d) => ({ value: d.id, label: d.name }))" />
    <SelectFilter :model-value="onlyAlerts ? '1' : ''" label="Alertes" all-label="Tous les employés" :options="[{ value: '1', label: `Créneaux non planifiés (${HORIZON} j)` }]"
      @update:model-value="(v) => (onlyAlerts = v === '1')" />
  </div>

  <EmptyState v-if="rows.length === 0" title="Aucun employé en tableau de chargement"
    text="Passez un employé en mode tableau de chargement depuis sa fiche (action « Passer au tableau de chargement »).">
    <template #action><button type="button" class="btn btn-sm btn-ghost" @click="navigate('employes')">Voir les employés</button></template>
  </EmptyState>
  <div v-else class="table-wrap">
    <table class="table load-table">
      <thead>
        <tr>
          <th scope="col">Employé</th>
          <th scope="col">Aujourd’hui</th>
          <th scope="col">
            <span class="block">Frise des {{ HORIZON }} prochains jours</span>
            <span class="load-axis" aria-hidden="true"><span v-for="d in axis" :key="d">{{ formatDayMonth(d) }}</span></span>
          </th>
          <th scope="col">Alertes</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="{ e, now, gaps, next } in rows" :key="e.id" :class="['row-click', { 'row-selected': current?.id === e.id }]" @click="selected = e.id">
          <td><PersonCell :employee="e" :sub="`${data.department(e.departmentId)?.name} · depuis le ${e.loadingSince ? formatDate(e.loadingSince) : '—'}`" /></td>
          <td>
            <Badge v-if="now.unplanned" tone="danger">Non planifié</Badge>
            <template v-else-if="!now.period"><span class="person-name">Horaire du département</span><span class="block small text-muted">Jusqu’au {{ e.loadingSince && formatDate(addDays(e.loadingSince, -1)) }}</span></template>
            <template v-else><span class="person-name">{{ now.period.label }}</span><span class="block small text-muted">{{ now.schedule?.name }}</span></template>
            <span v-if="next" class="block small text-muted">Ensuite : {{ formatRange(next.start, next.end) }}</span>
          </td>
          <td>
            <span class="load-strip" role="img" :aria-label="`Planning de ${e.firstName} ${e.lastName} sur ${HORIZON} jours`">
              <span v-for="d in days" :key="d" :class="['load-cell', cellOf(e, d).cls]" :style="cellOf(e, d).style" :title="cellOf(e, d).title" />
            </span>
          </td>
          <td>
            <Badge v-if="gaps.length === 0" tone="success">Couvert</Badge>
            <Badge v-else tone="warning">{{ gaps.length }} créneau(x) non planifié(s)</Badge>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <PeriodsPanel v-if="current && current.scheduleMode === 'chargement'" :employee="current" :horizon="HORIZON" :color-of="colorOf"
    @add="editing = { employeeId: current.id }" @edit="(period) => (editing = { period })" />

  <PeriodModal :state="editing" @close="editing = undefined" />
</template>
