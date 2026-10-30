<script setup>
import {isLeaveFeatureEnabled} from '../../maquette/companyModules';
import { computed, ref, watch } from 'vue';
import { Ban, CalendarDays, Clock, Paperclip, Send, Trash2, Upload, UserCheck } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Alert from '../../components/ui/Alert.vue';
import Avatar from '../../components/ui/Avatar.vue';
import Drawer from '../../components/ui/Drawer.vue';
import EffectBadge from '../../components/ui/EffectBadge.vue';
import Field from '../../components/ui/Field.vue';
import { diffDays, formatDate, formatDays, formatRange, overlaps, TODAY, YEAR } from '../../utils/dates';
import { balanceTypes, countLeaveDays, findEventConflicts, getAnnualBalance, getBalance } from '../../utils/leave';
import { countAuthorization, dayHours, formatDaysHours, formatHours, fromMinutes, nextWorkingDay, scheduleOf, slotTimes, toMinutes } from '../../utils/hours';
import { findPresenceConflicts, presenceEffect } from '../../utils/presence';

/** Nouvelle demande de congé (en jours ou demi-journées) ou d'autorisation d'absence (en heures). */
const props = defineProps({
  open: Boolean,
  defaultEmployeeId: { type: String, default: undefined },
});
const emit = defineEmits(['close', 'created']);

const store = useStore();
const data = useCompanyData();

const employeeId = ref('');
const kind = ref('conge');
const leaveTypeId = ref('');
const authDate = ref('');
const fromTime = ref('');
const toTime = ref('');
const start = ref('');
const end = ref('');
const singlePart = ref('full');
const startsPm = ref(false);
const endsAm = ref(false);
const comment = ref('');
const attachment = ref('');
const ackWarning = ref(false);
const submitted = ref(false);

const types = computed(() => data.leaveTypes.filter((t) => !t.archived&&isLeaveFeatureEnabled(store.companyId,t)));
const dayTypes = computed(() => types.value.filter((t) => t.unit !== 'heure'));
const hourTypes = computed(() => types.value.filter((t) => t.unit === 'heure'));
const selectable = computed(() => data.activePeople.filter((e) => !!data.profile(e.id)));

// Réinitialisation à chaque ouverture.
watch(() => props.open, (open) => {
  if (!open) return;
  employeeId.value = props.defaultEmployeeId ?? store.currentUser.id;
  kind.value = 'conge';
  leaveTypeId.value = dayTypes.value[0]?.id ?? '';
  authDate.value = ''; fromTime.value = ''; toTime.value = '';
  start.value = ''; end.value = ''; singlePart.value = 'full'; startsPm.value = false; endsAm.value = false;
  comment.value = ''; attachment.value = ''; ackWarning.value = false; submitted.value = false;
}, { immediate: true });

const employee = computed(() => data.person(employeeId.value));
const type = computed(() => data.leaveType(leaveTypeId.value));
const rule = computed(() => data.leaveRules.find((r) => r.leaveTypeId === leaveTypeId.value && !r.archived));
const isAuth = computed(() => kind.value === 'autorisation');

function switchKind(k) {
  kind.value = k;
  leaveTypeId.value = (k === 'autorisation' ? hourTypes.value : dayTypes.value)[0]?.id ?? '';
  submitted.value = false; ackWarning.value = false;
  if (k === 'autorisation') {
    const first = scheduleOf(store.db, employeeId.value)?.slots[0];
    if (!authDate.value) authDate.value = nextWorkingDay(store.db, employeeId.value, TODAY);
    if (first && !fromTime.value) {
      fromTime.value = first.start;
      toTime.value = fromMinutes(Math.min(toMinutes(first.start) + 60, toMinutes(first.end)));
    }
  }
}

function pickFrom(v) {
  if (!v) return;
  // L'heure de fin reste après le début : à défaut, +1 h dans la limite du créneau.
  if (!toTime.value || toMinutes(toTime.value) <= toMinutes(v)) {
    const slot = scheduleOf(store.db, employeeId.value)?.slots.find((sl) => toMinutes(v) >= toMinutes(sl.start) && toMinutes(v) < toMinutes(sl.end));
    toTime.value = fromMinutes(Math.min(toMinutes(v) + 60, slot ? toMinutes(slot.end) : toMinutes(v) + 60));
  }
}

