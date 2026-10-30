<script setup>
import { useSettingsRights } from './settingsRights';
import { computed, onMounted, ref, watch } from 'vue';
import { IdCard } from '@lucide/vue';
import { useStore } from '../../store';
import Alert from '../../components/ui/Alert.vue';
import Field from '../../components/ui/Field.vue';
import Switch from '../../components/ui/Switch.vue';
import FormCard from '../../components/FormCard.vue';
import SaveBar from '../../components/SaveBar.vue';
import { TODAY } from '../../utils/dates';
import { formatMatricule } from '../../utils/org';

/**
 * Numérotation des employés (numéro de souche) : format et compteur des matricules attribués à la création.
 * La souche est enregistrée dans le backend, qui attribue lui-même les matricules (GET / PUT /api/employee-numbering).
 */
const SEPARATORS = [{ value: '-', label: 'Tiret ( - )' }, { value: '/', label: 'Barre oblique ( / )' }, { value: '', label: 'Aucun' }];

const store = useStore();
const { canEdit } = useSettingsRights();
const saved = computed(() => store.numbering);
const n = ref(saved.value ? { ...saved.value } : undefined);
const submitted = ref(false);
const saving = ref(false);

// Le compteur avance à chaque création : on relit la souche à l'ouverture de la page.
onMounted(() => store.loadNumbering());
// Nouvelle valeur du serveur : reprise dans le formulaire s'il n'a pas été modifié entre-temps.
watch(saved, (value, previous) => {
  if (value && (!n.value || JSON.stringify(n.value) === JSON.stringify(previous))) n.value = { ...value };
});

const dirty = computed(() => !!n.value && JSON.stringify(n.value) !== JSON.stringify(saved.value));
// Le backend saute tout matricule déjà attribué, quelle que soit la société.
const taken = computed(() => new Set(store.db.employees.map((e) => e.matricule.trim().toUpperCase())));
const preview = computed(() => (n.value ? [0, 1, 2].map((i) => formatMatricule(n.value, n.value.next + i)) : []));
const collision = computed(() => preview.value.find((m) => taken.value.has(m)));
// Plus haut matricule existant avec ce préfixe (repère pour reprendre une numérotation).
const highest = computed(() => (n.value ? store.db.employees.map((e) => e.matricule).filter((m) => m.toUpperCase().startsWith(n.value.prefix.trim().toUpperCase())).sort().reverse()[0] : undefined));

const errors = computed(() => {
  const e = {};
  if (!n.value) return e;
  if (!/^[A-Za-z0-9]{1,8}$/.test(n.value.prefix.trim())) e.prefix = 'De 1 à 8 lettres ou chiffres.';
  if (!Number.isInteger(n.value.digits) || n.value.digits < 3 || n.value.digits > 8) e.digits = 'Entre 3 et 8 chiffres.';
  if (!Number.isInteger(n.value.next) || n.value.next < 1) e.next = 'Entier strictement positif.';
  else if (String(n.value.next).length > n.value.digits) e.next = `Dépasse ${n.value.digits} chiffres : augmentez la longueur.`;
  return e;
});
const err = (k) => (submitted.value ? errors.value[k] : undefined);

async function save() {
  submitted.value = true;
  if (Object.keys(errors.value).length || saving.value) return;
  saving.value = true;
  try {
    await store.saveNumbering({ ...n.value, prefix: n.value.prefix.trim().toUpperCase() });
    n.value = { ...store.numbering };
    submitted.value = false;
    store.toast('Numérotation des employés enregistrée');
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
    <FormCard title="Numéro de souche — employés"
      subtitle="Chaque nouvel employé reçoit automatiquement le matricule suivant ; le compteur avance d’un à chaque création et saute un numéro déjà pris.">
      <template #icon><IdCard :size="16" /></template>
      <p v-if="!n && !store.numberingError" class="fempty">Chargement de la numérotation…</p>
      <Alert v-else-if="!n" tone="danger" title="Numérotation indisponible">
        {{ store.numberingError }} <button type="button" class="link-btn" @click="store.loadNumbering()">Réessayer</button>
      </Alert>
      <div v-else class="numbering">
        <div class="form-grid">
          <Field v-slot="{ id }" label="Préfixe" required :error="err('prefix')" hint="Ex. : initiales de la société.">
            <input :id="id" :value="n.prefix" maxlength="8" @input="n.prefix = $event.target.value.toUpperCase()" />
          </Field>
          <Field v-slot="{ id }" label="Séparateur">
            <select :id="id" v-model="n.separator"><option v-for="s in SEPARATORS" :key="s.label" :value="s.value">{{ s.label }}</option></select>
          </Field>
          <Field v-slot="{ id }" label="Nombre de chiffres" required :error="err('digits')" hint="Le compteur est complété par des zéros.">
            <input :id="id" v-model.number="n.digits" type="number" min="3" max="8" />
          </Field>
          <Field v-slot="{ id }" label="Prochain numéro" required :error="err('next')" hint="Modifiable pour reprendre une numérotation existante.">
            <input :id="id" v-model.number="n.next" type="number" min="1" />
          </Field>
        </div>
        <div class="mt-12">
          <Switch v-model="n.withYear" label="Inclure l’année d’embauche dans le matricule" />
        </div>

        <div class="numbering-preview" aria-live="polite">
          <span class="numbering-label">Aperçu des prochains matricules</span>
          <div class="numbering-codes">
            <code v-for="(m, i) in preview" :key="m" :class="{ next: i === 0 }">{{ m }}</code>
          </div>
          <span class="small text-muted">
            Le prochain employé créé recevra <strong>{{ preview[0] }}</strong>{{ n.withYear ? ` (année ${TODAY.slice(0, 4)} pour une embauche cette année)` : '' }}.
            <template v-if="highest"> Plus haut matricule existant : <span class="mono">{{ highest }}</span>.</template>
          </span>
        </div>
        <Alert v-if="collision" tone="warning" title="Numéro déjà attribué">{{ collision }} existe déjà : il sera sauté automatiquement à la création.</Alert>
      </div>
      <SaveBar v-if="n && canEdit" :dirty="dirty && !saving" @reset="reset" @save="save" />
    </FormCard>
  </div>
</template>
