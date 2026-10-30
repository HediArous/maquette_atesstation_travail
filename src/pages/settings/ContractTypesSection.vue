<script setup>
import { computed, ref, watch } from 'vue';
import { Pencil, Trash2 } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import Alert from '../../components/ui/Alert.vue';
import Badge from '../../components/ui/Badge.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import Switch from '../../components/ui/Switch.vue';
import ArchivableTable from '../../components/ArchivableTable.vue';
import ContractAlertCard from './ContractAlertCard.vue';
import { previewContractTypeCode } from './codeSeries';

/**
 * Types de contrat (backend /api/type-contracts). Code attribué à la création par le numéro de souche, déduit du nom ; un type désactivé n'est plus proposé pour un nouveau
 * contrat mais les contrats existants le conservent ; un type déjà utilisé ne peut pas être supprimé.
 * Le nombre de contrats vient du backend (0 tant que les contrats ne sont pas gérés).
 */
const store = useStore();
const data = useCompanyData();
const editing = ref();
const busy = ref(false);

const columns = [
  { key: 'code', header: 'Code' },
  { key: 'name', header: 'Nom' },
  { key: 'fixedTerm', header: 'Durée' },
  { key: 'renewable', header: 'Renouvelable' },
  { key: 'trial', header: 'Période d’essai' },
  { key: 'contracts', header: 'Contrats', className: 'num' },
];

// ---------- Formulaire ----------
const type = computed(() => editing.value?.type);
const used = computed(() => type.value?.contractCount ?? 0);
const f = ref({ name: '', fixedTerm: true, renewable: true, trial: false, trialMonths: '' });
const submitted = ref(false);
const saveError = ref('');

watch(editing, (state) => {
  if (!state) return;
  submitted.value = false;
  saveError.value = '';
  const t = state.type;
  f.value = {
    name: t?.name ?? '',
    fixedTerm: t?.fixedTerm ?? true,
    renewable: t?.renewable ?? true,
    trial: !!t?.trialMonths,
    trialMonths: t?.trialMonths ? String(t.trialMonths) : '',
  };
});

// Code existant, ou aperçu de celui qu'attribuera le backend (premières lettres du nom, sans préfixe).
const code = computed(() => type.value?.code ?? previewContractTypeCode(store, f.value.name));
const errors = computed(() => {
  const e = {};
  if (!f.value.name.trim()) e.name = 'Nom requis.';
  else if (!/\p{L}/u.test(f.value.name)) e.name = 'Le nom doit contenir au moins une lettre.';
  const months = Number(f.value.trialMonths);
  if (f.value.trial && !(Number.isInteger(months) && months >= 1 && months <= 120)) e.trialMonths = 'Entre 1 et 120 mois.';
  return e;
});
const err = (k) => (submitted.value ? errors.value[k] : undefined);

function toggleTrial(on) {
  f.value.trial = on;
  if (on && !f.value.trialMonths) f.value.trialMonths = '1';
}

async function save() {
  submitted.value = true;
  if (Object.keys(errors.value).length || busy.value) return;
  busy.value = true;
  saveError.value = '';
  try {
    const saved = await store.saveContractType({
      id: type.value?.id,
      name: f.value.name,
      fixedTerm: f.value.fixedTerm,
      renewable: f.value.renewable,
      trialMonths: f.value.trial ? Number(f.value.trialMonths) : 0,
    });
    store.toast(`Type de contrat « ${saved.name} » ${type.value ? 'mis à jour' : `ajouté — code ${saved.code}`}`);
    editing.value = undefined;
  } catch (e) {
    saveError.value = e.message;
  } finally {
    busy.value = false;
  }
}

// ---------- Suppression (avec confirmation) ----------
const deleting = ref();
const deleteError = ref('');

function askDelete(t) {
  deleting.value = t;
  deleteError.value = '';
}

