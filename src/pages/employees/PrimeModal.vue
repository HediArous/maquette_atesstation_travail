<script setup>
import { computed, ref, watch } from 'vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import EmptyState from '../../components/ui/EmptyState.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import { TODAY } from '../../utils/dates';
import { formatAmount } from '../../utils/org';
import { PRIME_TYPE } from './constants';

/** Attribution d'une prime du catalogue à un employé. Émet `submit` avec (primeId, date d'effet). */
const props = defineProps({
  open: Boolean,
  employee: { type: Object, required: true },
});
const emit = defineEmits(['close', 'submit']);

const store = useStore();
const data = useCompanyData();
const f = ref({ primeId: '', since: TODAY });
const available = computed(() => data.primes.filter((p) => !p.archived && !props.employee.primes.some((x) => x.primeId === p.id)));

watch(() => props.open, (open) => { if (open) f.value = { primeId: available.value[0]?.id ?? '', since: TODAY }; });

function save() {
  emit('submit', f.value.primeId, f.value.since);
  emit('close');
}
</script>

<template>
  <Modal :open="open" title="Attribuer une prime" @close="emit('close')">
    <EmptyState v-if="available.length === 0" title="Aucune prime disponible" text="Toutes les primes actives du catalogue sont déjà attribuées, ou le catalogue est vide." />
    <div v-else class="form-grid">
      <Field v-slot="{ id }" label="Prime du catalogue" required>
        <select :id="id" v-model="f.primeId">
          <option v-for="p in available" :key="p.id" :value="p.id">{{ p.name }} — {{ formatAmount(p.amount, store.activeDevise) }} ({{ PRIME_TYPE[p.type]?.toLowerCase() }})</option>
        </select>
      </Field>
      <Field v-slot="{ id }" label="Date d’effet" required><input :id="id" v-model="f.since" type="date" /></Field>
    </div>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="!f.primeId || !f.since" @click="save">Attribuer</button>
    </template>
  </Modal>
</template>
