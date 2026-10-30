<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { ArrowDownWideNarrow, ArrowRight, ArrowUpNarrowWide, Bot, ChevronLeft, ChevronRight, CloudOff, History, LoaderCircle, Pencil, Plus, RotateCcw, Search, Trash2, X } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import { employeeHistoryApi, fromEmployeeHistoryDto, HISTORY_TYPE_LABEL, HISTORY_TYPE_TONE } from '../../api/employeeHistory';
import Avatar from '../../components/ui/Avatar.vue';
import Badge from '../../components/ui/Badge.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import FormCard from '../../components/FormCard.vue';
import SelectFilter from '../../components/ui/SelectFilter.vue';
import { formatDate, formatLong } from '../../utils/dates';

/**
 * Historique du dossier (RH-10), en lecture seule, présenté en chronologie verticale groupée par jour : recherche et
 * filtres appliqués par le serveur (POST /api/employees/{id}/history/search), tri par date, pagination serveur.
 * Les événements sont écrits par le backend à chaque modification (fiche, contrats, salaires, horaire, primes, accès…).
 */
const props = defineProps({
  employee: { type: Object, required: true },
});
const emit = defineEmits(['count']);

const store = useStore();
const data = useCompanyData();

const q = ref('');
const EMPTY_FIELDS = { type: '', field: '', authorUserId: '', from: '', to: '' };
const fields = reactive({ ...EMPTY_FIELDS });
const sort = 'date';
const direction = ref('desc');
const PAGE_SIZES = [5,10, 20, 50, 100];
const page = ref(0);
const size = ref(20);

// Recherche saisie : envoyée après une courte pause de frappe.
const search = ref('');
let typing;
watch(q, (v) => { window.clearTimeout(typing); typing = window.setTimeout(() => { search.value = v.trim(); }, 300); });
onBeforeUnmount(() => window.clearTimeout(typing));

// Options des filtres « Champ » et « Auteur » : valeurs réellement présentes dans l'historique de l'employé.
const options = ref({ fields: [], authors: [], users: [] });
async function loadOptions() {
  try { options.value = await employeeHistoryApi.filters(props.employee.id); } catch { options.value = { fields: [], authors: [], users: [] }; }
}
const typeOptions = Object.entries(HISTORY_TYPE_LABEL).map(([value, label]) => ({ value, label }));

// Critères hors pagination (la clé sert à revenir en page 1 et à éviter les appels en double).
const criteria = computed(() => ({ search: search.value, ...fields, sort, direction: direction.value }));
const criteriaKey = computed(() => JSON.stringify(criteria.value));
const hasFilters = computed(() => !!q.value || Object.values(fields).some((v) => v));
function reset() { window.clearTimeout(typing); q.value = ''; search.value = ''; Object.assign(fields, EMPTY_FIELDS); }

// Filtres actifs affichés en pastilles, chacune supprimable.
const labelOf = (list, value) => list.find((o) => o.value === value)?.label ?? value;
const activeFilters = computed(() => [
  search.value && { key: 'search', label: `« ${search.value} »`, clear: () => { q.value = ''; search.value = ''; } },
  fields.type && { key: 'type', label: `Type : ${HISTORY_TYPE_LABEL[fields.type]}`, clear: () => { fields.type = ''; } },
  fields.field && { key: 'field', label: `Champ : ${labelOf(options.value.fields, fields.field)}`, clear: () => { fields.field = ''; } },
  fields.authorUserId && { key: 'author', label: `Auteur : ${labelOf(options.value.users ?? [], fields.authorUserId)}`, clear: () => { fields.authorUserId = ''; } },
  (fields.from || fields.to) && {
    key: 'period',
    label: fields.from && fields.to ? `Du ${formatDate(fields.from)} au ${formatDate(fields.to)}`
      : fields.from ? `Depuis le ${formatDate(fields.from)}` : `Jusqu’au ${formatDate(fields.to)}`,
    clear: () => { fields.from = ''; fields.to = ''; },
  },
].filter(Boolean));

