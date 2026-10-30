<script setup>
import { computed, ref } from 'vue';
import { ArrowDown, ArrowUp, Bell, Plus, Save, Trash2 } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import { INTERVENTION_LABEL, KIND_LABEL } from '../../api/approvalCircuits';
import Alert from '../../components/ui/Alert.vue';
import Drawer from '../../components/ui/Drawer.vue';
import Field from '../../components/ui/Field.vue';

/**
 * Création ou modification d'un circuit (RH-22) : un circuit par département (sous-départements compris), sans date
 * d'effet. Pour changer un circuit, on modifie le même : nom, département (correction d'une erreur) et étapes (de 1 à 5,
 * du niveau le moins élevé au plus élevé). Les demandes déjà envoyées gardent leurs approbateurs.
 */
const props = defineProps({
  /** Circuit modifié ; absent en création. */
  circuit: { type: Object, default: undefined },
});
const emit = defineEmits(['close', 'saved']);

const MAX_STEPS = 5;
const store = useStore();
const data = useCompanyData();
const isEdit = computed(() => !!props.circuit);
const latest = props.circuit?.versions?.[props.circuit.versions.length - 1];

const c = ref({
  name: props.circuit?.name ?? '',
  departmentId: props.circuit?.departmentId ?? '',
  steps: JSON.parse(JSON.stringify(latest?.steps ?? props.circuit?.steps
    ?? [{ kind: 'manager', label: KIND_LABEL.manager, notify: true, intervention: 'validation' }])),
});
const submitted = ref(false);
const saving = ref(false);
const serverError = ref('');

const people = computed(() => data.people.filter((e) => e.status !== 'inactif'));
// Circuit actif d'un autre département déjà affecté à ce département (un seul circuit par département).
const takenBy = (departmentId) => data.circuits.find((x) => !x.archived && x.departmentId === departmentId && x.id !== props.circuit?.id);
/**
 * Départements et sous-départements actifs, chaque sous-département sous son parent. Ceux qui ont déjà un circuit sont
 * grisés (non sélectionnables) ; un sous-département sans circuit hérite de celui de son parent.
 */
const departmentOptions = computed(() => data.activeDepartments.flatMap((d) => [
  { id: d.id, label: d.name, sub: false, taken: takenBy(d.id) },
  ...data.subDepartments(d.id).filter((s) => !s.archived).map((s) => ({ id: s.id, label: s.name, sub: true, taken: takenBy(s.id) })),
]));
const optionLabel = (o) => `${o.sub ? '\u00a0\u00a0\u00a0↳ ' : ''}${o.label}${o.taken ? ` — déjà : « ${o.taken.name} »` : ''}`;
// Circuit hérité par un sous-département choisi (information) : celui de son département parent.
const inherited = computed(() => {
  const d = data.department(c.value.departmentId);
  return d?.parentId ? takenBy(d.parentId) : undefined;
});

/**
 * Doublons interdits (création et modification) : « Manager direct (N+1) » et « Responsable du département » au plus une
 * fois ; « Personne nommée » répétable, mais chaque personne une seule fois. Clé d'une étape : son type, ou la personne.
 */
const stepKey = (s) => (s.kind === 'employee' ? (s.employeeId ? `employee:${s.employeeId}` : null) : s.kind);
/** Numéro (1…) de l'autre étape qui utilise déjà ce type / cette personne, sinon 0. */
const usedAt = (i, key) => (key ? c.value.steps.findIndex((s, j) => j !== i && stepKey(s) === key) + 1 : 0);
/** Pour chaque étape, numéro de l'étape précédente identique (0 si aucune). */
const duplicates = computed(() => c.value.steps.map((s, i) => {
  const key = stepKey(s);
  const first = key ? c.value.steps.findIndex((o) => stepKey(o) === key) : -1;
  return first >= 0 && first < i ? first + 1 : 0;
}));
function duplicateMessage(i) {
  const at = duplicates.value[i];
  if (!at) return '';
  const s = c.value.steps[i];
  if (s.kind === 'employee') {
    const p = people.value.find((x) => x.id === s.employeeId) ?? data.employee(s.employeeId);
    return `${p ? `${p.firstName} ${p.lastName}` : 'Cette personne'} est déjà approbateur à l’étape ${at} : chaque personne ne peut être choisie qu’une seule fois.`;
  }
  return `Le type « ${KIND_LABEL[s.kind]} » est déjà utilisé à l’étape ${at} : il ne peut figurer qu’une seule fois.`;
}

