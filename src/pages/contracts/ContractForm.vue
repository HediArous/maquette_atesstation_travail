<script setup>
import { computed, ref, watch } from 'vue';
import { useCompanyData } from '../../store/companyData';
import { contractsApi, defaultTrialEnd, fromContractDto, overlappingContract, toContractDto } from '../../api/contracts';
import { fromTypeContractDto, typeContractsApi } from '../../api/typeContracts';
import { formatDate } from '../../utils/dates';
import Alert from '../../components/ui/Alert.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import PeriodEndFields from '../../components/ui/PeriodEndFields.vue';
import Switch from '../../components/ui/Switch.vue';

/**
 * Ajout / modification d'un contrat. Durée déterminée : date de fin calculée depuis la périodicité (PeriodEndFields) ;
 * indéterminée : périodicité et fin désactivées, fin vide ;
 * la fin de période d'essai est proposée depuis le type et la date de début, et n'est plus recalculée une fois
 * personnalisée. Le chevauchement avec un autre contrat de l'employé est signalé ici, et toujours vérifié par le backend.
 */
const props = defineProps({
  open: Boolean,
  /** Contrat modifié ; absent = ajout. */
  contract: { type: Object, default: undefined },
  /** Employé imposé (onglet Contrats de la fiche) : le choix de l'employé est verrouillé. */
  employeeId: { type: String, default: '' },
  /** Valeurs proposées pour un ajout (ex. renouvellement : même type, début au lendemain de l'échéance). */
  preset: { type: Object, default: undefined },
  title: { type: String, default: '' },
});
const emit = defineEmits(['close', 'saved']);

const data = useCompanyData();
const types = ref([]);
const typesError = ref('');
const f = ref({});
const submitted = ref(false);
const saveError = ref('');
const serverErrors = ref({});
const busy = ref(false);
// Période d'essai maximale, en mois (même borne que le backend).
const TRIAL_MAX = 120;
const TRIAL_CHOICES = Array.from({ length: TRIAL_MAX + 1 }, (_, i) => i);
// Période d'essai choisie à la main : elle n'est plus remplacée par celle du type.
const trialCustomized = ref(false);

const employees = computed(() => [...data.employees].sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)));
const type = computed(() => types.value.find((t) => t.id === f.value.typeContractId));
const fixedTerm = computed(() => type.value?.fixedTerm ?? false);
const typeTrialMonths = computed(() => type.value?.trialMonths ?? 0);
// Date de fin de l'essai qui découle des mois choisis (affichée en aide).
const trialEnd = computed(() => defaultTrialEnd(f.value.start, f.value.trialMonths));

watch(() => props.open, async (open) => {
  if (!open) return;
  const c = props.contract;
  submitted.value = false;
  saveError.value = '';
  serverErrors.value = {};
  f.value = {
    employeeId: c?.employeeId ?? (props.employeeId || ''),
    typeContractId: c?.typeContractId ?? (c ? '' : props.preset?.typeContractId ?? ''),
    start: c?.start ?? (c ? '' : props.preset?.start ?? ''),
    end: c?.end ?? (c ? '' : props.preset?.end ?? ''),
    trialMonths: c?.trialMonths ?? null,
    active: c?.active ?? true,
  };
  // En modification, la période du contrat est conservée telle quelle.
  trialCustomized.value = c?.trialMonths != null;
  await loadTypes(c);
  // Contrat enregistré sans durée d'essai : déduite de sa date de fin d'essai, à défaut celle du type.
  if (f.value.trialMonths == null) {
    const months = c?.trialEnd ? TRIAL_CHOICES.find((n) => defaultTrialEnd(c.start, n) === c.trialEnd) : undefined;
    f.value.trialMonths = months ?? (c?.trialEnd ? null : typeTrialMonths.value);
  }
}, { immediate: true });

// Types actifs ; en modification, le type actuel du contrat reste proposé même s'il a été désactivé depuis.
async function loadTypes(c) {
  typesError.value = '';
  try {
    const active = (await typeContractsApi.list(true)).map((dto) => fromTypeContractDto(dto));
    if (c && !active.some((t) => t.id === c.typeContractId)) {
      active.push(fromTypeContractDto(await typeContractsApi.get(c.typeContractId)));
    }
    types.value = active;
  } catch (e) {
    typesError.value = e.message;
  }
}

// Type modifié : date de fin vidée pour un type indéterminé, période d'essai du type reprise si non personnalisée.
watch(() => [f.value.typeContractId, typeTrialMonths.value], () => {
  if (!props.open || !type.value) return;
  if (!fixedTerm.value) f.value.end = '';
  if (!trialCustomized.value) f.value.trialMonths = typeTrialMonths.value;
});

// Nombre entier positif : signe, exposant et décimales refusés à la frappe.
function blockNonDigit(event) {
  if (['-', '+', 'e', 'E', '.', ','].includes(event.key)) event.preventDefault();
}

// Saisie libre : vide = null (erreur affichée) ; une valeur négative est ramenée à 0.
function chooseTrial(value) {
  f.value.trialMonths = value === '' ? null : Math.max(0, Number(value));
  trialCustomized.value = true;
}

// Contrats de l'employé choisi (archivés compris), lus sur le serveur pour signaler immédiatement un chevauchement.
const employeeContracts = ref([]);
watch(() => [props.open, f.value.employeeId], async ([open, employeeId]) => {
  employeeContracts.value = [];
  if (!open || !employeeId) return;
  try {
    const res = await contractsApi.search({ employeeId, size: 100 });
    if (f.value.employeeId === employeeId) employeeContracts.value = res.content.map(fromContractDto);
  } catch {
    // Indication seulement : le backend refusera de toute façon un chevauchement à l'enregistrement.
  }
});

