<script setup>
import { computed } from 'vue';
import { Check, Clock } from '@lucide/vue';
import { useCompanyData } from '../../store/companyData';
import { holidayFallsOn } from '../../utils/org';
import Avatar from '../../components/ui/Avatar.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import { formatRange, formatWeekdayShort, isoWeekday, TODAY } from '../../utils/dates';
import { formatRequestDuration } from '../../utils/hours';
import { eventTargets } from '../../utils/leave';

/** Planning par collaborateur : une ligne par personne, des blocs d'absence sur plusieurs jours. */
const props = defineProps({
  days: { type: Array, required: true },
  people: { type: Array, required: true },
  requests: { type: Array, required: true },
  events: { type: Array, required: true },
  emptyText: { type: String, default: '' },
});
const emit = defineEmits(['open']);

const data = useCompanyData();

const plural = (n) => `${String(n).replace('.', ',')} jour${n > 1 ? 's' : ''}`;

const first = computed(() => props.days[0]);
const last = computed(() => props.days[props.days.length - 1]);
// Jours fériés actifs de la période (annuels : même jour et même mois chaque année).
const holidays = computed(() => new Map(props.days.flatMap((d) => {
  const h = data.holidays.find((x) => !x.archived && holidayFallsOn(x, d));
  return h ? [[d, h.name]] : [];
})));
const cols = computed(() => `minmax(150px, 190px) repeat(${props.days.length}, minmax(84px, 1fr))`);
const weekEvents = computed(() => props.events.filter((e) => e.start <= last.value && e.end >= first.value));

const span = (start, end) => {
  const a = Math.max(0, props.days.indexOf(start < first.value ? first.value : start));
  const b = props.days.indexOf(end > last.value ? last.value : end);
  return `${a + 2} / ${b + 3}`;
};
const dayClass = (d) => `${isoWeekday(d) >= 6 ? 'off' : ''} ${holidays.value.has(d) ? 'holiday' : ''} ${d === TODAY ? 'today' : ''}`;
const blockedFor = (p, d) => props.events.some((e) => e.effect === 'block' && e.start <= d && e.end >= d && eventTargets(e, p));
const requestsOf = (p) => props.requests.filter((r) => r.employeeId === p.id && r.start <= last.value && r.end >= first.value);
</script>

<template>
  <div class="wb-scroll">
    <div class="wb" role="table" :aria-label="`Planning du ${formatRange(first, last)}`" :style="{ '--wb-cols': cols }">
      <div class="wb-row wb-head" role="row">
        <span class="wb-name" role="columnheader"><span class="sr-only">Collaborateur</span></span>
        <span v-for="d in days" :key="d" role="columnheader" :class="['wb-day', dayClass(d)]" :title="holidays.get(d)">
          <span class="wb-dow">{{ formatWeekdayShort(d) }}</span>
          <span class="wb-date">{{ Number(d.slice(8)) }}</span>
          <span v-if="holidays.has(d)" class="wb-holiday">{{ holidays.get(d) }}</span>
        </span>
      </div>

      <div v-if="weekEvents.length > 0" class="wb-row wb-events" role="row">
        <span class="wb-name wb-muted" role="rowheader" :style="{ gridRow: `1 / ${weekEvents.length + 1}` }">Événements</span>
        <span v-for="(d, i) in days" :key="d" :class="['wb-cell', dayClass(d)]" :style="{ gridColumn: i + 2, gridRow: `1 / ${weekEvents.length + 1}` }" />
        <a v-for="(e, i) in weekEvents" :key="e.id" href="/evenements" :class="`wb-event effect-${e.effect}`"
          :style="{ gridColumn: span(e.start, e.end), gridRow: i + 1 }" :title="`${e.name} — ${e.description}`">
          {{ e.name }}
        </a>
      </div>

      <div v-if="people.length === 0" class="wb-empty">
        <EmptyState title="Aucune absence" :text="emptyText || 'Aucun collaborateur ne correspond aux filtres.'" />
      </div>

      <div v-for="p in people" :key="p.id" class="wb-row" role="row">
        <span class="wb-name" role="rowheader">
          <Avatar :employee="p" :size="26" />
          <span class="wb-person-text">
            <a :href="`/employes/${p.id}`" class="wb-person">{{ p.firstName }} {{ p.lastName }}</a>
            <span class="wb-person-sub">{{ p.departmentName }}</span>
          </span>
        </span>
        <span v-for="(d, i) in days" :key="d" role="cell" :class="['wb-cell', dayClass(d), { blocked: blockedFor(p, d) }]" :style="{ gridColumn: i + 2 }" />
        <button v-for="r in requestsOf(p)" :key="r.id" type="button" :class="['wb-block', r.status === 'en_attente' ? 'pending' : 'approved']"
          :style="{ gridColumn: span(r.start, r.end), '--lt': data.leaveType(r.leaveTypeId)?.color ?? '#64748b' }"
          :title="`${data.leaveType(r.leaveTypeId)?.name} · ${formatRange(r.start, r.end)} · ${formatRequestDuration(r)}`"
          :aria-label="`${p.firstName} ${p.lastName}, ${data.leaveType(r.leaveTypeId)?.name}, ${formatRange(r.start, r.end)}, ${formatRequestDuration(r)}, ${r.status === 'en_attente' ? 'soumis' : 'approuvé'}`"
          @click="emit('open', r.id)">
          <span class="wb-block-title">{{ data.leaveType(r.leaveTypeId)?.name }}</span>
          <span class="wb-block-sub">
            <Clock v-if="r.status === 'en_attente'" :size="11" aria-hidden="true" /><Check v-else :size="11" aria-hidden="true" />
            {{ r.status === 'en_attente' ? 'Soumis' : 'Approuvé' }} · {{ r.hours != null ? `${r.startTime}–${r.endTime}` : plural(r.days) }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
