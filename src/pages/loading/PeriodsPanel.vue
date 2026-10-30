<script setup>
import { computed } from 'vue';
import { Pencil, Plus, Trash2 } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Alert from '../../components/ui/Alert.vue';
import Badge from '../../components/ui/Badge.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import { formatRange, TODAY } from '../../utils/dates';
import { periodsOf, uncoveredRanges } from '../../utils/org';

/** Périodes planifiées d'un employé du tableau de chargement. */
const props = defineProps({
  employee: { type: Object, required: true },
  horizon: { type: Number, required: true },
  /** (scheduleId) => couleur dans la frise. */
  colorOf: { type: Function, required: true },
});
const emit = defineEmits(['add', 'edit']);

const store = useStore();
const data = useCompanyData();
const periods = computed(() => periodsOf(store.db, props.employee.id).sort((a, b) => b.start.localeCompare(a.start)));
const gaps = computed(() => uncoveredRanges(store.db, props.employee, TODAY, props.horizon));

function cancel(p) {
  store.cancelPeriod(p.id);
  store.toast('Période annulée', 'info');
}
</script>

<template>
  <section class="panel mt-16">
    <div class="panel-head">
      <h2 class="panel-title">Périodes de {{ employee.firstName }} {{ employee.lastName }}</h2>
      <div class="row-gap">
        <a class="btn btn-sm btn-ghost" :href="`/employes/${employee.id}`">Fiche employé</a>
        <button type="button" class="btn btn-sm btn-primary" @click="emit('add')"><Plus :size="14" aria-hidden="true" /> Planifier</button>
      </div>
    </div>
    <Alert v-if="gaps.length > 0" tone="warning" title="Non planifié">{{ gaps.map((g) => formatRange(g.start, g.end)).join(' · ') }}</Alert>
    <EmptyState v-if="periods.length === 0" title="Aucune période" text="Planifiez une première période pour cet employé." />
    <div v-else class="table-wrap">
      <table class="table">
        <thead><tr><th scope="col">Période</th><th scope="col">Horaire</th><th scope="col">Dates</th><th scope="col">État</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>
          <tr v-for="p in periods" :key="p.id" :class="{ 'row-archived': p.end < TODAY }">
            <td><span class="person-name">{{ p.label }}</span><span v-if="p.reason" class="block small text-muted">{{ p.reason }}</span></td>
            <td><span class="legend-swatch" :style="{ background: colorOf(p.scheduleId) }" aria-hidden="true" /> {{ data.schedule(p.scheduleId)?.name }}</td>
            <td class="nowrap">{{ formatRange(p.start, p.end) }}</td>
            <td>
              <Badge v-if="p.end < TODAY" tone="muted">Terminée</Badge>
              <Badge v-else-if="p.start <= TODAY && p.end >= TODAY" tone="success">En cours</Badge>
              <Badge v-else tone="info">Planifiée</Badge>
            </td>
            <td class="actions">
              <template v-if="p.end >= TODAY">
                <button type="button" class="btn btn-sm btn-ghost" @click="emit('edit', p)"><Pencil :size="13" aria-hidden="true" /> Modifier</button>
                <button type="button" class="btn btn-sm btn-ghost" @click="cancel(p)"><Trash2 :size="13" aria-hidden="true" /> Annuler</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
