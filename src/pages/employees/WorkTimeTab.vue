<script setup>
import { computed, ref } from 'vue';
import { AlertTriangle, CalendarClock, ChevronRight, Clock, Coffee, Moon, Plus } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Badge from '../../components/ui/Badge.vue';
import FormCard from '../../components/FormCard.vue';
import Modal from '../../components/ui/Modal.vue';
import ProfessionalProfileCard from './ProfessionalProfileCard.vue';
import ScheduleEditor from '../settings/ScheduleEditor.vue';
import { formatDate, formatRange, TODAY } from '../../utils/dates';
import { scheduleSummary, slotsOn, toMinutes } from '../../utils/hours';
import { periodsOf, scheduleOn, specialScheduleOf, uncoveredRanges } from '../../utils/org';

/** Temps de travail (RH-6, RH-21, RH-24) : horaire en vigueur, semaine type et périodes planifiées. */
const props = defineProps({
  employee: { type: Object, required: true },
});
const emit = defineEmits(['switch']);

const WEEK = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const slotMinutes = (s) => { const d = toMinutes(s.end) - toMinutes(s.start); return d > 0 ? d : d + 24 * 60; };
const fmtH = (min) => `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`;
const isNight = (s) => toMinutes(s.end) < toMinutes(s.start);

const store = useStore();
const data = useCompanyData();
const now = computed(() => scheduleOn(store.db, props.employee));
const loading = computed(() => props.employee.scheduleMode === 'chargement');
const periods = computed(() => periodsOf(store.db, props.employee.id).sort((a, b) => b.start.localeCompare(a.start)));
const gaps = computed(() => uncoveredRanges(store.db, props.employee));

/** Jours travaillés de l'employé dans son horaire : jours propres à son (sous-)département, sinon ceux du scénario. */
const workDays = computed(() => {
  const s = now.value.schedule;
  if (!s) return [];
  const own = now.value.period ? undefined : [props.employee.subDepartmentId, props.employee.departmentId].map((id) => (id ? s.departmentWorkDays?.[id] : undefined)).find(Boolean);
  return own ?? s.workDays;
});
/** Créneaux propres à chaque jour (index 0 = lundi) : chaque créneau ne s'affiche que sur ses jours. */
const week = computed(() => WEEK.map((name, i) => {
  const s = now.value.schedule;
  const slots = s && workDays.value.includes(i + 1) ? slotsOn(s, i + 1) : [];
  return { name, slots, minutes: slots.reduce((sum, x) => sum + slotMinutes(x), 0) };
}));
const weekMinutes = computed(() => week.value.reduce((sum, d) => sum + d.minutes, 0));
const sameSlotCount = computed(() => new Set(week.value.filter((d) => d.slots.length).map((d) => d.slots.length)).size === 1);
const slotCount = computed(() => week.value.find((d) => d.slots.length)?.slots.length ?? 0);

// Horaire spécial : remplace celui du département pour cet employé ; le retirer rend l'horaire du département.
const special = computed(() => specialScheduleOf(store.db, props.employee.id));
const specialChoices = computed(() => data.schedules.filter((s) => s.departmentSchedule === false && !s.archived));
const specialPick = ref('');
const savingSpecial = ref(false);
const choosing = ref(false);
const creating = ref(false);
function openChoice() {
  specialPick.value = special.value?.id ?? '';
  choosing.value = true;
}
async function setSpecial(scheduleId) {
  savingSpecial.value = true;
  try {
    await store.assignEmployeeSchedule(props.employee.id, scheduleId);
    choosing.value = false;
    store.toast(scheduleId ? `Horaire spécial « ${data.schedule(scheduleId)?.name} » affecté` : 'Retour à l’horaire du département', 'info');
  } catch (e) {
    store.toast(e.message, 'danger');
  } finally {
    savingSpecial.value = false;
  }
}

const stateOf = (p) => (p.end < TODAY ? 'past' : p.start <= TODAY ? 'current' : 'next');
const STATE_BADGE = { current: ['success', 'En cours'], next: ['info', 'À venir'], past: ['muted', 'Terminée'] };
</script>

