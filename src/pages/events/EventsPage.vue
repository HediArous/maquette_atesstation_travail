<script setup>
import { computed, ref } from 'vue';
import { Archive, ArchiveRestore, Building2, CalendarRange, Plus, Users } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import ArchivedBadge from '../../components/ui/ArchivedBadge.vue';
import Card from '../../components/ui/Card.vue';
import EffectBadge from '../../components/ui/EffectBadge.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import SelectFilter from '../../components/ui/SelectFilter.vue';
import Switch from '../../components/ui/Switch.vue';
import { EFFECTS } from '../../components/ui/labels';
import { formatRange, overlaps, TODAY } from '../../utils/dates';
import { eventTargets } from '../../utils/leave';
import LeaveForm from '../leave/LeaveForm.vue';
import EventForm from './EventForm.vue';

/** Événements de la société et leur effet sur les demandes de congé. */
const store = useStore();
const data = useCompanyData();
const type = ref('');
const effect = ref('');
const when = ref('avenir');
const showArchived = ref(false);
const createOpen = ref(false);
const leaveOpen = ref(false);

const list = computed(() => data.events
  .filter((e) => showArchived.value || !e.archived)
  .filter((e) => !type.value || e.type === type.value)
  .filter((e) => !effect.value || e.effect === effect.value)
  .filter((e) => when.value === '' || (when.value === 'avenir' ? e.end >= TODAY : e.end < TODAY))
  .sort((a, b) => a.start.localeCompare(b.start)));

const typeOptions = computed(() => [...new Set(data.events.map((e) => e.type))].map((t) => ({ value: t, label: t })));

const impacted = (ev) => data.requests.filter((r) => {
  const emp = data.person(r.employeeId);
  return emp && (r.status === 'en_attente' || r.status === 'approuve') && overlaps(r.start, r.end, ev.start, ev.end) && eventTargets(ev, emp);
});
const firstName = (r) => data.person(r.employeeId)?.firstName;
</script>

<template>
  <PageHeader eyebrow="Application RH · Planification" title="Événements" subtitle="Événements de la société et leur effet sur les demandes de congé.">
    <template #icon><CalendarRange :size="20" :stroke-width="1.8" /></template>
    <template #actions>
      <button type="button" class="btn btn-ghost" @click="leaveOpen = true">Tester une demande de congé</button>
      <button type="button" class="btn btn-primary" @click="createOpen = true"><Plus :size="16" aria-hidden="true" /> Nouvel événement</button>
    </template>
    <template #toolbar>
      <div class="effect-cards">
        <div v-for="(e, k) in EFFECTS" :key="k" :class="`effect-card effect-${k}`">
          <EffectBadge :effect="k" />
          <p class="small">{{ e.help }}</p>
        </div>
      </div>
    </template>
  </PageHeader>
  <Card flush>
    <div class="filters">
      <SelectFilter v-model="when" label="Période" all-label="Toutes" :options="[{ value: 'avenir', label: 'En cours et à venir' }, { value: 'passe', label: 'Passés' }]" />
      <SelectFilter v-model="type" label="Type" :options="typeOptions" />
      <SelectFilter v-model="effect" label="Effet" :options="Object.entries(EFFECTS).map(([k, e]) => ({ value: k, label: e.label }))" />
      <div class="filter filter-check"><Switch v-model="showArchived" label="Afficher les archivés" /></div>
    </div>
    <EmptyState v-if="list.length === 0" title="Aucun événement" :text="data.events.length === 0 ? 'Créez le premier événement de la société.' : 'Aucun événement ne correspond aux filtres.'">
      <template #action><button type="button" class="btn btn-sm btn-primary" @click="createOpen = true">Créer un événement</button></template>
    </EmptyState>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr><th scope="col">Événement</th><th scope="col">Type</th><th scope="col">Dates</th><th scope="col">Concerne</th><th scope="col">Effet</th><th scope="col">Demandes impactées</th><th scope="col"><span class="sr-only">Actions</span></th></tr>
        </thead>
        <tbody>
          <tr v-for="e in list" :key="e.id" :class="{ 'row-archived': e.archived }">
            <td><span class="person-name">{{ e.name }}</span> <ArchivedBadge v-if="e.archived" /><span class="block small text-muted">{{ e.description }}</span></td>
            <td>{{ e.type }}</td>
            <td class="nowrap">{{ formatRange(e.start, e.end) }}</td>
            <td class="small">
              <span v-if="e.allCompany" class="row-gap"><Building2 :size="14" aria-hidden="true" /> Toute la société</span>
              <template v-else>
                {{ e.departmentIds.map((d) => data.departmentName(d)).join(', ') }}
                <span v-if="e.employeeIds.length > 0" class="block text-muted"><Users :size="13" aria-hidden="true" class="inline-icon" /> {{ e.employeeIds.map((id) => `${data.person(id)?.firstName} ${data.person(id)?.lastName}`).join(', ') }}</span>
              </template>
            </td>
            <td><EffectBadge :effect="e.effect" /></td>
            <td class="small">
              <span v-if="e.effect === 'info'" class="text-muted">—</span>
              <span v-else-if="impacted(e).length === 0" class="text-muted">Aucune</span>
              <span v-else :title="impacted(e).map(firstName).join(', ')"><strong>{{ impacted(e).length }}</strong> ({{ impacted(e).map(firstName).join(', ') }})</span>
            </td>
            <td class="actions">
              <button type="button" class="btn btn-sm btn-ghost" @click="store.setArchived('events', e.id, !e.archived)">
                <template v-if="e.archived"><ArchiveRestore :size="14" aria-hidden="true" /> Restaurer</template>
                <template v-else><Archive :size="14" aria-hidden="true" /> Archiver</template>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </Card>
  <EventForm :open="createOpen" @close="createOpen = false" />
  <LeaveForm :open="leaveOpen" @close="leaveOpen = false" />
</template>
