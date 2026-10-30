<script setup>
import { computed, ref, watch } from 'vue';
import { Ban, Check, CheckCircle2, Circle, Clock, Eye, MinusCircle, Paperclip, UserCheck, X, XCircle } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Alert from '../../components/ui/Alert.vue';
import Avatar from '../../components/ui/Avatar.vue';
import Badge from '../../components/ui/Badge.vue';
import Drawer from '../../components/ui/Drawer.vue';
import EffectBadge from '../../components/ui/EffectBadge.vue';
import Field from '../../components/ui/Field.vue';
import LeaveStatusBadge from '../../components/ui/LeaveStatusBadge.vue';
import LeaveTypeTag from '../../components/ui/LeaveTypeTag.vue';
import Modal from '../../components/ui/Modal.vue';
import PersonCell from '../../components/ui/PersonCell.vue';
import StepStatusBadge from '../../components/ui/StepStatusBadge.vue';
import { formatDate, formatDateTime, formatDays, formatLong, formatRange, TODAY } from '../../utils/dates';
import { dayHours, formatDaysHours, formatRequestDuration, scheduleOf } from '../../utils/hours';
import { currentStep, findEventConflicts, getBalance } from '../../utils/leave';
import { findPresenceConflicts } from '../../utils/presence';

/** Détail d'une demande de congé : décision par étape, annulation, historique. */
const props = defineProps({ requestId: { type: String, default: undefined } });
const emit = defineEmits(['close']);

const STEP_ICON = { approuve: CheckCircle2, refuse: XCircle, en_attente: Clock, a_venir: Circle, ignore: MinusCircle, info: Eye };
const PART_LABEL = { full: '', am: ' (matin)', pm: ' (après-midi)' };

const store = useStore();
const data = useCompanyData();
const comment = ref('');
const error = ref('');
const confirmCancel = ref(false);
const cancelReason = ref('');

const req = computed(() => data.requests.find((r) => r.id === props.requestId));
const employee = computed(() => data.person(req.value?.employeeId));

watch(() => [props.requestId, req.value?.status, req.value?.steps.length], () => { comment.value = ''; error.value = ''; });

const type = computed(() => data.leaveType(req.value?.leaveTypeId));
const step = computed(() => (req.value ? currentStep(req.value) : undefined));
const approver = computed(() => data.person(step.value?.approverId));
const balance = computed(() => getBalance(store.db, employee.value.id, req.value.leaveTypeId, req.value.id));
const perDay = computed(() => dayHours(scheduleOf(store.db, req.value.employeeId)));
const fmtBal = (d) => (balance.value.scope === 'annuel' ? formatDaysHours(d, perDay.value) : formatDays(d));
const conflicts = computed(() => findEventConflicts(store.db, employee.value.id, req.value.start, req.value.end));
const presence = computed(() => (req.value.status === 'en_attente' || req.value.status === 'approuve'
  ? findPresenceConflicts(store.db, employee.value.id, req.value.leaveTypeId, req.value.start, req.value.end, req.value.id) : []));
const canDecide = computed(() => req.value.status === 'en_attente' && !!step.value);
const isMyTurn = computed(() => !!step.value && store.isStepApprover(step.value));
const canCancel = computed(() => req.value.status === 'en_attente' || (req.value.status === 'approuve' && req.value.end >= TODAY));
const period = computed(() => {
  const r = req.value;
  return r.start === r.end
    ? `${formatLong(r.start)}${PART_LABEL[r.startPart]}`
    : `Du ${formatLong(r.start)}${r.startPart === 'pm' ? ' (après-midi)' : ''} au ${formatLong(r.end)}${r.endPart === 'am' ? ' (matin)' : ''}`;
});
const balanceAfter = computed(() => balance.value.available - (req.value.status === 'annule' || req.value.status === 'refuse' ? 0 : req.value.days));
const history = computed(() => [...req.value.history].reverse());

