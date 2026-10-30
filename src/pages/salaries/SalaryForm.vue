<script setup>
import { computed, ref, watch } from 'vue';
import { useCompanyData } from '../../store/companyData';
import { useStore } from '../../store';
import { contractsApi, fromContractDto } from '../../api/contracts';
import { fromSalaryDto, salariesApi, toSalaryDto } from '../../api/salaries';
import { formatDate } from '../../utils/dates';
import Alert from '../../components/ui/Alert.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import PeriodEndFields from '../../components/ui/PeriodEndFields.vue';
import Switch from '../../components/ui/Switch.vue';

/**
 * Ajout / modification d'un salaire. La période doit être couverte par un contrat actif de l'employé : sous un contrat
 * à durée déterminée, la date de fin est obligatoire et bornée par la fin du contrat ; sous un contrat à durée
 * indéterminée, elle est facultative (salaire en cours). Indications immédiates ici, vérification finale par le backend.
 */
const props = defineProps({
  open: Boolean,
  /** Salaire modifié ; absent = ajout. */
  salary: { type: Object, default: undefined },
  /** Employé imposé (onglet Rémunération de la fiche) : le choix de l'employé est verrouillé. */
  employeeId: { type: String, default: '' },
  title: { type: String, default: '' },
});
const emit = defineEmits(['close', 'saved']);

const store = useStore();
const data = useCompanyData();
const f = ref({});
const submitted = ref(false);
const saveError = ref('');
const serverErrors = ref({});
const busy = ref(false);

const employees = computed(() => [...data.employees].sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)));

watch(() => props.open, (open) => {
  if (!open) return;
  const s = props.salary;
  submitted.value = false;
  saveError.value = '';
  serverErrors.value = {};
  f.value = {
    employeeId: s?.employeeId ?? (props.employeeId || ''),
    start: s?.start ?? '',
    end: s?.end ?? '',
    amount: s?.amount ?? null,
    active: s?.active ?? true,
    // Devise historique conservée en modification ; devise active par défaut à l'ajout.
    deviseId: s?.deviseId || store.activeDevise?.id || '',
  };
}, { immediate: true });

// Contrats actifs de l'employé choisi, lus sur le serveur pour guider la saisie des dates.
const employeeContracts = ref([]);
watch(() => [props.open, f.value.employeeId], async ([open, employeeId]) => {
  employeeContracts.value = [];
  if (!open || !employeeId) return;
  try {
    const res = await contractsApi.search({ employeeId, etat: true, size: 100 });
    if (f.value.employeeId === employeeId) employeeContracts.value = res.content.map(fromContractDto);
  } catch {
    // Indication seulement : le backend vérifie de toute façon la couverture par un contrat.
  }
});

// Contrat en vigueur à la date de début du salaire.
const contract = computed(() => {
  const { start } = f.value;
  if (!start) return undefined;
  return employeeContracts.value.find((c) => c.start <= start && (!c.end || c.end >= start));
});
const fixedTerm = computed(() => contract.value?.fixedTerm ?? false);
const contractLabel = (c) => `${c.typeCode} du ${formatDate(c.start)}${c.end ? ` au ${formatDate(c.end)}` : ', sans date de fin'}`;

// Devise du salaire : décimales de la saisie bornées par la devise et par le stockage (2 décimales).
const devise = computed(() => store.devises.find((d) => d.id === f.value.deviseId) ?? props.salary?.devise);
const maxDecimals = computed(() => Math.min(2, devise.value?.decimals ?? 2));
const decimalsOf = (v) => (String(v).split('.')[1] ?? '').length;

