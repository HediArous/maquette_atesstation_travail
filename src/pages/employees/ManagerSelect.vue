<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { Check, ChevronDown, Link2, Search } from '@lucide/vue';

/**
 * Choix du responsable N+1 : chaque ligne indique si l'employé a un compte utilisateur. Quand l'employé suit un circuit
 * d'approbation (lockWithoutAccount), un responsable sans compte n'est pas sélectionnable directement : on lui associe
 * d'abord un compte depuis sa ligne (événement « link »), puis le parent le sélectionne. Sinon, tout employé se choisit ;
 * « Sans compte » et « Associer » restent affichés dans tous les cas, avec ou sans circuit.
 */
const props = defineProps({
  id: { type: String, default: undefined },
  modelValue: { type: String, default: '' },
  /** Employés proposés. */
  options: { type: Array, required: true },
  /** (employeeId) => l'employé a un compte utilisateur. */
  hasAccount: { type: Function, required: true },
  /** Le circuit exige un N+1 (pas de choix « Aucun responsable »). */
  requireAccount: { type: Boolean, default: false },
  /** L'employé suit un circuit : le N+1 doit avoir un compte pour valider ses congés. */
  lockWithoutAccount: { type: Boolean, default: false },
  /** L'utilisateur peut associer un compte (gestion des accès). */
  canLink: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'link']);

const open = ref(false);
const active = ref(0);
const query = ref('');
const trigger = ref(null);
const panel = ref(null);
const search = ref(null);
const pos = ref({ top: 0, left: 0, width: 0 });

const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const nameOf = (e) => `${e.firstName} ${e.lastName}`;
// « Aucun » (si le N+1 est facultatif), puis les employés filtrés : avec compte d'abord, puis sans compte.
const items = computed(() => {
  const q = fold(query.value.trim());
  const list = props.options
    .filter((e) => !q || fold(nameOf(e)).includes(q))
    .map((e) => ({ e, account: props.hasAccount(e.id) }))
    .sort((a, b) => (a.account === b.account ? nameOf(a.e).localeCompare(nameOf(b.e)) : a.account ? -1 : 1));
  return [...(props.requireAccount || q ? [] : [{ e: null, account: true }]), ...list];
});
const selected = computed(() => props.options.find((e) => e.id === props.modelValue));
const locked = (item) => !!item.e && props.lockWithoutAccount && !item.account;

function place() {
  const r = trigger.value.getBoundingClientRect();
  const width = Math.max(r.width, 320);
  const height = panel.value?.offsetHeight ?? 300;
  const below = r.bottom + 4 + height <= window.innerHeight - 8;
  pos.value = {
    top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - height),
    left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
    width,
  };
}

async function show() {
  open.value = true;
  query.value = '';
  active.value = Math.max(0, items.value.findIndex((i) => (i.e?.id ?? '') === props.modelValue));
  place();
  await nextTick();
  place();
  search.value?.focus();
}

function close(refocus = false) {
  open.value = false;
  if (refocus) trigger.value?.focus();
}

// Ligne sans compte alors qu'un circuit est suivi : on associe d'abord le compte (le parent sélectionnera l'employé ensuite).
function choose(item) {
  if (!item) return;
  if (locked(item)) { link(item); return; }
  emit('update:modelValue', item.e?.id ?? '');
  close(true);
}

function link(item) {
  if (!props.canLink) return;
  close();
  emit('link', item.e);
}

const optionId = (i) => `${props.id || 'mgr'}-opt-${i}`;

