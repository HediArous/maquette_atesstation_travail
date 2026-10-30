<script setup>
import { computed, ref, watch } from 'vue';
import { Clock, CornerDownRight } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Alert from '../../components/ui/Alert.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import { formatDate, TODAY } from '../../utils/dates';
import { scheduleSummary } from '../../utils/hours';
import { impactedEmployees, nameCode } from '../../utils/org';

/** Création ou modification d'un département / sous-département. `state` : { dep?, parentId? } ; fermée tant qu'il est absent. */
const props = defineProps({
  state: { type: Object, default: undefined },
});
const emit = defineEmits(['close']);

const store = useStore();
const data = useCompanyData();
const f = ref({ name: '', code: '', headId: '', sub: false, parentId: '', scheduleId: '', effectiveDate: TODAY });
const submitted = ref(false);
const saving = ref(false);
const serverError = ref('');
/** Code saisi à la main (création) : il ne suit plus le nom. */
const codeTouched = ref(false);

const dep = computed(() => props.state?.dep);

watch(() => props.state, (state) => {
  if (!state) return;
  submitted.value = false;
  serverError.value = '';
  codeTouched.value = false;
  const d = state.dep;
  const parentId = d?.parentId ?? state.parentId ?? '';
  f.value = { name: d?.name ?? '', code: d?.code ?? '', headId: d?.headId ?? '', sub: !!parentId, parentId, scheduleId: d?.scheduleId ?? '', effectiveDate: TODAY };
}, { immediate: true });

const isSub = computed(() => f.value.sub);
const hasSubs = computed(() => !!dep.value && data.subDepartments(dep.value.id).length > 0);
// Départements actifs de premier niveau ; en modification, le parent actuel reste affiché même s'il est désactivé.
const parentOptions = computed(() => data.departments.filter((d) => d.id !== dep.value?.id && (!d.archived || d.id === f.value.parentId)));
const siblings = computed(() => (isSub.value ? data.subDepartments(f.value.parentId) : data.departments));
const takenCodes = computed(() => new Set(store.db.departments.filter((d) => d.id !== dep.value?.id).map((d) => d.code.trim().toUpperCase())));
// Création : code proposé d'après le nom (préfixe + premières lettres, Paramètres › Numéro de souche), modifiable.
// Il suit le nom tant qu'il n'a pas été saisi à la main ; vidé, il reprend la proposition.
const numbering = computed(() => store.codeNumberings?.departement);
const suggested = computed(() => (numbering.value ? nameCode(numbering.value, f.value.name, takenCodes.value) : ''));
const code = computed(() => (dep.value || codeTouched.value ? f.value.code : suggested.value).trim().toUpperCase());

function onCodeInput(value) {
  f.value.code = value.toUpperCase();
  codeTouched.value = !!value.trim();
}
const schedule = computed(() => data.schedule(f.value.scheduleId));
const parentSchedule = computed(() => (isSub.value ? data.schedule(data.department(f.value.parentId)?.scheduleId) : undefined));
const shownSchedule = computed(() => schedule.value ?? parentSchedule.value);
// Affectation ou remplacement du scénario : appliqué à une date d'effet (RH-21).
const scheduleChanged = computed(() => (f.value.scheduleId || '') !== (dep.value?.scheduleId ?? ''));
const impacted = computed(() => (dep.value ? impactedEmployees(store.db, [dep.value.id], f.value.scheduleId).length : 0));

const errors = computed(() => {
  const e = {};
  if (!f.value.name.trim()) e.name = 'Nom requis.';
  else if (siblings.value.some((d) => d.id !== dep.value?.id && d.name.trim().toLowerCase() === f.value.name.trim().toLowerCase())) e.name = 'Ce nom existe déjà à ce niveau.';
  if (!code.value) e.code = dep.value || !numbering.value ? 'Code requis.' : 'Saisissez le nom ou un code.';
  else if (takenCodes.value.has(code.value)) e.code = 'Ce code est déjà utilisé.';
  if (isSub.value && !f.value.parentId) e.parentId = 'Choisissez le département parent.';
  if (scheduleChanged.value && (!f.value.effectiveDate || f.value.effectiveDate < TODAY)) e.effectiveDate = 'Date d’effet requise, aujourd’hui ou plus tard.';
  return e;
});
const err = (k) => (submitted.value ? errors.value[k] : undefined);

function toggleSub(checked) {
  f.value = { ...f.value, sub: checked, parentId: checked ? f.value.parentId : '' };
}

