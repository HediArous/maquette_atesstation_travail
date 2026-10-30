<script setup>
import { computed, ref } from 'vue';
import { Pencil, Users } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import ArchivableTable from '../../components/ArchivableTable.vue';
import Alert from '../../components/ui/Alert.vue';
import Badge from '../../components/ui/Badge.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import { formatRange, TODAY } from '../../utils/dates';
import { DAY_NAMES, daysLabel, scheduleDays, scheduleDayTypes, scheduleSummary, weeklyMinutes } from '../../utils/hours';
import { impactedEmployees, scheduleUsage } from '../../utils/org';
import ScheduleEditor from './ScheduleEditor.vue';

/**
 * Scénarios d'horaires (RH-21) : création et modification dans ScheduleEditor ; un scénario affecté à des départements
 * s'archive avec un scénario de remplacement, à une date d'effet.
 */
const store = useStore();
const data = useCompanyData();
const editing = ref();
/** Archivage avec remplacement : { schedule, replacementId, effectiveDate, error, saving }. */
const archiving = ref();

// Filtre par type : horaires de département ou horaires spéciaux d'employé.
const typeFilter = ref('all');
const rows = computed(() => data.schedules.filter((s) => typeFilter.value === 'all' || (typeFilter.value === 'dept') === (s.departmentSchedule !== false)));

const columns = [
  { key: 'name', header: 'Scénario' },
  { key: 'type', header: 'Type' },
  { key: 'days', header: 'Journées et créneaux' },
  { key: 'volume', header: 'Volume' },
  { key: 'usage', header: 'Affecté à' },
  { key: 'employees', header: 'Employés', className: 'num' },
];

const periodState = (s) => (!s.startDate || !s.endDate ? undefined : s.endDate < TODAY ? 'past' : s.startDate > TODAY ? 'next' : 'now');
const computedHours = (s) => Math.round(weeklyMinutes(s) / 6) / 10;
const gapOf = (s) => (s.weeklyHours ? Math.round((computedHours(s) - s.weeklyHours) * 10) / 10 : 0);

function toggleArchived(s) {
  if (s.archived) { store.setArchived('schedules', s.id, false); return; }
  const u = scheduleUsage(store.db, s.id);
  // Horaire spécial : ses employés reprennent l'horaire de leur département, ou un horaire spécial de remplacement.
  if (s.departmentSchedule === false) {
    if (!s.employeeIds?.length) { store.setArchived('schedules', s.id, true); return; }
    archiving.value = { schedule: s, replacementId: '', effectiveDate: TODAY, error: '', saving: false };
    return;
  }
  if (u.departments.length === 0) { store.setArchived('schedules', s.id, true); return; }
  archiving.value = { schedule: s, replacementId: '', effectiveDate: TODAY, error: '', saving: false };
}

const archivingSpecial = computed(() => archiving.value?.schedule.departmentSchedule === false);
// Le remplaçant est du même type que le scénario archivé.
const replacements = computed(() => data.schedules.filter((x) => !x.archived && x.id !== archiving.value?.schedule.id
  && (x.departmentSchedule === false) === archivingSpecial.value));
const archiveUsage = computed(() => (archiving.value ? scheduleUsage(store.db, archiving.value.schedule.id) : undefined));
const archiveImpact = computed(() => (archiveUsage.value ? impactedEmployees(store.db, archiveUsage.value.departments.map((d) => d.id), archiving.value.schedule.id).length : 0));

async function confirmArchive() {
  const a = archiving.value;
  if (!a.replacementId && !archivingSpecial.value) { a.error = 'Choisissez un scénario de remplacement.'; return; }
  if (!a.effectiveDate || a.effectiveDate < TODAY) { a.error = 'La date d’effet ne peut pas être dans le passé.'; return; }
  a.saving = true;
  a.error = '';
  try {
    await store.setScheduleStatus(a.schedule.id, false, a.replacementId, a.effectiveDate);
    store.toast(a.replacementId ? `« ${a.schedule.name} » archivé — remplacé par « ${data.schedule(a.replacementId)?.name} »` : `« ${a.schedule.name} » archivé — ses employés reprennent l’horaire de leur département`, 'info');
    archiving.value = undefined;
  } catch (e) {
    a.error = e.message;
  } finally {
    a.saving = false;
  }
}
</script>

