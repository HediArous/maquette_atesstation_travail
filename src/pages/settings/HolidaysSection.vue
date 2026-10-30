<script setup>
import { computed, ref, watch } from 'vue';
import { CalendarPlus, Check, Pencil } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Alert from '../../components/ui/Alert.vue';
import Badge from '../../components/ui/Badge.vue';
import DayMonthPicker from '../../components/ui/DayMonthPicker.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import Switch from '../../components/ui/Switch.vue';
import ArchivableTable from '../../components/ArchivableTable.vue';
import { holidayEnd, holidayFallsOn } from '../../utils/org';
import { eachDay, formatDate, formatDayMonth, formatRange, formatWeekdayShort, YEAR } from '../../utils/dates';
import { nextHijriYear } from '../../utils/hijri';

/**
 * Jours fériés de la société active (RH-20, backend /api/holidays), sur un ou plusieurs jours : ponctuels ou répétés chaque année.
 * Un jour férié actif est exclu du décompte des congés ; archivé, il n'est plus appliqué aux nouveaux calculs.
 * Fêtes religieuses (Aïd…) : leur date change chaque année ; un jour férié ponctuel se reporte à l'année suivante avec
 * une date estimée d'après le calendrier hégirien, « à confirmer » jusqu'à l'annonce officielle.
 */
const store = useStore();
const data = useCompanyData();
const editing = ref();
const busy = ref(false);

const rows = computed(() => [...data.holidays].sort((a, b) => a.date.localeCompare(b.date)));
const columns = [
  { key: 'date', header: 'Date', className: 'nowrap' },
  { key: 'name', header: 'Nom' },
  { key: 'days', header: 'Durée', className: 'nowrap' },
  { key: 'recurring', header: 'Récurrence' },
];

// ---------- Formulaire ----------
const holiday = computed(() => editing.value?.holiday);
// Report à l'année suivante : jour férié d'origine (le formulaire crée sa copie).
const copyOf = computed(() => editing.value?.copyOf);
const DAYS_MAX = 31;
const f = ref({ name: '', date: '', days: 1, recurring: false, toConfirm: false });
const submitted = ref(false);
const saveError = ref('');

watch(editing, (state) => {
  if (!state) return;
  submitted.value = false;
  saveError.value = '';
  const h = state.holiday;
  f.value = state.prefill ? { ...state.prefill }
    : { name: h?.name ?? '', date: h?.date ?? '', days: h?.days ?? 1, recurring: h?.recurring ?? false, toConfirm: h?.toConfirm ?? false };
  syncDayMonth();
});

// Jour férié annuel : seuls le jour et le mois sont saisis ; la date est enregistrée sur une année de référence
// bissextile (le 29 février reste possible), l'année n'étant pas prise en compte.
const REF_YEAR = '2000';
const rDay = ref('');
const rMonth = ref('');
const pad = (n) => String(n).padStart(2, '0');

function syncDayMonth() {
  rDay.value = f.value.date ? Number(f.value.date.slice(8, 10)) : '';
  rMonth.value = f.value.date ? Number(f.value.date.slice(5, 7)) : '';
}

watch([rDay, rMonth], ([d, m]) => {
  if (!f.value.recurring) return;
  f.value.date = d && m ? `${REF_YEAR}-${pad(m)}-${pad(d)}` : '';
});

// Passage annuel ↔ ponctuel : l'année de référence est remplacée par l'année en cours (date effacée si elle n'existe pas).
watch(() => f.value.recurring, (recurring) => {
  if (!f.value.date) return;
  if (recurring) {
    f.value.date = `${REF_YEAR}${f.value.date.slice(4)}`;
    syncDayMonth();
  } else if (f.value.date.startsWith(REF_YEAR)) {
    const date = `${YEAR}${f.value.date.slice(4)}`;
    f.value.date = new Date(`${date}T12:00:00`).toISOString().slice(0, 10) === date ? date : '';
  }
});

