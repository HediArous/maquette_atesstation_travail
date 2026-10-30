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
import { previewCode } from './codeSeries';
import { DEFAULT_MAX_SIZE_MB, MAX_SIZE_MB_LIMIT } from '../../api/documentTypes';

/**
 * Types de documents du dossier employé (RH-17, backend /api/document-types). Nom et code uniques dans la société ;
 * un type désactivé n'est plus proposé à l'ajout d'un document mais ses documents restent classés ; un type déjà utilisé
 * ne peut pas être supprimé.
 */
const FORMATS = ['pdf', 'jpg', 'png', 'docx'];
// Nom et code : au moins une lettre (refuse « -- », « 123 »…).
const HAS_LETTER = /\p{L}/u;

const store = useStore();
const data = useCompanyData();
const editing = ref();
const busy = ref(false);

const columns = [
  { key: 'name', header: 'Type de document' },
  { key: 'code', header: 'Code' },
  { key: 'required', header: 'Obligatoire' },
  { key: 'formats', header: 'Formats acceptés' },
  { key: 'maxSizeMb', header: 'Taille max.', className: 'num' },
];

// ---------- Formulaire ----------
const type = computed(() => editing.value?.type);
const f = ref({ name: '', required: false, formats: ['pdf'], maxSizeMb: String(DEFAULT_MAX_SIZE_MB) });
const submitted = ref(false);
const saveError = ref('');

watch(editing, (state) => {
  if (!state) return;
  submitted.value = false;
  saveError.value = '';
  const t = state.type;
  f.value = { name: t?.name ?? '', required: t?.required ?? false, formats: [...(t?.formats ?? ['pdf'])], maxSizeMb: String(t?.maxSizeMb ?? DEFAULT_MAX_SIZE_MB) };
});

// Vérifications immédiates ; le backend reste juge de l'unicité.
const others = computed(() => data.documentTypes.filter((t) => t.id !== type.value?.id));
const errors = computed(() => {
  const e = {};
  const name = f.value.name.trim().toLowerCase();
  if (!name) e.name = 'Nom requis.';
  else if (!HAS_LETTER.test(name)) e.name = 'Le nom doit contenir au moins une lettre.';
  else if (others.value.some((t) => t.name.trim().toLowerCase() === name)) e.name = 'Ce type existe déjà dans la société.';
  if (f.value.formats.length === 0) e.formats = 'Choisissez au moins un format.';
  const size = Number(f.value.maxSizeMb);
  if (!Number.isInteger(size) || size < 1 || size > MAX_SIZE_MB_LIMIT) e.maxSizeMb = `Saisissez un nombre entier de Mo entre 1 et ${MAX_SIZE_MB_LIMIT}.`;
  return e;
});
// Code existant, ou aperçu de celui qu'attribuera le backend (Paramètres › Numéro de souche).
const code = computed(() => type.value?.code ?? previewCode(store, 'type_document', f.value.name));
const err = (k) => (submitted.value ? errors.value[k] : undefined);

function toggleFormat(fmt, on) {
  f.value.formats = on ? FORMATS.filter((y) => y === fmt || f.value.formats.includes(y)) : f.value.formats.filter((y) => y !== fmt);
}

