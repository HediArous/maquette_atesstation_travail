<script setup>
import { computed, ref, watch } from 'vue';
import { useStore } from '../../store';
import { newId } from '../../store/ids';
import { useCompanyData } from '../../store/companyData';
import Avatar from '../../components/ui/Avatar.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';

/** Liaison de fonctions solo (suppléance). `state` : { link? } ; fermée tant qu'il est absent. */
const props = defineProps({
  state: { type: Object, default: undefined },
});
const emit = defineEmits(['close']);

const store = useStore();
const data = useCompanyData();
const name = ref('');
const ids = ref([]);
const submitted = ref(false);

const link = computed(() => props.state?.link);

watch(() => props.state, (state) => {
  if (!state) return;
  name.value = state.link?.name ?? '';
  ids.value = [...(state.link?.functionIds ?? [])];
  submitted.value = false;
}, { immediate: true });

const solos = computed(() => data.functions.filter((f) => f.interim && f.kind === 'solo' && !f.archived));
const errors = computed(() => ({ name: name.value.trim() ? '' : 'Nom requis.', ids: ids.value.length >= 2 ? '' : 'Sélectionnez au moins deux fonctions solo.' }));
const holderOf = (f) => data.employees.find((e) => e.functionId === f.id && e.status !== 'inactif');

function save() {
  submitted.value = true;
  if (errors.value.name || errors.value.ids) return;
  const saved = { ...(link.value ?? { id: newId('fl'), companyId: store.companyId }), name: name.value.trim(), functionIds: [...ids.value] };
  if (link.value) store.updateItem('functionLinks', saved); else store.addItem('functionLinks', saved);
  store.toast(`Liaison « ${saved.name} » enregistrée`);
  emit('close');
}
</script>

<template>
  <Modal v-if="state" open :title="link ? `Modifier « ${link.name} »` : 'Lier des fonctions solo'" @close="emit('close')">
    <Field v-slot="{ id }" label="Nom de la liaison" required :error="submitted ? errors.name : ''" hint="Ex. : Suppléance finance"><input :id="id" v-model="name" /></Field>
    <fieldset class="form-section mt-16">
      <legend>Fonctions solo concernées</legend>
      <p v-if="submitted && errors.ids" class="field-error mb-12">{{ errors.ids }}</p>
      <p v-if="solos.length === 0" class="small text-muted">Aucune fonction solo avec règles d’intérim : définissez-en dans Paramètres › Fonctions.</p>
      <div v-else class="fn-pick-list">
        <label v-for="f in solos" :key="f.id" :class="['fn-pick', { checked: ids.includes(f.id) }]">
          <input v-model="ids" type="checkbox" :value="f.id" />
          <Avatar v-if="holderOf(f)" :employee="holderOf(f)" :size="26" />
          <span v-else class="avatar" style="width: 26px; height: 26px" aria-hidden="true">—</span>
          <span class="grow"><span class="person-name">{{ f.name }}</span><span class="block small text-muted">{{ holderOf(f) ? `${holderOf(f).firstName} ${holderOf(f).lastName}` : 'Vacant' }} · {{ data.departmentName(f.departmentId) ?? 'Transverse' }}</span></span>
        </label>
      </div>
      <p class="small text-muted mt-8">Seules les fonctions de type « solo » peuvent être liées (Paramètres › Fonctions).</p>
    </fieldset>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" @click="save">Enregistrer</button>
    </template>
  </Modal>
</template>
