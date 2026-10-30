<script setup>
import { computed } from 'vue';
import { CheckCircle2, Eye, SkipForward } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Alert from '../../components/ui/Alert.vue';
import Avatar from '../../components/ui/Avatar.vue';
import Badge from '../../components/ui/Badge.vue';
import { circuitStepsFor } from '../../utils/org';

/** Circuit hérité du département avec l'approbateur de chaque niveau et les sauts automatiques (RH-23). */
const props = defineProps({
  employee: { type: Object, required: true },
  profile: { type: Object, default: undefined },
});

const SKIP = {
  requester: 'Sauté : l’employé est l’approbateur de ce niveau',
  below: 'Sauté : niveau inférieur à celui de l’employé',
  duplicate: 'Sauté : approbateur déjà présent à un niveau précédent',
  undefined: 'Sauté : aucun approbateur défini pour cet employé',
};

const store = useStore();
const data = useCompanyData();
const circuit = computed(() => data.circuit(props.profile?.circuitId));
const steps = computed(() => (circuit.value ? circuitStepsFor(store.db, props.employee.id, circuit.value) : []));
const active = computed(() => steps.value.filter((s) => !s.skipped));
// Étapes qui valident (les « Consultation seule » reçoivent la demande pour information).
const validating = computed(() => active.value.filter((s) => s.intervention !== 'consultation'));
</script>

<template>
  <Alert v-if="!circuit && employee.followsLeaveCircuit === false" tone="info" title="Hors circuit">L’employé ne suit pas le circuit d’approbation de son département : ses demandes de congé sont validées par la RH.</Alert>
  <Alert v-else-if="!circuit" tone="info" title="Aucun circuit">Le département « {{ data.departmentName(employee.departmentId) }} » n’a pas de circuit d’approbation : les demandes de congé de l’employé sont validées par la RH.</Alert>
  <template v-else>
    <p class="small text-muted">{{ circuit.name }} · circuit du département « {{ data.departmentName(circuit.departmentId) }} », appliqué automatiquement</p>
    <ol class="timeline mt-8">
      <li v-for="(s, i) in steps" :key="i" :class="`timeline-item ${s.skipped ? 'step-ignore' : 'step-en_attente'}`">
        <span class="timeline-icon"><SkipForward v-if="s.skipped" :size="14" /><Eye v-else-if="s.intervention === 'consultation'" :size="14" /><CheckCircle2 v-else :size="14" /></span>
        <div class="timeline-content">
          <div class="timeline-head">
            <span class="step-num">{{ i + 1 }}</span>
            <Avatar v-if="data.person(s.approverId)" :employee="data.person(s.approverId)" :size="24" />
            <span class="person-name">{{ data.person(s.approverId) ? `${data.person(s.approverId).firstName} ${data.person(s.approverId).lastName}` : '—' }}</span>
            <Badge v-if="s.skipped" tone="muted">Sauté</Badge>
            <Badge v-else-if="s.intervention === 'consultation'" tone="info">Pour info</Badge>
            <Badge v-else tone="primary">{{ validating.indexOf(s) === 0 ? '1re validation' : 'Validation' }}</Badge>
          </div>
          <p class="small text-muted">{{ s.label }}{{ s.skipped ? ` · ${SKIP[s.skipped]}` : '' }}</p>
        </div>
      </li>
    </ol>
    <Alert v-if="validating.length === 0" tone="success" title="Validation automatique">Aucun approbateur supérieur à l’employé dans son circuit : ses demandes sont approuvées automatiquement à l’envoi (décision historisée).</Alert>
  </template>
</template>