const errors = computed(() => {
  const e = {};
  const { employeeId, start, end, amount } = f.value;
  if (!employeeId) e.employeeId = 'Choisissez un employé.';
  if (!start) e.start = 'Date de début requise.';
  if (amount == null || amount === '' || !(Number(amount) > 0)) e.amount = 'Montant supérieur à 0 requis.';
  else if (decimalsOf(amount) > maxDecimals.value) e.amount = `Au plus ${maxDecimals.value} décimale(s).`;
  if (end && start && end < start) e.end = 'La date de fin ne peut pas précéder la date de début.';
  else if (fixedTerm.value && !end) e.end = 'Périodicité requise : le contrat est à durée déterminée.';
  else if (fixedTerm.value && contract.value.end && end > contract.value.end) e.end = `La date de fin dépasse la fin du contrat (${formatDate(contract.value.end)}).`;
  return e;
});
const err = (k) => (submitted.value ? errors.value[k] : undefined) ?? serverErrors.value[k];

// Champ du SalaryDTO signalé par le backend → champ du formulaire.
const FIELD = { employeeId: 'employeeId', startDate: 'start', endDate: 'end', amount: 'amount', deviseId: 'deviseId' };
watch(f, () => { serverErrors.value = {}; }, { deep: true });

async function save() {
  submitted.value = true;
  if (Object.keys(errors.value).length || busy.value) return;
  busy.value = true;
  saveError.value = '';
  try {
    const dto = toSalaryDto({ ...f.value, amount: Number(f.value.amount) });
    const res = props.salary ? await salariesApi.update(props.salary.id, dto) : await salariesApi.create(dto);
    emit('saved', fromSalaryDto(res), !props.salary);
  } catch (e) {
    if (e.field && FIELD[e.field]) serverErrors.value = { [FIELD[e.field]]: e.message };
    else saveError.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal :open="open" :title="title || (salary ? `Modifier le salaire de ${salary.employeeName}` : 'Nouveau salaire')" @close="emit('close')">
    <Alert v-if="saveError" tone="danger" title="Enregistrement impossible" class="mb-12">{{ saveError }}</Alert>
    <div class="form-grid">
      <Field v-slot="{ id }" label="Employé" required :error="err('employeeId')">
        <select :id="id" v-model="f.employeeId" :disabled="!!employeeId">
          <option value="" disabled>Choisir…</option>
          <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.lastName }} {{ e.firstName }}</option>
        </select>
      </Field>
      <Field v-slot="{ id }" :label="`Montant${devise ? ` (${devise.code})` : ''}`" required :error="err('amount')">
        <span class="input-suffix"><input :id="id" v-model.number="f.amount" type="number" min="0" :step="1 / 10 ** maxDecimals" /><span aria-hidden="true">{{ devise?.symbol }}</span></span>
      </Field>
      <!-- <Field v-slot="{ id }" label="Devise" :error="err('deviseId')"
        :hint="salary ? 'Devise enregistrée avec ce salaire : elle ne change pas quand une autre devise devient active.' : 'Devise active proposée par défaut.'">
        <select :id="id" v-model="f.deviseId">
          <option v-if="!store.devises.length && devise" :value="devise.id">{{ devise.code }} — {{ devise.symbol }}</option>
          <option v-for="d in store.devises" :key="d.id" :value="d.id">{{ d.label }} ({{ d.code }}, {{ d.symbol }}){{ d.active ? ' — active' : '' }}</option>
        </select>
      </Field> -->
      <Field v-slot="{ id }" label="Date de début" required :error="err('start')"
        :hint="contract ? `Contrat ${contractLabel(contract)}.` : f.employeeId && f.start ? 'Aucun contrat actif ne couvre cette date.' : undefined">
        <input :id="id" v-model="f.start" type="date" />
      </Field>
      <PeriodEndFields v-model="f.end" :start="f.start" :required="fixedTerm" :error="err('end')"
        :hint="contract && !fixedTerm ? 'Facultative : vide = salaire en cours (contrat à durée indéterminée).'
          : fixedTerm && contract.end ? `Fin au plus tard le ${formatDate(contract.end)} (fin du contrat).` : undefined" />
    </div>
    <div v-if="!salary" class="mt-12"><Switch v-model="f.active" label="Salaire actif dès sa création" /></div>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="busy" @click="save">{{ salary ? 'Enregistrer' : 'Ajouter' }}</button>
    </template>
  </Modal>
</template>