// Vérifications immédiates ; le backend reste juge (société, chevauchement).
const errors = computed(() => {
  const e = {};
  const name = f.value.name.trim();
  if (!name) e.name = 'Nom requis.';
  else if (!/\p{L}/u.test(name)) e.name = 'Le nom doit contenir au moins une lettre.';
  const days = Number(f.value.days);
  if (!Number.isInteger(days) || days < 1 || days > DAYS_MAX) e.days = `Entre 1 et ${DAYS_MAX} jours.`;
  const year = Number(f.value.date.slice(0, 4));
  if (!f.value.date) e.date = f.value.recurring ? 'Jour et mois requis.' : 'Date requise.';
  else if (!f.value.recurring && (year < 1900 || year > 2100)) e.date = 'Année invalide (entre 1900 et 2100).';
  else if (!e.days && !holiday.value?.archived) {
    // Deux jours fériés actifs ne se chevauchent pas, sur toute leur durée.
    const candidate = { date: f.value.date, days, recurring: f.value.recurring };
    const clash = data.holidays.find((x) => x.id !== holiday.value?.id && !x.archived
      && (eachDay(candidate.date, holidayEnd(candidate)).some((d) => holidayFallsOn(x, d))
        || eachDay(x.date, holidayEnd(x)).some((d) => holidayFallsOn(candidate, d))));
    if (clash) e.date = `Chevauche le jour férié « ${clash.name} » (${period(clash)}${clash.recurring ? ', chaque année' : ''}).`;
  }
  return e;
});
/** « 1 mai 2026 », « 20 mars → 22 mars 2026 » ; annuel : sans l'année. */
function period(h) {
  const end = holidayEnd(h);
  if (h.recurring) return end === h.date ? formatDayMonth(h.date) : `${formatDayMonth(h.date)} → ${formatDayMonth(end)}`;
  return end === h.date ? formatDate(h.date) : formatRange(h.date, end);
}
// ---------- Report à l'année suivante (fêtes religieuses) ----------
const yearOf = (h) => Number(h.date.slice(0, 4));
// Nom sans année : « Aïd al-Fitr 2026 » et « Aïd al-Fitr 2027 » désignent la même fête.
const baseName = (h) => h.name.replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const reportedTo = (h) => data.holidays.find((x) => x.id !== h.id && !x.recurring && yearOf(x) === yearOf(h) + 1 && baseName(x) === baseName(h));
const canReport = (h) => !h.recurring && !h.archived && !reportedTo(h);

function reportNextYear(h) {
  const next = String(yearOf(h) + 1);
  const name = h.name.includes(String(yearOf(h))) ? h.name.replaceAll(String(yearOf(h)), next) : `${h.name} ${next}`;
  editing.value = { copyOf: h, prefill: { name, date: nextHijriYear(h.date), days: h.days, recurring: false, toConfirm: true } };
}

/** Date officielle annoncée : le jour férié n'est plus « à confirmer ». */
async function confirmDate(h) {
  try {
    await store.saveHoliday({ ...h, toConfirm: false });
    store.toast(`Date de « ${h.name} » confirmée : ${period(h)}`);
  } catch (e) {
    store.toast(e.message, 'danger');
  }
}

const plural = (n) => `${n} jour${n > 1 ? 's' : ''}`;
const err = (k) => (submitted.value ? errors.value[k] : undefined);

