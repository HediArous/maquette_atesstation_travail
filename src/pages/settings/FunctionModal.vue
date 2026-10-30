<script setup>
import { computed, ref, watch } from 'vue';
import { UserRound, Users } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Alert from '../../components/ui/Alert.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import Switch from '../../components/ui/Switch.vue';
import LinkedFunctionSelect from './LinkedFunctionSelect.vue';
import { nameCode } from '../../utils/org';

/** Création ou modification d'une fonction (backend /api/job-positions). `state` : { fn? } ; fermée tant qu'il est absent. */
const props = defineProps({
  state: { type: Object, default: undefined },
});
const emit = defineEmits(['close']);

const store = useStore();
const data = useCompanyData();
const f = ref({ name: '', departmentId: '', interim: false, kind: 'solo', minPresent: '', relatedFunctionId: '' });
const submitted = ref(false);
const saving = ref(false);
const serverError = ref('');

const fn = computed(() => props.state?.fn);
// Départements et sous-départements actifs de la base, dans l'ordre de l'arborescence.
const deptOptions = computed(() => data.activeDepartments.flatMap((d) => [d, ...data.subDepartments(d.id).filter((x) => !x.archived)]));
const deptLabel = (d) => { const p = data.department(d.parentId); return p ? `${p.name} › ${d.name}` : d.name; };

watch(() => props.state, (state) => {
  if (!state) return;
  submitted.value = false;
  serverError.value = '';
  const x = state.fn;
  f.value = {
    name: x?.name ?? '', departmentId: x?.departmentId ?? (data.activeDepartments[0]?.id ?? ''), interim: x?.interim ?? false,
    kind: x?.kind ?? 'solo', minPresent: x?.minPresent != null ? String(x.minPresent) : '', relatedFunctionId: (x && data.linkedFunction(x)?.id) ?? '',
  };
}, { immediate: true });

const count = computed(() => (fn.value ? data.employees.filter((e) => e.functionId === fn.value.id && e.status !== 'inactif').length : 0));
// Code attribué par le backend à la création (Paramètres › Numéro de souche) : aperçu en création, lecture seule ensuite.
const takenCodes = computed(() => new Set(store.db.functions.map((x) => x.code)));
const code = computed(() => fn.value?.code
  ?? (store.codeNumberings?.fonction && f.value.name.trim() ? nameCode(store.codeNumberings.fonction, f.value.name, takenCodes.value) : ''));
// Fonctions solo proposées comme fonction liée (hors elle-même) ; la liaison actuelle reste affichée même si elle est archivée.
const soloOptions = computed(() => data.functions.filter((x) => x.id !== fn.value?.id && x.interim && x.kind === 'solo'
  && (!x.archived || x.id === f.value.relatedFunctionId)));
// Fonctions qui désignent celle-ci comme fonction liée : elle doit rester solo.
const linkedBy = computed(() => (fn.value ? data.functions.filter((x) => x.relatedFunctionId === fn.value.id) : []));
// Liaison réciproque : si la fonction choisie est déjà liée à une autre, cette ancienne liaison sera remplacée.
const replacedLink = computed(() => {
  const chosen = data.fn(f.value.relatedFunctionId);
  const current = chosen && data.linkedFunction(chosen);
  return current && current.id !== fn.value?.id ? { chosen, current } : undefined;
});

const errors = computed(() => {
  const e = {};
  const name = f.value.name.trim().toLowerCase();
  if (!name) e.name = 'Intitulé requis.';
  else if (store.db.functions.some((x) => x.id !== fn.value?.id && x.name.trim().toLowerCase() === name)) e.name = 'Une fonction porte déjà ce nom.';
  if (!f.value.departmentId) e.departmentId = deptOptions.value.length ? 'Département requis.' : 'Aucun département actif : créez-en dans Paramètres › Départements.';
  if (f.value.interim && f.value.kind === 'groupe') {
    const n = Number(f.value.minPresent);
    if (f.value.minPresent === '' || !Number.isInteger(n) || n < 1) e.minPresent = 'Présence minimale requise : au moins 1 personne.';
  }
  if (linkedBy.value.length && !(f.value.interim && f.value.kind === 'solo')) {
    e.kind = `Fonction liée par ${linkedBy.value.map((x) => `« ${x.name} »`).join(', ')} : elle doit rester une fonction solo.`;
  }
  return e;
});

