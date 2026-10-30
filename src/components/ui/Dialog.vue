<script>
// Nombre de superpositions ouvertes : le défilement de la page n'est rétabli qu'à la fermeture de la dernière.
let openOverlays = 0;
</script>

<script setup>
import { onBeforeUnmount, ref, useId, watch } from 'vue';
import { Maximize2, Minimize2, X } from '@lucide/vue';

/** Fenêtre centrée commune aux modales et aux formulaires, avec passage en plein écran. */
const props = defineProps({
  open: Boolean,
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  /** sm | md | lg | xl */
  width: { type: String, default: 'md' },
});
const emit = defineEmits(['close']);

const dialog = ref(null);
const titleId = useId();
const full = ref(false);
let release = null;

function activate() {
  const previous = document.activeElement;
  const onKey = (e) => {
    // Seule la superposition la plus haute réagit à Échap.
    const overlays = document.querySelectorAll('.overlay');
    if (e.key === 'Escape' && overlays[overlays.length - 1]?.contains(dialog.value)) emit('close');
  };
  document.addEventListener('keydown', onKey);
  openOverlays++;
  document.body.style.overflow = 'hidden';
  // Focus sur la boîte de dialogue elle-même : annoncée par les lecteurs d'écran, sans faire défiler le contenu.
  window.setTimeout(() => dialog.value?.focus({ preventScroll: true }), 0);
  release = () => {
    document.removeEventListener('keydown', onKey);
    openOverlays--;
    if (openOverlays === 0) document.body.style.overflow = '';
    previous?.focus?.();
  };
}

function deactivate() {
  release?.();
  release = null;
}

watch(() => props.open, (open) => {
  if (open) activate();
  else { deactivate(); full.value = false; }
}, { immediate: true });

onBeforeUnmount(deactivate);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @mousedown="$event.target === $event.currentTarget && emit('close')">
      <div ref="dialog" :class="['dialog', `dialog-${width}`, { fullscreen: full }]" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1">
        <div class="overlay-header">
          <div class="grow">
            <h2 :id="titleId">{{ title }}</h2>
            <div v-if="$slots.subtitle || subtitle" class="overlay-subtitle"><slot name="subtitle">{{ subtitle }}</slot></div>
          </div>
          <div class="overlay-tools">
            <button type="button" class="icon-btn overlay-close" :aria-label="full ? 'Réduire la fenêtre' : 'Ouvrir en plein écran'"
              :title="full ? 'Réduire' : 'Plein écran'" :aria-pressed="full" @click="full = !full">
              <Minimize2 v-if="full" :size="16" />
              <Maximize2 v-else :size="16" />
            </button>
            <button type="button" class="icon-btn overlay-close" aria-label="Fermer" title="Fermer" @click="emit('close')"><X :size="18" /></button>
          </div>
        </div>
        <div class="overlay-body"><slot /></div>
        <div v-if="$slots.footer" class="overlay-footer"><slot name="footer" /></div>
      </div>
    </div>
  </Teleport>
</template>
