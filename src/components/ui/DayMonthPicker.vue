<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/vue';

/**
 * Choix d'un jour et d'un mois sans année (date annuelle) : champ compact ouvrant une mini-grille des jours du mois.
 * v-model:day (1–31) et v-model:month (1–12) ; '' tant que rien n'est choisi. Février compte 29 jours.
 */
const props = defineProps({
  id: { type: String, default: undefined },
  day: { type: [Number, String], default: '' },
  month: { type: [Number, String], default: '' },
  placeholder: { type: String, default: 'Jour et mois' },
});
const emit = defineEmits(['update:day', 'update:month']);

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const daysIn = (m) => new Date(2000, m, 0).getDate();

const open = ref(false);
const shown = ref(1);
const trigger = ref(null);
const panel = ref(null);
const pos = ref({ top: 0, left: 0 });

const label = computed(() => (props.day && props.month ? `${props.day} ${MONTHS[props.month - 1]}` : ''));
const days = computed(() => Array.from({ length: daysIn(shown.value) }, (_, i) => i + 1));

function place() {
  const r = trigger.value.getBoundingClientRect();
  const width = 248;
  const height = panel.value?.offsetHeight ?? 236;
  const below = r.bottom + 4 + height <= window.innerHeight;
  pos.value = {
    top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - height),
    left: Math.min(r.left, window.innerWidth - width - 8),
  };
}

async function toggle() {
  if (open.value) { close(); return; }
  shown.value = Number(props.month) || 1;
  open.value = true;
  place();
  await nextTick();
  place();
  panel.value?.querySelector('.dmp-day.selected, .dmp-day')?.focus();
}

function close(refocus = false) {
  open.value = false;
  if (refocus) trigger.value?.focus();
}

function step(n) {
  shown.value = ((shown.value - 1 + n + 12) % 12) + 1;
}

function pick(d) {
  emit('update:month', shown.value);
  emit('update:day', d);
  close(true);
}

// Fermeture au clic extérieur, à Échap (sans fermer la fenêtre parente) ou au défilement.
function onDown(e) {
  if (!panel.value?.contains(e.target) && !trigger.value?.contains(e.target)) close();
}
function onKey(e) {
  if (e.key === 'Escape') { e.stopPropagation(); close(true); }
}
function onScroll(e) {
  if (!panel.value?.contains(e.target)) close();
}
watch(open, (o) => {
  const fn = o ? 'addEventListener' : 'removeEventListener';
  document[fn]('mousedown', onDown, true);
  document[fn]('keydown', onKey, true);
  window[fn]('scroll', onScroll, true);
  window[fn]('resize', close);
});
onBeforeUnmount(() => { open.value = false; });
</script>

<template>
  <button :id="id" ref="trigger" type="button" :class="['dmp-trigger', { 'is-empty': !label, open }]" aria-haspopup="dialog" :aria-expanded="open" @click="toggle">
    <span>{{ label || placeholder }}</span>
    <CalendarDays :size="15" aria-hidden="true" />
  </button>
  <Teleport to="body">
    <div v-if="open" ref="panel" class="dmp-panel" role="dialog" aria-label="Choisir le jour et le mois" :style="{ top: `${pos.top}px`, left: `${pos.left}px` }">
      <div class="dmp-head">
        <button type="button" class="dmp-nav" aria-label="Mois précédent" @click="step(-1)"><ChevronLeft :size="16" /></button>
        <span class="dmp-month" aria-live="polite">{{ MONTHS[shown - 1] }}</span>
        <button type="button" class="dmp-nav" aria-label="Mois suivant" @click="step(1)"><ChevronRight :size="16" /></button>
      </div>
      <div class="dmp-months" role="group" aria-label="Mois">
        <button v-for="(m, i) in MONTHS" :key="m" type="button" :class="['dmp-m', { on: shown === i + 1 }]" :aria-pressed="shown === i + 1" :title="m" @click="shown = i + 1">
          {{ m.slice(0, 3) }}
        </button>
      </div>
      <div class="dmp-grid" role="group" :aria-label="`Jours de ${MONTHS[shown - 1]}`">
        <button v-for="d in days" :key="d" type="button" :class="['dmp-day', { selected: Number(day) === d && Number(month) === shown }]"
          :aria-label="`${d} ${MONTHS[shown - 1]}`" @click="pick(d)">
          {{ d }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dmp-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  height: 32px;
  padding: 0 9px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: #fff;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dmp-trigger.is-empty span { color: var(--muted); }
.dmp-trigger svg { color: var(--muted); flex: none; }
.dmp-trigger:focus-visible,
.dmp-trigger.open { border-color: var(--primary); box-shadow: var(--focus); outline: none; }

.dmp-panel {
  position: fixed;
  z-index: 90;
  width: 248px;
  padding: 10px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-lg);
}
.dmp-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.dmp-month { font-weight: 600; text-transform: capitalize; }
.dmp-nav,
.dmp-m,
.dmp-day {
  border: 0;
  background: none;
  color: var(--text);
  font: inherit;
  cursor: pointer;
}
.dmp-nav { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 6px; color: var(--text-2); }
.dmp-nav:hover { background: var(--surface-2); }

.dmp-months { display: grid; grid-template-columns: repeat(6, 1fr); gap: 2px; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid var(--border); }
.dmp-m { height: 22px; border-radius: 5px; font-size: 11.5px; color: var(--text-2); }
.dmp-m:hover { background: var(--surface-2); }
.dmp-m.on { background: var(--primary-soft); color: var(--primary); font-weight: 600; }

.dmp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.dmp-day { height: 28px; border-radius: 6px; font-size: 13px; font-variant-numeric: tabular-nums; }
.dmp-day:hover { background: var(--primary-soft); color: var(--primary); }
.dmp-day.selected { background: var(--primary); color: #fff; font-weight: 600; }
.dmp-nav:focus-visible,
.dmp-m:focus-visible,
.dmp-day:focus-visible { box-shadow: var(--focus); outline: none; }
</style>