/** Enregistré dans le backend ; ses refus (règles d'intérim, fonction liée non solo…) s'affichent dans la fenêtre. */
async function save() {
  submitted.value = true;
  if (Object.keys(errors.value).length || saving.value) return;
  saving.value = true;
  serverError.value = '';
  const solo = f.value.interim && f.value.kind === 'solo';
  try {
    const saved = await store.saveFunction({
      ...(fn.value ?? {}),
      name: f.value.name.trim(), departmentId: f.value.departmentId || undefined, interim: f.value.interim, kind: f.value.kind,
      minPresent: f.value.interim && f.value.kind === 'groupe' ? Number(f.value.minPresent) : undefined,
      relatedFunctionId: solo ? f.value.relatedFunctionId || undefined : undefined,
    });
    store.toast(`Fonction « ${saved.name} » ${fn.value ? 'mise à jour' : 'ajoutée'} — code ${saved.code}${saved.interim ? ` — intérim ${saved.kind}` : ''}`);
    emit('close');
  } catch (e) {
    serverError.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (saving.value || !window.confirm(`Supprimer définitivement la fonction « ${fn.value.name} » ?`)) return;
  saving.value = true;
  serverError.value = '';
  try {
    await store.deleteFunction(fn.value.id);
    store.toast(`Fonction « ${fn.value.name} » supprimée`, 'info');
    emit('close');
  } catch (e) {
    serverError.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Modal v-if="state" open :title="fn ? `Modifier « ${fn.name} »` : 'Nouvelle fonction'" @close="emit('close')">
    <Alert v-if="serverError" tone="danger" title="Enregistrement refusé">{{ serverError }}</Alert>
    <div class="form-grid">
      <Field v-slot="{ id }" label="Intitulé" required :error="submitted ? errors.name : ''"><input :id="id" v-model="f.name" /></Field>
      <Field v-slot="{ id }" label="Département" required :error="submitted ? errors.departmentId : ''">
        <select :id="id" v-model="f.departmentId">
          <option v-if="!f.departmentId" value="" disabled>Sélectionner un département</option>
          <option v-for="d in deptOptions" :key="d.id" :value="d.id">{{ deptLabel(d) }}</option>
          <option v-if="fn && data.department(f.departmentId)?.archived" :value="f.departmentId">{{ data.department(f.departmentId).name }} (archivé)</option>
        </select>
      </Field>
      <Field v-slot="{ id }" label="Code" :hint="fn ? 'Attribué à la création, non modifiable.' : 'Généré à l’enregistrement (Paramètres › Numéro de souche).'">
        <input :id="id" class="mono" :value="code" readonly placeholder="Généré automatiquement" />
      </Field>
    </div>
    <fieldset class="form-section mt-16">
      <legend>Règles d’intérim</legend>
      <Switch v-model="f.interim" label="Appliquer les règles d’intérim à cette fonction" />
      <p v-if="!f.interim" class="small text-muted mt-8">Aucune contrainte de suppléance ni de présence minimale : les absences des titulaires ne sont pas contrôlées.</p>
      <template v-else>
        <div class="deduct-choice mt-12" role="radiogroup" aria-label="Type de fonction">
          <label :class="['deduct-option', { checked: f.kind === 'solo' }]">
            <input v-model="f.kind" type="radio" name="fn-kind" value="solo" />
            <UserRound :size="18" aria-hidden="true" />
            <span><span class="person-name">Fonction solo</span><span class="block small text-muted">Une seule personne. Peut être liée à d’autres fonctions solo pour la suppléance.</span></span>
          </label>
          <label :class="['deduct-option', { checked: f.kind === 'groupe' }]">
            <input v-model="f.kind" type="radio" name="fn-kind" value="groupe" />
            <Users :size="18" aria-hidden="true" />
            <span><span class="person-name">Fonction groupe</span><span class="block small text-muted">Plusieurs personnes. On fixe le nombre minimum de présents.</span></span>
          </label>
        </div>
        <Alert v-if="f.kind === 'solo' && count > 1" tone="warning" title="Plusieurs titulaires">{{ count }} personnes occupent cette fonction : le type « groupe » serait plus adapté.</Alert>
        <div v-if="f.kind === 'solo'" class="cap-row">
          <Field v-slot="{ id }" label="Fonction liée" class="linked-field" hint="Facultatif. Fonction solo qui assure la suppléance ; la liaison s’applique dans les deux sens.">
            <LinkedFunctionSelect :id="id" v-model="f.relatedFunctionId" :options="soloOptions" :current-id="fn?.id ?? ''" />
          </Field>
        </div>
        <Alert v-if="f.kind === 'solo' && replacedLink" tone="warning" title="Liaison remplacée">« {{ replacedLink.chosen.name }} » est actuellement liée à « {{ replacedLink.current.name }} » : cette liaison sera retirée.</Alert>
        <div v-if="f.kind === 'groupe'" class="cap-row">
          <Field v-slot="{ id }" label="Présence minimale (personnes)" required :error="submitted ? errors.minPresent : ''"
            :hint="fn ? `Effectif actif : ${count}. Exemple : 3 personnes et 2 requises → 1 absence possible à la fois.` : 'Peut aussi être réglée dans « Règles et quotas ».'">
            <input :id="id" v-model="f.minPresent" type="number" min="1" step="1" placeholder="Au moins 1" />
          </Field>
        </div>
      </template>
      <p v-if="submitted && errors.kind" class="field-error mt-8">{{ errors.kind }}</p>
    </fieldset>
    <template #footer>
      <button v-if="fn" type="button" class="btn btn-ghost text-danger" :disabled="saving" @click="remove">Supprimer</button>
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Enregistrement…' : fn ? 'Enregistrer' : 'Ajouter' }}</button>
    </template>
  </Modal>
</template>

<style scoped>
/* Assez large pour lire le nom et le code de la fonction liée. */
.cap-row .linked-field { width: min(100%, 380px); }
</style>
