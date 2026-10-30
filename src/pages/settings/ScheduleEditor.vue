<script setup>
import { computed, ref } from 'vue';
import { AlertTriangle, ArrowRight, Building2, CalendarDays, CalendarOff, Clock, Coffee, FileText, Moon, Plus, Save, Trash2, UserCog, Users, X } from '@lucide/vue';
import { useStore } from '../../store';
import { newId } from '../../store/ids';
import { useCompanyData } from '../../store/companyData';
import Alert from '../../components/ui/Alert.vue';
import Drawer from '../../components/ui/Drawer.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import FormCard from '../../components/FormCard.vue';
import { formatDate, formatRange, TODAY } from '../../utils/dates';
import { DAY_NAMES as DAYS, dayHours, daysLabel, scheduleDays, slotMinutes, toMinutes, weeklyMinutes } from '../../utils/hours';
import { assignmentWindow, holidayOn, impactedEmployees, liveAssignments } from '../../utils/org';
import SlotTimeline from './SlotTimeline.vue';

/**
 * Éditeur de scénario d'horaire (RH-21) : libellé, période d'application, volume, fuseau horaire, journées types
 * (jours et créneaux), départements concernés à une date d'effet et jours non travaillés exceptionnels
 * (sans doublon avec les jours fériés, RH-20). Enregistré dans le backend.
 * Type exclusif : un horaire de département s'affecte aux départements, un horaire spécial directement aux employés.
 */
const props = defineProps({
  /** Scénario à modifier ; absent = création. */
  schedule: { type: Object, default: undefined },
  /** Création depuis la fiche d'un employé : horaire spécial déjà affecté à cet employé. */
  forEmployeeId: { type: String, default: undefined },
  /** Création d'un horaire spécial sans employé (ex. formulaire d'ajout : l'employé n'existe pas encore). */
  special: Boolean,
});
const emit = defineEmits(['close', 'saved']);

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const DEFAULT_TIMEZONE = 'Africa/Tunis';
const clone = (x) => JSON.parse(JSON.stringify(x));

const store = useStore();
const data = useCompanyData();

const blank = () => ({
  id: '', companyId: store.companyId, name: '', startDate: TODAY, endDate: `${TODAY.slice(0, 4)}-12-31`, weeklyHours: 37.5, timezone: DEFAULT_TIMEZONE,
  slots: [{ label: 'Matin', start: '08:30', end: '12:30', days: [1, 2, 3, 4, 5] }, { label: 'Après-midi', start: '13:30', end: '17:00', days: [1, 2, 3, 4, 5] }],
  exceptionalOffDays: [],
  departmentSchedule: !props.forEmployeeId && !props.special,
});

// Chaque créneau porte ses jours ; un ancien scénario les reprend de ses jours travaillés.
const s = ref(props.schedule
  ? { ...clone(props.schedule), timezone: props.schedule.timezone || DEFAULT_TIMEZONE, slots: props.schedule.slots.map((x) => ({ ...x, days: [...(x.days ?? props.schedule.workDays)] })) }
  : blank());
// Départements dont l'affectation est en cours ou à venir.
const initialDeps = props.schedule ? [...new Set(liveAssignments(store.db, props.schedule.id).map((a) => a.departmentId))] : [];
const deps = ref([...initialDeps]);
// Horaire spécial : employés qui l'utilisent à la place de l'horaire de leur département.
const initialEmps = props.schedule ? [...(props.schedule.employeeIds ?? [])] : [];
const emps = ref(props.forEmployeeId && !props.schedule ? [props.forEmployeeId] : [...initialEmps]);
const isDept = computed(() => s.value.departmentSchedule !== false);
// Le type ne change plus une fois le scénario affecté (départements, même passés, ou employés).
const typeLocked = computed(() => !!props.forEmployeeId || props.special ||!!props.schedule && ((store.db.scheduleAssignments ?? []).some((a) => a.scheduleId === props.schedule.id) || initialEmps.length > 0));
function setType(dept) {
  if (typeLocked.value) return;
  s.value.departmentSchedule = dept;
  if (dept) emps.value = [];
  else { deps.value = []; s.value.exceptionalOffDays = s.value.exceptionalOffDays.map((o) => ({ ...o, departmentId: undefined })); }
}
const empName = (id) => { const e = data.employee(id); return e ? `${e.firstName} ${e.lastName}`.trim() : id; };
const availableEmps = computed(() => data.employees.filter((e) => e.status !== 'inactif' && !emps.value.includes(e.id))
  .sort((a, b) => empName(a.id).localeCompare(empName(b.id))));
