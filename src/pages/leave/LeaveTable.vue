<script setup>
import { ChevronRight, Paperclip } from '@lucide/vue';
import { useCompanyData } from '../../store/companyData';
import EmptyState from '../../components/ui/EmptyState.vue';
import LeaveStatusBadge from '../../components/ui/LeaveStatusBadge.vue';
import LeaveTypeTag from '../../components/ui/LeaveTypeTag.vue';
import PersonCell from '../../components/ui/PersonCell.vue';
import { formatRange } from '../../utils/dates';
import { formatRequestDuration } from '../../utils/hours';
import { currentStep } from '../../utils/leave';

defineProps({
  requests: { type: Array, required: true },
  hideEmployee: Boolean,
  emptyText: { type: String, default: '' },
});
const emit = defineEmits(['open']);

const data = useCompanyData();
</script>

<template>
  <EmptyState v-if="requests.length === 0" title="Aucune demande" :text="emptyText || 'Aucune demande ne correspond aux filtres sélectionnés.'" />
  <div v-else class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th v-if="!hideEmployee" scope="col">Employé</th>
          <th scope="col">Type</th>
          <th scope="col">Dates</th>
          <th scope="col" class="num">Durée</th>
          <th scope="col">Statut</th>
          <th scope="col">Approbateur actuel</th>
          <th scope="col"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in requests" :key="r.id" class="row-click" @click="emit('open', r.id)">
          <td v-if="!hideEmployee"><PersonCell :employee="data.person(r.employeeId)" :sub="data.departmentName(data.person(r.employeeId)?.departmentId)" /></td>
          <td>
            <LeaveTypeTag :type="data.leaveType(r.leaveTypeId)" />
            <Paperclip v-if="r.attachment" :size="13" class="inline-icon text-muted ml-4" aria-label="Justificatif joint" />
          </td>
          <td class="nowrap">
            {{ formatRange(r.start, r.end) }}
            <span v-if="r.startTime" class="text-muted small"> · {{ r.startTime }}–{{ r.endTime }}</span>
            <span v-else-if="r.startPart !== 'full' || r.endPart !== 'full'" class="text-muted small"> · ½ j</span>
          </td>
          <td class="num">{{ formatRequestDuration(r) }}</td>
          <td><LeaveStatusBadge :status="r.status" /></td>
          <td>
            <span v-if="currentStep(r)" class="small">
              <template v-if="currentStep(r).rh">RH</template>
              <template v-else>{{ data.person(currentStep(r).approverId)?.firstName }} {{ data.person(currentStep(r).approverId)?.lastName }}</template>
              <span class="text-muted"> · étape {{ currentStep(r).order }}/{{ r.steps.length }}</span>
            </span>
            <span v-else class="text-muted small">{{ r.exempt ? 'Approuvée automatiquement' : '—' }}</span>
          </td>
          <td class="actions">
            <button type="button" class="btn btn-sm btn-ghost" :aria-label="`Ouvrir la demande de ${data.person(r.employeeId)?.firstName} ${data.person(r.employeeId)?.lastName}`"
              @click.stop="emit('open', r.id)">
              Détail <ChevronRight :size="14" aria-hidden="true" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
