<script setup>
import {isCompanyModuleEnabled} from '../../maquette/companyModules';
import { computed, ref, watch } from 'vue';
import { AlertTriangle, CheckCircle2, CloudOff, Download, Eye, FileText, ListChecks, LoaderCircle, Paperclip, Plus, Trash2, Upload } from '@lucide/vue';
import { useStore } from '../../store';
import { documentTypesApi, fromDocumentTypeDto } from '../../api/documentTypes';
import { employeeDocumentsApi, fromEmployeeDocumentDto, maxSizeMbOf, saveEmployeeDocument, sizeError } from '../../api/employeeDocuments';
import { formatDate } from '../../utils/dates';
import Alert from '../../components/ui/Alert.vue';
import Badge from '../../components/ui/Badge.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import FormCard from '../../components/FormCard.vue';
import DocumentViewer from './DocumentViewer.vue';

/**
 * Onglet « Documents » de la fiche employé (RH-9 / RH-17) : pièces obligatoires, ajout, consultation, téléchargement
 * (dialogue DocumentViewer) et suppression des documents (backend /api/employees/{id}/documents). Le fichier part en multipart, stocké en BYTEA.
 */
const props = defineProps({ employee: { type: Object, required: true } });
const emit = defineEmits(['count']);

const store = useStore();
const docs = ref([]);
const allTypes = ref([]);
const loading = ref(true);
const error = ref('');

