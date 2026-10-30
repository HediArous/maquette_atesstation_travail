<script setup>
import { computed, ref, watch } from 'vue';
import ColorField from './ui/ColorField.vue';
import Field from './ui/Field.vue';
import Modal from './ui/Modal.vue';

/**
 * Petite modale de création générique, pilotée par une liste de champs :
 * { key, label, type: 'text' | 'date' | 'number' | 'color' | 'select' | 'checkbox', required?, placeholder?, hint?, options? }.
 */
const props = defineProps({
  open: Boolean,
  title: { type: String, required: true },
  fields: { type: Array, required: true },
  /** Valeurs initiales, rechargées à chaque ouverture. */
  initial: { type: Object, required: true },
});
const emit = defineEmits(['close', 'submit']);

const values = ref({ ...props.initial });
const submitted = ref(false);

watch(() => props.open, (open) => {
  if (open) { values.value = { ...props.initial }; submitted.value = false; }
}, { immediate: true });

const missing = computed(() => props.fields
  .filter((f) => f.type !== 'checkbox' && f.required && !String(values.value[f.key] ?? '').trim())
  .map((f) => f.key));

function save() {
  submitted.value = true;
  if (missing.value.length) return;
  emit('submit', { ...values.value });
  emit('close');
}
</script>

<template>
  <Modal :open="open" :title="title" @close="emit('close')">
    <div class="form-grid">
      <template v-for="f in fields" :key="f.key">
        <label v-if="f.type === 'checkbox'" class="check span-2">
          <input v-model="values[f.key]" type="checkbox" /> {{ f.label }}
        </label>
        <Field v-else v-slot="{ id }" :label="f.label" :required="f.required" :hint="f.hint"
          :error="submitted && missing.includes(f.key) ? 'Champ requis.' : ''" :class="f.type === 'select' || f.type === 'text' ? 'span-2' : ''">
          <ColorField v-if="f.type === 'color'" :id="id" :model-value="String(values[f.key] ?? '#2f5bd3')" @update:model-value="values[f.key] = $event" />
          <select v-else-if="f.type === 'select'" :id="id" v-model="values[f.key]">
            <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <input v-else :id="id" v-model="values[f.key]" :type="f.type" :placeholder="f.placeholder" :step="f.type === 'number' ? '0.5' : undefined" />
        </Field>
      </template>
    </div>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" @click="save">Ajouter</button>
    </template>
  </Modal>
</template>