function onDecide(decision) {
  if (decision === 'refuse' && !comment.value.trim()) { error.value = 'Un commentaire est requis pour motiver un refus.'; return; }
  store.decide(req.value.id, decision, comment.value.trim());
}

function cancel() {
  store.cancelLeave(req.value.id, cancelReason.value.trim());
  confirmCancel.value = false;
  cancelReason.value = '';
}
</script>

<template>
  <Drawer v-if="!req || !employee" open title="Demande introuvable" @close="emit('close')">
    <p>Cette demande n’existe pas dans la société active.</p>
  </Drawer>
  <Drawer v-else open wide :title="`Demande de ${employee.firstName} ${employee.lastName}`" @close="emit('close')">
    <template #subtitle>
      <span class="row-gap"><LeaveStatusBadge :status="req.status" /> <span class="text-muted">Réf. {{ req.id.toUpperCase() }} · envoyée le {{ formatDateTime(req.createdAt) }}</span></span>
    </template>

    <div class="detail-grid">
      <div class="stack">
        <dl class="detail-list">
          <div><dt>Employé</dt><dd><PersonCell :employee="employee" :sub="`${employee.functionName} · ${data.departmentName(employee.departmentId)}`" /></dd></div>
          <div><dt>Type</dt><dd><LeaveTypeTag :type="type" /></dd></div>
          <div><dt>Période</dt><dd>{{ period }}{{ req.startTime ? ` · de ${req.startTime} à ${req.endTime}` : '' }}</dd></div>
          <div>
            <dt>Durée décomptée</dt>
            <dd><strong>{{ formatRequestDuration(req) }}</strong><span v-if="req.hours != null" class="text-muted small"> · soit {{ req.days.toFixed(2).replace('.', ',') }} j de solde</span></dd>
          </div>
          <div><dt>Impact sur le solde</dt><dd><Badge v-if="type?.deductsFromAnnual" tone="primary">Déduit du solde annuel</Badge><Badge v-else tone="neutral">Hors solde annuel</Badge></dd></div>
          <div v-if="balance.tracked">
            <dt>{{ balance.scope === 'annuel' ? 'Solde annuel' : 'Plafond restant' }} (hors cette demande → après)</dt>
            <dd>{{ fmtBal(balance.available) }} → {{ fmtBal(balanceAfter) }}</dd>
          </div>
          <div><dt>Commentaire</dt><dd>{{ req.comment }}<span v-if="!req.comment" class="text-muted">Aucun commentaire</span></dd></div>
          <div>
            <dt>Justificatif</dt>
            <dd><span v-if="req.attachment" class="file-chip"><Paperclip :size="14" aria-hidden="true" /> {{ req.attachment }}</span><span v-else class="text-muted">Aucun</span></dd>
          </div>
        </dl>

        <Alert v-if="conflicts.length > 0 && req.status !== 'annule'" :tone="conflicts.some((c) => c.effect === 'block') ? 'danger' : 'warning'" title="Événements sur la période">
          <ul class="plain-list">
            <li v-for="c in conflicts" :key="c.id">{{ c.name }} ({{ formatRange(c.start, c.end) }}) <EffectBadge :effect="c.effect" /></li>
          </ul>
        </Alert>

        <Alert v-for="c in presence" :key="c.rule" tone="warning" :title="`Règle de présence — ${c.kind === 'solo' ? 'fonction liée' : 'présence minimale'} : ${c.rule}`">
          <p>{{ c.message }}</p>
          <p class="small mt-4">Jours concernés : {{ c.days.slice(0, 6).map((d) => formatDate(d)).join(', ') }}{{ c.days.length > 6 ? ` et ${c.days.length - 6} autre(s)` : '' }}</p>
        </Alert>

        <div v-if="canDecide" class="decision-box">
          <p class="label">Décision pour l’étape {{ step.order }}</p>
          <p v-if="!isMyTurn" class="small text-muted">
            L’étape courante revient à <strong>{{ step?.rh ? 'la RH' : `${approver?.firstName} ${approver?.lastName}` }}</strong>. En tant qu’administrateur RH, vous pouvez saisir sa décision.
          </p>
          <Field label="Commentaire de décision" :error="error" hint="Obligatoire en cas de refus.">
            <template #default="{ id }">
              <textarea :id="id" v-model="comment" rows="2" placeholder="Ex. : OK, passation prévue avec l’équipe." @input="error = ''" />
            </template>
          </Field>
        </div>
      </div>

      <div class="stack">
        <section>
          <h3 class="section-title">Étapes d’approbation</h3>
          <Alert v-if="req.exempt || req.steps.length === 0" tone="success" title="Approbation automatique">
            <UserCheck :size="14" aria-hidden="true" class="inline-icon" /> Aucun approbateur supérieur dans le circuit{{ req.circuitName ? ` « ${req.circuitName} »` : '' }} : la demande a été approuvée automatiquement (décision historisée).
          </Alert>
          <ol v-else class="timeline">
            <li v-for="s in req.steps" :key="s.order" :class="`timeline-item step-${s.status}`">
              <span class="timeline-icon"><component :is="STEP_ICON[s.status]" :size="20" aria-hidden="true" /></span>
              <div class="timeline-content">
                <div class="timeline-head">
                  <span class="step-num">{{ s.order }}</span>
                  <template v-if="s.rh"><span class="person-name">Ressources humaines</span></template>
                  <template v-else>
                    <Avatar :employee="data.person(s.approverId)" :size="24" />
                    <span class="person-name">{{ data.person(s.approverId)?.firstName }} {{ data.person(s.approverId)?.lastName }}</span>
                  </template>
                  <StepStatusBadge :status="s.status" />
                </div>
                <p class="small text-muted">{{ s.rh ? (s.decidedBy ? `Décision de ${data.person(s.decidedBy)?.firstName ?? ''} ${data.person(s.decidedBy)?.lastName ?? ''}` : 'Employé hors circuit d’approbation') : data.person(s.approverId)?.functionName }}{{ s.decidedAt ? ` · ${formatDateTime(s.decidedAt)}` : '' }}</p>
                <blockquote v-if="s.comment" class="quote">{{ s.comment }}</blockquote>
              </div>
            </li>
          </ol>
        </section>
        <section>
          <h3 class="section-title">Historique</h3>
          <ul class="history">
            <li v-for="(h, i) in history" :key="i">
              <span class="history-time">{{ formatDateTime(h.at) }}</span>
              <span>{{ h.label }}<span v-if="data.person(h.actorId)" class="text-muted"> — {{ data.person(h.actorId).firstName }} {{ data.person(h.actorId).lastName }}</span></span>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <Modal :open="confirmCancel" title="Annuler cette demande ?" size="sm" @close="confirmCancel = false">
      <p class="mb-12">La demande restera visible dans l’historique avec le statut « Annulée ». Les étapes en attente seront clôturées.</p>
      <Field label="Motif (facultatif)">
        <template #default="{ id }"><input :id="id" v-model="cancelReason" placeholder="Ex. : changement de planning" /></template>
      </Field>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="confirmCancel = false">Retour</button>
        <button type="button" class="btn btn-danger" @click="cancel">Confirmer l’annulation</button>
      </template>
    </Modal>

    <template #footer>
      <button v-if="canCancel" type="button" class="btn btn-ghost-danger" @click="confirmCancel = true"><Ban :size="16" aria-hidden="true" /> Annuler la demande</button>
      <span class="spacer" />
      <template v-if="canDecide">
        <button type="button" class="btn btn-danger" @click="onDecide('refuse')"><X :size="16" aria-hidden="true" /> Refuser</button>
        <button type="button" class="btn btn-success" @click="onDecide('approve')"><Check :size="16" aria-hidden="true" /> Approuver l’étape {{ step.order }}</button>
      </template>
      <button v-if="!canDecide && !canCancel" type="button" class="btn btn-ghost" @click="emit('close')">Fermer</button>
    </template>
  </Drawer>
</template>
