<script setup>
import { computed } from 'vue';
import { AlertTriangle, Briefcase, CalendarCheck, CalendarClock, ChevronRight, Clock, KeyRound, UserRound, Users } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Avatar from '../../components/ui/Avatar.vue';
import Badge from '../../components/ui/Badge.vue';
import EmployeeStatusBadge from '../../components/ui/EmployeeStatusBadge.vue';
import { formatDate, formatDayMonth, TODAY } from '../../utils/dates';
import { dayHours, formatDaysHours } from '../../utils/hours';
import { getAnnualBalance } from '../../utils/leave';
import { circuitForDepartment, scheduleOn } from '../../utils/org';
import { seniority } from './constants';

/** En-tête de la fiche employé : identité, statuts, quatre repères et alertes du moment. */
const props = defineProps({
  employee: { type: Object, required: true },
  profile: { type: Object, required: true },
});
const emit = defineEmits(['tab']);

const store = useStore();
const data = useCompanyData();

const manager = computed(() => data.employee(props.employee.managerId));
const today = computed(() => scheduleOn(store.db, props.employee));
const balance = computed(() => getAnnualBalance(store.db, props.employee.id));
const mine = computed(() => data.requests.filter((r) => r.employeeId === props.employee.id));
const absence = computed(() => mine.value.find((r) => r.status === 'approuve' && r.start <= TODAY && r.end >= TODAY));
const nextAbsence = computed(() => mine.value.filter((r) => r.status === 'approuve' && r.start > TODAY).sort((a, b) => a.start.localeCompare(b.start))[0]);
const pending = computed(() => mine.value.filter((r) => r.status === 'en_attente').length);
const circuit = computed(() => circuitForDepartment(store.db, props.employee.subDepartmentId || props.employee.departmentId));
const sub = computed(() => data.department(props.employee.subDepartmentId));
</script>

<template>
  <header class="emp-hero">
    <Avatar :employee="employee" :size="64" />
    <div class="emp-hero-main">
      <h1>{{ employee.firstName }} {{ employee.lastName }}</h1>
      <p class="emp-hero-role">
        {{ data.fn(employee.functionId)?.name }}
        <span aria-hidden="true"> · </span>{{ data.department(employee.departmentId)?.name }}<template v-if="sub"> <ChevronRight :size="12" aria-hidden="true" class="inline-icon" /> {{ sub.name }}</template>
      </p>
      <div class="emp-hero-tags">
        <span class="emp-matricule">{{ employee.matricule }}</span>
        <EmployeeStatusBadge :status="employee.status" :value="employee.statusValue" />
        <Badge tone="neutral">{{ employee.contract }}</Badge>
        <Badge tone="primary"><template #icon><KeyRound :size="11" aria-hidden="true" /></template>{{ data.role(profile.roleId)?.name }}</Badge>
        <Badge v-if="employee.scheduleMode === 'chargement'" tone="warning"><template #icon><CalendarClock :size="11" aria-hidden="true" /></template>Tableau de chargement</Badge>
      </div>
    </div>
    <div class="emp-hero-actions"><slot name="actions" /></div>
  </header>

  <!-- Quatre repères : ce qu'on cherche en premier en ouvrant une fiche. -->
  <dl class="emp-facts">
    <div>
      <dt><Briefcase :size="13" aria-hidden="true" /> Ancienneté</dt>
      <dd>{{ seniority(employee.hireDate) }}</dd>
      <span>Depuis le {{ formatDate(employee.hireDate) }}</span>
    </div>
    <div class="emp-fact-link" role="button" tabindex="0" @click="emit('tab', 'temps')" @keydown.enter.prevent="emit('tab', 'temps')" @keydown.space.prevent="emit('tab', 'temps')">
      <dt><Clock :size="13" aria-hidden="true" /> Horaire aujourd’hui</dt>
      <dd :class="today.unplanned ? 'danger' : ''">{{ today.unplanned ? 'Non planifié' : today.schedule?.name ?? '—' }}</dd>
      <span>{{ today.unplanned ? 'Tableau de chargement' : today.period ? today.period.label : employee.scheduleMode === 'organisation' ? 'Horaire du département' : today.source }}</span>
    </div>
    <!-- <div class="emp-fact-link" role="button" tabindex="0" @click="emit('tab', 'conges')" @keydown.enter.prevent="emit('tab', 'conges')" @keydown.space.prevent="emit('tab', 'conges')">
      <dt><CalendarCheck :size="13" aria-hidden="true" /> Solde de congés</dt>
      <dd :class="balance.available < 0 ? 'danger' : ''">{{ balance.tracked ? formatDaysHours(balance.available, dayHours(today.schedule)) : '—' }}</dd>
      <span>{{ pending ? `${pending} demande${pending > 1 ? 's' : ''} en attente` : nextAbsence ? `Prochain congé le ${formatDayMonth(nextAbsence.start)}` : 'Aucune demande en attente' }}</span>
    </div> -->
    <div>
      <dt><Users :size="13" aria-hidden="true" /> Responsable</dt>
      <dd><a v-if="manager" class="link" :href="`/employes/${manager.id}`">{{ manager.firstName }} {{ manager.lastName }}</a><template v-else>—</template></dd>
      <span>{{ manager ? data.fn(manager.functionId)?.name : 'Aucun responsable direct' }}</span>
    </div>
  </dl>

  <ul v-if="absence || today.unplanned || !circuit || employee.status === 'inactif'" class="emp-alerts">
    <li v-if="employee.status === 'inactif'" class="muted"><UserRound :size="14" aria-hidden="true" /> Employé inactif : il ne peut plus déposer de demande, son dossier est conservé.</li>
    <li v-if="absence" class="info"><CalendarCheck :size="14" aria-hidden="true" /> En congé jusqu’au {{ formatDayMonth(absence.end) }} inclus.</li>
    <li v-if="today.unplanned" class="danger"><AlertTriangle :size="14" aria-hidden="true" /> Non planifié aujourd’hui dans le tableau de chargement. <button type="button" class="link-btn" @click="emit('tab', 'temps')">Voir les périodes</button></li>
    <li v-if="!circuit" class="danger"><AlertTriangle :size="14" aria-hidden="true" /> Le département n’a pas de circuit d’approbation : les demandes ne peuvent pas être validées.</li>
  </ul>
</template>