const result = ref({ content: [], totalElements: 0, totalPages: 0 });
const loading = ref(false);
const error = ref('');
let lastKey = '';
let seq = 0;

async function fetchPage(force = false) {
  const key = `${props.employee.id}|${criteriaKey.value}|${page.value}|${size.value}`;
  if (!force && key === lastKey) return;
  lastKey = key;
  const mine = ++seq;
  loading.value = true;
  try {
    const res = await employeeHistoryApi.search(props.employee.id, { ...criteria.value, page: page.value, size: size.value });
    // Réponse d'une requête dépassée (nouvelle recherche, autre page) : ignorée.
    if (mine !== seq) return;
    if (res.totalPages > 0 && page.value >= res.totalPages) { page.value = res.totalPages - 1; return; }
    result.value = res;
    error.value = '';
    expanded.value = new Set();
    if (!hasFilters.value) emit('count', res.totalElements);
  } catch (err) {
    if (mine !== seq) return;
    // Aucune donnée de remplacement : la liste est vidée et l'erreur affichée.
    result.value = { content: [], totalElements: 0, totalPages: 0 };
    error.value = err.message;
    lastKey = '';
  } finally {
    if (mine === seq) loading.value = false;
  }
}

watch(criteriaKey, () => { if (page.value === 0) fetchPage(); else page.value = 0; });
watch(size, () => { if (page.value === 0) fetchPage(); else page.value = 0; });
watch(page, () => fetchPage());
// Autre employé, autre société, ou fiche modifiée (nouvel objet employé) : options et page relues.
watch([() => props.employee.id, () => store.companyId], () => { reset(); page.value = 0; }, { flush: 'sync' });
watch([() => props.employee.id, () => store.companyId, () => props.employee], () => { loadOptions(); fetchPage(true); }, { immediate: true });

const rows = computed(() => result.value.content.map(fromEmployeeHistoryDto));
const total = computed(() => result.value.totalElements);
const pageCount = computed(() => result.value.totalPages);
const firstRow = computed(() => (total.value === 0 ? 0 : page.value * size.value + 1));
const lastRow = computed(() => Math.min((page.value + 1) * size.value, total.value));
const pages = computed(() => {
  const n = pageCount.value;
  const keep = [...new Set([0, n - 1, page.value - 1, page.value, page.value + 1])].filter((p) => p >= 0 && p < n).sort((a, b) => a - b);
  return keep.flatMap((p, i) => (i > 0 && p - keep[i - 1] > 1 ? ['…', p] : [p]));
});

// Événements de la page groupés par jour, dans l'ordre renvoyé par le serveur.
const days = computed(() => {
  const groups = [];
  for (const h of rows.value) {
    const day = h.at.slice(0, 10);
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] });
    groups.at(-1).items.push(h);
  }
  return groups;
});

const TYPE_ICON = { CREATION: Plus, MODIFICATION: Pencil, SUPPRESSION: Trash2 };
const time = (at) => at?.split('T')[1]?.slice(0, 5) ?? '';
const dayLabel = (day) => { const v = formatLong(day); return v.charAt(0).toUpperCase() + v.slice(1); };

// Valeurs longues repliées ; « Afficher plus » les déroule pour l'événement.
const LONG = 80;
const expanded = ref(new Set());
const isLong = (h) => (h.oldValue?.length ?? 0) > LONG || (h.newValue?.length ?? 0) > LONG;
function toggle(id) {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id); else next.add(id);
  expanded.value = next;
}

const isSystem = (h) => !h.authorId && h.authorName === 'Système';
// Avatar de l'auteur : fiche connue (couleur selon le genre), sinon initiales du nom.
function author(h) {
  const known = h.authorId ? data.employee(h.authorId) : undefined;
  if (known) return known;
  const [firstName = '', ...rest] = (h.authorName ?? '').split(' ');
  return { id: h.authorId ?? h.authorName, firstName, lastName: rest.join(' ') };
}
</script>

