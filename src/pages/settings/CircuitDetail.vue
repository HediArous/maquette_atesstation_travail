<script setup>
import { computed } from 'vue';
import { Bell, Building2, CalendarDays, Eye, Users } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import ArchivedBadge from '../../components/ui/ArchivedBadge.vue';
import Avatar from '../../components/ui/Avatar.vue';
import Badge from '../../components/ui/Badge.vue';
import Drawer from '../../components/ui/Drawer.vue';
import { circuitForDepartment } from '../../utils/org';
import { circuitPeriod, circuitState } from './circuits';

/** Fiche d'un circuit (RH-22) : département (et sous-départements qui en héritent), employés concernés et étapes. */
const props = defineProps({
  circuit: { type: Object, required: true },
});
const emit = defineEmits(['close', 'edit']);

const store = useStore();
const data = useCompanyData();

const state = computed(() => circuitState(props.circuit));
const department = computed(() => data.department(props.circuit.departmentId));
const parent = computed(() => (department.value?.parentId ? data.department(department.value.parentId) : undefined));
// Sous-départements sans circuit propre : ils héritent de ce circuit.
const inheritedBy = computed(() => data.subDepartments(props.circuit.departmentId)
  .filter((d) => !d.archived && circuitForDepartment(store.db, d.id)?.id === props.circuit.id));
const users = computed(() => data.profiles.filter((p) => p.circuitId === props.circuit.id).length);

function stepLabel(s) {
  if (s.kind !== 'employee') return s.label;
  const p = data.person(s.employeeId);
  return p ? `${p.firstName} ${p.lastName}` : 'Personne nommée (introuvable)';
}
const stepSub = (s) => (s.kind === 'employee' ? data.person(s.employeeId)?.functionName || 'Personne nommée' : 'Résolu pour chaque demandeur');
</script>

<template>
  <Drawer open :title="circuit.name" subtitle="Fiche du circuit d’approbation" @close="emit('close')">
    <div class="cd-status">
      <ArchivedBadge v-if="circuit.archived" />
      <Badge :tone="state.tone">{{ state.label }}</Badge>
    </div>

    <dl class="cd-facts">
      <div>
        <dt><Building2 :size="14" aria-hidden="true" /> Département</dt>
        <dd>
          {{ department?.name }}
          <span v-if="parent" class="block small text-muted">Sous-département de « {{ parent.name }} »</span>
          <span v-if="inheritedBy.length" class="block small text-muted">Hérité par : {{ inheritedBy.map((d) => d.name).join(', ') }}</span>
        </dd>
      </div>
      <div>
        <dt><CalendarDays :size="14" aria-hidden="true" /> Création</dt>
        <dd>{{ circuitPeriod(circuit) }}</dd>
      </div>
      <div>
        <dt><Users :size="14" aria-hidden="true" /> Employés concernés</dt>
        <dd>{{ users }} employé{{ users > 1 ? 's' : '' }} aujourd’hui</dd>
      </div>
    </dl>

    <h3 class="cd-title">Étapes d’approbation</h3>
    <ol class="cd-versions">
      <li class="cd-version current">
        <ol class="cd-steps">
          <li v-for="(s, i) in circuit.steps" :key="i">
            <span class="step-num">{{ i + 1 }}</span>
            <Avatar v-if="s.kind === 'employee' && data.person(s.employeeId)" :employee="data.person(s.employeeId)" :size="22" />
            <span class="cd-step-text">
              <span>{{ stepLabel(s) }}</span>
              <span class="block small text-muted">{{ stepSub(s) }}</span>
            </span>
            <span v-if="s.intervention === 'consultation'" class="cd-notify" title="Reçoit la demande pour information, sans bloquer le circuit"><Eye :size="12" aria-hidden="true" /> Pour info</span>
            <span v-if="s.notify" class="cd-notify" title="L’approbateur est notifié quand la demande arrive à son étape"><Bell :size="12" aria-hidden="true" /> Notifié</span>
          </li>
        </ol>
      </li>
    </ol>

    <template #footer>
      <span class="spacer" />
      <button type="button" class="btn btn-ghost" @click="emit('close')">Fermer</button>
      <button v-if="!circuit.archived" type="button" class="btn btn-primary" @click="emit('edit', circuit)">Modifier</button>
    </template>
  </Drawer>
</template>

<style scoped>
.cd-status { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.cd-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 20px; margin: 0 0 18px; padding: 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
.cd-facts dt { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
.cd-facts dd { margin: 3px 0 0; font-weight: 500; }
.cd-title { margin: 0 0 8px; font-size: 14px; }
.cd-versions { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.cd-version { padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; }
.cd-version.current { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.cd-version.past { opacity: .8; }
.cd-version-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cd-dot { color: var(--muted); }
.cd-version.current .cd-dot { color: var(--primary); }
.cd-when { margin-left: auto; }
.cd-steps { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 6px; }
.cd-steps li { display: flex; align-items: center; gap: 10px; }
.cd-step-text { flex: 1; min-width: 0; }
.cd-notify { display: inline-flex; align-items: center; gap: 4px; padding: 1px 7px; border-radius: 999px; background: var(--primary-soft); color: var(--primary); font-size: 11px; font-weight: 500; }
@media (max-width: 640px) { .cd-facts { grid-template-columns: 1fr; } .cd-when { margin-left: 0; } }
</style>
