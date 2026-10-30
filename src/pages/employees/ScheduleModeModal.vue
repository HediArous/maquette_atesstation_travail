<script setup>
import { computed, ref, watch } from 'vue';
import { CalendarClock, CalendarRange } from '@lucide/vue';
import { useStore } from '../../store';
import { navigate } from '../../router/navigate';
import Alert from '../../components/ui/Alert.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import { formatRange, TODAY } from '../../utils/dates';
import { organisationalSchedule, uncoveredRanges } from '../../utils/org';

/** Bascule au tableau de chargement, ou retour à l'horaire du département (RH-24). */
const props = defineProps({
  employee: { type: Object, required: true },
  open: Boolean,
});
const emit = defineEmits(['close']);

const store = useStore();
const date = ref(TODAY);
const reason = ref('');
const submitted = ref(false);

watch(() => props.open, (open) => { if (open) { date.value = TODAY; reason.value = ''; submitted.value = false; } });

const target = computed(() => (props.employee.scheduleMode === 'organisation' ? 'chargement' : 'organisation'));
const gaps = computed(() => {
  if (target.value !== 'chargement' || !date.value) return [];
  const preview = { ...props.employee, scheduleMode: target.value, loadingSince: date.value };
  return uncoveredRanges(store.db, preview, date.value);
});
const org = computed(() => organisationalSchedule(store.db, props.employee.departmentId, props.employee.subDepartmentId));
const dateError = computed(() => (date.value ? '' : 'La date d’effet est obligatoire.'));

function save() {
  submitted.value = true;
  if (dateError.value) return;
  store.setScheduleMode(props.employee.id, target.value, date.value, reason.value);
  store.toast(target.value === 'chargement' ? 'Employé passé au tableau de chargement' : 'Retour à l’horaire organisationnel');
  emit('close');
}
</script>

<template>
  <Modal :open="open" :title="target === 'chargement' ? 'Passer au tableau de chargement' : 'Revenir à l’horaire organisationnel'" @close="emit('close')">
    <div class="stack">
      <p v-if="target === 'chargement'" class="small">
        À la date d’effet, {{ employee.firstName }} ne suit plus l’horaire de son département : ses horaires sont planifiés par périodes dans le tableau de chargement.
        L’employé y reste tant qu’on ne le ramène pas manuellement à l’horaire organisationnel.
      </p>
      <p v-else class="small">
        À la date d’effet, l’horaire du rattachement s’applique de nouveau : <strong>{{ org.schedule?.name ?? 'aucun horaire défini' }}</strong> ({{ org.source }}).
        Les périodes planifiées sont conservées dans l’historique.
      </p>
      <div class="form-grid">
        <Field v-slot="{ id }" label="Date d’effet" required :error="submitted ? dateError : ''"><input :id="id" v-model="date" type="date" /></Field>
        <Field v-slot="{ id }" label="Motif"><input :id="id" v-model="reason" placeholder="Ex. : affectation aux équipes postées" /></Field>
      </div>
      <Alert v-if="gaps.length > 0" tone="warning" title="Périodes non couvertes">
        Aucune période planifiée pour {{ gaps.map((g) => formatRange(g.start, g.end)).join(' · ') }} : l’employé sera « Non planifié » sur ces dates.
        Planifiez-le ensuite depuis le tableau de chargement.
      </Alert>
      <button v-if="target === 'chargement'" type="button" class="link-btn" @click="emit('close'); navigate('chargement')">
        <CalendarRange :size="13" aria-hidden="true" class="inline-icon" /> Ouvrir le tableau de chargement
      </button>
    </div>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" @click="save"><CalendarClock :size="14" aria-hidden="true" /> Confirmer</button>
    </template>
  </Modal>
</template>