<template>
  <div class="fstack">
    <ProfessionalProfileCard :employee="employee" />

    <FormCard title="Mode horaire"
      :subtitle="loading
        ? `Tableau de chargement depuis le ${employee.loadingSince ? formatDate(employee.loadingSince) : '—'} : l’horaire est planifié par périodes, sans retour automatique au département.`
        : now.special ? `${now.source} : remplace l’horaire du département pour cet employé.` : `Horaire organisationnel : hérité — ${now.source}.`">
      <template #icon><Clock :size="16" /></template>
      <template #title>Mode horaire <Badge v-if="!loading" :tone="now.special ? 'warning' : 'info'">{{ now.special ? 'Horaire spécial' : 'Horaire du département' }}</Badge></template>
      <template #actions>
        <button v-if="store.can('horaires_employes.modifier')" type="button" class="btn btn-sm btn-ghost" :disabled="employee.status === 'inactif'" @click="openChoice">Choisir un horaire</button>
        <!-- <button type="button" class="btn btn-sm btn-ghost" :disabled="employee.status === 'inactif'" @click="emit('switch')">{{ loading ? 'Revenir à l’horaire du département' : 'Passer au tableau de chargement' }}</button> -->
      </template>
      <template v-if="now.schedule">
        <p class="emp-schedule-name"><strong>{{ now.schedule.name }}</strong><span v-if="now.period" class="text-muted"> — période « {{ now.period.label }} », {{ formatRange(now.period.start, now.period.end) }}</span></p>
        <ul class="emp-week">
          <li v-for="d in week" :key="d.name" :class="d.slots.length ? '' : 'off'">
            <span class="emp-week-day">{{ d.name }}</span>
            <span v-if="d.slots.length" class="emp-week-slots">
              <span v-for="(s, k) in d.slots" :key="k" :class="['emp-slot', { night: isNight(s) }]"><Moon v-if="isNight(s)" :size="11" aria-hidden="true" />{{ s.start }}–{{ s.end }}</span>
            </span>
            <span v-else class="emp-week-rest">Repos</span>
            <span class="emp-week-total">{{ d.slots.length ? fmtH(d.minutes) : '—' }}</span>
          </li>
        </ul>
        <p class="emp-week-foot">
          <Coffee :size="12" aria-hidden="true" /> {{ sameSlotCount ? (slotCount > 1 ? `${slotCount} créneaux par jour` : '1 créneau par jour') : 'Créneaux variables selon le jour' }}
          <span aria-hidden="true"> · </span>{{ fmtH(weekMinutes) }} par semaine{{ now.schedule.weeklyHours ? ` (volume déclaré : ${now.schedule.weeklyHours.toLocaleString('fr-FR')} h)` : '' }}
        </p>
      </template>
      <p v-else class="fempty">{{ now.unplanned ? 'Aucune période en cours : l’employé est « Non planifié » aujourd’hui.' : 'Aucun horaire défini pour ce rattachement.' }}</p>
    </FormCard>

    <!-- Choix de l'horaire spécial : horaire existant, ou création avec l'éditeur de scénario -->
    <Modal v-if="choosing" open title="Choisir un horaire" @close="choosing = false">
      <p class="small">{{ special ? `Horaire actuel : « ${special.name} » (horaire spécial).` : 'L’employé utilise actuellement l’horaire de son département.' }} L’horaire choisi remplace celui du département pour {{ employee.firstName }} uniquement.</p>
      <p v-if="loading" class="small text-muted mt-12">L’employé est au tableau de chargement : ses périodes planifiées priment sur cet horaire.</p>
      <p v-if="specialChoices.length === 0" class="fempty mt-12">Aucun horaire spécial actif : créez-en un.</p>
      <div v-else class="fn-pick-list mt-12" role="radiogroup" aria-label="Horaires spéciaux">
        <label v-for="s in specialChoices" :key="s.id" :class="['fn-pick', { checked: specialPick === s.id }]">
          <input v-model="specialPick" type="radio" name="special-schedule" :value="s.id" />
          <span><strong>{{ s.name }}</strong><span class="small text-muted"> — {{ scheduleSummary(s) }} · {{ formatRange(s.startDate, s.endDate) }}</span></span>
        </label>
      </div>
      <button v-if="store.can('horaires.creer')" type="button" class="btn btn-sm btn-ghost mt-12" @click="creating = true"><Plus :size="13" aria-hidden="true" /> Créer un nouvel horaire</button>
      <template #footer>
        <button v-if="special" type="button" class="btn btn-ghost" :disabled="savingSpecial" @click="setSpecial(null)">Revenir à l’horaire du département</button>
        <span class="spacer" />
        <button type="button" class="btn btn-ghost" @click="choosing = false">Annuler</button>
        <button type="button" class="btn btn-primary" :disabled="!specialPick || specialPick === special?.id || savingSpecial" @click="setSpecial(specialPick)">{{ savingSpecial ? 'Enregistrement…' : 'Choisir cet horaire' }}</button>
      </template>
    </Modal>
    <!-- Création : l'éditeur enregistre l'horaire spécial déjà affecté à cet employé -->
    <ScheduleEditor v-if="creating" :for-employee-id="employee.id" @saved="choosing = false" @close="creating = false" />

    <FormCard v-if="loading" title="Périodes planifiées" subtitle="Tableau de chargement : un horaire actif par période, sans chevauchement.">
      <template #icon><CalendarClock :size="16" /></template>
      <template #actions><a class="btn btn-sm btn-ghost" href="/chargement">Ouvrir le tableau de chargement <ChevronRight :size="13" aria-hidden="true" /></a></template>
      <p v-if="gaps.length > 0" class="emp-gap"><AlertTriangle :size="14" aria-hidden="true" /> Non planifié sur les 30 prochains jours : {{ gaps.map((g) => formatRange(g.start, g.end)).join(' · ') }}</p>
      <p v-if="periods.length === 0" class="fempty">Aucune période planifiée.</p>
      <ol v-else class="emp-periods">
        <li v-for="p in periods" :key="p.id" :class="stateOf(p)">
          <span class="emp-period-dates">{{ formatRange(p.start, p.end) }}</span>
          <span class="emp-period-main"><strong>{{ p.label }}</strong><span class="text-muted"> · {{ data.schedule(p.scheduleId)?.name }}</span><span v-if="p.reason" class="emp-sub">{{ p.reason }}</span></span>
          <Badge :tone="STATE_BADGE[stateOf(p)][0]">{{ STATE_BADGE[stateOf(p)][1] }}</Badge>
        </li>
      </ol>
    </FormCard>
  </div>
</template>
