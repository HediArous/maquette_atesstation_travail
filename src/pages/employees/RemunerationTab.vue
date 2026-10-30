<script setup>
import { computed, ref } from 'vue';
import { Ban, BadgePercent, Plus, Trash2 } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Badge from '../../components/ui/Badge.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import Modal from '../../components/ui/Modal.vue';
import Switch from '../../components/ui/Switch.vue';
import FormCard from '../../components/FormCard.vue';
import { formatDate } from '../../utils/dates';
import { formatAmount } from '../../utils/org';
import { PRIME_TYPE } from './constants';
import PrimeModal from './PrimeModal.vue';
import SalariesCard from './SalariesCard.vue';

/** Salaire de base daté et primes (RH-8). */
const props = defineProps({
  employee: { type: Object, required: true },
});

const store = useStore();
const data = useCompanyData();
const primeOpen = ref(false);
const confirmRevoke = ref(false);


// Enregistré dans le backend (/api/employee-primes) ; un refus est affiché.
async function run(action, message) {
  try {
    await action();
    store.toast(message, 'info');
  } catch (e) {
    store.toast(e.message, 'danger');
  }
}

function togglePrimes(allow) {
  if (!allow && props.employee.primes.length > 0) { confirmRevoke.value = true; return; }
  run(() => store.setPrimesAllowed(props.employee.id, allow), allow ? 'Primes autorisées pour cet employé' : 'Autorisation des primes retirée');
}

function revoke() {
  const count = props.employee.primes.length;
  confirmRevoke.value = false;
  run(() => store.setPrimesAllowed(props.employee.id, false), `Autorisation retirée — ${count} prime(s) révoquée(s)`);
}

function removePrime(primeId) {
  run(() => store.removePrime(props.employee.id, primeId), 'Prime retirée');
}

function assignPrime(primeId, since) {
  run(() => store.assignPrime(props.employee.id, primeId, since), 'Prime attribuée');
}
</script>

<template>
  <div class="fstack">
    <SalariesCard v-if="store.can('salaires.consulter')" :employee="employee" />

    <FormCard v-if="store.can('primes.consulter')" title="Primes" subtitle="Attribuées depuis le catalogue de la société, si les primes sont autorisées pour l’employé.">
      <template #icon><BadgePercent :size="16" /></template>
      <template v-if="employee.allowPrimes" #actions>
        <button v-if="store.can('primes.creer')" type="button" class="btn btn-sm btn-primary" @click="primeOpen = true"><Plus :size="14" aria-hidden="true" /> Attribuer une prime</button>
      </template>
      <Switch :model-value="employee.allowPrimes" :disabled="!store.can('primes.modifier')" label="Autoriser les primes pour cet employé" @update:model-value="togglePrimes" />
      <p v-if="!employee.allowPrimes" class="small text-muted mt-8">Les primes ne sont pas autorisées : la section est masquée sur la vue d’ensemble.</p>
      <EmptyState v-else-if="employee.primes.length === 0" title="Aucune prime attribuée" text="Attribuez une prime du catalogue de la société." />
      <div v-else class="table-wrap mt-12">
        <table class="table">
          <thead><tr><th scope="col">Prime</th><th scope="col">Type</th><th scope="col" class="num">Montant</th><th scope="col">Depuis</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="ep in employee.primes" :key="ep.primeId">
              <td><span class="person-name">{{ data.prime(ep.primeId)?.name }}</span> <Badge v-if="data.prime(ep.primeId)?.archived" tone="muted">Désactivée au catalogue</Badge></td>
              <td>{{ data.prime(ep.primeId) && PRIME_TYPE[data.prime(ep.primeId).type] }}</td>
              <td class="num">{{ data.prime(ep.primeId) ? formatAmount(data.prime(ep.primeId).amount, store.activeDevise) : '—' }}</td>
              <td class="nowrap">{{ formatDate(ep.since) }}</td>
              <td class="actions">
                <button v-if="store.can('primes.supprimer')" type="button" class="btn btn-sm btn-ghost" @click="removePrime(ep.primeId)"><Trash2 :size="13" aria-hidden="true" /> Retirer</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </FormCard>

    <PrimeModal :open="primeOpen" :employee="employee" @close="primeOpen = false"
      @submit="assignPrime" />
    <Modal :open="confirmRevoke" title="Retirer l’autorisation des primes ?" size="sm" @close="confirmRevoke = false">
      <p>Les {{ employee.primes.length }} prime(s) actives de {{ employee.firstName }} {{ employee.lastName }} seront révoquées. L’opération est tracée dans l’historique.</p>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="confirmRevoke = false">Annuler</button>
        <button type="button" class="btn btn-danger" @click="revoke"><Ban :size="14" aria-hidden="true" /> Retirer et révoquer</button>
      </template>
    </Modal>
  </div>
</template>
