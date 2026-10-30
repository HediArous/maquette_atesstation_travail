<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight } from '@lucide/vue';

/**
 * Sous-navigation horizontale : une ligne d'onglets en tête de la carte de contenu. Quand les onglets débordent, une
 * flèche (avec un fondu) signale de chaque côté qu'il en reste et fait défiler la barre.
 */
const props = defineProps({
  app: { type: String, required: true },
  section: { type: String, required: true },
  /** { title, items: [{ id, label, icon }] } */
  sub: { type: Object, required: true },
  counts: { type: Object, default: () => ({}) },
});

const scroller = ref(null);
const canLeft = ref(false);
const canRight = ref(false);

function update() {
  const el = scroller.value;
  if (!el) return;
  canLeft.value = el.scrollLeft > 2;
  canRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
}

function scrollBy(direction) {
  const el = scroller.value;
  el?.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.6), behavior: 'smooth' });
}

// Garde l'onglet actif visible quand la barre défile horizontalement.
const keepActiveVisible = () => nextTick(() => {
  scroller.value?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  update();
});

let resize;
onMounted(() => {
  keepActiveVisible();
  resize = new ResizeObserver(update);
  resize.observe(scroller.value);
});
onBeforeUnmount(() => resize?.disconnect());
watch(() => props.section, keepActiveVisible);
watch(() => props.sub.items.length, () => nextTick(update));
</script>

<template>
  <nav class="section-tabs" :aria-label="`Navigation ${sub.title}`">
    <button v-show="canLeft" type="button" class="stabs-arrow left" tabindex="-1" aria-label="Onglets précédents" @click="scrollBy(-1)">
      <ChevronLeft :size="16" aria-hidden="true" />
    </button>
    <div ref="scroller" class="stabs-scroll" @scroll.passive="update">
      <div class="stabs-row">
        <a v-for="item in sub.items" :key="item.id" :href="`/${app}/${item.id}`" :class="['stab', { active: section === item.id }]"
          :aria-current="section === item.id ? 'page' : undefined">
          <component :is="item.icon" :size="15" :stroke-width="1.9" aria-hidden="true" />
          <span>{{ item.label }}</span>
          <span v-if="counts[item.id] > 0" class="stab-count" :aria-label="`${counts[item.id]} à traiter`">{{ counts[item.id] }}</span>
        </a>
      </div>
    </div>
    <button v-show="canRight" type="button" class="stabs-arrow right" tabindex="-1" aria-label="Onglets suivants" @click="scrollBy(1)">
      <ChevronRight :size="16" aria-hidden="true" />
    </button>
  </nav>
</template>

<style scoped>
/* Le défilement passe à .stabs-scroll : la barre (collante) reste fixe et porte les flèches. */
.section-tabs { overflow: hidden; position: sticky; }
.stabs-scroll { flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.stabs-scroll::-webkit-scrollbar { display: none; }

.stabs-arrow {
  position: absolute;
  top: 0;
  bottom: 1px;
  z-index: 1;
  display: flex;
  align-items: center;
  width: 44px;
  padding: 0 8px;
  border: 0;
  color: var(--primary, #2563eb);
  cursor: pointer;
}
.stabs-arrow.left { left: 0; justify-content: flex-start; background: linear-gradient(to right, #fff 55%, rgba(255, 255, 255, 0)); }
.stabs-arrow.right { right: 0; justify-content: flex-end; background: linear-gradient(to left, #fff 55%, rgba(255, 255, 255, 0)); }
.stabs-arrow:hover :deep(svg) { transform: scale(1.15); }
</style>
