<script setup>
import {leaveCatalog} from '../../maquette/leaveCatalog';
import {isLeaveFeatureEnabled} from '../../maquette/companyModules';
import { computed } from 'vue';
import { ShieldAlert } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Card from '../../components/ui/Card.vue';
import Segmented from '../../components/ui/Segmented.vue';
import { policyTypeIds, presenceEffect } from '../../utils/presence';

/** Application des règles de présence : effet (blocage ou avertissement) et types de congé concernés. */
const store = useStore();
const data = useCompanyData();
const availableTypes=computed(()=>leaveCatalog.types.filter(t=>!t.archived&&isLeaveFeatureEnabled(store.companyId,t)));
const types = computed(() => policyTypeIds(store.db, store.companyId));
const effect = computed(() => presenceEffect(store.db, store.companyId));

const save = (leaveTypeIds, eff) => store.setPresencePolicy({ companyId: store.companyId, leaveTypeIds, effect: eff });

function setEffect(v) {
  save([...types.value], v);
  store.toast(v === 'block' ? 'Les demandes en conflit seront bloquées' : 'Les demandes en conflit afficheront un avertissement');
}

function toggleType(id, on) {
  const next = new Set(types.value);
  if (on) next.add(id); else next.delete(id);
  save([...next], effect.value);
}
</script>

<template>
  <Card>
    <template #title><span class="row-gap"><ShieldAlert :size="15" aria-hidden="true" /> Application des règles</span></template>
    <div class="policy-grid">
      <div>
        <p class="label">Lorsqu’une règle n’est pas respectée</p>
        <Segmented :model-value="effect" label="Effet des règles de présence" :options="[{ value: 'block', label: 'Bloquer la demande' }, { value: 'warning', label: 'Avertir seulement' }]" @update:model-value="setEffect" />
        <p class="small text-muted mt-8">Les approbateurs voient toujours le conflit dans le détail de la demande.</p>
      </div>
      <div>
        <p class="label">Types de congé soumis aux règles</p>
        <p v-if="availableTypes.length === 0" class="small text-muted">Aucun type de congé : paramétrez-en dans Paramètres › Types de congé.</p>
        <div v-else class="check-grid">
          <label v-for="t in availableTypes" :key="t.id" class="check">
            <input type="checkbox" :checked="types.has(t.id)" @change="toggleType(t.id, $event.target.checked)" />
            <span class="type-tag"><span class="type-dot" :style="{ background: t.color }" aria-hidden="true" />{{ t.name }}</span>
          </label>
        </div>
        <p class="small text-muted mt-8">Les absences imprévisibles (maladie…) sont généralement exclues.</p>
      </div>
    </div>
  </Card>
</template>
