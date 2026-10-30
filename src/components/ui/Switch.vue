<script setup>
defineProps({
  modelValue: Boolean,
  label: { type: String, required: true },
  disabled: Boolean,
});
defineEmits(['update:modelValue']);
</script>

<template>
  <label :class="['switch', { disabled }]">
    <input type="checkbox" role="switch" :checked="modelValue" :disabled="disabled" @change="$emit('update:modelValue', $event.target.checked)" />
    <span class="switch-track" aria-hidden="true"><span class="switch-thumb" /></span>
    <span>{{ label }}</span>
  </label>
</template>
