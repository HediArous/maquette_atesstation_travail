<script setup>
import { computed } from 'vue';
import { toMinutes } from '../../utils/hours';

/** Frise de 24 h : chaque créneau y est placé ; un poste de nuit est coupé à minuit et reprend le lendemain. */
const props = defineProps({
  slots: { type: Array, required: true },
});

const pct = (min) => `${(min / (24 * 60)) * 100}%`;
const segments = computed(() => props.slots.flatMap((x, i) => {
  if (!x.start || !x.end || x.start === x.end) return [];
  const a = toMinutes(x.start);
  const b = toMinutes(x.end);
  return b > a
    ? [{ i, a, b, night: false, label: x.label }]
    : [{ i, a, b: 24 * 60, night: true, label: x.label }, { i, a: 0, b, night: true, label: x.label }];
}));
</script>

<template>
  <div class="slot-timeline" aria-hidden="true">
    <div class="slot-track">
      <span v-for="(g, k) in segments" :key="k" :class="['slot-seg', { night: g.night }]" :style="{ left: pct(g.a), width: pct(g.b - g.a) }" :title="g.label">{{ g.i + 1 }}</span>
    </div>
    <div class="slot-scale"><span v-for="h in [0, 6, 12, 18, 24]" :key="h" :style="{ left: pct(h * 60) }">{{ h }} h</span></div>
  </div>
</template>