const addEmp = (id) => { if (id) emps.value = [...emps.value, id]; };
const removeEmp = (id) => { emps.value = emps.value.filter((x) => x !== id); };
const submitted = ref(false);
const saving = ref(false);
const serverError = ref('');
const confirming = ref(false);

// Fuseaux horaires IANA proposés.
const timezones = (() => {
  const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [DEFAULT_TIMEZONE, 'Europe/Paris', 'UTC'];
  return all.includes(s.value.timezone) ? all : [s.value.timezone, ...all];
})();

// Départements et sous-départements actifs, dans l'ordre de l'arborescence.
const options = computed(() => data.activeDepartments.flatMap((d) => [d, ...data.subDepartments(d.id).filter((x) => !x.archived)]));
const label = (id) => { const d = data.department(id); const p = data.department(d?.parentId); return p ? `${p.name} › ${d?.name}` : d?.name ?? ''; };
const available = computed(() => options.value.filter((d) => !deps.value.includes(d.id)));

/**
 * Scénario remplacé dans un département : seulement s'il s'applique pendant la période du nouveau (la date d'effet est
 * le début de la période d'application). Deux scénarios sur des périodes différentes coexistent.
 */
function replacedIn(departmentId) {
  const start = s.value.startDate;
  const end = s.value.endDate;
  if (!start || !end) return undefined;
  for (const a of store.db.scheduleAssignments ?? []) {
    if (a.departmentId !== departmentId || a.scheduleId === s.value.id) continue;
    const w = assignmentWindow(store.db, a);
    if (w && w.start <= end && w.end >= start) return { schedule: data.schedule(a.scheduleId), start: w.start > start ? w.start : start, end: w.end < end ? w.end : end };
  }
  return undefined;
}
const replacedLabel = (id) => { const r = replacedIn(id); return r ? ` (remplace « ${r.schedule?.name} » : ${formatRange(r.start, r.end)})` : ''; };

// Impact : employés en mode organisationnel dont l'horaire viendrait de ce scénario (le tableau de chargement n'est pas concerné).
const impacted = computed(() => (isDept.value ? impactedEmployees(store.db, deps.value, s.value.id) : emps.value.map((id) => data.employee(id)).filter(Boolean)));
const removed = computed(() => initialDeps.filter((id) => !deps.value.includes(id)).map((id) => data.department(id)).filter(Boolean));
const added = computed(() => deps.value.filter((id) => !initialDeps.includes(id)));
const assignmentChanged = computed(() => removed.value.length > 0 || added.value.length > 0);

const addDep = (id) => { if (id) deps.value = [...deps.value, id]; };
const removeDep = (id) => {
  deps.value = deps.value.filter((x) => x !== id);
  s.value.exceptionalOffDays = s.value.exceptionalOffDays.filter((o) => o.departmentId !== id);
};

// Journées types : créneaux regroupés par jeu de jours identique ; un jour n'appartient qu'à une journée type.
const keyOf = (slot) => [...(slot.days ?? [])].sort().join(',');
const groups = computed(() => {
  const map = new Map();
  s.value.slots.forEach((slot, index) => {
    const days = [...(slot.days ?? [])].sort();
    const key = days.join(',') || `vide-${index}`;
    if (!map.has(key)) map.set(key, { key, days, items: [] });
    map.get(key).items.push({ slot, index });
  });
  return [...map.values()].sort((a, b) => (a.days[0] ?? 9) - (b.days[0] ?? 9));
});
const freeDays = computed(() => {
  const used = new Set(groups.value.flatMap((g) => g.days));
  return [1, 2, 3, 4, 5, 6, 7].filter((d) => !used.has(d));
});
const ownerOf = (g, day) => groups.value.findIndex((o) => o.key !== g.key && o.days.includes(day));