function onStart() {
  if (!end.value || start.value > end.value) end.value = start.value;
}

const rangeStart = computed(() => (isAuth.value ? authDate.value : start.value));
const rangeEnd = computed(() => (isAuth.value ? authDate.value : end.value));
const single = computed(() => !!start.value && start.value === end.value);
const startPart = computed(() => (isAuth.value ? 'full' : single.value ? singlePart.value : startsPm.value ? 'pm' : 'full'));
const endPart = computed(() => (isAuth.value ? 'full' : single.value ? singlePart.value : endsAm.value ? 'am' : 'full'));
const datesValid = computed(() => !!rangeStart.value && !!rangeEnd.value && rangeEnd.value >= rangeStart.value);

const count = computed(() => (!isAuth.value && employee.value && datesValid.value
  ? countLeaveDays(store.db, employee.value.id, start.value, end.value, startPart.value, endPart.value) : null));
const schedule = computed(() => (employee.value ? scheduleOf(store.db, employee.value.id) : undefined));
const perDay = computed(() => dayHours(schedule.value));
const timesValid = computed(() => !!fromTime.value && !!toTime.value && toMinutes(toTime.value) > toMinutes(fromTime.value));
const times = computed(() => slotTimes(schedule.value?.slots ?? []));
const endTimes = computed(() => times.value.endsAfter(fromTime.value));
const auth = computed(() => (isAuth.value && employee.value && authDate.value && timesValid.value
  ? countAuthorization(store.db, employee.value.id, authDate.value, fromTime.value, toTime.value) : null));
const requested = computed(() => (isAuth.value ? auth.value?.days ?? 0 : count.value?.total ?? 0));
const annual = computed(() => (employee.value ? getAnnualBalance(store.db, employee.value.id) : null));
const ownCaps = computed(() => (employee.value ? balanceTypes(store.db, employee.value.companyId).own : []));
const balance = computed(() => (employee.value ? getBalance(store.db, employee.value.id, leaveTypeId.value) : null));
const conflicts = computed(() => (employee.value && datesValid.value ? findEventConflicts(store.db, employee.value.id, rangeStart.value, rangeEnd.value) : []));
const blocking = computed(() => conflicts.value.filter((c) => c.effect === 'block'));
const warnings = computed(() => conflicts.value.filter((c) => c.effect === 'warning'));
// Règles de présence (fonctions solo liées, présence minimale des fonctions groupe).
// Une autorisation de quelques heures n'est pas soumise aux règles de présence (journées entières).
const presence = computed(() => (!isAuth.value && employee.value && datesValid.value
  ? findPresenceConflicts(store.db, employee.value.id, leaveTypeId.value, start.value, end.value) : []));
const presenceBlocks = computed(() => presence.value.length > 0 && presenceEffect(store.db, employee.value?.companyId ?? '') === 'block');
const presenceWarns = computed(() => presence.value.length > 0 && !presenceBlocks.value);
const hardBlock = computed(() => blocking.value.length > 0 || presenceBlocks.value);
const overlapping = computed(() => (employee.value && datesValid.value
  ? data.requests.filter((r) => r.employeeId === employee.value.id && (r.status === 'approuve' || r.status === 'en_attente') && overlaps(r.start, r.end, rangeStart.value, rangeEnd.value)
    // Deux autorisations le même jour ne se chevauchent que si leurs plages horaires se croisent.
    && !(isAuth.value && r.startTime && r.endTime && timesValid.value && (toMinutes(r.endTime) <= toMinutes(fromTime.value) || toMinutes(r.startTime) >= toMinutes(toTime.value))))
  : []));
const teamAbsent = computed(() => (employee.value && datesValid.value
  ? data.requests.filter((r) => r.status === 'approuve' && r.employeeId !== employee.value.id && data.person(r.employeeId)?.departmentId === employee.value.departmentId && overlaps(r.start, r.end, rangeStart.value, rangeEnd.value))
  : []));
