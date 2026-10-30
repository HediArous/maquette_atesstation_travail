<script setup>
import { onMounted, ref } from 'vue';
import { IdCard } from '@lucide/vue';
import { useStore } from '../../store';
import { formatMatricule, nameCode } from '../../utils/org';
import CodeNumberingEditor from './CodeNumberingEditor.vue';
import { CODE_SERIES } from './codeSeries';
import EmployeeNumberingEditor from './EmployeeNumberingEditor.vue';

/**
 * Numéro de souche : format des codes attribués à la création — matricules des employés (compteur), codes des
 * départements, fonctions, primes et types de documents (préfixe + premières lettres du nom). Les types de contrat n'ont
 * pas de souche : leur code est fait des premières lettres du nom.
 * Une série par onglet.
 */
const SERIES = [
  { id: 'employe', label: 'Employés', rule: 'Matricule séquentiel', item: 'matricule', icon: IdCard },
  ...Object.entries(CODE_SERIES).map(([id, serie]) => ({ id, label: serie.label, rule: 'Code déduit du nom', item: serie.item, icon: serie.icon })),
];

const store = useStore();
const entity = ref('employe');
const tabs = ref([]);

/** Onglets au clavier : flèches gauche / droite, Début, Fin (le focus suit la sélection). */
function onKey(event, index) {
  const last = SERIES.length - 1;
  const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  entity.value = SERIES[next].id;
  tabs.value[next]?.focus();
}

// Le compteur des matricules avance à chaque création : on relit les souches à l'ouverture de la page.
onMounted(() => {
  store.loadNumbering();
  store.loadCodeNumberings();
});

function example(id) {
  if (id === 'employe') return store.numbering ? formatMatricule(store.numbering, store.numbering.next) : '…';
  const n = store.codeNumberings?.[id];
  return n ? nameCode(n, CODE_SERIES[id].samples[0]) : '…';
}
</script>

<template>
  <div class="fstack num-series-wrap">
    <div class="num-series" role="tablist" aria-label="Séries numérotées">
      <button v-for="(s, i) in SERIES" :key="s.id" ref="tabs" type="button" role="tab" :aria-selected="entity === s.id" :tabindex="entity === s.id ? 0 : -1"
        :class="['num-serie', { on: entity === s.id }]" @click="entity = s.id" @keydown="onKey($event, i)">
        <span class="num-serie-icon"><component :is="s.icon" :size="13" aria-hidden="true" /></span>
        <span class="num-serie-text" :title="s.rule"><strong>{{ s.label }}</strong></span>
        <span class="num-serie-code">
          <code :title="s.id === 'employe' ? 'Prochain matricule' : `${s.rule} — exemple pour « ${CODE_SERIES[s.id].samples[0]} »`">{{ example(s.id) }}</code>
        </span>
      </button>
    </div>
    <EmployeeNumberingEditor v-if="entity === 'employe'" />
    <CodeNumberingEditor v-for="s in SERIES.filter((x) => x.id !== 'employe' && x.id === entity)" :key="s.id" :entity="s.id" :label="s.label" :item="s.item">
      <template #icon><component :is="s.icon" :size="16" /></template>
    </CodeNumberingEditor>
  </div>
</template>
