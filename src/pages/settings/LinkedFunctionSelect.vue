<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { Check, ChevronDown, Link2 } from '@lucide/vue';
import { useCompanyData } from '../../store/companyData';

/**
 * Choix de la fonction solo liée (suppléance) : chaque fonction indique si elle est disponible ou déjà liée à une autre.
 * La liaison est réciproque : choisir une fonction déjà liée retire son ancienne liaison.
 */
const props = defineProps({
  id: { type: String, default: undefined },
  modelValue: { type: String, default: '' },
  /** Fonctions solo proposées. */
  options: { type: Array, required: true },
  /** Fonction en cours de modification (absente à la création). */
  currentId: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

const data = useCompanyData();
const open = ref(false);
const active = ref(-1);
const trigger = ref(null);
const panel = ref(null);
const pos = ref({ top: 0, left: 0, width: 0 });

// Statut de chaque fonction : libre, liée à la fonction en cours ou liée à une autre.
const items = computed(() => props.options
  .map((x) => {
    const partner = data.linkedFunction(x);
    const state = !partner ? 'free' : partner.id === props.currentId ? 'self' : 'other';
    return { fn: x, partner, state };
  })
  .sort((a, b) => a.fn.name.localeCompare(b.fn.name)));
// Groupes affichés : liaison actuelle, fonctions disponibles, fonctions déjà liées à une autre.
const groups = computed(() => [
  { key: 'self', title: 'Liaison actuelle', list: items.value.filter((i) => i.state === 'self') },
  { key: 'free', title: 'Disponibles', list: items.value.filter((i) => i.state === 'free') },
  { key: 'other', title: 'Déjà liées', list: items.value.filter((i) => i.state === 'other') },
].filter((g) => g.list.length));
// Ordre de navigation au clavier : « Aucune », puis les fonctions dans l'ordre des groupes.
const flat = computed(() => [{ fn: null }, ...groups.value.flatMap((g) => g.list)]);
const selected = computed(() => items.value.find((i) => i.fn.id === props.modelValue));

function place() {
  const r = trigger.value.getBoundingClientRect();
  const width = Math.max(r.width, 360);
  const height = panel.value?.offsetHeight ?? 280;
  const below = r.bottom + 4 + height <= window.innerHeight - 8;
  pos.value = {
    top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - height),
    left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
    width,
  };
}

async function show() {
  open.value = true;
  active.value = Math.max(0, flat.value.findIndex((i) => (i.fn?.id ?? '') === props.modelValue));
  place();
  await nextTick();
  place();
}

function close(refocus = false) {
  open.value = false;
  if (refocus) trigger.value?.focus();
}

function choose(item) {
  emit('update:modelValue', item.fn?.id ?? '');
  close(true);
}

const optionId = (i) => `${props.id || 'lfs'}-opt-${i}`;
const indexOf = (item) => flat.value.indexOf(item);

async function onKey(e) {
  if (!open.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); }
    return;
  }
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); active.value = Math.min(flat.value.length - 1, active.value + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active.value = Math.max(0, active.value - 1); }
  else if (e.key === 'Home') { e.preventDefault(); active.value = 0; }
  else if (e.key === 'End') { e.preventDefault(); active.value = flat.value.length - 1; }
  else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(flat.value[active.value]); }
  else if (e.key === 'Tab') close();
  await nextTick();
  panel.value?.querySelector(`#${optionId(active.value)}`)?.scrollIntoView({ block: 'nearest' });
}

// Fermeture au clic extérieur, au défilement de la page ou au redimensionnement.
function onDown(e) {
  if (!panel.value?.contains(e.target) && !trigger.value?.contains(e.target)) close();
}
function onScroll(e) {
  if (!panel.value?.contains(e.target)) close();
}
watch(open, (o) => {
  const fn = o ? 'addEventListener' : 'removeEventListener';
  document[fn]('mousedown', onDown, true);
  window[fn]('scroll', onScroll, true);
  window[fn]('resize', close);
});
onBeforeUnmount(() => { open.value = false; });
</script>