const noticeShort = computed(() => !isAuth.value && rule.value && start.value && diffDays(TODAY, start.value) < rule.value.minNoticeDays);
const insufficient = computed(() => (balance.value?.tracked && requested.value > 0 ? requested.value > balance.value.available + 1e-9 : false));
const fmtBal = (d) => (balance.value?.scope === 'annuel' ? formatDaysHours(d, perDay.value) : formatDays(d));
const profile = computed(() => data.profile(employeeId.value));
const circuit = computed(() => data.circuit(profile.value?.circuitId));
// Sans circuit suivi : demande validée par la RH. Circuit sans approbateur supérieur : approbation automatique, historisée.
const byRh = computed(() => !circuit.value);
const exempt = computed(() => !byRh.value && profile.value.approverIds.length === 0);

const errors = computed(() => {
  const e = {};
  if (!employee.value) e.employee = 'Choisissez un employé.';
  if (!leaveTypeId.value) e.type = isAuth.value ? 'Aucun type d’autorisation paramétré (Paramètres › Types de congé).' : 'Aucun type de congé paramétré (Paramètres › Types de congé).';
  if (isAuth.value) {
    if (!authDate.value) e.authDate = 'Indiquez la date.';
    if (!fromTime.value) e.fromTime = 'Heure de début requise.';
    if (!toTime.value) e.toTime = 'Heure de fin requise.';
    else if (fromTime.value && !timesValid.value) e.toTime = 'L’heure de fin doit suivre l’heure de début.';
    if (auth.value && !auth.value.workingDay) e.authDate = auth.value.holiday ? `Jour férié : ${auth.value.holiday}.` : 'Ce jour n’est pas travaillé selon votre horaire.';
    else if (auth.value && auth.value.hours === 0) e.toTime = 'La plage est entièrement en dehors de vos créneaux de travail.';
  } else {
    if (!start.value) e.start = 'Indiquez la date de début.';
    if (!end.value) e.end = 'Indiquez la date de fin.';
    if (start.value && end.value && end.value < start.value) e.end = 'La date de fin doit être postérieure ou égale à la date de début.';
    if (count.value && count.value.total === 0) e.end = 'Aucun jour ouvré dans la période sélectionnée.';
  }
  return e;
});
const blockers = computed(() => {
  const list = [...Object.values(errors.value)];
  if (blocking.value.length) list.push('Conflit avec un événement bloquant.');
  if (overlapping.value.length) list.push('Chevauchement avec une autre demande.');
  if (presenceBlocks.value) list.push('Règle de présence non respectée.');
  if ((warnings.value.length || presenceWarns.value) && !ackWarning.value) list.push('Avertissement à confirmer.');
  return list;
});
const showErr = (k) => (submitted.value ? errors.value[k] : undefined);
const hasMessages = computed(() => datesValid.value && (blocking.value.length > 0 || warnings.value.length > 0 || presence.value.length > 0
  || overlapping.value.length > 0 || noticeShort.value || teamAbsent.value.length > 0));

function submit() {
  submitted.value = true;
  if (blockers.value.length) return;
  if(!types.value.some(t=>t.id===leaveTypeId.value)){store.toast('Ce type est indisponible pour la société.','danger');return;}
  const req = store.submitLeave({
    employeeId: employeeId.value, leaveTypeId: leaveTypeId.value, start: rangeStart.value, end: rangeEnd.value,
    startPart: startPart.value, endPart: endPart.value, comment: comment.value, attachment: attachment.value || undefined,
    ...(isAuth.value ? { startTime: fromTime.value, endTime: toTime.value } : {}),
  });
  store.toast(exempt.value ? 'Demande envoyée et approuvée automatiquement (aucun approbateur supérieur)'
    : byRh.value ? 'Demande envoyée à la RH pour validation' : 'Demande envoyée au premier approbateur');
  emit('close');
  emit('created', req.id);
}

const fmtCents = (n) => n.toFixed(2).replace('.', ',');
</script>