<template>
  <FormCard title="Historique" subtitle="Chronologie inaltérable : les entrées sont ajoutées par l’application et ne peuvent être ni modifiées ni supprimées.">
    <template #icon><History :size="16" /></template>

    <div class="filters hist-filters">
      <div class="filter filter-search">
        <label for="hist-q">Recherche</label>
        <div class="input-icon">
          <Search :size="14" aria-hidden="true" />
          <input id="hist-q" v-model="q" type="search" placeholder="Description, valeur, champ, auteur…" />
        </div>
      </div>
      <SelectFilter v-model="fields.type" label="Type" :options="typeOptions" />
      <SelectFilter v-model="fields.field" label="Champ" :options="options.fields" />
      <SelectFilter v-model="fields.authorUserId" label="Auteur" :options="options.users ?? []" />
      <div class="filter">
        <label for="hist-from">Du</label>
        <input id="hist-from" v-model="fields.from" type="date" :max="fields.to || undefined" />
      </div>
      <div class="filter">
        <label for="hist-to">au</label>
        <input id="hist-to" v-model="fields.to" type="date" :min="fields.from || undefined" />
      </div>
    </div>

    <div v-if="activeFilters.length" class="hist-active" aria-label="Filtres actifs">
      <span v-for="f in activeFilters" :key="f.key" class="hist-chip">
        {{ f.label }}
        <button type="button" :aria-label="`Retirer le filtre ${f.label}`" @click="f.clear()"><X :size="12" /></button>
      </span>
      <button type="button" class="btn btn-sm btn-ghost" @click="reset"><RotateCcw :size="13" aria-hidden="true" /> Réinitialiser</button>
    </div>

    <EmptyState v-if="loading && !rows.length && !error" title="Chargement de l’historique…" text="Lecture des événements sur le serveur.">
      <template #icon><LoaderCircle :size="28" class="spin" aria-hidden="true" /></template>
    </EmptyState>
    <EmptyState v-else-if="error" title="Historique indisponible" :text="error">
      <template #icon><CloudOff :size="28" aria-hidden="true" /></template>
      <template #action><button type="button" class="btn btn-sm btn-primary" @click="fetchPage(true)">Réessayer</button></template>
    </EmptyState>
    <template v-else>
      <div class="hist-toolbar">
        <p class="result-count" aria-live="polite">
          {{ total }} événement{{ total > 1 ? 's' : '' }}<template v-if="total"> · {{ firstRow }}–{{ lastRow }}</template>
          <LoaderCircle v-if="loading" :size="12" class="spin" aria-label="Actualisation…" />
        </p>
        <button v-if="total > 1" type="button" class="btn btn-sm btn-ghost" :aria-label="`Trier par date : ${direction === 'desc' ? 'plus récents' : 'plus anciens'} d’abord`"
          @click="direction = direction === 'desc' ? 'asc' : 'desc'">
          <component :is="direction === 'desc' ? ArrowDownWideNarrow : ArrowUpNarrowWide" :size="13" aria-hidden="true" />
          {{ direction === 'desc' ? 'Plus récents d’abord' : 'Plus anciens d’abord' }}
        </button>
      </div>

      <EmptyState v-if="rows.length === 0" :title="hasFilters ? 'Aucun événement trouvé' : 'Aucun événement'"
        :text="hasFilters ? 'Modifiez la recherche ou les filtres.' : 'Les modifications du dossier apparaîtront ici.'">
        <template v-if="hasFilters" #action><button type="button" class="btn btn-sm btn-ghost" @click="reset">Effacer les filtres</button></template>
      </EmptyState>

      <div v-else class="hist-timeline" :class="{ 'is-loading': loading }">
        <section v-for="g in days" :key="g.day" class="hist-day">
          <h4 class="hist-day-title"><time :datetime="g.day">{{ dayLabel(g.day) }}</time></h4>
          <ol class="hist-list">
            <li v-for="h in g.items" :key="h.id" class="hist-item" :class="`hist-${h.type?.toLowerCase()}`">
              <span class="hist-dot" aria-hidden="true"><component :is="TYPE_ICON[h.type] ?? Pencil" :size="13" /></span>
              <article class="hist-card">
                <header class="hist-head">
                  <Badge :tone="HISTORY_TYPE_TONE[h.type]">{{ HISTORY_TYPE_LABEL[h.type] ?? h.type }}</Badge>
                  <button type="button" class="hist-field" :title="`Filtrer sur « ${h.fieldLabel} »`" @click="fields.field = h.field">{{ h.fieldLabel }}</button>
                  <time class="hist-time small text-muted" :datetime="h.at">{{ time(h.at) }}</time>
                </header>
                <p class="hist-desc">{{ h.label }}</p>
                <div v-if="h.oldValue || h.newValue" class="hist-values" :class="{ open: expanded.has(h.id) }">
                  <span v-if="h.oldValue" class="hist-old" :title="h.oldValue"><span class="sr-only">Avant : </span>{{ h.oldValue }}</span>
                  <ArrowRight v-if="h.oldValue && h.newValue" :size="12" class="text-muted hist-arrow" aria-hidden="true" />
                  <span v-if="h.newValue" class="hist-new" :title="h.newValue"><span class="sr-only">Après : </span>{{ h.newValue }}</span>
                </div>
                <button v-if="isLong(h)" type="button" class="hist-more" :aria-expanded="expanded.has(h.id)" @click="toggle(h.id)">
                  {{ expanded.has(h.id) ? 'Afficher moins' : 'Afficher plus' }}
                </button>
                <footer class="hist-author">
                  <span v-if="isSystem(h)" class="avatar hist-system" aria-hidden="true"><Bot :size="13" /></span>
                  <Avatar v-else :employee="author(h)" :size="22" />
                  <span class="small">par <strong :class="{ 'text-muted': isSystem(h) }">{{ h.authorName }}</strong></span>
                </footer>
              </article>
            </li>
          </ol>
        </section>
      </div>

      <nav v-if="total > 0" class="pager" aria-label="Pagination de l’historique">
        <label class="pager-size">Afficher
          <select v-model.number="size">
            <option v-for="n in PAGE_SIZES" :key="n" :value="n">{{ n }}</option>
          </select>
          par page
        </label>
        <div class="pager-pages">
          <button type="button" class="icon-btn icon-btn-sm" :disabled="page === 0 || loading" aria-label="Page précédente" @click="page--"><ChevronLeft :size="14" /></button>
          <template v-for="(p, i) in pages" :key="`${p}-${i}`">
            <span v-if="p === '…'" class="pager-gap" aria-hidden="true">…</span>
            <button v-else type="button" class="btn btn-sm" :class="p === page ? 'btn-primary' : 'btn-ghost'" :aria-current="p === page ? 'page' : undefined"
              :disabled="loading && p !== page" @click="page = p">{{ p + 1 }}</button>
          </template>
          <button type="button" class="icon-btn icon-btn-sm" :disabled="page >= pageCount - 1 || loading" aria-label="Page suivante" @click="page++"><ChevronRight :size="14" /></button>
        </div>
        <span class="pager-info">Page {{ page + 1 }} / {{ pageCount }}</span>
      </nav>
    </template>
  </FormCard>
