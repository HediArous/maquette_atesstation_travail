<script setup>
import { ref } from 'vue';
import { Archive, ArchiveRestore, Link2, Pencil, Plus } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import ArchivedBadge from '../../components/ui/ArchivedBadge.vue';
import Card from '../../components/ui/Card.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import FunctionLinkModal from './FunctionLinkModal.vue';

/** Fonctions solo liées (suppléance) : leurs titulaires ne peuvent pas être absents en même temps. */
const store = useStore();
const data = useCompanyData();
const editing = ref();
const holderNames = (fnId) => data.employees.filter((e) => e.functionId === fnId && e.status !== 'inactif').map((e) => `${e.firstName} ${e.lastName}`).join(', ') || 'Vacant';
</script>

<template>
  <Card flush>
    <template #title><span class="row-gap"><Link2 :size="15" aria-hidden="true" /> Fonctions solo liées</span></template>
    <template #actions><button type="button" class="btn btn-sm btn-primary" @click="editing = {}"><Plus :size="14" aria-hidden="true" /> Lier des fonctions</button></template>
    <p class="card-intro">Les titulaires de fonctions liées se remplacent : ils ne peuvent pas être en congé le même jour ni sur une période qui se chevauche.</p>
    <EmptyState v-if="data.functionLinks.length === 0" title="Aucune liaison" text="Liez au moins deux fonctions solo." />
    <ul v-else class="link-list">
      <li v-for="l in data.functionLinks" :key="l.id" :class="{ archived: l.archived }">
        <div class="grow">
          <p class="person-name">{{ l.name }} <ArchivedBadge v-if="l.archived" /></p>
          <div class="link-chain">
            <span v-for="(id, i) in l.functionIds" :key="id" class="link-chain-item">
              <span v-if="i > 0" class="link-sep" aria-label="lié à">⇄</span>
              <span class="fn-chip"><span class="fn-chip-name">{{ data.fn(id)?.name }}</span><span class="fn-chip-holder">{{ holderNames(id) }}</span></span>
            </span>
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-ghost" :disabled="l.archived" @click="editing = { link: l }"><Pencil :size="13" aria-hidden="true" /> Modifier</button>
        <button type="button" class="btn btn-sm btn-ghost" @click="store.setArchived('functionLinks', l.id, !l.archived)">
          <template v-if="l.archived"><ArchiveRestore :size="13" aria-hidden="true" /> Restaurer</template>
          <template v-else><Archive :size="13" aria-hidden="true" /> Archiver</template>
        </button>
      </li>
    </ul>
    <FunctionLinkModal :state="editing" @close="editing = undefined" />
  </Card>
</template>
