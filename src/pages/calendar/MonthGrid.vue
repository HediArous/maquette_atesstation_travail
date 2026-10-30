<script setup>
import { computed } from 'vue';
import { useCompanyData } from '../../store/companyData';
import { holidayFallsOn } from '../../utils/org';
import { formatMonth, isoWeekday, TODAY } from '../../utils/dates';

/** Grille du mois : une cellule par jour, avec les absences, jours fériés et événements. */
const props = defineProps({
  days: { type: Array, required: true },
  cursor: { type: String, required: true },
  leaves: { type: Array, required: true },
  events: { type: Array, required: true },
  showNames: Boolean,
});
const emit = defineEmits(['open']);

const WEEKDAYS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];

const data = useCompanyData();
const month = computed(() => props.cursor.slice(0, 7));
// Jours fériés actifs de la période (annuels : même jour et même mois chaque année).
const holidays = computed(() => new Map(props.days.flatMap((d) => {
  const h = data.holidays.find((x) => !x.archived && holidayFallsOn(x, d));
  return h ? [[d, h.name]] : [];
})));

const leavesOn = (d) => props.leaves.filter((r) => r.start <= d && r.end >= d);
const eventsOn = (d) => props.events.filter((e) => e.start <= d && e.end >= d);
const personLabel = (r) => {
  const p = data.person(r.employeeId);
  return `${p?.firstName} ${p?.lastName}`;
};
</script>

<template>
  <div class="month-wrap">
    <div class="month-grid" role="grid" :aria-label="formatMonth(cursor)">
      <div v-for="d in WEEKDAYS" :key="d" class="month-head" role="columnheader">{{ d }}</div>
      <div v-for="d in days" :key="d" role="gridcell"
        :class="['month-cell', { other: d.slice(0, 7) !== month, weekend: isoWeekday(d) >= 6, holiday: holidays.has(d), today: d === TODAY }]">
        <div class="month-cell-head">
          <span class="month-day">{{ Number(d.slice(8)) }}</span>
          <span v-if="holidays.has(d)" class="holiday-label" :title="holidays.get(d)">{{ holidays.get(d) }}</span>
        </div>
        <a v-for="e in eventsOn(d)" :key="e.id" href="/evenements" :class="`cal-chip event effect-${e.effect}`" :title="e.description">{{ e.name }}</a>
        <template v-if="isoWeekday(d) < 6 && !holidays.has(d)">
          <button v-for="r in leavesOn(d).slice(0, 3)" :key="r.id" type="button" :class="['cal-chip', 'leave', { pending: r.status === 'en_attente' }]"
            :aria-label="`${personLabel(r)}, ${data.leaveType(r.leaveTypeId)?.name}, ${r.status === 'en_attente' ? 'soumis' : 'approuvé'}`" @click="emit('open', r.id)">
            {{ showNames ? `${data.person(r.employeeId)?.firstName} ${data.person(r.employeeId)?.lastName[0]}.` : data.leaveType(r.leaveTypeId)?.name }}
          </button>
          <span v-if="leavesOn(d).length > 3" class="more">+{{ leavesOn(d).length - 3 }}</span>
        </template>
      </div>
    </div>
  </div>
</template>