</template>

<style scoped>
.hist-filters { margin-bottom: 4px; }
.hist-active { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 6px 0 4px; }
.hist-chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 2px 4px 2px 10px;
  border: 1px solid #cddcf2; border-radius: 999px; background: #f6f9fe; font-size: 12px; color: #0b5cc0;
}
.hist-chip button {
  display: inline-flex; padding: 2px; border: 0; border-radius: 999px; background: none; color: inherit; cursor: pointer;
}
.hist-chip button:hover { background: #e3edfb; }
.hist-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }

.hist-timeline { margin-top: 4px; transition: opacity .15s; }
.hist-timeline.is-loading { opacity: .55; }
.hist-day + .hist-day { margin-top: 14px; }
.hist-day-title {
  position: sticky; top: 0; z-index: 1; margin: 0 0 8px; padding: 4px 0;
  background: #fff; font-size: 12px; font-weight: 600; color: #475569; letter-spacing: .02em;
}
.hist-list { list-style: none; margin: 0; padding: 0; }
.hist-item { position: relative; display: flex; gap: 12px; padding-bottom: 12px; }
.hist-item:not(:last-child)::before {
  content: ""; position: absolute; left: 12px; top: 28px; bottom: 0; width: 1px; background: var(--border-strong, #d5dbe3);
}
.hist-dot {
  flex-shrink: 0; width: 25px; height: 25px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid #d5dbe3; background: #fff; color: #64748b;
}
.hist-creation .hist-dot { border-color: #b7e2c8; background: #ecf8f1; color: #166534; }
.hist-modification .hist-dot { border-color: #cddcf2; background: #f6f9fe; color: #0b5cc0; }
.hist-suppression .hist-dot { border-color: #f3c7c7; background: #fdf0f0; color: #9f1d1d; }
.hist-card {
  flex: 1; min-width: 0; padding: 10px 12px; border: 1px solid #e3e8ef; border-radius: 8px; background: #fff;
}
.hist-card:hover { border-color: #cfd8e3; }
.hist-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.hist-time { margin-left: auto; font-variant-numeric: tabular-nums; }
.hist-field {
  padding: 2px 8px; border: 1px solid #e3e8ef; border-radius: 999px; background: #f6f8fb;
  font-size: 11.5px; color: #334155; cursor: pointer;
}
.hist-field:hover { border-color: #7aa7e3; color: #0b5cc0; }
.hist-field:focus-visible, .hist-more:focus-visible { outline: 2px solid #7aa7e3; outline-offset: 2px; }
.hist-desc { margin: 6px 0 0; color: #1e293b; overflow-wrap: anywhere; }
.hist-values { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 6px; }
.hist-old, .hist-new {
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  padding: 1px 6px; border-radius: 4px; font-size: 11.5px;
}
.hist-values:not(.open) .hist-old, .hist-values:not(.open) .hist-new { max-width: min(280px, 100%); }
.hist-values.open { flex-direction: column; align-items: flex-start; }
.hist-values.open .hist-old, .hist-values.open .hist-new { white-space: pre-wrap; overflow-wrap: anywhere; }
.hist-values.open .hist-arrow { transform: rotate(90deg); }
.hist-old { background: #fdf0f0; color: #9f1d1d; text-decoration: line-through; }
.hist-new { background: #ecf8f1; color: #166534; font-weight: 600; }
.hist-more { margin-top: 4px; padding: 0; border: 0; background: none; font-size: 12px; color: #0b5cc0; cursor: pointer; }
.hist-more:hover { text-decoration: underline; }
.hist-author { display: flex; align-items: center; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e3e8ef; color: #475569; }
.hist-system { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; background: #e2e8f0; color: #475569; }
/* Pagination : mêmes règles que la liste des employés (EmployeeList.vue). */
.pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0 4px; font-size: 12px; color: var(--muted); }
.pager-size { display: inline-flex; align-items: center; gap: 6px; }
.pager-size select { height: 28px; padding: 0 6px; border: 1px solid var(--border, #dbe2ea); border-radius: 6px; background: transparent; color: inherit; }
.pager-pages { display: inline-flex; align-items: center; gap: 4px; }
.pager-pages .btn { min-width: 30px; justify-content: center; }
.pager-gap { padding: 0 4px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (max-width: 640px) {
  .hist-item { gap: 8px; }
  .hist-card { padding: 8px 10px; }
  .hist-time { margin-left: 0; width: 100%; }
}
</style>