async function onKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); active.value = Math.min(items.value.length - 1, active.value + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active.value = Math.max(0, active.value - 1); }
  else if (e.key === 'Enter') { e.preventDefault(); choose(items.value[active.value]); }
  else if (e.key === 'Tab') close();
  await nextTick();
  panel.value?.querySelector(`#${optionId(active.value)}`)?.scrollIntoView({ block: 'nearest' });
}
function onTriggerKey(e) {
  if (!open.value && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); }
}
watch(query, () => { active.value = 0; });

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
  <button :id="id" ref="trigger" type="button" :class="['mgr-trigger', { open, invalid }]" role="combobox" aria-haspopup="listbox"
    :aria-expanded="open" :aria-controls="`${id || 'mgr'}-list`" @click="open ? close() : show()" @keydown="onTriggerKey">
    <span v-if="selected" class="mgr-value">
      <span class="mgr-name">{{ nameOf(selected) }}</span>
      <span v-if="!hasAccount(selected.id)" class="mgr-chip">Sans compte</span>
    </span>
    <span v-else class="mgr-placeholder">{{ requireAccount ? 'Choisir le responsable…' : 'Aucun responsable' }}</span>
    <ChevronDown :size="15" class="mgr-chevron" aria-hidden="true" />
  </button>

  <Teleport to="body">
    <div v-if="open" :id="`${id || 'mgr'}-list`" ref="panel" class="mgr-panel"
      :style="{ top: `${pos.top}px`, left: `${pos.left}px`, width: `${pos.width}px` }">
      <label class="mgr-search">
        <Search :size="13" aria-hidden="true" />
        <input ref="search" v-model="query" type="text" placeholder="Rechercher un employé" aria-label="Rechercher un employé"
          :aria-activedescendant="optionId(active)" @keydown="onKey" />
      </label>
      <div role="listbox" aria-label="Responsable hiérarchique (N+1)" @mousedown.prevent>
        <p v-if="items.length === 0" class="mgr-empty">Aucun employé trouvé.</p>
        <div v-for="(item, i) in items" :id="optionId(i)" :key="item.e?.id ?? 'none'" role="option"
          :aria-selected="(item.e?.id ?? '') === modelValue" :aria-disabled="locked(item) && !canLink"
          :class="['mgr-option', { active: active === i, locked: locked(item) }]"
          :title="locked(item) ? (canLink ? `Associez d’abord un compte à ${nameOf(item.e)} pour le choisir` : `${nameOf(item.e)} n’a pas de compte utilisateur`) : undefined"
          @mouseenter="active = i" @click="choose(item)">
          <template v-if="item.e">
            <span class="mgr-name">{{ nameOf(item.e) }}</span>
            <template v-if="!item.account">
              <span class="mgr-chip">Sans compte</span>
              <button v-if="canLink" type="button" class="mgr-link" :aria-label="`Associer un compte à ${nameOf(item.e)}`"
                @click.stop="link(item)">
                <Link2 :size="12" aria-hidden="true" /> Associer
              </button>
            </template>
          </template>
          <span v-else class="mgr-name mgr-muted">Aucun responsable</span>
          <Check v-if="(item.e?.id ?? '') === modelValue" :size="14" class="mgr-check" aria-hidden="true" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.mgr-trigger {
  display: flex; align-items: center; gap: 8px; width: 100%; height: 32px; padding: 0 9px;
  border: 1px solid var(--border-strong); border-radius: 6px; background: #fff; color: var(--text); font: inherit; text-align: left; cursor: pointer;
}
.mgr-trigger:focus-visible, .mgr-trigger.open { border-color: var(--primary); box-shadow: var(--focus); outline: none; }
.mgr-trigger.invalid { border-color: var(--danger, #d92d20); }
.mgr-value { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
.mgr-placeholder { flex: 1; color: var(--muted); }
.mgr-chevron { flex: none; color: var(--muted); transition: transform .15s; }
.open .mgr-chevron { transform: rotate(180deg); }

.mgr-panel {
  position: fixed; z-index: 90; max-height: 300px; overflow-y: auto; padding: 4px;
  background: #fff; border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow-lg);
}
.mgr-search {
  position: sticky; top: -4px; z-index: 1; display: flex; align-items: center; gap: 6px; margin: -4px -4px 4px; padding: 7px 10px;
  background: #fff; border-bottom: 1px solid var(--border); color: var(--muted);
}
.mgr-search input { flex: 1; min-width: 0; height: 22px; padding: 0; border: 0; outline: none; background: transparent; font: inherit; font-size: 12.5px; color: var(--text); box-shadow: none; }
.mgr-option { display: flex; align-items: center; gap: 8px; min-height: 30px; padding: 3px 8px 3px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.mgr-option.active { background: var(--surface-2); }
.mgr-option[aria-selected='true'] { background: var(--primary-soft); }
.mgr-option.locked .mgr-name { color: var(--muted); }
.mgr-name { flex: 0 1 auto; min-width: 0; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mgr-muted { color: var(--muted); font-weight: 400; }
.mgr-chip { flex: none; padding: 0 6px; border-radius: 999px; background: #fff6e5; color: #93500a; font-size: 10.5px; font-weight: 500; line-height: 16px; }
.mgr-link {
  flex: none; display: inline-flex; align-items: center; gap: 3px; margin-left: auto; height: 22px; padding: 0 7px;
  border: 1px solid #c9daf3; border-radius: 6px; background: #fff; color: var(--primary); font: inherit; font-size: 11.5px; font-weight: 500; cursor: pointer;
}
.mgr-link:hover { background: var(--primary-soft); border-color: var(--primary); }
.mgr-check { flex: none; margin-left: auto; color: var(--primary); }
.mgr-link + .mgr-check { margin-left: 0; }
.mgr-empty { margin: 0; padding: 10px; font-size: 12.5px; color: var(--muted); }
</style>