/** Enregistré dans le backend ; ses refus (nom ou code déjà pris, responsable inactif…) s'affichent dans la fenêtre. */
async function save() {
  submitted.value = true;
  if (Object.keys(errors.value).length || saving.value) return;
  saving.value = true;
  serverError.value = '';
  try {
    const saved = await store.saveDepartment({
      ...(dep.value ?? { companyId: store.companyId }),
      name: f.value.name.trim(), code: code.value, headId: f.value.headId || undefined,
      parentId: isSub.value ? f.value.parentId : undefined,
    });
    if (scheduleChanged.value) await store.assignDepartmentSchedule(saved.id, f.value.scheduleId, f.value.effectiveDate);
    store.toast(`${isSub.value ? 'Sous-département' : 'Département'} « ${saved.name} » ${dep.value ? 'mis à jour' : 'ajouté'} — code ${saved.code}`);
    emit('close');
  } catch (e) {
    serverError.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Modal v-if="state" open :title="dep ? `Modifier « ${dep.name} »` : isSub ? 'Nouveau sous-département' : 'Nouveau département'" @close="emit('close')">
    <Alert v-if="serverError" tone="danger" title="Enregistrement refusé">{{ serverError }}</Alert>
    <label :class="['dep-sub-toggle', { on: isSub, disabled: hasSubs || !!dep }]" :title="dep ? 'Le niveau ne se modifie pas après la création.' : 'Rattacher cette entité à un département existant.'">
      <input type="checkbox" :checked="isSub" :disabled="hasSubs || !!dep" @change="toggleSub($event.target.checked)" />
      <CornerDownRight :size="13" aria-hidden="true" />
      <span>Sous-département</span>
    </label>
    <div class="form-grid mt-12">
      <Field v-if="isSub" v-slot="{ id }" label="Département parent" required :error="err('parentId')" class="span-2">
        <select :id="id" v-model="f.parentId" :disabled="!!dep">
          <option value="">Sélectionner le département parent…</option>
          <option v-for="d in parentOptions" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
      </Field>
      <Field v-slot="{ id }" label="Nom" required :error="err('name')"><input :id="id" v-model="f.name" placeholder="Ex. : Financier" /></Field>
      <Field v-slot="{ id }" label="Code" required :error="err('code')" :hint="dep ? 'Unique dans la société.' : 'Proposé d’après le nom (Paramètres › Numéro de souche), modifiable.'">
        <input :id="id" :value="code" maxlength="20" :placeholder="dep ? '' : 'Déduit du nom'" @input="onCodeInput($event.target.value)" />
      </Field>
      <Field v-slot="{ id }" label="Responsable">
        <select :id="id" v-model="f.headId">
          <option value="">À définir</option>
          <option v-for="e in data.employees.filter((x) => x.status !== 'inactif' || x.id === f.headId)" :key="e.id" :value="e.id">{{ e.firstName }} {{ e.lastName }}</option>
        </select>
      </Field>
      <Field v-slot="{ id }" label="Horaire organisationnel"
        :hint="isSub ? 'Facultatif : sans horaire propre, le sous-département hérite de celui de son département.' : 'Facultatif : appliqué aux employés en mode organisationnel.'">
        <select :id="id" v-model="f.scheduleId">
          <option value="">{{ isSub ? 'Hériter du département' : 'Aucun' }}</option>
          <option v-for="s in data.schedules.filter((x) => x.departmentSchedule !== false && (!x.archived || x.id === f.scheduleId))" :key="s.id" :value="s.id">{{ s.name }} — {{ scheduleSummary(s) }}</option>
        </select>
      </Field>
      <Field v-if="scheduleChanged" v-slot="{ id }" label="Date d’effet de l’horaire" required :error="err('effectiveDate')" class="span-2"
        :hint="dep ? `${impacted} employé(s) en horaire organisationnel concerné(s) à compter du ${formatDate(f.effectiveDate || TODAY)} ; le tableau de chargement n’est pas affecté.` : 'Appliqué dès la création du département.'">
        <input :id="id" v-model="f.effectiveDate" type="date" :min="TODAY" />
      </Field>
    </div>
    <p v-if="shownSchedule" class="dep-sched"><Clock :size="13" aria-hidden="true" /> <strong>{{ shownSchedule.name }}</strong>{{ schedule ? '' : ' (hérité)' }} · {{ scheduleSummary(shownSchedule) }}</p>
    <p v-if="!isSub && !dep" class="small text-muted mt-12">Affectez ensuite un circuit d’approbation à ce département (Paramètres › Circuits d’approbation) : la création d’employés y est bloquée sans circuit.</p>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Enregistrement…' : dep ? 'Enregistrer' : 'Ajouter' }}</button>
    </template>
  </Modal>
</template>