async function save() {
  submitted.value = true;
  if (Object.keys(errors.value).length || busy.value) return;
  busy.value = true;
  saveError.value = '';
  try {
    const saved = await store.saveDocumentType({ ...f.value, maxSizeMb: Number(f.value.maxSizeMb), id: type.value?.id });
    store.toast(`Type de document « ${saved.name} » ${type.value ? 'mis à jour' : `ajouté — code ${saved.code}`}`);
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
    await store.deleteDocumentType(t.id);
    store.toast(`Type de document « ${t.name} » supprimé`, 'info');
    deleting.value = undefined;
  } catch (e) {
    // 409 : des documents sont classés sous ce type ; on propose la désactivation.
    deleteError.value = e.status === 409
      ? 'Des documents d’employés sont déjà classés sous ce type. Désactivez-le plutôt : il ne sera plus proposé et les documents existants resteront classés.'
      : `La suppression n’a pas abouti : ${e.message}`;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Alert v-if="store.documentTypesStatus === 'error'" tone="danger" title="Types de documents non chargés">
    {{ store.documentTypesError }} <button type="button" class="link-btn" @click="store.loadDocumentTypes()">Réessayer</button>
  </Alert>
  <ArchivableTable title="Types de documents" add-label="Ajouter un type" collection="documentTypes" :rows="data.documentTypes" :columns="columns" :name-of="(t) => t.name"
    description="Classement des pièces du dossier employé. Un type obligatoire est attendu dans chaque dossier ; seuls les formats indiqués sont acceptés au dépôt. Un type archivé n’est plus proposé, les documents déjà classés sont conservés."
    @add="editing = {}">
    <template #cell-name="{ row: t }"><span class="person-name">{{ t.name }}</span></template>
    <template #cell-code="{ row: t }"><span class="mono">{{ t.code }}</span></template>
    <template #cell-required="{ row: t }"><Badge v-if="t.required" tone="warning">Obligatoire</Badge><Badge v-else tone="neutral">Facultatif</Badge></template>
    <template #cell-maxSizeMb="{ row: t }"><span class="num">{{ t.maxSizeMb }} Mo</span></template>
    <template #cell-formats="{ row: t }"><span class="small mono">{{ t.formats.map((x) => x.toUpperCase()).join(' · ') }}</span></template>
    <template #row-actions="{ row: t }">
      <button type="button" class="btn btn-sm btn-ghost" :disabled="t.archived" :aria-label="`Modifier ${t.name}`" @click="editing = { type: t }"><Pencil :size="13" aria-hidden="true" /> Modifier</button>
      <button type="button" class="btn btn-sm btn-ghost" :disabled="busy" :aria-label="`Supprimer ${t.name}`" @click="askDelete(t)"><Trash2 :size="14" aria-hidden="true" /> Supprimer</button>
    </template>
  </ArchivableTable>

  <Modal :open="!!editing" :title="type ? `Modifier « ${type.name} »` : 'Nouveau type de document'" @close="editing = undefined">
    <Alert v-if="saveError" tone="danger" title="Enregistrement impossible" class="mb-12">{{ saveError }}</Alert>
    <div class="form-grid">
      <Field v-slot="{ id }" label="Nom" required :error="err('name')"><input :id="id" v-model="f.name" placeholder="Ex. : Carte d’identité nationale" autocomplete="off" /></Field>
      <Field v-slot="{ id }" label="Code" :hint="type ? 'Attribué à la création, non modifiable.' : 'Généré à l’enregistrement (Paramètres › Numéro de souche).'">
        <input :id="id" class="mono" :value="code" readonly placeholder="Généré automatiquement" />
      </Field>
    </div>
    <div class="form-grid mt-12">
      <Field v-slot="{ id }" label="Taille maximale d’un fichier" required :error="err('maxSizeMb')" :hint="`De 1 à ${MAX_SIZE_MB_LIMIT} Mo ; tout fichier plus volumineux est refusé au dépôt.`">
        <span class="input-suffix"><input :id="id" v-model="f.maxSizeMb" type="number" min="1" :max="MAX_SIZE_MB_LIMIT" step="1" inputmode="numeric" /><span aria-hidden="true">Mo</span></span>
      </Field>
    </div>
    <div class="mt-12"><Switch v-model="f.required" label="Document obligatoire dans chaque dossier employé" /></div>
    <fieldset class="form-section mt-16">
      <legend>Formats acceptés</legend>
      <div class="perm-options">
        <label v-for="fmt in FORMATS" :key="fmt" :class="['perm-option', { on: f.formats.includes(fmt) }]">
          <input type="checkbox" :checked="f.formats.includes(fmt)" @change="toggleFormat(fmt, $event.target.checked)" />
          <span class="mono">{{ fmt.toUpperCase() }}</span>
        </label>
      </div>
      <p v-if="err('formats')" class="field-error">{{ err('formats') }}</p>
    </fieldset>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="editing = undefined">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="busy" @click="save">{{ type ? 'Enregistrer' : 'Ajouter' }}</button>
    </template>
  </Modal>

  <Modal :open="!!deleting" size="sm" title="Supprimer ce type de document ?" @close="deleting = undefined">
    <template v-if="deleting">
      <p>Le type « <strong>{{ deleting.name }}</strong> » sera supprimé définitivement.</p>
      <p class="small text-muted mt-8">Un type déjà utilisé par des documents d’employés ne peut pas être supprimé : désactivez-le plutôt.</p>
      <Alert v-if="deleteError" tone="danger" title="Suppression impossible" class="mt-12">{{ deleteError }}</Alert>
    </template>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="deleting = undefined">{{ deleteError ? 'Fermer' : 'Annuler' }}</button>
      <button v-if="!deleteError" type="button" class="btn btn-danger" :disabled="busy" @click="confirmDelete"><Trash2 :size="14" aria-hidden="true" /> Supprimer</button>
    </template>
  </Modal>
</template>
