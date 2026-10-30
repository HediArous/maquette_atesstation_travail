<script setup>
import { computed, ref } from 'vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import { leaveCatalog } from '../../maquette/leaveCatalog';
import { applicablePolicies, policyApplies } from '../../maquette/leaveCatalogModel';
import { circuitOfEmployee, holidayOn, isWorkingDay, scheduleOn } from '../../utils/org';
import { countAuthorization } from '../../utils/hours';
import { diffDays, eachDay, formatDate, TODAY } from '../../utils/dates';
import Field from '../../components/ui/Field.vue';
import Badge from '../../components/ui/Badge.vue';
const props = defineProps({ typeId: { type: String, required: true }, policyId: { type: String, default: '' } });
const store = useStore(), data = useCompanyData();
const employeeId = ref('e1'), from = ref(TODAY), to = ref(TODAY), startTime = ref('11:00'), endTime = ref('14:00');
const employee = computed(() => data.employees.find(e => e.id === employeeId.value));
const type = computed(() => leaveCatalog.types.find(t => t.id === props.typeId));
const policies = computed(() => !employee.value ? [] : applicablePolicies(leaveCatalog, props.typeId, employee.value, from.value, store.db.departments));
const policy = computed(() => policies.value.length === 1 ? policies.value[0] : null);
const schedule = computed(() => employee.value && from.value ? scheduleOn(store.db, employee.value, from.value) : null);
const circuit = computed(() => employee.value ? circuitOfEmployee(store.db, employee.value) : null);
const result = computed(() => {
  if (!employee.value || !from.value || type.value?.unit !== 'minutes' && (!to.value || to.value < from.value || diffDays(from.value, to.value) > 365)) return { error: 'Choisissez une période valide de 366 jours maximum.', rows: [] };
  if (policies.value.length !== 1) return { error: policies.value.length > 1 ? 'Plusieurs politiques applicables : corrigez les affectations.' : 'Aucune politique active applicable à cet employé et à cette date.', rows: [] };
  if (props.policyId && policy.value.id !== props.policyId) return { error: 'Cette politique ne s’applique pas à cet employé et à cette date.', rows: [] };
  if (type.value.archived) return { error: 'Type archivé : aucune nouvelle demande possible.', rows: [] };
  const dates = type.value.unit === 'minutes' ? [from.value] : eachDay(from.value, to.value);
  if (dates.some(day => !policyApplies(policy.value, employee.value, day, store.db.departments))) return { error: 'La politique ne couvre pas toute la période. Scindez la demande à la date de changement.', rows: [] };
  if (type.value.unit === 'minutes') {
    if (!schedule.value?.schedule) return { error: 'Aucun horaire applicable : le calcul horaire est indisponible.', rows: [] };
    if (!startTime.value || !endTime.value || endTime.value <= startTime.value) return { error: 'L’heure de retour doit suivre l’heure de départ.', rows: [] };
    const calc = countAuthorization(store.db, employeeId.value, from.value, startTime.value, endTime.value);
    return { value: `${Math.round(calc.hours * 60)} min`, rows: [{ date: from.value, reason: calc.holiday ? `Jour férié : ${calc.holiday}` : `${calc.outsideMinutes} minute(s) hors temps de travail exclues`, counted: `${Math.round(calc.hours * 60)} min` }] };
  }
  const rows = dates.map(day => {
    const effective = scheduleOn(store.db, employee.value, day);
    if (policy.value.counting === 'worked' && !effective.schedule) return { date: day, missing: true, reason: 'Horaire absent : calcul impossible', counted: '—' };
    const holiday = holidayOn(store.db, store.companyId, day);
    const off = policy.value.counting === 'worked' && !isWorkingDay(store.db, employee.value, day);
    const excluded = off || policy.value.excludeHolidays && !!holiday;
    return { date: day, reason: off ? 'Repos / jour non travaillé du scénario' : policy.value.excludeHolidays && holiday ? `Jour férié : ${holiday.name}` : policy.value.counting === 'calendar' ? 'Jour calendaire' : `Travaillé · ${effective.schedule.name}`, counted: excluded ? 0 : 1 };
  });
  if (rows.some(r => r.missing)) return { error: 'Un horaire manque sur la période. Aucun horaire arbitraire n’est appliqué.', rows };
  return { value: `${rows.reduce((n, r) => n + r.counted, 0)} j`, rows };
});
</script>