<template>
  <Alert v-if="store.schedulesStatus === 'error'" tone="danger" title="Scénarios non chargés">{{ store.schedulesError }}
    <button type="button" class="btn btn-sm btn-ghost" @click="store.loadSchedules()">Réessayer</button>
  </Alert>
  <div class="segmented" role="radiogroup" aria-label="Type d’horaire affiché" style="margin-bottom: 12px">
    <button v-for="[k, l] in [['all', 'Tous'], ['dept', 'Horaires de département'], ['special', 'Horaires spéciaux d’employé']]" :key="k" type="button" role="radio"
      :aria-checked="typeFilter === k" :class="{ active: typeFilter === k }" @click="typeFilter = k">{{ l }}</button>
  </div>
  <ArchivableTable title="Scénarios d’horaires" add-label="Nouveau scénario" collection="schedules" :rows="rows" :columns="columns" :name-of="(s) => s.name"
    description="Chaque scénario définit ses journées types (jours et créneaux), sa période, son fuseau horaire et son volume hebdomadaire. Un horaire de département s’affecte aux départements ; un horaire spécial s’affecte directement aux employés et remplace pour eux l’horaire de leur département."
    :empty-text="store.schedulesStatus === 'loading' ? 'Chargement des scénarios…' : ''" :on-toggle-archived="toggleArchived" @add="editing = {}">
    <template #cell-name="{ row: s }">
      <span class="sc-name">
        <span class="person-name">{{ s.name }}</span>
        <span v-if="s.startDate && s.endDate" class="small text-muted">{{ formatRange(s.startDate, s.endDate) }} · {{ s.timezone }}</span>
        <span class="sc-tags">
          <Badge v-if="periodState(s)" :tone="periodState(s) === 'now' ? 'success' : periodState(s) === 'next' ? 'info' : 'muted'">{{ periodState(s) === 'now' ? 'En cours' : periodState(s) === 'next' ? 'À venir' : 'Terminé' }}</Badge>
          <Badge v-if="s.exceptionalOffDays?.length" tone="neutral">{{ s.exceptionalOffDays.length }} jour{{ s.exceptionalOffDays.length > 1 ? 's' : '' }} except.</Badge>
          <Badge v-if="s.version > 1" tone="neutral">v{{ s.version }}</Badge>
        </span>
      </span>
    </template>
    <template #cell-type="{ row: s }">
      <Badge :tone="s.departmentSchedule === false ? 'warning' : 'info'">{{ s.departmentSchedule === false ? 'Spécial employé' : 'Département' }}</Badge>
    </template>
    <template #cell-days="{ row: s }">
      <span class="sc-days">
        <span class="day-pills"><span v-for="(d, i) in DAY_NAMES" :key="d" :class="['day-pill', { on: scheduleDays(s).includes(i + 1) }]" :aria-label="`${d} ${scheduleDays(s).includes(i + 1) ? 'travaillé' : 'repos'}`">{{ d[0] }}</span></span>
        <span v-for="g in scheduleDayTypes(s)" :key="g.days.join()" class="sc-type">
          <strong>{{ daysLabel(g.days) }}</strong>
          <span>{{ g.slots.map((sl) => `${sl.start}–${sl.end}`).join(' · ') }}</span>
        </span>
      </span>
    </template>
    <template #cell-volume="{ row: s }">
      <span class="sc-vol">
        <strong>{{ (s.weeklyHours ?? computedHours(s)).toLocaleString('fr-FR') }} h</strong>
        <span class="small text-muted">créneaux : {{ computedHours(s).toLocaleString('fr-FR') }} h</span>
        <Badge v-if="Math.abs(gapOf(s)) >= 0.1" :tone="gapOf(s) > 0 ? 'warning' : 'info'">{{ gapOf(s) > 0 ? '+' : '' }}{{ gapOf(s).toLocaleString('fr-FR') }} h</Badge>
      </span>
    </template>
    <template #cell-usage="{ row: s }">
      <span v-if="s.departmentSchedule === false" :class="s.employeeIds?.length ? 'small' : 'text-muted small'">{{ s.employeeIds?.length ? `${s.employeeIds.length} employé(s) en horaire spécial` : 'Non utilisé' }}</span>
      <span v-else-if="!scheduleUsage(store.db, s.id).inUse" class="text-muted small">Non utilisé</span>
      <span v-else class="sc-usage">
        <span v-for="d in scheduleUsage(store.db, s.id).departments" :key="d.id" class="sc-chip">{{ d.name }}</span>
        <span v-if="scheduleUsage(store.db, s.id).periods.length > 0" class="small text-muted">{{ scheduleUsage(store.db, s.id).periods.length }} période(s) du tableau de chargement</span>
      </span>
    </template>
    <template #cell-employees="{ row: s }"><strong class="num">{{ s.departmentSchedule === false ? s.employeeIds?.length ?? 0 : data.profiles.filter((p) => p.scheduleId === s.id).length }}</strong></template>
    <template #row-actions="{ row: s }">
      <button type="button" class="btn btn-sm btn-ghost" :disabled="s.archived" :aria-label="`Modifier ${s.name}`" @click="editing = { schedule: s }"><Pencil :size="13" aria-hidden="true" /> Modifier</button>
    </template>
  </ArchivableTable>
  <ScheduleEditor v-if="editing" :schedule="editing.schedule" @close="editing = undefined" />

  <!-- Archivage d'un scénario utilisé : remplacement obligatoire -->
  <Modal v-if="archiving" open :title="`Archiver « ${archiving.schedule.name} »`" @close="archiving = undefined">
    <Alert v-if="archiving.error" tone="danger">{{ archiving.error }}</Alert>
    <p v-if="archivingSpecial" class="small">Cet horaire spécial est utilisé par <strong>{{ archiving.schedule.employeeIds.length }} employé(s)</strong>. Choisissez un horaire spécial de remplacement, ou laissez vide : ils reprendront l’horaire de leur département.</p>
    <p v-else class="small">Ce scénario est affecté à <strong>{{ archiveUsage.departments.map((d) => d.name).join(', ') }}</strong>. Choisissez le scénario qui le remplacera dans ces départements.</p>
    <div class="form-grid mt-12">
      <Field v-slot="{ id }" label="Scénario de remplacement" :required="!archivingSpecial" class="span-2">
        <select :id="id" v-model="archiving.replacementId">
          <option value="">{{ archivingSpecial ? 'Aucun — retour à l’horaire du département' : 'Sélectionner un scénario actif…' }}</option>
          <option v-for="r in replacements" :key="r.id" :value="r.id">{{ r.name }} — {{ scheduleSummary(r) }}</option>
        </select>
      </Field>
      <Field v-if="!archivingSpecial" v-slot="{ id }" label="Date d’effet" required>
        <input :id="id" v-model="archiving.effectiveDate" type="date" :min="TODAY" />
      </Field>
    </div>
    <p v-if="!archivingSpecial" class="sched-impact mt-12"><Users :size="14" aria-hidden="true" /> <span><strong>{{ archiveImpact }} employé{{ archiveImpact > 1 ? 's' : '' }}</strong> en horaire organisationnel concerné{{ archiveImpact > 1 ? 's' : '' }}. Les employés du tableau de chargement ne sont pas affectés ; les périodes déjà planifiées conservent leur version.</span></p>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="archiving = undefined">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="archiving.saving" @click="confirmArchive">{{ archiving.saving ? 'Archivage…' : 'Remplacer et archiver' }}</button>
    </template>
  </Modal>
</template>