<template>
  <button :id="id" ref="trigger" type="button" :class="['lfs-trigger', { open }]" role="combobox" aria-haspopup="listbox"
    :aria-expanded="open" :aria-controls="`${id || 'lfs'}-list`" :aria-activedescendant="open ? optionId(active) : undefined"
    @click="open ? close() : show()" @keydown="onKey">
    <span v-if="selected" class="lfs-value">
      <span class="lfs-name">{{ selected.fn.name }}</span>
      <span class="lfs-code">{{ selected.fn.code }}</span>
    </span>
    <span v-else class="lfs-placeholder">Aucune</span>
    <ChevronDown :size="15" class="lfs-chevron" aria-hidden="true" />
  </button>

  <Teleport to="body">
    <div v-if="open" :id="`${id || 'lfs'}-list`" ref="panel" class="lfs-panel" role="listbox" aria-label="Fonction liée"
      :style="{ top: `${pos.top}px`, left: `${pos.left}px`, width: `${pos.width}px` }" @mousedown.prevent>
      <div :id="optionId(0)" role="option" :aria-selected="!modelValue" :class="['lfs-option', 'lfs-none', { active: active === 0 }]"
        @mouseenter="active = 0" @click="choose(flat[0])">
        <span class="lfs-line"><span class="lfs-name">Aucune</span><span class="lfs-sub">Pas de suppléance</span></span>
        <Check v-if="!modelValue" :size="15" class="lfs-check" aria-hidden="true" />
      </div>

      <p v-if="items.length === 0" class="lfs-empty">Aucune autre fonction solo avec règles d’intérim.</p>

      <template v-for="group in groups" :key="group.key">
        <div class="lfs-group" role="presentation">{{ group.title }} <span>{{ group.list.length }}</span></div>
        <div v-for="item in group.list" :id="optionId(indexOf(item))" :key="item.fn.id" role="option" :aria-selected="item.fn.id === modelValue"
          :class="['lfs-option', { active: active === indexOf(item) }]"
          :title="item.state === 'other' ? `${item.fn.name} — liée à ${item.partner.name}. La choisir retire cette liaison.` : `${item.fn.name} (${item.fn.code})`"
          @mouseenter="active = indexOf(item)" @click="choose(item)">
          <span class="lfs-line">
            <span class="lfs-name">{{ item.fn.name }}</span>
            <span :class="['lfs-status', item.state]">
              <template v-if="item.state === 'free'"><span class="lfs-dot" aria-hidden="true" />Disponible</template>
              <template v-else-if="item.state === 'self'"><Link2 :size="11" aria-hidden="true" />Liée à cette fonction</template>
              <template v-else><Link2 :size="11" aria-hidden="true" /><span class="lfs-partner">Liée à {{ item.partner.name }}</span></template>
            </span>
            <span v-if="item.fn.archived" class="lfs-archived">Archivée</span>
            <span class="lfs-code">{{ item.fn.code }}</span>
          </span>
          <Check v-if="item.fn.id === modelValue" :size="15" class="lfs-check" aria-hidden="true" />
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.lfs-trigger {
  display: flex;
  align-items: center;
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
.lfs-trigger:focus-visible,
.lfs-trigger.open { border-color: var(--primary); box-shadow: var(--focus); outline: none; }
.lfs-value { display: flex; align-items: baseline; gap: 8px; min-width: 0; flex: 1; }
.lfs-placeholder { flex: 1; color: var(--muted); }
.lfs-chevron { flex: none; color: var(--muted); transition: transform .15s; }
.open .lfs-chevron { transform: rotate(180deg); }

.lfs-panel {
  position: fixed;
  z-index: 90;
  max-height: 300px;
  overflow-y: auto;
  padding: 4px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-lg);
}
.lfs-group {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px 2px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: var(--muted);
}
.lfs-group span { font-weight: 500; font-variant-numeric: tabular-nums; }
.lfs-option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.lfs-option.active { background: var(--surface-2); }
.lfs-option[aria-selected='true'] { background: var(--primary-soft); }
.lfs-none { border-bottom: 1px solid var(--border); border-radius: 6px 6px 0 0; margin-bottom: 2px; }
.lfs-line { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
.lfs-name { flex: 0 1 auto; min-width: 0; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lfs-code { flex: none; margin-left: auto; font-family: var(--mono, ui-monospace, monospace); font-size: 11.5px; color: var(--muted); }
.lfs-sub { font-size: 11.5px; color: var(--muted); white-space: nowrap; }
.lfs-archived { flex: none; padding: 0 6px; border-radius: 999px; background: var(--surface-2); font-size: 11px; color: var(--muted); }
.lfs-empty { padding: 10px; font-size: 12.5px; color: var(--muted); }

.lfs-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 55%;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
}
.lfs-status.free { background: #ecfdf3; color: #067647; }
.lfs-status.self { background: var(--primary-soft); color: var(--primary); }
.lfs-status.other { background: #fff6e5; color: #93500a; }
.lfs-partner { overflow: hidden; text-overflow: ellipsis; }
.lfs-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.lfs-check { flex: none; color: var(--primary); }
</style>