async function confirmDelete() {
  const t = deleting.value;
  if (!t || busy.value) return;
  busy.value = true;
  try {
    await store.deleteContractType(t.id);
    store.toast(`Type de contrat « ${t.name} » supprimé`, 'info');
    deleting.value = undefined;
  } catch (e) {
    // 409 : des contrats utilisent ce type ; on propose la désactivation.
    deleteError.value = e.status === 409
      ? 'Des contrats utilisent déjà ce type. Désactivez-le plutôt : il ne sera plus proposé et les contrats existants le conserveront.'
      : `La suppression n’a pas abouti : ${e.message}`;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <!-- Paramètre commun à tous les contrats : délai de notification avant la fin du contrat en cours. -->
  <ContractAlertCard />
  <Alert v-if="store.contractTypesStatus === 'error'" tone="danger" title="Types de contrat non chargés">
    {{ store.contractTypesError }} <button type="button" class="link-btn" @click="store.loadContractTypes()">Réessayer</button>
  </Alert>
  <ArchivableTable title="Types de contrat" add-label="Ajouter un type" collection="contractTypes" :rows="data.contractTypes" :columns="columns" :name-of="(t) => t.name"
    :empty-text="store.contractTypesStatus === 'loading' ? 'Chargement des types de contrat…' : ''"
    description="Types proposés dans le parcours contractuel des employés. Un type à durée déterminée exige une date de fin ; la période d’essai indiquée est proposée par défaut. Un type archivé n’est plus proposé, les contrats existants le conservent."
    @add="editing = {}">
    <template #cell-code="{ row: t }"><span class="mono"><strong>{{ t.code }}</strong></span></template>
    <template #cell-name="{ row: t }"><span class="person-name">{{ t.name }}</span></template>
    <template #cell-fixedTerm="{ row: t }"><Badge v-if="t.fixedTerm" tone="info">Déterminée</Badge><Badge v-else tone="success">Indéterminée</Badge></template>
    <template #cell-renewable="{ row: t }"><Badge v-if="t.renewable" tone="neutral">Oui</Badge><span v-else class="text-muted">Non</span></template>
    <template #cell-trial="{ row: t }"><template v-if="t.trialMonths">{{ t.trialMonths }} mois</template><span v-else class="text-muted">Aucune</span></template>
    <template #cell-contracts="{ row: t }"><span class="num">{{ t.contractCount }}</span></template>
    <template #row-actions="{ row: t }">
      <button type="button" class="btn btn-sm btn-ghost" :disabled="t.archived" :aria-label="`Modifier ${t.name}`" @click="editing = { type: t }"><Pencil :size="13" aria-hidden="true" /> Modifier</button>
      <button type="button" class="btn btn-sm btn-ghost" :disabled="busy" :aria-label="`Supprimer ${t.name}`" @click="askDelete(t)"><Trash2 :size="14" aria-hidden="true" /> Supprimer</button>
    </template>
  </ArchivableTable>

  <Modal :open="!!editing" :title="type ? `Modifier « ${type.name} »` : 'Nouveau type de contrat'" @close="editing = undefined">
    <Alert v-if="saveError" tone="danger" title="Enregistrement impossible" class="mb-12">{{ saveError }}</Alert>
    <div class="form-grid">
      <Field v-slot="{ id }" label="Nom" required :error="err('name')"><input :id="id" v-model="f.name" placeholder="Ex. : Contrat à durée déterminée" autocomplete="off" /></Field>
      <Field v-slot="{ id }" label="Code" :hint="type ? 'Attribué à la création, non modifiable.' : 'Un mot : 3 premières lettres ; plusieurs mots : initiale de chacun.'">
        <input :id="id" class="mono" :value="code" readonly placeholder="Généré automatiquement" />
      </Field>
    </div>
    <div class="stack mt-12">
      <Switch v-model="f.fixedTerm" label="Contrat à durée déterminée (date de fin obligatoire)" />
      <Switch v-model="f.renewable" label="Renouvelable" />
      <Switch :model-value="f.trial" label="Ce contrat comporte une période d’essai" @update:model-value="toggleTrial" />
      <div v-if="f.trial">
        <Field v-slot="{ id }" label="Durée de la période d’essai" required :error="err('trialMonths')" hint="Proposée par défaut à chaque nouveau contrat de ce type.">
          <span class="input-suffix"><input :id="id" v-model="f.trialMonths" type="number" min="1" max="120" step="1" /><span aria-hidden="true">mois</span></span>
        </Field>
      </div>
    </div>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="editing = undefined">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="busy" @click="save">{{ type ? 'Enregistrer' : 'Ajouter' }}</button>
    </template>
  </Modal>

  <Modal :open="!!deleting" size="sm" title="Supprimer ce type de contrat ?" @close="deleting = undefined">
    <template v-if="deleting">
      <p>Le type « <strong>{{ deleting.name }}</strong> » sera supprimé définitivement.</p>
      <p class="small text-muted mt-8">Un type déjà utilisé par des contrats ne peut pas être supprimé : désactivez-le plutôt.</p>
      <Alert v-if="deleteError" tone="danger" title="Suppression impossible" class="mt-12">{{ deleteError }}</Alert>
    </template>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="deleting = undefined">{{ deleteError ? 'Fermer' : 'Annuler' }}</button>
      <button v-if="!deleteError" type="button" class="btn btn-danger" :disabled="busy" @click="confirmDelete"><Trash2 :size="14" aria-hidden="true" /> Supprimer</button>
    </template>
  </Modal>
</template>
