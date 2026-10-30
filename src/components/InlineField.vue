<script setup>
import { computed, inject, nextTick, ref, unref, useId, watch } from 'vue';
import { Check, Pencil, X } from '@lucide/vue';

/**
 * Champ modifiable sur place : la valeur s'affiche en lecture ; un clic ouvre l'éditeur (slot `editor`),
 * ✓ / Entrée enregistre, ✕ / Échap annule. `save` peut être asynchrone : une erreur rejetée s'affiche sous le champ.
 * En lecture seule (prop `readonly`, ou `inlineReadonly` fourni par un parent, ex. la fiche sans droit de modification),
 * la valeur s'affiche sans éditeur.
 */
const props = defineProps({
  label: { type: String, required: true },
  value: { type: null, default: undefined },
  /** Valeur affichée vide : « Non renseigné ». */
  empty: Boolean,
  required: Boolean,
  hint: { type: String, default: '' },
  validate: { type: Function, default: undefined },
  save: { type: Function, required: true },
  readonly: Boolean,
});

const inheritedReadonly = inject('inlineReadonly', false);
const isReadonly = computed(() => props.readonly || !!unref(inheritedReadonly));

const id = useId();
const editing = ref(false);
const saving = ref(false);
const draft = ref(props.value);
const error = ref();
const box = ref();

watch(() => props.value, (v) => { if (!editing.value) draft.value = v; });

async function open() {
  draft.value = props.value;
  editing.value = true;
  await nextTick();
  box.value?.querySelector('input, select, textarea')?.focus();
}
function cancel() { editing.value = false; draft.value = props.value; error.value = undefined; }
async function submit() {
  if (saving.value) return;
  const e = props.validate?.(draft.value);
  if (e) { error.value = e; return; }
  if (JSON.stringify(draft.value) !== JSON.stringify(props.value)) {
    saving.value = true;
    try {
      await props.save(draft.value);
    } catch (err) {
      error.value = err?.message ?? 'Enregistrement impossible.';
      return;
    } finally {
      saving.value = false;
    }
  }
  editing.value = false;
  error.value = undefined;
}
function onKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); submit(); }
}
const set = (v) => { draft.value = v; };
</script>

<template>
  <div ref="box" :class="['if', { 'is-editing': editing, 'has-error': error }]">
    <label class="if-label" :for="editing ? id : undefined">{{ label }}<span v-if="required" class="req" aria-hidden="true"> *</span></label>
    <div v-if="editing" class="if-edit" @keydown="onKey">
      <div class="if-control field"><slot name="editor" :draft="draft" :set="set" :id="id" /></div>
      <button type="button" class="if-btn ok" :disabled="saving" :aria-label="`Enregistrer ${label}`" title="Enregistrer (Entrée)" @click="submit"><Check :size="14" /></button>
      <button type="button" class="if-btn" :disabled="saving" aria-label="Annuler" title="Annuler (Échap)" @click="cancel"><X :size="14" /></button>
    </div>
    <div v-else-if="isReadonly" class="if-value is-readonly">
      <span v-if="empty" class="if-empty">Non renseigné</span>
      <span v-else><slot /></span>
    </div>
    <button v-else type="button" class="if-value" :aria-label="`Modifier ${label}`" @click="open">
      <span v-if="empty" class="if-empty">Non renseigné</span>
      <span v-else><slot /></span>
      <Pencil :size="13" aria-hidden="true" class="if-pen" />
    </button>
    <p v-if="error" class="field-error">{{ error }}</p>
    <p v-else-if="hint && !isReadonly" class="if-hint">{{ hint }}</p>
  </div>
</template>