const errors = computed(() => {
  const e = {};
  const name = c.value.name.trim();
  if (!name) e.name = 'Nom requis.';
  else if (!/\p{L}/u.test(name)) e.name = 'Le nom doit contenir au moins une lettre.';
  if (!c.value.departmentId) e.departmentId = 'Un circuit est affecté à un département.';
  else if (takenBy(c.value.departmentId)) e.departmentId = `« ${data.departmentName(c.value.departmentId)} » a déjà le circuit « ${takenBy(c.value.departmentId).name} » : modifiez-le plutôt.`;
  if (c.value.steps.length === 0) e.steps = 'Ajoutez au moins une étape.';
  else if (c.value.steps.some((s) => s.kind === 'employee' && !s.employeeId)) e.steps = 'Choisissez la personne de chaque étape nommée.';
  else if (duplicates.value.some(Boolean)) e.steps = 'Le circuit contient des étapes en double : corrigez-les avant d’enregistrer.';
  else if (!c.value.steps.some((s) => (s.intervention ?? 'validation') === 'validation')) e.steps = 'Au moins une étape doit être de type « Validation requise » : une consultation seule ne valide pas la demande.';
  return e;
});
const err = (k) => (submitted.value ? errors.value[k] : undefined);

const title = computed(() => (isEdit.value ? `Modifier « ${props.circuit.name} »` : 'Nouveau circuit'));
const subtitle = 'Un circuit par département ; un sous-département sans circuit propre hérite de celui de son département. De 1 à 5 approbateurs, du niveau le moins élevé au plus élevé.';

function setKind(i, kind) {
  c.value.steps[i] = { ...c.value.steps[i], kind, label: KIND_LABEL[kind], employeeId: undefined };
}

function move(i, d) {
  const steps = [...c.value.steps];
  [steps[i], steps[i + d]] = [steps[i + d], steps[i]];
  c.value.steps = steps;
}

// Nouvelle étape : « Personne nommée » (toujours possible, chaque personne restant unique).
const addStep = () => { c.value.steps = [...c.value.steps, { kind: 'employee', label: KIND_LABEL.employee, notify: true, intervention: 'validation' }]; };
const removeStep = (i) => { c.value.steps = c.value.steps.filter((_, j) => j !== i); };