const extOf = (name) => name.split('.').pop()?.toLowerCase() ?? '';
const formatOk = (type, name) => !type || type.formats.includes(extOf(name) === 'jpeg' ? 'jpg' : extOf(name));
/** Taille lisible : « 850 Ko », « 2,4 Mo ». */
const formatSize = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`);

// La dernière requête lancée l'emporte (changement d'employé pendant un chargement).
let requestId = 0;
async function load() {
  const id = ++requestId;
  loading.value = true;
  try {
    const [list, types] = await Promise.all([employeeDocumentsApi.list(props.employee.id), documentTypesApi.list()]);
    if (id !== requestId) return;
    docs.value = list.map(fromEmployeeDocumentDto);
    allTypes.value = types.map((dto) => fromDocumentTypeDto(dto));
    error.value = '';
    emit('count', docs.value.length);
  } catch (e) {
    if (id === requestId) error.value = e.message;
  } finally {
    if (id === requestId) loading.value = false;
  }
}
watch(() => props.employee.id, () => { docs.value = []; load(); }, { immediate: true });

const types = computed(() => allTypes.value.filter((t) => !t.archived));
const typeOf = (id) => allTypes.value.find((t) => t.id === id);
const required = computed(() => types.value.filter((t) => t.required));
const provided = computed(() => required.value.filter((t) => docs.value.some((d) => d.typeId === t.id)));

// ---------- Ajout ----------
const draft = ref({ typeId: '', file: null });
const fileKey = ref(0);
const submitted = ref(false);
const saving = ref(false);
const draftType = computed(() => typeOf(draft.value.typeId));
const errors = computed(() => {
  const e = {};
  const { typeId, file } = draft.value;
  if (!typeId) e.typeId = 'Type requis.';
  if (!file) e.file = 'Fichier requis.';
  else if (!formatOk(draftType.value, file.name)) e.file = `Formats acceptés : ${draftType.value.formats.join(', ')}.`;
  else if (sizeError(file, draftType.value)) e.file = `${sizeError(file, draftType.value)} (fichier de ${formatSize(file.size)})`;
  return e;
});
const err = (k) => (submitted.value ? errors.value[k] : undefined);
// Limite annoncée avant le dépôt : taille maximale et formats du type choisi.
const fileHint = computed(() => (draftType.value
  ? `Taille maximale : ${maxSizeMbOf(draftType.value)} Mo · formats : ${draftType.value.formats.join(', ')}`
  : 'La taille maximale dépend du type de document choisi.'));
const accept = computed(() => draftType.value?.formats.flatMap((f) => (f === 'jpg' ? ['.jpg', '.jpeg'] : [`.${f}`])).join(','));

const onFile = (e) => { draft.value.file = e.target.files?.[0] ?? null; };

async function add() {
  submitted.value = true;
  if (Object.keys(errors.value).length || saving.value) return;
  saving.value = true;
  try {
    await employeeDocumentsApi.create(props.employee.id, { documentTypeId: draft.value.typeId, file: draft.value.file });
    store.toast('Document ajouté');
    draft.value = { typeId: '', file: null };
    fileKey.value += 1;
    submitted.value = false;
    await load();
  } catch (e) {
    store.toast(`Ajout impossible : ${e.message}`, 'danger');
  } finally {
    saving.value = false;
  }
}

// ---------- Visualisation (dialogue DocumentViewer) / téléchargement (contenu lu en binaire) ----------
const busyId = ref('');
const viewing = ref();
async function save(d) {
  busyId.value = d.id;
  try {
    await saveEmployeeDocument(props.employee.id, d);
  } catch (e) {
    store.toast(`Téléchargement impossible : ${e.message}`, 'danger');
  } finally {
    busyId.value = '';
  }
}

// ---------- Suppression ----------
const removing = ref();
async function confirmRemove() {
  const d = removing.value;
  if (!d || busyId.value) return;
  busyId.value = d.id;
  try {
    await employeeDocumentsApi.remove(props.employee.id, d.id);
    store.toast('Document supprimé', 'info');
    removing.value = undefined;
    await load();
  } catch (e) {
    store.toast(`Suppression impossible : ${e.message}`, 'danger');
  } finally {
    busyId.value = '';
  }
}
</script>

<template>
  <FormCard v-if="isCompanyModuleEnabled(store.companyId,'attestations')&&(store.can('attestations.traiter')||store.currentUser.id===employee.id&&store.can('attestations.demander'))" title="Attestations de travail" subtitle="Demandes et documents générés, distincts des pièces déposées dans le dossier."><a v-if="store.can('attestations.traiter')" :href="`/documents-rh?employe=${employee.id}`" class="btn btn-ghost btn-sm">Voir les attestations</a><a v-if="store.can('attestations.traiter')&&store.can('attestations.generer')" :href="`/documents-rh?employe=${employee.id}&nouvelle=1`" class="btn btn-primary btn-sm">Préparer une attestation</a><a v-if="!store.can('attestations.traiter')&&store.currentUser.id===employee.id&&store.can('attestations.demander')" href="/mes-documents" class="btn btn-primary btn-sm">Demander mon attestation</a></FormCard>
  <div class="fstack">
    <Alert v-if="error && docs.length" tone="danger" title="Actualisation impossible">
      {{ error }} <button type="button" class="btn btn-sm btn-ghost" @click="load">Réessayer</button>
    </Alert>

    <FormCard title="Pièces obligatoires"
      :subtitle="required.length ? `${provided.length} sur ${required.length} fournie${provided.length > 1 ? 's' : ''}` : 'Aucune pièce obligatoire paramétrée (Paramètres › Types de documents).'">
      <template #icon><ListChecks :size="16" /></template>
      <template v-if="required.length" #actions>
        <Badge :tone="provided.length === required.length ? 'success' : 'warning'">{{ provided.length === required.length ? 'Dossier complet' : 'Dossier incomplet' }}</Badge>
      </template>
      <ul v-if="required.length" class="doc-check">
        <li v-for="t in required" :key="t.id" :class="provided.includes(t) ? 'ok' : 'missing'">
          <CheckCircle2 v-if="provided.includes(t)" :size="15" aria-hidden="true" />
          <AlertTriangle v-else :size="15" aria-hidden="true" />
          <span class="doc-check-name">{{ t.name }}</span>
          <span v-if="provided.includes(t)" class="small text-muted">Fournie</span>
          <button v-else-if="store.can('documents.creer')" type="button" class="btn btn-sm btn-ghost" @click="draft.typeId = t.id"><Plus :size="12" aria-hidden="true" /> Ajouter</button>
        </li>
      </ul>
    </FormCard>

    <FormCard title="Documents du dossier" :subtitle="`${docs.length} document${docs.length > 1 ? 's' : ''} joint${docs.length > 1 ? 's' : ''}`">
      <template #icon><FileText :size="16" /></template>
      <div v-if="store.can('documents.creer')" class="doc-add">
        <Field label="Type de document" required :error="err('typeId')" v-slot="{ id }">
          <select :id="id" v-model="draft.typeId">
            <option value="">Sélectionner…</option>
            <option v-for="t in types" :key="t.id" :value="t.id">{{ t.name }}{{ t.required ? ' *' : '' }}</option>
          </select>
        </Field>
        <Field label="Fichier" required :error="err('file')" :hint="fileHint" v-slot="{ id }">
          <label :class="['ffile', { 'has-file': draft.file }]" :for="id">
            <Upload :size="13" aria-hidden="true" />
            <span class="ffile-name">{{ draft.file?.name || (draftType ? `Insérer un document (${maxSizeMbOf(draftType)} Mo max)…` : 'Choisissez d’abord le type de document') }}</span>
            <input :key="fileKey" :id="id" type="file" :accept="accept" @change="onFile" />
          </label>
        </Field>
        <button type="button" class="btn btn-primary doc-add-btn" :disabled="saving" @click="add">
          <LoaderCircle v-if="saving" :size="14" class="spin" aria-hidden="true" /><Plus v-else :size="14" aria-hidden="true" /> Ajouter
        </button>
      </div>

      <EmptyState v-if="loading && !docs.length" title="Chargement des documents…" class="mt-12">
        <template #icon><LoaderCircle :size="24" class="spin" aria-hidden="true" /></template>
      </EmptyState>
      <EmptyState v-else-if="error && !docs.length" title="Documents indisponibles" :text="error" class="mt-12">
        <template #icon><CloudOff :size="24" aria-hidden="true" /></template>
        <template #action><button type="button" class="btn btn-primary" @click="load">Réessayer</button></template>
      </EmptyState>
      <p v-else-if="!docs.length" class="fempty mt-12">Aucun document joint au dossier.</p>
      <div v-else :class="['table-wrap', 'mt-12', { 'is-loading': loading }]">
        <table class="table">
          <thead><tr><th scope="col">Type</th><th scope="col">Fichier</th><th scope="col">Ajouté le</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="d in docs" :key="d.id">
              <td><span class="person-name">{{ d.typeName ?? '—' }}</span><span v-if="typeOf(d.typeId)?.required" class="block small text-muted">Obligatoire</span></td>
              <td><span class="rp-file"><Paperclip :size="12" aria-hidden="true" /> {{ d.fileName }}</span><span v-if="d.size" class="block small text-muted">{{ formatSize(d.size) }}</span></td>
              <td class="nowrap">{{ d.addedAt ? formatDate(d.addedAt.slice(0, 10)) : '—' }}</td>
              <td class="actions">
                <button type="button" class="icon-btn icon-btn-sm" title="Visualiser" :aria-label="`Visualiser ${d.fileName}`" @click="viewing = d"><Eye :size="14" /></button>
                <button type="button" class="icon-btn icon-btn-sm" title="Télécharger" :aria-label="`Télécharger ${d.fileName}`" :disabled="busyId === d.id" @click="save(d)"><Download :size="14" /></button>
                <button v-if="store.can('documents.supprimer')" type="button" class="icon-btn icon-btn-sm icon-btn-danger" title="Supprimer" :aria-label="`Supprimer ${d.fileName}`" :disabled="busyId === d.id" @click="removing = d"><Trash2 :size="14" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </FormCard>

    <DocumentViewer :employee-id="employee.id" :document="viewing" @close="viewing = undefined" @download="save" />

    <Modal :open="!!removing" title="Supprimer ce document ?" size="sm" @close="removing = undefined">
      <p v-if="removing">Le fichier <strong>{{ removing.fileName }}</strong> sera retiré du dossier.</p>
      <template #footer>
        <span class="spacer" />
        <button type="button" class="btn btn-ghost" @click="removing = undefined">Annuler</button>
        <button type="button" class="btn btn-danger" :disabled="!!busyId" @click="confirmRemove"><Trash2 :size="14" aria-hidden="true" /> Supprimer</button>
      </template>
    </Modal>
  </div>
</template>