<template>
  <Drawer :open="open" wide :title="isAuth ? 'Nouvelle demande d’autorisation' : 'Nouvelle demande de congé'"
    subtitle="Le décompte exclut les jours non travaillés et les jours fériés." @close="emit('close')">
    <div class="request-top">
      <div class="kind-switch" role="radiogroup" aria-label="Nature de la demande">
        <button type="button" role="radio" :aria-checked="kind === 'conge'" :class="['kind-option', { active: kind === 'conge' }]" @click="switchKind('conge')">
          <span class="kind-icon" aria-hidden="true"><CalendarDays :size="17" /></span>
          <span><span class="kind-label">Congé</span><span class="kind-sub">En jours ou demi-journées</span></span>
        </button>
        <button type="button" role="radio" :aria-checked="kind === 'autorisation'" :class="['kind-option', { active: kind === 'autorisation' }]" @click="switchKind('autorisation')">
          <span class="kind-icon" aria-hidden="true"><Clock :size="17" /></span>
          <span><span class="kind-label">Autorisation</span><span class="kind-sub">En heures, sur vos créneaux</span></span>
        </button>
      </div>
      <div class="balance-strip" aria-label="Soldes restants">
        <div v-if="annual?.tracked" class="balance-tile primary">
          <span class="balance-tile-label">Solde annuel restant</span>
          <span class="balance-tile-value">{{ formatDaysHours(annual.available, perDay) }}</span>
          <span class="balance-tile-sub">soit {{ formatHours(annual.available * perDay) }} · 1 j = {{ formatHours(perDay) }}{{ annual.pending ? ` · ${formatDaysHours(annual.pending, perDay)} en attente` : '' }}</span>
        </div>
        <div v-for="t in ownCaps" :key="t.id" class="balance-tile">
          <span class="balance-tile-label" :title="t.name"><span class="dot" :style="{ background: t.color }" aria-hidden="true" /> {{ t.name }}</span>
          <span class="balance-tile-value">{{ formatDays(getBalance(store.db, employeeId, t.id).available) }}</span>
          <span class="balance-tile-sub">sur {{ formatDays(getBalance(store.db, employeeId, t.id).acquired) }}</span>
        </div>
      </div>
    </div>

    <div class="form-split">
      <div class="form-main">
        <fieldset class="form-section">
          <legend>Demande</legend>
          <div class="form-grid">
            <Field label="Employé" required class="span-2" :error="showErr('employee')"
              :hint="employeeId && employeeId !== store.currentUser.id ? 'Vous saisissez la demande pour le compte de cet employé.' : ''">
              <template #default="{ id }">
                <select :id="id" v-model="employeeId">
                  <option v-if="!employeeId" value="">Sélectionner un employé…</option>
                  <option v-for="e in selectable" :key="e.id" :value="e.id">{{ e.firstName }} {{ e.lastName }}{{ e.id === store.currentUser.id ? ' (moi)' : '' }} — {{ data.departmentName(e.departmentId) }}</option>
                </select>
              </template>
            </Field>
            <Field v-slot="{ id }" :label="isAuth ? 'Type d’autorisation' : 'Type de congé'" required class="span-2" :error="showErr('type')">
              <select :id="id" v-model="leaveTypeId">
                <option v-for="t in (isAuth ? hourTypes : dayTypes)" :key="t.id" :value="t.id">{{ t.name }} ({{ t.code }})</option>
              </select>
            </Field>
            <template v-if="isAuth">
              <Field v-slot="{ id }" label="Date" required :error="showErr('authDate')" class="span-2">
                <input :id="id" v-model="authDate" type="date" :min="`${YEAR}-01-01`" />
              </Field>
              <Field v-slot="{ id }" label="De" required :error="showErr('fromTime')">
                <select :id="id" v-model="fromTime" @change="pickFrom($event.target.value)">
                  <option v-if="!fromTime" value="">Heure de début</option>
                  <optgroup v-for="g in times.starts" :key="g.label" :label="g.label"><option v-for="t in g.times" :key="t" :value="t">{{ t }}</option></optgroup>
                </select>
              </Field>
              <Field v-slot="{ id }" label="À" required :error="showErr('toTime')">
                <select :id="id" v-model="toTime" :disabled="!fromTime">
                  <option v-if="!toTime" value="">Heure de fin</option>
                  <optgroup v-for="g in endTimes" :key="g.label" :label="g.label"><option v-for="t in g.times" :key="t" :value="t">{{ t }}</option></optgroup>
                </select>
              </Field>
            </template>
            <template v-else>
              <Field v-slot="{ id }" label="Date de début" required :error="showErr('start')">
                <input :id="id" v-model="start" type="date" :min="`${YEAR}-01-01`" @input="onStart" />
              </Field>
              <Field v-slot="{ id }" label="Date de fin" required :error="showErr('end')">
                <input :id="id" v-model="end" type="date" :min="start || undefined" />
              </Field>
            </template>
          </div>

          <div v-if="isAuth" class="form-subsection">
            <p class="label">Vos créneaux de travail <span class="text-muted">· horaire « {{ schedule?.name }} »</span></p>
            <div class="slot-row">
              <button v-for="sl in (schedule?.slots ?? [])" :key="sl.label" type="button" class="slot-chip" :title="`Remplir avec le créneau ${sl.label.toLowerCase()}`"
                @click="fromTime = sl.start; toTime = sl.end">
                <span>{{ sl.label }}</span> {{ sl.start }}–{{ sl.end }}
              </button>
            </div>
            <p class="text-muted small mt-4">Seules les heures comprises dans vos créneaux sont décomptées (les pauses sont exclues). Une journée de solde = {{ formatHours(perDay) }}.</p>
          </div>
          <div v-else class="form-subsection">
            <p class="label">Période partielle</p>
            <p v-if="!type?.allowHalfDay" class="text-muted small">Ce type de congé se pose uniquement en journées complètes.</p>
            <div v-else-if="single" class="radio-row" role="radiogroup" aria-label="Période de la journée">
              <label v-for="[v, l] in [['full', 'Journée complète'], ['am', 'Matin'], ['pm', 'Après-midi']]" :key="v" :class="['radio-pill', { checked: singlePart === v }]">
                <input v-model="singlePart" type="radio" name="singlePart" :value="v" /> {{ l }}
              </label>
            </div>
            <div v-else class="check-col">
              <label class="check"><input v-model="startsPm" type="checkbox" :disabled="!start" /> Commencer l’après-midi du premier jour</label>
              <label class="check"><input v-model="endsAm" type="checkbox" :disabled="!end" /> Terminer à midi le dernier jour</label>
            </div>
          </div>
        </fieldset>

        <fieldset class="form-section">
          <legend>Compléments</legend>
          <Field v-slot="{ id }" label="Commentaire" hint="Visible par les approbateurs.">
            <textarea :id="id" v-model="comment" rows="3" placeholder="Motif ou précision utile (facultatif)" />
          </Field>
          <Field label="Justificatif (facultatif)"
            :hint="type?.requiresProof ? 'Conseillé pour ce type de congé — vous pourrez aussi le transmettre plus tard.' : 'Seul le nom du fichier est conservé pour le moment ; l’envoi vers le serveur viendra avec le backend.'">
            <template #default="{ id }">
              <div v-if="attachment" class="file-chip">
                <Paperclip :size="15" aria-hidden="true" /> <span>{{ attachment }}</span>
                <button type="button" class="icon-btn" aria-label="Retirer le justificatif" @click="attachment = ''"><Trash2 :size="15" /></button>
              </div>
              <div v-else class="file-row">
                <label :for="id" class="dropzone">
                  <span class="dropzone-icon" aria-hidden="true"><Upload :size="15" /></span>
                  <span><strong>Choisir un fichier</strong><span class="dropzone-sub">PDF, JPG ou PNG</span></span>
                </label>
                <input :id="id" type="file" class="sr-only" accept=".pdf,.jpg,.jpeg,.png" @change="attachment = $event.target.files?.[0]?.name ?? ''" />
              </div>
            </template>
          </Field>
        </fieldset>

        <div v-if="hasMessages" class="stack">
          <Alert v-for="c in presence" :key="c.rule" :tone="presenceBlocks ? 'danger' : 'warning'"
            :title="`${c.kind === 'solo' ? 'Fonction liée' : 'Présence minimale'} : ${c.rule}${presenceBlocks ? ' — demande bloquée' : ''}`">
            <p>{{ c.message }}</p>
            <p class="small mt-4">Jours concernés : {{ c.days.slice(0, 6).map((d) => formatDate(d)).join(', ') }}{{ c.days.length > 6 ? ` et ${c.days.length - 6} autre(s)` : '' }}</p>
            <label v-if="presenceWarns" class="check mt-8"><input v-model="ackWarning" type="checkbox" /> J’ai pris connaissance de cette règle et je maintiens ma demande</label>
          </Alert>
          <Alert v-for="ev in blocking" :key="ev.id" tone="danger" :title="`Période bloquée : ${ev.name}`">
            {{ formatRange(ev.start, ev.end) }} — {{ ev.description }} Les demandes chevauchant cet événement ne peuvent pas être envoyées.
          </Alert>
          <Alert v-for="r in overlapping" :key="r.id" tone="danger" title="Chevauchement avec une demande existante">
            {{ data.leaveType(r.leaveTypeId)?.name }} du {{ formatRange(r.start, r.end) }} ({{ r.status === 'approuve' ? 'approuvée' : 'en attente' }}).
          </Alert>
          <Alert v-for="ev in warnings" :key="ev.id" tone="warning" :title="`Attention : ${ev.name}`">
            <p>{{ formatRange(ev.start, ev.end) }} — {{ ev.description }}</p>
            <label class="check mt-8"><input v-model="ackWarning" type="checkbox" /> J’ai pris connaissance de cet événement et je maintiens ma demande</label>
          </Alert>
          <Alert v-if="noticeShort" tone="warning" title="Délai de prévenance court">
            La règle prévoit {{ rule.minNoticeDays }} jours de prévenance pour ce type. La demande reste possible mais sera signalée.
          </Alert>
          <Alert v-if="teamAbsent.length > 0" tone="info" :title="`${teamAbsent.length} collègue(s) du département absent(s) sur la période`">
            {{ teamAbsent.map((r) => `${data.person(r.employeeId)?.firstName} ${data.person(r.employeeId)?.lastName} (${formatRange(r.start, r.end)})`).join(', ') }}
          </Alert>
        </div>
      </div>

      <aside class="form-aside" aria-label="Solde et décompte">
        <div class="aside-card">
          <p class="aside-title">{{ balance?.scope === 'annuel' ? 'Solde annuel' : balance?.scope === 'propre' ? `Plafond — ${type?.name}` : 'Solde' }}</p>
          <p :class="`impact-badge impact-${type?.deductsFromAnnual ? 'annuel' : 'hors'}`">
            {{ type?.deductsFromAnnual ? 'Ce type est déduit du solde annuel' : 'Hors solde annuel : le solde annuel n’est pas modifié' }}
          </p>
          <template v-if="balance?.tracked">
            <dl class="balance-grid">
              <div><dt>Acquis {{ YEAR }}</dt><dd>{{ formatDays(balance.acquired) }}</dd></div>
              <div><dt>Pris</dt><dd>{{ fmtBal(balance.taken) }}</dd></div>
              <div><dt>En attente</dt><dd>{{ fmtBal(balance.pending) }}</dd></div>
              <div class="strong"><dt>Disponible</dt><dd>{{ fmtBal(balance.available) }}</dd></div>
            </dl>
            <div class="meter" aria-hidden="true">
              <span class="meter-taken" :style="{ width: `${Math.min(100, (balance.taken / Math.max(balance.acquired, 1)) * 100)}%` }" />
              <span class="meter-pending" :style="{ width: `${Math.min(100, (balance.pending / Math.max(balance.acquired, 1)) * 100)}%` }" />
            </div>
          </template>
          <p v-else class="text-muted small">Aucun plafond pour ce type{{ type?.requiresProof ? ' — justificatif conseillé' : '' }}.</p>
        </div>

        <div class="aside-card">
          <p class="aside-title">Aperçu du décompte</p>
          <template v-if="isAuth">
            <template v-if="auth && auth.workingDay">
              <ul class="count-list">
                <li><span>Plage demandée</span><span>{{ fromTime }}–{{ toTime }}</span></li>
                <li v-if="auth.outsideMinutes > 0"><span>Hors créneaux (pause, hors horaire)</span><span>− {{ formatHours(auth.outsideMinutes / 60) }}</span></li>
                <li><span>Journée de travail (horaire « {{ schedule?.name }} »)</span><span>{{ formatHours(perDay) }}</span></li>
                <li class="total"><span>Total décompté</span><span>{{ formatHours(auth.hours) }}</span></li>
                <li class="sub"><span>Équivalent en jours de solde</span><span>{{ fmtCents(auth.days) }} j</span></li>
              </ul>
              <p v-if="balance?.tracked" :class="['after-balance', { 'text-danger': insufficient }]">
                {{ balance.scope === 'annuel' ? 'Solde annuel après demande' : 'Plafond restant après demande' }} : <strong>{{ fmtBal(balance.available - auth.days) }}</strong>
                <span v-if="balance.scope === 'annuel'" class="block small text-muted">soit {{ formatHours((balance.available - auth.days) * perDay) }} restantes</span>
                <template v-if="insufficient"> — solde insuffisant (signalé aux approbateurs)</template>
              </p>
            </template>
            <p v-else class="text-muted small">Choisissez une date travaillée et une plage horaire pour afficher le décompte.</p>
          </template>
          <template v-else-if="count">
            <ul class="count-list">
              <li><span>Jours calendaires</span><span>{{ count.calendarDays }}</span></li>
              <li><span>Jours non travaillés (horaire « {{ data.schedule(profile?.scheduleId)?.name }} »)</span><span>− {{ count.nonWorkingDays }}</span></li>
              <li><span>Jours fériés</span><span>− {{ count.holidays.length }}</span></li>
              <li v-for="h in count.holidays" :key="h.date" class="sub"><span>{{ formatDate(h.date) }} · {{ h.name }}</span><span /></li>
              <li v-if="count.halfDayDeduction > 0"><span>Demi-journées</span><span>− {{ String(count.halfDayDeduction).replace('.', ',') }}</span></li>
              <li class="total"><span>Total décompté</span><span>{{ formatDays(count.total) }}</span></li>
            </ul>
            <p v-if="balance?.tracked" :class="['after-balance', { 'text-danger': insufficient }]">
              {{ balance.scope === 'annuel' ? 'Solde annuel après demande' : 'Plafond restant après demande' }} : <strong>{{ fmtBal(balance.available - count.total) }}</strong>
              <template v-if="insufficient"> — solde insuffisant (signalé aux approbateurs)</template>
            </p>
          </template>
          <p v-else class="text-muted small">Sélectionnez des dates pour afficher le décompte.</p>
        </div>

        <div class="aside-card">
          <p class="aside-title">Circuit d’approbation</p>
          <p v-if="byRh" class="small"><UserCheck :size="15" aria-hidden="true" class="inline-icon" /> Aucun circuit d’approbation suivi : la demande sera validée par la RH.</p>
          <p v-else-if="exempt" class="small"><UserCheck :size="15" aria-hidden="true" class="inline-icon" /> Aucun approbateur supérieur dans le circuit : la demande sera approuvée automatiquement.</p>
          <ol v-else class="mini-steps">
            <li v-for="(id, i) in profile?.approverIds" :key="id">
              <span class="step-num">{{ i + 1 }}</span><Avatar :employee="data.person(id)" :size="22" /> {{ data.person(id)?.firstName }} {{ data.person(id)?.lastName }}
            </li>
          </ol>
          <p class="text-muted small mt-8">{{ circuit?.name }}</p>
        </div>

        <div v-if="conflicts.length > 0" class="aside-card">
          <p class="aside-title">Événements sur la période</p>
          <ul class="plain-list">
            <li v-for="c in conflicts" :key="c.id"><Ban v-if="c.effect === 'block'" :size="13" aria-hidden="true" class="inline-icon text-danger" />{{ c.name }} <EffectBadge :effect="c.effect" /></li>
          </ul>
        </div>
      </aside>
    </div>

    <template #footer>
      <span class="footer-note">
        <span v-if="submitted && blockers.length > 0" class="text-danger">{{ blockers[0] }}</span>
        <template v-else>Vérifiez le décompte avant l’envoi.</template>
      </span>
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="hardBlock" @click="submit"><Send :size="16" aria-hidden="true" /> Envoyer la demande</button>
    </template>
  </Drawer>
</template>