async function save() {
  submitted.value = true;
  if (Object.keys(errors.value).length || busy.value) return;
  busy.value = true;
  saveError.value = '';
  try {
    const saved = await store.saveHoliday({ ...f.value, id: holiday.value?.id });
    store.toast(`Jour férié « ${saved.name} » ${holiday.value ? 'mis à jour' : copyOf.value ? `reporté — date estimée : ${period(saved)}, à confirmer` : 'ajouté'}`);
    editing.value = undefined;
  } catch (e) {
    saveError.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Alert v-if="store.holidaysStatus === 'error'" tone="danger" title="Jours fériés non chargés">
    {{ store.holidaysError }} <button type="button" class="link-btn" @click="store.loadHolidays()">Réessayer</button>
  </Alert>
  <ArchivableTable title="Jours fériés" add-label="Ajouter un jour férié" collection="holidays" :rows="rows" :columns="columns" :name-of="(h) => h.name"
    :description="`Calendrier propre à ${data.company.name}${data.company.city ? ` (${data.company.city})` : ''}. Les jours fériés actifs sont exclus du décompte des congés ; un jour férié archivé n’est plus appliqué aux nouveaux calculs.`"
    @add="editing = {}">
    <template #cell-date="{ row: h }">
      <span v-if="!h.recurring" class="text-muted small">{{ formatWeekdayShort(h.date) }}</span> {{ period(h) }}
    </template>
    <template #cell-days="{ row: h }">{{ plural(h.days) }}</template>
    <template #cell-name="{ row: h }">
      <span class="person-name">{{ h.name }}</span>
      <Badge v-if="h.toConfirm" tone="warning" class="holiday-tbc" title="Date estimée : à corriger à l’annonce officielle">À confirmer</Badge>
    </template>
    <template #cell-recurring="{ row: h }"><Badge v-if="h.recurring" tone="info">Chaque année</Badge><Badge v-else tone="neutral">Ponctuel</Badge></template>
    <template #row-actions="{ row: h }">
      <button v-if="h.toConfirm && !h.archived" type="button" class="btn btn-sm btn-ghost" :aria-label="`Confirmer la date de ${h.name}`"
        title="La date officielle correspond : retirer « à confirmer »" @click="confirmDate(h)"><Check :size="14" aria-hidden="true" /> Confirmer</button>
      <button v-if="canReport(h)" type="button" class="btn btn-sm btn-ghost" :aria-label="`Reporter ${h.name} à ${yearOf(h) + 1}`"
        title="Créer ce jour férié pour l’année suivante, avec une date estimée d’après le calendrier hégirien" @click="reportNextYear(h)"><CalendarPlus :size="14" aria-hidden="true" /> Reporter à {{ yearOf(h) + 1 }}</button>
      <button type="button" class="btn btn-sm btn-ghost" :aria-label="`Modifier ${h.name}`" @click="editing = { holiday: h }"><Pencil :size="13" aria-hidden="true" /> Modifier</button>
    </template>
  </ArchivableTable>

  <Modal :open="!!editing" :title="holiday ? `Modifier « ${holiday.name} »` : copyOf ? `Reporter « ${copyOf.name} » à ${yearOf(copyOf) + 1}` : 'Nouveau jour férié'" @close="editing = undefined">
    <Alert v-if="saveError" tone="danger" title="Enregistrement impossible" class="mb-12">{{ saveError }}</Alert>
    <Alert v-if="copyOf" tone="info" title="Date estimée" class="mb-12">
      Même jour du calendrier hégirien que {{ period(copyOf) }}. Elle reste « à confirmer » : corrigez-la si besoin à l’annonce officielle (± 1 jour selon l’observation du croissant).
    </Alert>
    <div class="form-grid">
      <Field v-slot="{ id }" label="Nom" required :error="err('name')"><input :id="id" v-model="f.name" placeholder="Ex. : Fête du Travail" /></Field>
      <Field label="Récurrence" :hint="f.recurring ? 'Appliqué chaque année aux mêmes dates.' : 'Ponctuel : appliqué uniquement à ces dates.'">
        <div class="holiday-switch"><Switch v-model="f.recurring" label="Se répète chaque année" /></div>
      </Field>
      <Field v-slot="{ id }" label="Date" required :error="err('date')" :hint="f.days > 1 ? 'Premier jour.' : f.recurring ? 'Jour et mois, sans année.' : undefined">
        <DayMonthPicker v-if="f.recurring" :id="id" v-model:day="rDay" v-model:month="rMonth" placeholder="Choisir le jour et le mois" />
        <input v-else :id="id" v-model="f.date" type="date" />
      </Field>
      <Field v-slot="{ id }" label="Nombre de jours" required :error="err('days')" :hint="f.date && !err('days') && Number(f.days) > 1 ? `Du ${period({ ...f, days: Number(f.days) })}.` : 'Jours consécutifs à partir de la date.'">
        <input :id="id" v-model.number="f.days" type="number" min="1" :max="DAYS_MAX" step="1" />
      </Field>
    </div>
    <div v-if="!f.recurring" class="mt-12">
      <Switch v-model="f.toConfirm" label="Date estimée, à confirmer" />
      <p class="small text-muted mt-8">{{ f.toConfirm ? 'Fête dont la date officielle n’est pas encore annoncée (Aïd…). Le jour férié s’applique déjà à cette date.' : 'Date officielle.' }}</p>
    </div>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="editing = undefined">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="busy" @click="save">{{ busy ? 'Enregistrement…' : holiday ? 'Enregistrer' : 'Ajouter' }}</button>
    </template>
  </Modal>
</template>

<style scoped>
.holiday-switch { display: flex; align-items: center; min-height: 38px; }
.holiday-tbc { margin-left: 6px; }
</style>
