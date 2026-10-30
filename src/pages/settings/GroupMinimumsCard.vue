<script setup>
import { computed } from 'vue';
import { Users } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Avatar from '../../components/ui/Avatar.vue';
import Badge from '../../components/ui/Badge.vue';
import Card from '../../components/ui/Card.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import Switch from '../../components/ui/Switch.vue';
import { functionHolders } from '../../utils/presence';

/** Présence minimale des fonctions groupe : nombre de personnes qui doivent rester présentes chaque jour. */
const store = useStore();
const data = useCompanyData();
const groups = computed(() => data.functions.filter((f) => f.interim && f.kind === 'groupe' && !f.archived));

const holdersOf = (f) => functionHolders(store.db, f.id);
const maxAbsent = (f) => (f.minPresent != null ? Math.max(0, holdersOf(f).length - f.minPresent) : undefined);
const setMin = (f, value) => store.updateItem('functions', { ...f, minPresent: value === '' ? undefined : Math.max(0, Number(value)) });
</script>

<template>
  <Card flush>
    <template #title><span class="row-gap"><Users :size="15" aria-hidden="true" /> Présence minimale des fonctions groupe</span></template>
    <p class="card-intro">Nombre de personnes qui doivent rester présentes chaque jour. Exemple : 3 ingénieurs et 2 requis → un seul peut être en congé sur une même période.</p>
    <EmptyState v-if="groups.length === 0" title="Aucune fonction groupe" text="Définissez des fonctions de type « groupe » dans Paramètres › Fonctions." />
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Fonction</th>
            <th scope="col">Titulaires</th>
            <th scope="col" class="num">Effectif</th>
            <th scope="col">Présents minimum</th>
            <th scope="col">Absences simultanées</th>
            <th scope="col">Règle active</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in groups" :key="f.id">
            <td><span class="person-name">{{ f.name }}</span><span class="block small text-muted">{{ data.departmentName(f.departmentId) ?? 'Transverse' }}</span></td>
            <td><span class="avatar-stack"><span v-for="e in holdersOf(f)" :key="e.id" :title="`${e.firstName} ${e.lastName}`"><Avatar :employee="e" :size="24" /></span></span></td>
            <td class="num">{{ holdersOf(f).length }}</td>
            <td>
              <label class="sr-only" :for="`min-${f.id}`">Présents minimum pour {{ f.name }}</label>
              <input :id="`min-${f.id}`" class="input-sm" type="number" min="0" :max="holdersOf(f).length" step="1" :value="f.minPresent ?? ''" placeholder="—" @input="setMin(f, $event.target.value)" />
            </td>
            <td>
              <span v-if="maxAbsent(f) == null" class="text-muted small">Non défini</span>
              <Badge v-else-if="maxAbsent(f) === 0" tone="danger">Aucune absence possible</Badge>
              <Badge v-else tone="success">{{ maxAbsent(f) }} à la fois</Badge>
            </td>
            <td>
              <Switch :model-value="f.minPresent != null" :label="f.minPresent != null ? 'Oui' : 'Non'" @update:model-value="(v) => setMin(f, v ? String(Math.max(1, holdersOf(f).length - 1)) : '')" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </Card>
</template>