<template>
  <section class="inherit-preview">
    <h3>Vérifier avec les paramètres existants</h3>
    <p class="small text-muted">Simulation de décompte, sans dépôt de demande ni consommation de droits. Elle ne vérifie pas les quotas ou justificatifs.</p>
    <div class="form-grid mt-12">
      <Field v-slot="{ id }" label="Employé"><select :id="id" v-model="employeeId"><option v-for="e in data.employees" :key="e.id" :value="e.id">{{ e.firstName }} {{ e.lastName }}</option></select></Field>
      <Field v-slot="{ id }" :label="type?.unit === 'minutes' ? 'Date' : 'Du'"><input :id="id" v-model="from" type="date" /></Field>
      <Field v-if="type?.unit !== 'minutes'" v-slot="{ id }" label="Au"><input :id="id" v-model="to" type="date" :min="from" /></Field>
      <template v-else><Field v-slot="{ id }" label="Départ"><input :id="id" v-model="startTime" type="time" /></Field><Field v-slot="{ id }" label="Retour"><input :id="id" v-model="endTime" type="time" /></Field></template>
    </div>
    <dl class="inherit-details">
      <div><dt>Politique applicable</dt><dd>{{ policy?.name || 'Aucune politique unique' }}<span v-if="policy"> · v{{ policy.version }}</span></dd></div>
      <div><dt>Horaire à la date choisie</dt><dd>{{ schedule?.schedule?.name || 'Aucun horaire' }}<span class="small text-muted"> · {{ schedule?.source }}</span></dd></div>
      <div><dt>Circuit hérité</dt><dd>{{ circuit?.name || 'Traitement RH : aucun circuit suivi' }}<span class="small text-muted"> · aucun choix de circuit dans le type ou la politique</span></dd></div>
      <div><dt>Jours fériés</dt><dd>Calendrier existant de la société · {{ store.db.holidays.filter(h => h.companyId === store.companyId && !h.archived).length }} entrée(s)</dd></div>
    </dl>
    <p v-if="result.error" class="field-error" role="status">{{ result.error }}</p>
    <p v-else class="inherit-total" role="status">Durée calculée : <Badge tone="info">{{ result.value }}</Badge></p>
    <details v-if="result.rows.length"><summary>Voir les jours ou créneaux comptés</summary><div class="table-wrap"><table class="table table-compact"><thead><tr><th>Date</th><th>Explication</th><th>Décompte</th></tr></thead><tbody><tr v-for="r in result.rows" :key="r.date"><td>{{ formatDate(r.date) }}</td><td>{{ r.reason }}</td><td>{{ r.counted }}</td></tr></tbody></table></div></details>
  </section>
</template>
<style scoped>
.inherit-preview { border-top:1px solid var(--border); margin-top:20px; padding-top:18px; }
.inherit-preview h3 { font-size:14px; margin:0 0 8px; }
.inherit-details { margin:18px 0; font-size:12px; }
.inherit-details > div { display:grid; grid-template-columns:170px minmax(0,1fr); gap:12px; padding:8px 0; border-bottom:1px solid var(--border); }
.inherit-details dt { color:var(--muted); }.inherit-details dd { margin:0; }
.inherit-total { display:flex; align-items:center; gap:8px; margin:12px 0; }
summary { cursor:pointer; color:var(--primary); padding:6px 0; font-size:12px; }
@media(max-width:600px) { .inherit-details > div { grid-template-columns:1fr; gap:3px; } }
</style>
