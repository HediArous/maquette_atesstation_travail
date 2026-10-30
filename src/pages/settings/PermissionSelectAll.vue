<script setup>
import { computed, onMounted, ref, watch } from 'vue';

/** Case « tout cocher » : cochée si tout est coché, intermédiaire si une partie l'est. v-model : permissions cochées. */
const props = defineProps({
  /** Clés concernées par la case. */
  keys: { type: Array, required: true },
  disabled: Boolean,
  label: { type: String, required: true },
  className: { type: String, default: '' },
});
const value = defineModel({ type: Array, required: true });

const input = ref(null);
const count = computed(() => props.keys.filter((k) => value.value.includes(k)).length);
const all = computed(() => count.value === props.keys.length);

const sync = () => { if (input.value) input.value.indeterminate = count.value > 0 && !all.value; };
onMounted(sync);
watch([count, all], sync);

function onChange(e) {
  value.value = e.target.checked ? [...new Set([...value.value, ...props.keys])] : value.value.filter((k) => !props.keys.includes(k));
}
</script>

<template>
  <label :class="['perm-all', all ? 'on' : count ? 'partial' : '', className]">
    <input ref="input" type="checkbox" :checked="all" :disabled="disabled" @change="onChange" />
    <span>{{ label }}</span>
  </label>
</template>
