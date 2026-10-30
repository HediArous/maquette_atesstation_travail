<script setup>
import { useSettingsRights } from './settingsRights';
import { computed, ref, watch } from 'vue';
import { useStore } from '../../store';
import Alert from '../../components/ui/Alert.vue';
import Field from '../../components/ui/Field.vue';
import FormCard from '../../components/FormCard.vue';
import SaveBar from '../../components/SaveBar.vue';
import { nameCode } from '../../utils/org';
import { CODE_SERIES } from './codeSeries';

/**
 * Numéro de souche d'une série de codes déduits du nom (départements, fonctions, primes, types de contrat et de documents) :
 * préfixe + premières lettres du nom, sans compteur.
 * Enregistré dans le backend (PUT /api/code-numbering/{entity}), qui attribue lui-même le code à la création.
 */
const props = defineProps({
  /** Série de CODE_SERIES : 'departement', 'fonction', 'prime', 'type_document'. */
  entity: { type: String, required: true },
  label: { type: String, required: true },
  item: { type: String, required: true },
});

const SEPARATORS = [{ value: '-', label: 'Tiret ( - )' }, { value: '/', label: 'Barre oblique ( / )' }, { value: '', label: 'Aucun' }];

const store = useStore();
const { canEdit } = useSettingsRights();
const saved = computed(() => store.codeNumberings?.[props.entity]);
const n = ref(saved.value ? { ...saved.value } : undefined);
const submitted = ref(false);
const saving = ref(false);

// Nouvelle valeur du serveur : reprise dans le formulaire s'il n'a pas été modifié entre-temps.
watch(saved, (value, previous) => {
  if (value && (!n.value || JSON.stringify(n.value) === JSON.stringify(previous))) n.value = { ...value };
});

const dirty = computed(() => !!n.value && JSON.stringify(n.value) !== JSON.stringify(saved.value));
// Codes déjà attribués dans la série : l'aperçu ajoute un numéro comme le fera le backend.
const taken = computed(() => CODE_SERIES[props.entity].taken(store.db));
const samples = computed(() => CODE_SERIES[props.entity].samples);

const errors = computed(() => {
  const e = {};
  if (!n.value) return e;
  if (!/^[A-Za-z0-9]{1,8}$/.test(n.value.prefix.trim())) e.prefix = 'De 1 à 8 lettres ou chiffres.';
  if (!Number.isInteger(n.value.letters) || n.value.letters < 2 || n.value.letters > 6) e.letters = 'Entre 2 et 6 lettres.';
  return e;
});
const err = (k) => (submitted.value ? errors.value[k] : undefined);

async function save() {
  submitted.value = true;
  if (Object.keys(errors.value).length || saving.value) return;
  saving.value = true;
  try {
    await store.saveCodeNumbering(props.entity, { ...n.value, prefix: n.value.prefix.trim().toUpperCase() });
    n.value = { ...saved.value };
    submitted.value = false;
    store.toast(`Numérotation des ${props.label.toLowerCase()} enregistrée`);
  } catch (e) {
    store.toast(`Enregistrement impossible : ${e.message}`, 'danger');
  } finally {
    saving.value = false;
  }
}

function reset() {
  n.value = { ...saved.value };
  submitted.value = false;
}
</script>

<template>
  <div class="fstack">
    <FormCard :title="`Numéro de souche — ${label.toLowerCase()}`"
      :subtitle="`Le ${item} est déduit du nom saisi : préfixe + premières lettres du nom ; un numéro est ajouté si le code existe déjà.`">
      <template #icon><slot name="icon" /></template>
      <p v-if="!n && !store.codeNumberingsError" class="fempty">Chargement de la numérotation…</p>
      <Alert v-else-if="!n" tone="danger" title="Numérotation indisponible">
        {{ store.codeNumberingsError }} <button type="button" class="link-btn" @click="store.loadCodeNumberings()">Réessayer</button>
      </Alert>
      <div v-else class="numbering">
        <div class="form-grid">
          <Field v-slot="{ id }" label="Préfixe" required :error="err('prefix')" :hint="CODE_SERIES[entity].prefixHint">
            <input :id="id" :value="n.prefix" maxlength="8" @input="n.prefix = $event.target.value.toUpperCase()" />
          </Field>
          <Field v-slot="{ id }" label="Séparateur">
            <select :id="id" v-model="n.separator"><option v-for="s in SEPARATORS" :key="s.label" :value="s.value">{{ s.label }}</option></select>
          </Field>
          <Field v-slot="{ id }" label="Nombre de lettres du nom" required :error="err('letters')" hint="Premières lettres du nom reprises dans le code (accents et espaces ignorés).">
            <input :id="id" v-model.number="n.letters" type="number" min="2" max="6" />
          </Field>
        </div>

        <div class="numbering-preview" aria-live="polite">
          <span class="numbering-label">Aperçu à partir de noms</span>
          <div class="numbering-codes names">
            <span v-for="name in samples" :key="name" class="num-sample"><span>{{ name }}</span><span aria-hidden="true">→</span><code>{{ nameCode(n, name, taken) }}</code></span>
          </div>
          <span class="small text-muted">Les codes existants sont conservés ; seul le code des nouvelles créations est déduit du nom.</span>
        </div>
      </div>
      <SaveBar v-if="n && canEdit" :dirty="dirty && !saving" @reset="reset" @save="save" />
    </FormCard>
  </div>
</template>