function toggleGroupDay(g, day) {
  const days = g.days.includes(day) ? g.days.filter((x) => x !== day) : [...g.days, day].sort();
  if (days.length === 0) { store.toast('Une journée type garde au moins un jour : supprimez-la pour libérer ce jour.', 'info'); return; }
  s.value.slots = s.value.slots.map((x) => (keyOf(x) === g.key ? { ...x, days } : x));
}
function addGroup() {
  if (!freeDays.value.length) return;
  s.value.slots = [...s.value.slots, { label: 'Matin', start: '08:00', end: '12:00', days: [freeDays.value[0]] }];
}
function addSlot(g) {
  const last = g.items[g.items.length - 1]?.slot;
  const start = last?.end && toMinutes(last.end) < 22 * 60 ? last.end : '14:00';
  const end = `${String(Math.min(23, Math.floor(toMinutes(start) / 60) + 4)).padStart(2, '0')}:${start.slice(3)}`;
  s.value.slots = [...s.value.slots, { label: '', start, end, days: [...g.days] }];
}
const removeGroup = (g) => { s.value.slots = s.value.slots.filter((x) => keyOf(x) !== g.key); };
const removeSlot = (i) => { s.value.slots = s.value.slots.filter((_, j) => j !== i); };
const addOff = () => { s.value.exceptionalOffDays = [...s.value.exceptionalOffDays, { id: newId('x'), date: '', label: '' }]; };
const removeOff = (i) => { s.value.exceptionalOffDays = s.value.exceptionalOffDays.filter((_, j) => j !== i); };

// Contrôles par journée type : pas de chevauchement de créneaux le même jour.
const groupErrors = computed(() => groups.value.map((g) => {
  const day = g.items.map((x) => x.slot).filter((x) => x.start && x.end && x.start !== x.end && toMinutes(x.end) > toMinutes(x.start))
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  return day.some((x, i) => i > 0 && toMinutes(x.start) < toMinutes(day[i - 1].end)) ? 'Deux créneaux se chevauchent dans cette journée type.' : '';
}));

// Volume calculé : chaque créneau compte sur ses propres jours ; jours travaillés = jours couverts par un créneau.
const validSlots = computed(() => s.value.slots.filter((x) => x.start && x.end && x.start !== x.end));
const computedHours = computed(() => Math.round(weeklyMinutes({ slots: validSlots.value }) / 6) / 10);
const workDays = computed(() => scheduleDays(s.value));
const over = computed(() => Number(s.value.weeklyHours) > 0 && computedHours.value > Number(s.value.weeklyHours) + 0.01);
// Blocage : les créneaux doivent totaliser exactement le volume hebdomadaire déclaré.
const mismatch = computed(() => Number(s.value.weeklyHours) > 0 && Math.abs(weeklyMinutes({ slots: validSlots.value }) / 60 - Number(s.value.weeklyHours)) > 0.01);
const volume = computed(() => {
  const declared = Number(s.value.weeklyHours) || 0;
  const gap = Math.round((computedHours.value - declared) * 10) / 10;
  const tone = !declared ? 'none' : Math.abs(gap) < 0.05 ? 'ok' : gap > 0 ? 'over' : 'under';
  const max = Math.max(declared, computedHours.value, 1);
  return { declared, gap, tone, computedPct: Math.min(100, (computedHours.value / max) * 100), declaredPct: (declared / max) * 100 };
});
const volumeHint = computed(() => {
  const w = Number(s.value.weeklyHours);
  if (over.value) return `Créneaux : ${fmtHours(computedHours.value)} — dépassement`;
  if (w > 0 && computedHours.value < w - 0.4) return `Créneaux : ${fmtHours(computedHours.value)} (sous le volume)`;
  return 'Conforme aux créneaux';
});

