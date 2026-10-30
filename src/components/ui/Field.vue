<script setup>
import { useId } from 'vue';

/**
 * Champ de formulaire : libellé, aide et erreur. Le contrôle est fourni par le slot, qui reçoit l'`id` à lier au libellé :
 * <Field label="Nom" v-slot="{ id }"><input :id="id" v-model="nom" /></Field>
 */
defineProps({
  label: { type: String, required: true },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  required: Boolean,
});

const id = useId();
</script>

<template>
  <div :class="['field', { 'has-error': error }]">
    <label :for="id">{{ label }}<span v-if="required" class="req" aria-hidden="true"> *</span></label>
    <slot :id="id" />
    <p v-if="error" class="field-error">{{ error }}</p>
    <p v-else-if="hint || $slots.hint" class="field-hint"><slot name="hint">{{ hint }}</slot></p>
  </div>
</template>
