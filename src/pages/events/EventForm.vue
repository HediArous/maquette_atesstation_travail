<script setup>
import { computed, ref, watch } from 'vue';
import { useStore } from '../../store';
import { newId } from '../../store/ids';
import { useCompanyData } from '../../store/companyData';
import EffectBadge from '../../components/ui/EffectBadge.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import Switch from '../../components/ui/Switch.vue';
import { EFFECTS } from '../../components/ui/labels';

const props = defineProps({ open: Boolean });
const emit = defineEmits(['close']);

const EVENT_TYPES = ['Réunion', 'Séminaire', 'Formation', 'Clôture', 'Inventaire', 'Projet', 'Salon', 'Audit', 'Vie d’entreprise'];

const store = useStore();
const data = useCompanyData();
const blank = () => ({ name: '', type: 'Réunion', start: '', end: '', description: '', effect: 'info', allCompany: true, departmentIds: [], employeeIds: [] });
const f = ref(blank());
const submitted = ref(false);

watch(() => props.open, (open) => { if (open) { f.value = blank(); submitted.value = false; } });

const errors = computed(() => {
  const e = {};
  if (!f.value.name.trim()) e.name = 'Nom requis.';
  if (!f.value.start) e.start = 'Date de début requise.';
  if (!f.value.end || f.value.end < f.value.start) e.end = 'Date de fin invalide.';
  if (!f.value.allCompany && f.value.departmentIds.length + f.value.employeeIds.length === 0) e.target = 'Choisissez au moins un département ou une personne.';
  return e;
});
const err = (k) => (submitted.value ? errors.value[k] : undefined);

function onStart() {
  if (!f.value.end || f.value.start > f.value.end) f.value.end = f.value.start;
}

function save() {
  submitted.value = true;
  if (Object.keys(errors.value).length) return;
  store.addEvent({ id: newId('ev'), companyId: store.companyId, ...f.value, name: f.value.name.trim() });
  store.toast(`Événement « ${f.value.name.trim()} » créé`);
  emit('close');
}
</script>

<template>
  <Modal :open="open" title="Nouvel événement" size="lg" @close="emit('close')">
    <div class="form-grid">
      <Field v-slot="{ id }" label="Nom" required class="span-2" :error="err('name')">
        <input :id="id" v-model="f.name" placeholder="Ex. : Comité de direction trimestriel" />
      </Field>
      <Field v-slot="{ id }" label="Type">
        <select :id="id" v-model="f.type"><option v-for="t in EVENT_TYPES" :key="t">{{ t }}</option></select>
      </Field>
      <div />
      <Field v-slot="{ id }" label="Date de début" required :error="err('start')"><input :id="id" v-model="f.start" type="date" @input="onStart" /></Field>
      <Field v-slot="{ id }" label="Date de fin" required :error="err('end')"><input :id="id" v-model="f.end" type="date" :min="f.start || undefined" /></Field>
      <Field v-slot="{ id }" label="Description" class="span-2"><textarea :id="id" v-model="f.description" rows="2" /></Field>
    </div>

    <fieldset class="form-section">
      <legend>Effet sur les demandes de congé</legend>
      <div class="effect-picker" role="radiogroup" aria-label="Effet">
        <label v-for="(e, k) in EFFECTS" :key="k" :class="['effect-option', `effect-${k}`, { checked: f.effect === k }]">
          <input v-model="f.effect" type="radio" name="effect" :value="k" />
          <EffectBadge :effect="k" />
          <span class="small">{{ e.help }}</span>
        </label>
      </div>
    </fieldset>

    <fieldset class="form-section">
      <legend>Personnes concernées</legend>
      <Switch v-model="f.allCompany" label="Toute la société" />
      <div v-if="!f.allCompany" class="target-grid mt-12">
        <div>
          <p class="label">Départements</p>
          <div class="check-list">
            <label v-for="d in data.activeDepartments" :key="d.id" class="check"><input v-model="f.departmentIds" type="checkbox" :value="d.id" /> {{ d.name }}</label>
          </div>
        </div>
        <div>
          <p class="label">Personnes</p>
          <div class="check-list scroll">
            <label v-for="e in data.people.filter((p) => p.status !== 'inactif')" :key="e.id" class="check"><input v-model="f.employeeIds" type="checkbox" :value="e.id" /> {{ e.firstName }} {{ e.lastName }}</label>
          </div>
        </div>
        <p v-if="err('target')" class="field-error span-2">{{ err('target') }}</p>
      </div>
    </fieldset>

    <template #footer>
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" @click="save">Créer l’événement</button>
    </template>
  </Modal>
</template>