// Validation.
const offs = computed(() => s.value.exceptionalOffDays);
const offErrors = computed(() => offs.value.map((o, i, all) => {
  if (!o.date) return 'Date requise.';
  if (s.value.startDate && s.value.endDate && (o.date < s.value.startDate || o.date > s.value.endDate)) return 'Hors de la période d’application.';
  const holiday = holidayOn(store.db, store.companyId, o.date);
  if (holiday) return `Coïncide avec le jour férié « ${holiday.name} » (déjà chômé, RH-20).`;
  if (all.some((x, j) => j < i && x.date === o.date && (x.departmentId ?? '') === (o.departmentId ?? ''))) return 'Jour déjà saisi.';
  if (!o.label.trim()) return 'Motif requis.';
  return '';
}));
const errors = computed(() => {
  const e = {};
  const v = s.value;
  if (!v.name.trim()) e.name = 'Libellé requis.';
  else if (data.schedules.some((x) => x.id !== v.id && x.name.trim().toLowerCase() === v.name.trim().toLowerCase())) e.name = 'Un scénario porte déjà ce libellé.';
  if (!v.startDate || !v.endDate) e.period = 'Période requise.';
  else if (v.endDate < v.startDate) e.period = 'La fin précède le début.';
  if (!(Number(v.weeklyHours) > 0)) e.weeklyHours = 'Volume strictement positif.';
  if (!v.timezone) e.timezone = 'Fuseau horaire requis.';
  if (mismatch.value) e.volume = `Les créneaux totalisent ${fmtHours(computedHours.value)} au lieu des ${fmtHours(Number(v.weeklyHours))} déclarées.`;
  if (v.slots.length === 0) e.slots = 'Ajoutez au moins un créneau.';
  else if (v.slots.some((x) => !x.label.trim() || !x.start || !x.end || x.start === x.end)) e.slots = 'Chaque créneau a un libellé, un début et une fin différents.';
  if (v.slots.some((x) => !x.days?.length)) e.days = 'Chaque créneau doit s’appliquer à au moins un jour.';
  if (groupErrors.value.some(Boolean)) e.groups = 'Corrigez les journées types.';
  if (offErrors.value.some(Boolean)) e.off = 'Corrigez les jours exceptionnels.';
  return e;
});
const err = (k) => (submitted.value ? errors.value[k] : undefined);
const errorCount = computed(() => Object.keys(errors.value).length);

/** Avant la validation d'une affectation, le nombre d'employés concernés est confirmé. */
function save() {
  submitted.value = true;
  if (errorCount.value || saving.value) return;
  if (isDept.value && assignmentChanged.value && impacted.value.length > 0 && !confirming.value) { confirming.value = true; return; }
  persist();
}

async function persist() {
  confirming.value = false;
  saving.value = true;
  serverError.value = '';
  try {
    const saved = await store.saveSchedule(s.value, deps.value, emps.value);
    store.toast(props.schedule ? `Scénario « ${saved.name} » mis à jour (version ${saved.version})` : `Scénario « ${saved.name} » créé`);
    emit('saved', saved);
    emit('close');
  } catch (e) {
    serverError.value = e.message;
  } finally {
    saving.value = false;
  }
}

