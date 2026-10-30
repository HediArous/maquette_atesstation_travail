<script setup>
import { computed, ref, watch } from 'vue';
import { Pencil, Trash2 } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Alert from '../../components/ui/Alert.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import ArchivableTable from '../../components/ArchivableTable.vue';
import { formatAmount } from '../../utils/org';
import { PRIME_TYPE } from '../employees/constants';
import { previewCode } from './codeSeries';

/**
 * Catalogue des primes de la société (RH-25, backend /api/primes). Nom unique dans la société, montant strictement positif ;
 * code attribué à la création par le numéro de souche « primes », déduit du nom, puis non modifiable.
 * Archiver = désactiver : la prime n'est plus attribuable, les attributions existantes sont conservées. Une prime déjà attribuée
 * ne peut pas être supprimée.
 */
const store = useStore();
const data = useCompanyData();
const editing = ref();
// Devise active (Paramètres › Devises) : symbole affiché et nombre de décimales autorisées pour le montant.
const devise = computed(() => store.activeDevise);
const decimals = computed(() => (Number.isInteger(devise.value?.decimals) ? devise.value.decimals : 2));

const columns = [
  { key: 'name', header: 'Prime' },
  { key: 'code', header: 'Code' },
  { key: 'type', header: 'Type' },
  { key: 'amount', header: 'Montant', className: 'num' },
  { key: 'assigned', header: 'Attribuée à', className: 'num' },
];

async function remove(p) {
  if (p.assignments > 0) { store.toast(`« ${p.name} » est attribuée à ${p.assignments} employé(s) : elle ne peut pas être supprimée, seulement archivée.`, 'danger'); return; }
  if (!window.confirm(`Supprimer définitivement la prime « ${p.name} » ?`)) return;
  try {
    await store.deletePrime(p.id);
    store.toast(`Prime « ${p.name} » supprimée`, 'info');
  } catch (e) {
    store.toast(e.message, 'danger');
  }
}

// ---------- Formulaire ----------
const prime = computed(() => editing.value?.prime);
const f = ref({ name: '', amount: '', type: 'fixe' });
const submitted = ref(false);
const saving = ref(false);
const saveError = ref('');

watch(editing, (state) => {
  if (!state) return;
  submitted.value = false;
  saveError.value = '';
  const p = state.prime;
  f.value = { name: p?.name ?? '', amount: p ? String(p.amount) : '', type: p?.type ?? 'fixe' };
});

const errors = computed(() => {
  const e = {};
  if (!f.value.name.trim()) e.name = 'Nom requis.';
  else if (!/\p{L}/u.test(f.value.name)) e.name = 'Le nom doit contenir au moins une lettre.';
  else if (data.primes.some((p) => p.id !== prime.value?.id && p.name.trim().toLowerCase() === f.value.name.trim().toLowerCase())) e.name = 'Une prime porte déjà ce nom dans la société.';
  if (!(Number(f.value.amount) > 0)) e.amount = 'Le montant doit être strictement positif.';
  else if (!new RegExp(decimals.value > 0 ? `^\\d+([.,]\\d{1,${decimals.value}})?$` : '^\\d+$').test(String(f.value.amount).trim()))
    e.amount = decimals.value > 0 ? `Au plus ${decimals.value} décimale${decimals.value > 1 ? 's' : ''}.` : 'Montant entier attendu (devise sans décimales).';
  return e;
});
// Code existant, ou aperçu de celui qu'attribuera le backend.
const code = computed(() => prime.value?.code ?? previewCode(store, 'prime', f.value.name));
const err = (k) => (submitted.value ? errors.value[k] : undefined);


async function save() {
  submitted.value = true;
  if (Object.keys(errors.value).length || saving.value) return;
  saving.value = true;
  saveError.value = '';
  try {
    const saved = await store.savePrime({ ...f.value, amount: String(f.value.amount).replace(',', '.'), id: prime.value?.id });
    store.toast(`Prime « ${saved.name} » ${prime.value ? 'mise à jour' : `ajoutée — code ${saved.code}`}`);
    editing.value = undefined;
  } catch (e) {
    saveError.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Alert v-if="store.primesStatus === 'error'" tone="danger" title="Catalogue non chargé">
    {{ store.primesError }} <button type="button" class="link-btn" @click="store.loadPrimes()">Réessayer</button>
  </Alert>
  <Alert v-if="!devise && store.devisesStatus !== 'loading'" tone="warning" title="Aucune devise active">
    Activez une devise dans Paramètres › Devises : les montants sont affichés sans symbole.
  </Alert>
  <ArchivableTable title="Catalogue des primes" add-label="Ajouter une prime" collection="primes" :rows="data.primes" :columns="columns" :name-of="(p) => p.name"
    description="Primes attribuables aux employés dont les primes sont autorisées. Une prime archivée est désactivée : elle n’est plus proposée mais reste sur les fiches où elle est attribuée."
    @add="editing = {}">
    <template #cell-name="{ row: p }"><span class="person-name">{{ p.name }}</span></template>
    <template #cell-code="{ row: p }"><span class="mono">{{ p.code }}</span></template>
    <template #cell-type="{ row: p }">{{ PRIME_TYPE[p.type] }}</template>
    <template #cell-amount="{ row: p }">{{ formatAmount(p.amount, devise) }}</template>
    <template #cell-assigned="{ row: p }">{{ p.assignments }} employé{{ p.assignments > 1 ? 's' : '' }}</template>
    <template #row-actions="{ row: p }">
      <button type="button" class="btn btn-sm btn-ghost" :disabled="p.archived" :aria-label="`Modifier ${p.name}`" @click="editing = { prime: p }"><Pencil :size="13" aria-hidden="true" /> Modifier</button>
      <button type="button" class="btn btn-sm btn-ghost" :aria-label="`Supprimer ${p.name}`" @click="remove(p)"><Trash2 :size="13" aria-hidden="true" /> Supprimer</button>
    </template>
  </ArchivableTable>

  <Modal :open="!!editing" :title="prime ? `Modifier « ${prime.name} »` : 'Nouvelle prime'" @close="editing = undefined">
    <Alert v-if="saveError" tone="danger" title="Enregistrement impossible" class="mb-12">{{ saveError }}</Alert>
    <div class="form-grid">
      <Field v-slot="{ id }" label="Nom" required :error="err('name')"><input :id="id" v-model="f.name" placeholder="Ex. : Prime de transport" autocomplete="off" /></Field>
      <Field v-slot="{ id }" label="Code" :hint="prime ? 'Attribué à la création, non modifiable.' : 'Généré à l’enregistrement (Paramètres › Numéro de souche).'">
        <input :id="id" class="mono" :value="code" readonly placeholder="Généré automatiquement" />
      </Field>
      <Field v-slot="{ id }" label="Type">
        <select :id="id" v-model="f.type"><option v-for="(label, k) in PRIME_TYPE" :key="k" :value="k">{{ label }}</option></select>
      </Field>
      <Field v-slot="{ id }" :label="`Montant${devise ? ` (${devise.symbol})` : ''}`" required :error="err('amount')">
        <span class="input-suffix"><input :id="id" v-model="f.amount" type="number" min="0" :step="decimals > 0 ? 1 / 10 ** decimals : 1" /><span aria-hidden="true">{{ devise?.symbol }}</span></span>
      </Field>
    </div>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="editing = undefined">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Enregistrement…' : prime ? 'Enregistrer' : 'Ajouter' }}</button>
    </template>
  </Modal>
</template>
