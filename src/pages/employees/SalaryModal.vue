<script setup>
import { computed, ref, watch } from 'vue';
import { useStore } from '../../store';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import { TODAY } from '../../utils/dates';

/** Nouveau salaire de base daté. Émet `submit` avec (montant, date d'effet, motif). */
const props = defineProps({ open: Boolean });
const emit = defineEmits(['close', 'submit']);

const store = useStore();
const f = ref({ amount: '', since: TODAY, reason: '' });
const submitted = ref(false);

watch(() => props.open, (open) => { if (open) { f.value = { amount: '', since: TODAY, reason: '' }; submitted.value = false; } });

const errors = computed(() => ({
  amount: Number(f.value.amount) > 0 ? '' : 'Montant strictement positif.',
  since: f.value.since ? '' : 'Date d’effet requise.',
  reason: f.value.reason.trim() ? '' : 'Motif requis.',
}));

function save() {
  submitted.value = true;
  if (errors.value.amount || errors.value.since || errors.value.reason) return;
  emit('submit', Number(f.value.amount), f.value.since, f.value.reason.trim());
  emit('close');
}
</script>

<template>
  <Modal :open="open" title="Nouveau salaire de base" @close="emit('close')">
    <div class="form-grid">
      <Field v-slot="{ id }" :label="`Montant mensuel${store.activeDevise ? ` (${store.activeDevise.symbol})` : ''}`" required :error="submitted ? errors.amount : ''"><input :id="id" v-model="f.amount" type="number" min="0" step="100" /></Field>
      <Field v-slot="{ id }" label="Date d’effet" required :error="submitted ? errors.since : ''"><input :id="id" v-model="f.since" type="date" /></Field>
      <Field v-slot="{ id }" label="Motif" required class="span-2" :error="submitted ? errors.reason : ''"><input :id="id" v-model="f.reason" placeholder="Ex. : revalorisation annuelle" /></Field>
    </div>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" @click="save">Enregistrer</button>
    </template>
  </Modal>
</template>