const fmtHours = (n) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`;
const fmtDuration = (min) => `${Math.floor(min / 60)} h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`;
const isNight = (x) => !!x.start && !!x.end && toMinutes(x.end) < toMinutes(x.start);
const isValid = (x) => !!x.start && !!x.end && x.start !== x.end;
const groupMinutes = (g) => g.items.reduce((sum, { slot }) => sum + (isValid(slot) ? slotMinutes(slot) : 0), 0);
const pauseAfter = (g, k) => {
  const x = g.items[k].slot;
  const next = g.items[k + 1]?.slot;
  return next && isValid(x) && !isNight(x) && next.start && toMinutes(next.start) > toMinutes(x.end) ? toMinutes(next.start) - toMinutes(x.end) : 0;
};
const dayHoursOf = (i) => dayHours({ slots: validSlots.value }, i + 1);
</script>

<template>
  <Drawer open wide :title="schedule ? `Modifier « ${schedule.name} »` : 'Nouveau scénario d’horaire'"
    subtitle="Scénario d’horaire (RH-21) : créneaux, départements concernés, jours travaillés et jours exceptionnels." @close="emit('close')">
    <div class="fstack">
      <Alert v-if="serverError" tone="danger" title="Enregistrement refusé">{{ serverError }}</Alert>

      <!-- Synthèse du scénario, mise à jour en direct -->
      <dl class="fkpis cols-3" aria-label="Synthèse du scénario">
        <div><dt>Jours travaillés</dt><dd>{{ workDays.length }}<span>{{ s.slots.length }} créneau{{ s.slots.length > 1 ? 'x' : '' }}</span></dd></div>
        <div v-if="isDept"><dt>Départements</dt><dd>{{ deps.length }}<span>concerné{{ deps.length > 1 ? 's' : '' }}</span></dd></div>
        <div v-else><dt>Type</dt><dd>Spécial<span>horaire d’employé</span></dd></div>
        <div :class="impacted.length ? 'accent' : ''"><dt>Impact</dt><dd>{{ impacted.length }}<span>employé{{ impacted.length > 1 ? 's' : '' }}</span></dd></div>
      </dl>

      <FormCard title="Informations générales" subtitle="Le libellé est unique dans la société.">
        <template #icon><FileText :size="16" /></template>
        <Field label="Type d’horaire" required :hint="typeLocked ? 'Ce scénario est déjà affecté : son type ne peut plus changer.' : isDept ? 'Affecté aux départements : leurs employés en héritent par défaut.' : 'Affecté directement à des employés : il remplace pour eux l’horaire de leur département.'">
          <div class="segmented" role="radiogroup" aria-label="Type d’horaire">
            <button type="button" role="radio" :aria-checked="isDept" :class="{ active: isDept }" :disabled="typeLocked && !isDept" @click="setType(true)"><Building2 :size="13" aria-hidden="true" /> Horaire de département</button>
            <button type="button" role="radio" :aria-checked="!isDept" :class="{ active: !isDept }" :disabled="typeLocked && isDept" @click="setType(false)"><UserCog :size="13" aria-hidden="true" /> Horaire spécial d’employé</button>
          </div>
        </Field>
        <div class="sched-head">
          <Field v-slot="{ id }" label="Libellé" required :error="err('name')"><input :id="id" v-model="s.name" maxlength="100" placeholder="Ex. : Scénario Ramadan" /></Field>
          <Field v-slot="{ id }" label="Période d’application" required :error="err('period')">
            <span class="sched-period">
              <input :id="id" v-model="s.startDate" type="date" aria-label="Début de la période" />
              <ArrowRight :size="14" aria-hidden="true" />
              <input v-model="s.endDate" type="date" :min="s.startDate" aria-label="Fin de la période" />
            </span>
          </Field>
          <Field v-slot="{ id }" label="Volume hebdomadaire" required :error="err('weeklyHours')" :hint="volumeHint">
            <span class="input-suffix">
              <input :id="id" type="number" min="0" step="0.5" :value="s.weeklyHours ?? ''" @input="s.weeklyHours = $event.target.value === '' ? undefined : Number($event.target.value)" />
              <span aria-hidden="true">h</span>
            </span>
          </Field>
          <Field v-slot="{ id }" label="Fuseau horaire" required :error="err('timezone')" hint="Heures des créneaux exprimées dans ce fuseau.">
            <select :id="id" v-model="s.timezone">
              <option v-for="z in timezones" :key="z" :value="z">{{ z.replace(/_/g, ' ') }}</option>
            </select>
          </Field>
        </div>
      </FormCard>

      <FormCard title="Journées types et créneaux"
        subtitle="Chaque journée type a ses jours et ses créneaux (ex. Lun–Jeu, puis Ven, puis Sam). Un jour sans journée type est un jour de repos.">
        <template #icon><Clock :size="16" /></template>
        <template #actions>
          <button type="button" class="btn btn-sm btn-ghost" :disabled="freeDays.length === 0" :title="freeDays.length ? undefined : 'Tous les jours ont déjà une journée type.'" @click="addGroup">
            <Plus :size="14" aria-hidden="true" /> Journée type
          </button>
        </template>
        <!-- Comparaison du volume déclaré et des heures accumulées par les créneaux -->
        <p :class="['vol-line', volume.tone]" aria-live="polite">
          <span>Déclaré <strong>{{ fmtHours(volume.declared) }}</strong></span>
          <span aria-hidden="true">·</span>
          <span>Créneaux <strong>{{ fmtHours(computedHours) }}</strong></span>
          <span aria-hidden="true">·</span>
          <span class="vol-line-gap"><template v-if="volume.tone === 'ok'">Conforme</template><template v-else>Écart <strong>{{ volume.gap > 0 ? '+' : '' }}{{ fmtHours(volume.gap) }}</strong></template></span>
          <span class="vol-line-bar" aria-hidden="true"><span :style="{ width: `${volume.computedPct}%` }" /><i :style="{ left: `${volume.declaredPct}%` }" /></span>
        </p>
        <div v-if="mismatch" class="sched-block" role="alert">
          <p><AlertTriangle :size="14" aria-hidden="true" /> <span>Les créneaux totalisent <strong>{{ fmtHours(computedHours) }}</strong> par semaine au lieu des <strong>{{ fmtHours(Number(s.weeklyHours)) }}</strong> déclarées : ajustez les créneaux ou le volume hebdomadaire pour enregistrer.</span></p>
        </div>
        <div class="day-types">
          <section v-for="(g, gi) in groups" :key="g.key" :class="['day-type', { invalid: submitted && groupErrors[gi] }]" :aria-label="`Journée type ${LETTERS[gi]}`">
            <header class="day-type-head">
              <span class="day-type-badge">{{ LETTERS[gi] }}</span>
              <span class="day-type-title">
                <strong>Journée type {{ LETTERS[gi] }}</strong>
                <span>{{ g.days.length ? daysLabel(g.days) : 'Aucun jour' }} · {{ fmtDuration(groupMinutes(g)) }} par jour</span>
              </span>
              <button type="button" class="icon-btn icon-btn-sm icon-btn-danger" :disabled="groups.length === 1" :aria-label="`Supprimer la journée type ${LETTERS[gi]}`" title="Supprimer cette journée type" @click="removeGroup(g)"><Trash2 :size="14" /></button>
            </header>

            <div class="slot-days" role="group" :aria-label="`Jours de la journée type ${LETTERS[gi]}`">
              <span class="slot-days-label">Jours</span>
              <button v-for="(d, k) in DAYS" :key="d" type="button" :class="['slot-day', { on: g.days.includes(k + 1), taken: !g.days.includes(k + 1) && ownerOf(g, k + 1) >= 0 }]"
                :aria-pressed="g.days.includes(k + 1)" :disabled="!g.days.includes(k + 1) && ownerOf(g, k + 1) >= 0"
                :title="!g.days.includes(k + 1) && ownerOf(g, k + 1) >= 0 ? `Déjà dans la journée type ${LETTERS[ownerOf(g, k + 1)]}` : g.days.includes(k + 1) ? 'Retirer ce jour' : 'Ajouter ce jour'"
                @click="toggleGroupDay(g, k + 1)">{{ d }}<small v-if="!g.days.includes(k + 1) && ownerOf(g, k + 1) >= 0">{{ LETTERS[ownerOf(g, k + 1)] }}</small></button>
            </div>

            <SlotTimeline :slots="g.items.map((x) => x.slot)" />
            <ol class="sched-slots">
              <li v-for="({ slot: x, index: i }, k) in g.items" :key="i">
                <div :class="['slot-card', { invalid: submitted && (!x.label.trim() || !isValid(x)) }]">
                  <div class="slot-top">
                    <span class="slot-index" aria-hidden="true">{{ k + 1 }}</span>
                    <input v-model="x.label" class="fx-input slot-label" maxlength="50" :aria-label="`Libellé du créneau ${k + 1}, journée ${LETTERS[gi]}`" placeholder="Libellé — ex. : Matin" />
                    <span :class="['slot-duration', { night: isNight(x) }]" :title="isNight(x) ? 'Poste de nuit : traverse minuit' : undefined">
                      <Moon v-if="isNight(x)" :size="11" aria-hidden="true" />{{ isValid(x) ? fmtDuration(slotMinutes(x)) : '—' }}
                    </span>
                    <button type="button" class="icon-btn icon-btn-sm icon-btn-danger" :disabled="g.items.length === 1" :aria-label="`Supprimer le créneau ${k + 1}`" @click="removeSlot(i)"><Trash2 :size="14" /></button>
                  </div>
                  <div class="time-range">
                    <label><span>De</span><input v-model="x.start" type="time" :aria-label="`Début du créneau ${k + 1}`" /></label>
                    <ArrowRight :size="14" aria-hidden="true" />
                    <label><span>À</span><input v-model="x.end" type="time" :aria-label="`Fin du créneau ${k + 1}`" /></label>
                  </div>
                </div>
                <p v-if="pauseAfter(g, k) > 0" class="slot-pause"><Coffee :size="12" aria-hidden="true" /> Pause de {{ fmtDuration(pauseAfter(g, k)) }}</p>
              </li>
            </ol>
            <button type="button" class="btn btn-sm btn-ghost day-type-add" @click="addSlot(g)"><Plus :size="13" aria-hidden="true" /> Créneau pour {{ g.days.length ? daysLabel(g.days) : 'cette journée' }}</button>
            <p v-if="submitted && groupErrors[gi]" class="field-error">{{ groupErrors[gi] }}</p>
          </section>
        </div>
        <p class="day-types-rest">
          <CalendarOff :size="13" aria-hidden="true" />
          <span v-if="freeDays.length">Repos : <strong>{{ freeDays.map((d) => DAYS[d - 1]).join(', ') }}</strong> — ajoutez une journée type pour les travailler.</span>
          <span v-else>Tous les jours de la semaine sont travaillés.</span>
        </p>
        <p v-if="err('slots')" class="field-error">{{ err('slots') }}</p>
      </FormCard>

      <FormCard title="Jours travaillés" subtitle="Déduits des créneaux et de leurs jours : affichage seul, à modifier depuis les créneaux.">
        <template #icon><CalendarDays :size="16" /></template>
        <div class="table-wrap sched-days">
          <table class="table">
            <thead><tr><th scope="col">Périmètre</th><th v-for="d in DAYS" :key="d" scope="col" class="sched-day-col">{{ d }}</th><th scope="col" class="num">Jours</th><th scope="col" class="num">Total</th></tr></thead>
            <tbody>
              <tr>
                <td class="sched-day-dept">
                  <span v-if="deps.length">{{ deps.length }} département{{ deps.length > 1 ? 's' : '' }} concerné{{ deps.length > 1 ? 's' : '' }}</span>
                  <span v-else class="text-muted">Tous les jours du scénario</span>
                </td>
                <td v-for="(d, i) in DAYS" :key="d" class="sched-day-col">
                  <span :class="['day-toggle', 'readonly', dayHoursOf(i) > 0 ? 'on' : 'off']">{{ dayHoursOf(i) > 0 ? 'Travaillé' : 'Repos' }}</span>
                  <span class="day-hours">{{ dayHoursOf(i) > 0 ? fmtDuration(Math.round(dayHoursOf(i) * 60)) : '—' }}</span>
                </td>
                <td class="num"><strong>{{ workDays.length }}</strong></td>
                <td class="num"><strong>{{ fmtHours(computedHours) }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="err('days')" class="field-error">{{ err('days') }}</p>
      </FormCard>

      <FormCard v-if="isDept" title="Départements concernés" subtitle="Ils utilisent ce scénario comme horaire organisationnel.">
        <template #icon><Building2 :size="16" /></template>
        <p v-if="deps.length === 0" class="fempty">Aucun département : le scénario reste disponible pour le tableau de chargement.</p>
        <ul v-else class="perm-chips sched-chips">
          <li v-for="id in deps" :key="id" class="perm-chip">{{ label(id) }}<button type="button" :aria-label="`Retirer ${label(id)}`" @click="removeDep(id)"><X :size="12" /></button></li>
        </ul>
        <select v-if="available.length > 0" class="fx-input fx-select sched-add" :value="''" aria-label="Ajouter un département" @change="addDep($event.target.value); $event.target.value = ''">
          <option value="">+ Ajouter un département…</option>
          <option v-for="d in available" :key="d.id" :value="d.id">{{ label(d.id) }}{{ replacedLabel(d.id) }}</option>
        </select>
        <p v-else-if="options.length === 0" class="small text-muted sched-add">Aucun département actif dans la société : créez-en dans Paramètres › Départements.</p>
        <p class="sched-impact"><Users :size="14" aria-hidden="true" /> <span><strong>{{ impacted.length }} employé{{ impacted.length > 1 ? 's' : '' }}</strong> en horaire organisationnel concerné{{ impacted.length > 1 ? 's' : '' }} dans ce périmètre.</span></p>
        <Alert v-if="removed.length > 0" tone="warning">{{ removed.map((d) => d.name).join(', ') }} n’aura plus d’horaire organisationnel{{ removed.some((d) => !d.parentId) ? ' : affectez-lui un autre scénario' : ' (hérite de son département)' }}.</Alert>
      </FormCard>

      <FormCard v-else title="Employés concernés" subtitle="Horaire spécial : il remplace l’horaire de leur département. Un employé retiré reprend l’horaire de son département.">
        <template #icon><UserCog :size="16" /></template>
        <p v-if="emps.length === 0" class="fempty">Aucun employé : affectez-le ici ou depuis la fiche de l’employé (Temps de travail).</p>
        <ul v-else class="perm-chips sched-chips">
          <li v-for="id in emps" :key="id" class="perm-chip">{{ empName(id) }}<button type="button" :aria-label="`Retirer ${empName(id)}`" @click="removeEmp(id)"><X :size="12" /></button></li>
        </ul>
        <select v-if="availableEmps.length > 0" class="fx-input fx-select sched-add" :value="''" aria-label="Ajouter un employé" @change="addEmp($event.target.value); $event.target.value = ''">
          <option value="">+ Ajouter un employé…</option>
          <option v-for="e in availableEmps" :key="e.id" :value="e.id">{{ empName(e.id) }}</option>
        </select>
      </FormCard>

      <FormCard title="Jours non travaillés exceptionnels" subtitle="Fermetures propres à ce scénario. Un jour férié est déjà chômé : il ne peut pas être ressaisi ici (RH-20).">
        <template #icon><CalendarOff :size="16" /></template>
        <template #actions><button type="button" class="btn btn-sm btn-ghost" @click="addOff"><Plus :size="14" aria-hidden="true" /> Jour exceptionnel</button></template>
        <p v-if="offs.length === 0" class="fempty">Aucun jour non travaillé exceptionnel configuré.</p>
        <ul v-else class="sched-offs">
          <li v-for="(o, i) in offs" :key="o.id" :class="{ invalid: submitted && offErrors[i] }">
            <div class="sched-off-row">
              <input v-model="o.date" class="fx-input" type="date" :aria-label="`Date du jour exceptionnel ${i + 1}`" :min="s.startDate" :max="s.endDate" />
              <input v-model="o.label" class="fx-input" maxlength="150" :aria-label="`Motif du jour exceptionnel ${i + 1}`" placeholder="Motif — ex. : maintenance annuelle" />
              <select class="fx-input fx-select" :aria-label="`Département du jour exceptionnel ${i + 1}`" :value="o.departmentId ?? ''" @change="o.departmentId = $event.target.value || undefined">
                <option value="">Tous les départements du scénario</option>
                <option v-for="id in (isDept ? deps : [])" :key="id" :value="id">{{ label(id) }}</option>
              </select>
              <button type="button" class="icon-btn icon-btn-sm icon-btn-danger" :aria-label="`Supprimer le jour exceptionnel ${i + 1}`" @click="removeOff(i)"><Trash2 :size="14" /></button>
            </div>
            <p v-if="submitted && offErrors[i]" class="field-error">{{ offErrors[i] }}</p>
          </li>
        </ul>
      </FormCard>
    </div>

    <template #footer>
      <span v-if="submitted && errorCount > 0" class="footer-note text-danger">{{ errorCount }} point(s) à corriger</span>
      <span v-else-if="!isDept" class="footer-note">Horaire spécial · {{ emps.length }} employé(s)</span>
      <span v-else class="footer-note">{{ deps.length ? `Appliqué à ${deps.length} département(s) · ${impacted.length} employé(s)` : 'Disponible pour le tableau de chargement' }}</span>
      <span class="spacer" />
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="saving" @click="save"><Save :size="15" aria-hidden="true" /> {{ saving ? 'Enregistrement…' : schedule ? 'Enregistrer' : 'Créer le scénario' }}</button>
    </template>
  </Drawer>

  <!-- Confirmation : nombre d'employés concernés avant de valider l'affectation -->
  <Modal v-if="confirming" open title="Confirmer l’affectation" size="sm" @close="confirming = false">
    <p><strong>{{ impacted.length }} employé{{ impacted.length > 1 ? 's' : '' }}</strong> en horaire organisationnel {{ impacted.length > 1 ? 'appliqueront' : 'appliquera' }} « {{ s.name.trim() }} » à compter du <strong>{{ formatDate(s.startDate) }}</strong>.</p>
    <p class="small text-muted mt-12">Les employés gérés par le tableau de chargement ne sont pas affectés ; les périodes déjà planifiées conservent leur version du scénario.</p>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="confirming = false">Revenir</button>
      <button type="button" class="btn btn-primary" @click="persist">Confirmer</button>
    </template>
  </Modal>
</template>