const overlap = computed(() => overlappingContract(employeeContracts.value, {
  id: props.contract?.id, employeeId: f.value.employeeId, start: f.value.start, end: fixedTerm.value ? f.value.end : '',
}));

const errors = computed(() => {
  const e = {};
  const { employeeId, typeContractId, start, end } = f.value;
  if (!employeeId) e.employeeId = 'Choisissez un employé.';
  if (!typeContractId) e.typeContractId = 'Choisissez un type de contrat.';
  else if (type.value?.archived && typeContractId !== props.contract?.typeContractId) e.typeContractId = 'Ce type de contrat est désactivé.';
  if (!start) e.start = 'Date de début requise.';
  if (fixedTerm.value && !end) e.end = 'Périodicité requise pour un contrat à durée déterminée.';
  else if (end && start && end < start) e.end = 'La date de fin ne peut pas précéder la date de début.';
  const months = f.value.trialMonths;
  if (type.value && (months == null || !Number.isInteger(months) || months < 0 || months > TRIAL_MAX)) e.trialMonths = `Nombre entier de mois, de 0 à ${TRIAL_MAX}.`;
  else if (trialEnd.value && end && trialEnd.value > end) e.trialMonths = 'La période d’essai dépasse la date de fin du contrat.';
  if (overlap.value) {
    const o = overlap.value;
    e.start = `Période déjà couverte par le contrat ${o.typeCode} de cet employé (du ${formatDate(o.start)}${o.end ? ` au ${formatDate(o.end)}` : ', sans date de fin'}).`;
  }
  return e;
});
const err = (k) => (submitted.value ? errors.value[k] : undefined) ?? serverErrors.value[k];

// Champ du ContractDTO signalé par le backend → champ du formulaire.
const FIELD = { employeeId: 'employeeId', typeContractId: 'typeContractId', contractStart: 'start', contractEnd: 'end', periodeEssai: 'trialMonths' };
watch(f, () => { serverErrors.value = {}; }, { deep: true });

async function save() {
  submitted.value = true;
  if (Object.keys(errors.value).length || busy.value) return;
  busy.value = true;
  saveError.value = '';
  try {
    const dto = toContractDto({ ...f.value, trialMonths: f.value.trialMonths ?? 0 });
    const res = props.contract ? await contractsApi.update(props.contract.id, dto) : await contractsApi.create(dto);
    emit('saved', fromContractDto(res), !props.contract);
  } catch (e) {
    if (e.field && FIELD[e.field]) serverErrors.value = { [FIELD[e.field]]: e.message };
    else saveError.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal :open="open" :title="title || (contract ? `Modifier le contrat de ${contract.employeeName}` : 'Nouveau contrat')" @close="emit('close')">
    <Alert v-if="typesError" tone="danger" title="Types de contrat non chargés" class="mb-12">{{ typesError }}</Alert>
    <Alert v-if="saveError" tone="danger" title="Enregistrement impossible" class="mb-12">{{ saveError }}</Alert>
    <div class="form-grid">
      <Field v-slot="{ id }" label="Employé" required :error="err('employeeId')">
        <select :id="id" v-model="f.employeeId" :disabled="!!employeeId">
          <option value="" disabled>Choisir…</option>
          <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.lastName }} {{ e.firstName }}</option>
        </select>
      </Field>
      <Field v-slot="{ id }" label="Type de contrat" required :error="err('typeContractId')"
        :hint="type ? `${type.fixedTerm ? 'Durée déterminée' : 'Durée indéterminée'} · ${type.trialMonths ? `essai de ${type.trialMonths} mois` : 'sans période d’essai'}` : undefined">
        <select :id="id" v-model="f.typeContractId">
          <option value="" disabled>Choisir…</option>
          <option v-for="t in types" :key="t.id" :value="t.id">{{ t.name }}{{ t.archived ? ' (désactivé)' : '' }}</option>
        </select>
      </Field>
      <Field v-slot="{ id }" label="Date de début" required :error="err('start')"><input :id="id" v-model="f.start" type="date" /></Field>
      <PeriodEndFields v-model="f.end" :start="f.start" :required="fixedTerm" :disabled="!fixedTerm" :error="err('end')"
        :hint="type && !fixedTerm ? 'Sans objet pour un contrat à durée indéterminée.' : undefined" />
      <Field v-slot="{ id }" label="Période d’essai" :error="err('trialMonths')"
        :hint="trialEnd ? `Fin de l’essai le ${formatDate(trialEnd)}.` : type ? `Proposée par le type : ${typeTrialMonths} mois ; modifiable.` : 'Proposée par le type de contrat ; modifiable.'">
        <span class="input-suffix">
          <input :id="id" type="number" min="0" :max="TRIAL_MAX" step="1" inputmode="numeric" :value="f.trialMonths ?? ''" :disabled="!type" placeholder="0"
            @keydown="blockNonDigit" @input="chooseTrial($event.target.value)" @blur="$event.target.value = f.trialMonths ?? ''" />
          <span aria-hidden="true">mois</span>
        </span>
      </Field>
    </div>
    <div v-if="!contract" class="mt-12"><Switch v-model="f.active" label="Contrat actif dès sa création" /></div>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="busy" @click="save">{{ contract ? 'Enregistrer' : 'Ajouter' }}</button>
    </template>
  </Modal>
</template>
