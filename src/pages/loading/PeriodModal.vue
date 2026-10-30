<script setup>
import { computed, ref, watch } from 'vue';
import { useStore } from '../../store';
import { newId } from '../../store/ids';
import { useCompanyData } from '../../store/companyData';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import { addDays, formatDate, formatRange, TODAY } from '../../utils/dates';
import { scheduleSummary } from '../../utils/hours';
import { overlappingPeriod } from '../../utils/org';

/**
 * Création ou modification d'une période : horaire actif, dates, contrôle anti-chevauchement strict (RH-26).
 * `state` : { period?, employeeId? } ; la fenêtre est fermée tant qu'il n'est pas défini.
 */
const props = defineProps({
  state: { type: Object, default: undefined },
});
const emit = defineEmits(['close']);

const store = useStore();
const data = useCompanyData();
const f = ref({ employeeId: '', scheduleId: '', start: TODAY, end: addDays(TODAY, 13), label: '', reason: '' });
const submitted = ref(false);

const loadingEmployees = computed(() => data.employees.filter((e) => e.scheduleMode === 'chargement' && e.status !== 'inactif'));
// Un scénario archivé n'est plus proposé ; une période existante garde le sien (et sa version).
const schedules = computed(() => data.schedules.filter((s) => !s.archived || s.id === props.state?.period?.scheduleId));

watch(() => props.state, (state) => {
  if (!state) return;
  submitted.value = false;
  const p = state.period;
  f.value = p
    ? { employeeId: p.employeeId, scheduleId: p.scheduleId, start: p.start, end: p.end, label: p.label, reason: p.reason }
    : { employeeId: state.employeeId ?? loadingEmployees.value[0]?.id ?? '', scheduleId: schedules.value[0]?.id ?? '', start: TODAY, end: addDays(TODAY, 13), label: '', reason: '' };
}, { immediate: true });

const employee = computed(() => data.employee(f.value.employeeId));
const conflict = computed(() => (f.value.employeeId && f.value.start && f.value.end ? overlappingPeriod(store.db, f.value.employeeId, f.value.start, f.value.end, props.state?.period?.id) : undefined));
const errors = computed(() => {
  const e = {};
  if (!f.value.employeeId) e.employeeId = 'Choisissez un employé.';
  if (!f.value.scheduleId) e.scheduleId = 'Choisissez un horaire actif.';
  else if (data.schedule(f.value.scheduleId)?.archived && f.value.scheduleId !== props.state?.period?.scheduleId) e.scheduleId = 'Ce scénario est archivé : choisissez un horaire actif.';
  if (!f.value.start || !f.value.end) e.dates = 'Dates de début et de fin requises.';
  else if (f.value.end < f.value.start) e.dates = 'La date de fin précède la date de début.';
  else if (employee.value?.loadingSince && f.value.start < employee.value.loadingSince) e.dates = `L’employé est en tableau de chargement depuis le ${formatDate(employee.value.loadingSince)} seulement.`;
  else if (conflict.value) e.dates = `Chevauchement avec « ${conflict.value.label} » (${formatRange(conflict.value.start, conflict.value.end)}).`;
  if (!f.value.label.trim()) e.label = 'Intitulé requis.';
  return e;
});
const err = (k) => (submitted.value ? errors.value[k] : undefined);

function save() {
  submitted.value = true;
  if (Object.keys(errors.value).length) return;
  // La période garde la version du scénario en vigueur à sa création (RH-21) ; elle n'est reprise que si l'horaire change.
  const previous = props.state.period;
  const keep = previous?.scheduleSnapshot && previous.scheduleId === f.value.scheduleId;
  const schedule = data.schedule(f.value.scheduleId);
  store.savePeriod({
    id: previous?.id ?? newId('lp'), companyId: store.companyId, employeeId: f.value.employeeId, scheduleId: f.value.scheduleId,
    scheduleVersion: keep ? previous.scheduleVersion : schedule?.version, scheduleSnapshot: keep ? previous.scheduleSnapshot : JSON.parse(JSON.stringify(schedule)),
    start: f.value.start, end: f.value.end, label: f.value.label.trim(), reason: f.value.reason.trim(),
  });
  store.toast(props.state.period ? 'Période modifiée' : 'Période planifiée');
  emit('close');
}
</script>

<template>
  <Modal v-if="state" open :title="state.period ? 'Modifier la période' : 'Planifier une période'" @close="emit('close')">
    <div class="form-grid">
      <Field v-slot="{ id }" label="Employé" required :error="err('employeeId')" class="span-2">
        <select :id="id" v-model="f.employeeId" :disabled="!!state.period">
          <option v-for="e in loadingEmployees" :key="e.id" :value="e.id">{{ e.firstName }} {{ e.lastName }} — {{ data.department(e.departmentId)?.name }}</option>
        </select>
      </Field>
      <Field v-slot="{ id }" label="Horaire" required :error="err('scheduleId')" class="span-2" hint="Seuls les horaires actifs peuvent être planifiés. La période garde la version du scénario utilisée à sa création.">
        <select :id="id" v-model="f.scheduleId">
          <option v-for="s in schedules" :key="s.id" :value="s.id">{{ s.name }}{{ s.archived ? ' (archivé — version conservée)' : '' }} — {{ scheduleSummary(s) }}</option>
        </select>
      </Field>
      <Field v-slot="{ id }" label="Du" required :error="err('dates')"><input :id="id" v-model="f.start" type="date" /></Field>
      <Field v-slot="{ id }" label="Au" required><input :id="id" v-model="f.end" type="date" :min="f.start" /></Field>
      <Field v-slot="{ id }" label="Intitulé" required :error="err('label')" class="span-2"><input :id="id" v-model="f.label" placeholder="Ex. : Rotation matin — semaine 42" /></Field>
      <Field v-slot="{ id }" label="Motif" class="span-2"><input :id="id" v-model="f.reason" /></Field>
    </div>
    <p class="small text-muted mt-12">À l’échéance, s’il n’existe aucune période suivante, l’employé reste « Non planifié » : il ne revient pas automatiquement à l’horaire de son département.</p>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" @click="save">Enregistrer</button>
    </template>
  </Modal>
</template>
