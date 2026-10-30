<script setup>
import { computed, ref } from 'vue';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import { navigate } from '../../router/navigate';
import Segmented from '../../components/ui/Segmented.vue';
import SelectFilter from '../../components/ui/SelectFilter.vue';
import {
  addDays, addMonths, eachDay, endOfMonth, formatDate, formatDayMonth, formatMonth, overlaps, startOfMonth, startOfWeek, TODAY,
} from '../../utils/dates';
import { eventTargets } from '../../utils/leave';
import LeaveDetail from '../leave/LeaveDetail.vue';
import MonthGrid from './MonthGrid.vue';
import WeekBoard from './WeekBoard.vue';

/** Calendrier des absences de l'équipe (/calendrier) ou de l'utilisateur (/calendrier/perso). */
const props = defineProps({ param: { type: String, default: undefined } });

const store = useStore();
const data = useCompanyData();
const mode = ref('semaine');
const cursor = ref(TODAY);
const employeeId = ref('');
const departmentId = ref('');
const typeId = ref('');
const showPending = ref(true);
const openId = ref();

const scope = computed(() => (props.param === 'perso' ? 'perso' : 'equipe'));
const range = computed(() => {
  const weekStart = startOfWeek(cursor.value);
  return mode.value === 'mois'
    ? { start: startOfWeek(startOfMonth(cursor.value)), end: addDays(startOfWeek(endOfMonth(cursor.value)), 6) }
    : { start: weekStart, end: addDays(weekStart, 6) };
});
const days = computed(() => eachDay(range.value.start, range.value.end));

const me = computed(() => data.person(store.currentUser.id));
const people = computed(() => (scope.value === 'perso'
  ? data.people.filter((e) => e.id === store.currentUser.id)
  : data.activePeople.filter((e) => !employeeId.value || e.id === employeeId.value).filter((e) => !departmentId.value || e.departmentId === departmentId.value)));
const ids = computed(() => new Set(people.value.map((e) => e.id)));

const leaves = computed(() => data.requests.filter((r) =>
  ids.value.has(r.employeeId) && (r.status === 'approuve' || (showPending.value && r.status === 'en_attente'))
  && (!typeId.value || r.leaveTypeId === typeId.value) && overlaps(r.start, r.end, range.value.start, range.value.end)));
const events = computed(() => data.events.filter((e) => !e.archived && overlaps(e.start, e.end, range.value.start, range.value.end)
  && (scope.value === 'perso' ? !!me.value && eventTargets(e, me.value) : !departmentId.value || e.allCompany || e.departmentIds.includes(departmentId.value))));

const step = (n) => { cursor.value = mode.value === 'mois' ? addMonths(cursor.value, n) : addDays(cursor.value, 7 * n); };
const title = computed(() => (mode.value === 'mois' ? formatMonth(cursor.value) : `${formatDayMonth(range.value.start)} au ${formatDate(range.value.end)}`));
</script>

<template>
  <div class="page-header">
    <div class="page-header-top">
      <div class="ph-main">
        <span class="ph-icon" aria-hidden="true"><CalendarDays :size="20" :stroke-width="1.8" /></span>
        <div class="ph-text">
          <p class="ph-eyebrow">Application RH · Planning</p>
          <h1>{{ scope === 'perso' ? 'Mon calendrier' : 'Calendrier des absences' }}</h1>
          <p class="page-subtitle">{{ scope === 'perso' ? 'Vos absences, les jours fériés et les événements qui vous concernent.' : 'Absences de l’équipe, jours fériés et événements sur la période.' }}</p>
        </div>
      </div>
      <div class="page-actions">
        <Segmented :model-value="scope" label="Portée" :options="[{ value: 'equipe', label: 'Équipe' }, { value: 'perso', label: 'Moi' }]"
          @update:model-value="(s) => navigate(s === 'perso' ? 'calendrier/perso' : 'calendrier')" />
        <button type="button" class="btn btn-primary" @click="navigate('conges/demandes/nouvelle')"><Plus :size="15" aria-hidden="true" /> Demander un congé</button>
      </div>
    </div>
  </div>

  <div class="cal-toolbar">
    <button type="button" class="btn btn-pill" @click="cursor = TODAY">Aujourd’hui</button>
    <button type="button" class="icon-btn icon-btn-round" :aria-label="mode === 'mois' ? 'Mois précédent' : 'Semaine précédente'" @click="step(-1)"><ChevronLeft :size="16" /></button>
    <button type="button" class="icon-btn icon-btn-round" :aria-label="mode === 'mois' ? 'Mois suivant' : 'Semaine suivante'" @click="step(1)"><ChevronRight :size="16" /></button>
    <h2 class="cal-title" aria-live="polite">{{ title }}</h2>
    <span class="spacer" />
    <label for="cal-mode" class="sr-only">Affichage</label>
    <select id="cal-mode" v-model="mode" class="select-pill">
      <option value="semaine">Semaine</option>
      <option value="mois">Mois</option>
    </select>
  </div>

  <div class="filters filters-inline">
    <template v-if="scope === 'equipe'">
      <SelectFilter v-model="employeeId" label="Collaborateur"
        :options="data.activePeople.filter((e) => !departmentId || e.departmentId === departmentId).map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))" />
      <SelectFilter :model-value="departmentId" label="Département" :options="data.activeDepartments.map((d) => ({ value: d.id, label: d.name }))"
        @update:model-value="(v) => { departmentId = v; employeeId = ''; }" />
    </template>
    <SelectFilter v-model="typeId" label="Type d’absence" :options="data.leaveTypes.filter((t) => !t.archived).map((t) => ({ value: t.id, label: t.name }))" />
    <label class="check filter-check"><input v-model="showPending" type="checkbox" /> Inclure les demandes soumises</label>
  </div>

  <WeekBoard v-if="mode === 'semaine'" :days="days" :people="people" :requests="leaves" :events="events" @open="(id) => (openId = id)" />
  <MonthGrid v-else :days="days" :cursor="cursor" :leaves="leaves" :events="events" :show-names="scope === 'equipe'" @open="(id) => (openId = id)" />

  <div class="legend">
    <span><span class="legend-swatch approved" /> Approuvé</span>
    <span><span class="legend-swatch pending" /> Soumis</span>
    <span><span class="legend-swatch holiday" /> Jour férié</span>
    <span><span class="legend-swatch ev-info" /> Informatif</span>
    <span><span class="legend-swatch ev-warning" /> Avertissement</span>
    <span><span class="legend-swatch ev-block" /> Bloquant</span>
  </div>

  <LeaveDetail v-if="openId" :request-id="openId" @close="openId = undefined" />
</template>