async function save() {
  submitted.value = true;
  if (Object.keys(errors.value).length || saving.value) return;
  saving.value = true;
  serverError.value = '';
  try {
    const saved = await store.saveCircuit({ ...c.value, id: props.circuit?.id });
    emit('saved', { saved });
  } catch (e) {
    serverError.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Drawer open :title="title" :subtitle="subtitle" @close="emit('close')">
    <Alert v-if="serverError" tone="danger" title="Enregistrement refusé" class="mb-12">{{ serverError }}</Alert>
    <div class="form-grid">
      <Field v-slot="{ id }" label="Nom" required :error="err('name')" class="span-2"><input :id="id" v-model="c.name" placeholder="Ex. : Circuit Finance" /></Field>
      <Field v-slot="{ id }" label="Département" required :error="err('departmentId')" class="span-2"
        :hint="inherited ? `Ce sous-département aura son propre circuit, au lieu de « ${inherited.name} » hérité de son département.`
          : isEdit ? 'Modifiable en cas d’erreur, vers un département qui n’a pas encore de circuit.' : 'Les départements grisés ont déjà un circuit : modifiez-le plutôt.'">
        <select :id="id" v-model="c.departmentId">
          <option value="" disabled>Sélectionner un département</option>
          <option v-for="o in departmentOptions" :key="o.id" :value="o.id" :disabled="!!o.taken">{{ optionLabel(o) }}</option>
        </select>
      </Field>
    </div>

    <fieldset class="form-section mt-16">
      <legend>Étapes d’approbation</legend>
      <p class="small text-muted">Du niveau le moins élevé (1) au plus élevé. Si le demandeur est l’approbateur d’une étape, cette étape et les précédentes sont ignorées.
        Une étape en « Consultation seule » donne accès à la demande pour information, sans bloquer le circuit.</p>
      <ol class="step-editor mt-8">
        <li v-for="(s, i) in c.steps" :key="i" :class="{ 'step-duplicate': duplicates[i] }">
          <span class="step-num">{{ i + 1 }}</span>
          <div class="step-fields">
            <label class="sr-only" :for="`kind-${i}`">Approbateur, étape {{ i + 1 }}</label>
            <select :id="`kind-${i}`" :value="s.kind" @change="setKind(i, $event.target.value)">
              <option v-for="(label, k) in KIND_LABEL" :key="k" :value="k" :disabled="k !== 'employee' && k !== s.kind && !!usedAt(i, k)">
                {{ label }}{{ k !== 'employee' && usedAt(i, k) ? ` — déjà à l’étape ${usedAt(i, k)}` : '' }}
              </option>
            </select>
            <template v-if="s.kind === 'employee'">
              <label class="sr-only" :for="`emp-${i}`">Personne, étape {{ i + 1 }}</label>
              <select :id="`emp-${i}`" v-model="s.employeeId">
                <option :value="undefined" disabled>Choisir la personne…</option>
                <option v-for="p in people" :key="p.id" :value="p.id" :disabled="p.id !== s.employeeId && !!usedAt(i, `employee:${p.id}`)">
                  {{ p.firstName }} {{ p.lastName }}{{ usedAt(i, `employee:${p.id}`) ? ` — déjà à l’étape ${usedAt(i, `employee:${p.id}`)}` : p.functionName ? ` — ${p.functionName}` : '' }}
                </option>
              </select>
            </template>
            <label class="sr-only" :for="`intervention-${i}`">Type d’intervention, étape {{ i + 1 }}</label>
            <select :id="`intervention-${i}`" v-model="s.intervention" :class="['step-intervention', { info: s.intervention === 'consultation' }]"
              :title="s.intervention === 'consultation' ? 'La demande lui est accessible pour information, sans attendre sa décision' : 'Sa validation est nécessaire pour passer à l’étape suivante'">
              <option v-for="(label, k) in INTERVENTION_LABEL" :key="k" :value="k">{{ label }}</option>
            </select>
          </div>
          <label :class="['step-notify', { on: s.notify }]" :title="s.notify ? 'L’approbateur est notifié quand la demande arrive à son étape' : 'Pas de notification'">
            <input v-model="s.notify" type="checkbox" />
            <Bell :size="14" aria-hidden="true" /> Notifier
          </label>
          <button type="button" class="icon-btn" :disabled="i === 0" :aria-label="`Monter l’étape ${i + 1}`" @click="move(i, -1)"><ArrowUp :size="16" /></button>
          <button type="button" class="icon-btn" :disabled="i === c.steps.length - 1" :aria-label="`Descendre l’étape ${i + 1}`" @click="move(i, 1)"><ArrowDown :size="16" /></button>
          <button type="button" class="icon-btn icon-btn-danger" :disabled="c.steps.length === 1" :aria-label="`Supprimer l’étape ${i + 1}`" @click="removeStep(i)"><Trash2 :size="16" /></button>
          <p v-if="duplicates[i]" class="step-error" role="alert">{{ duplicateMessage(i) }}</p>
        </li>
      </ol>
      <p v-if="err('steps')" class="field-error">{{ err('steps') }}</p>
      <button type="button" class="btn btn-ghost btn-sm mt-8" :disabled="c.steps.length >= MAX_STEPS" @click="addStep">
        <Plus :size="15" aria-hidden="true" /> Ajouter une étape <template v-if="c.steps.length >= MAX_STEPS">(maximum atteint)</template>
      </button>
    </fieldset>

    <template #footer>
      <span class="spacer" />
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
        <Save :size="15" aria-hidden="true" /> {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
      </button>
    </template>
  </Drawer>
</template>

<style scoped>
.step-notify {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
  user-select: none;
}
.step-notify input { position: absolute; opacity: 0; pointer-events: none; }
.step-notify.on { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); }
.step-notify:focus-within { box-shadow: var(--focus); }
/* Type d'intervention : sélecteur discret ; « pour info » en bleu clair pour distinguer les étapes non bloquantes. */
.step-intervention { flex: 0 0 auto; max-width: 230px; }
.step-intervention.info { border-color: #bcd3f0; background-color: var(--primary-soft); color: var(--primary); }
/* Étape en double : sélecteurs bordés de rouge et message sous la ligne (affichés tout de suite, sans attendre l'enregistrement). */
.step-editor li.step-duplicate { flex-wrap: wrap; }
.step-duplicate select { border-color: var(--danger); }
.step-error { flex-basis: 100%; margin: 2px 0 0 34px; font-size: 12px; color: var(--danger); }
</style>
