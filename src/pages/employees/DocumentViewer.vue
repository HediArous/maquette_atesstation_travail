<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { CloudOff, Download, FileQuestion, FileX2, LoaderCircle } from '@lucide/vue';
import { employeeDocumentsApi } from '../../api/employeeDocuments';
import Dialog from '../../components/ui/Dialog.vue';
import EmptyState from '../../components/ui/EmptyState.vue';

/**
 * Visualisation d'un document du dossier employé sans quitter la fiche : PDF dans la visionneuse intégrée du navigateur,
 * image affichée telle quelle, autres formats proposés au téléchargement. Le contenu (BYTEA) est lu en binaire (Blob)
 * et exposé par une URL d'objet, révoquée à la fermeture ou au changement de document.
 */
const props = defineProps({
  employeeId: { type: String, required: true },
  /** Document affiché (fermé si vide) : { id, fileName, typeName, mimeType }. */
  document: { type: Object, default: undefined },
});
const emit = defineEmits(['close', 'download']);

const url = ref('');
const loading = ref(false);
const error = ref('');
const missing = ref(false);

const kind = computed(() => {
  const mime = props.document?.mimeType ?? '';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  return 'other';
});

function revoke() {
  if (url.value) URL.revokeObjectURL(url.value);
  url.value = '';
}

// La dernière lecture lancée l'emporte (document changé pendant un chargement).
let requestId = 0;
async function load() {
  const id = ++requestId;
  revoke();
  error.value = '';
  missing.value = false;
  const d = props.document;
  if (!d || kind.value === 'other') { loading.value = false; return; }
  loading.value = true;
  try {
    const blob = await employeeDocumentsApi.download(props.employeeId, d.id);
    if (id !== requestId) return;
    // Type imposé par les métadonnées : la visionneuse PDF et la balise <img> en dépendent.
    url.value = URL.createObjectURL(blob.type === d.mimeType ? blob : new Blob([blob], { type: d.mimeType }));
  } catch (e) {
    if (id !== requestId) return;
    missing.value = e.status === 404;
    error.value = e.message;
  } finally {
    if (id === requestId) loading.value = false;
  }
}
watch(() => props.document?.id, load, { immediate: true });

function close() {
  requestId++;
  revoke();
  emit('close');
}
onBeforeUnmount(() => { requestId++; revoke(); });

const imageError = ref(false);
watch(url, () => { imageError.value = false; });
</script>

<template>
  <Dialog :open="!!document" :title="document?.fileName ?? ''" width="xl" @close="close">
    <template #subtitle>{{ document?.typeName ?? 'Type inconnu' }}</template>

    <div class="doc-viewer">
      <EmptyState v-if="loading" title="Chargement du document…">
        <template #icon><LoaderCircle :size="24" class="spin" aria-hidden="true" /></template>
      </EmptyState>
      <EmptyState v-else-if="missing" title="Document introuvable" text="Ce document n’existe plus dans le dossier de l’employé.">
        <template #icon><FileX2 :size="24" aria-hidden="true" /></template>
      </EmptyState>
      <EmptyState v-else-if="error" title="Chargement impossible" :text="error">
        <template #icon><CloudOff :size="24" aria-hidden="true" /></template>
        <template #action><button type="button" class="btn btn-primary" @click="load">Réessayer</button></template>
      </EmptyState>
      <EmptyState v-else-if="kind === 'other' || imageError" title="Aperçu non disponible"
        :text="imageError ? 'Le navigateur ne parvient pas à afficher cette image.' : 'Ce format ne peut pas être affiché dans le navigateur. Téléchargez le fichier pour l’ouvrir.'">
        <template #icon><FileQuestion :size="24" aria-hidden="true" /></template>
        <template #action><button type="button" class="btn btn-primary" @click="emit('download', document)"><Download :size="14" aria-hidden="true" /> Télécharger</button></template>
      </EmptyState>
      <iframe v-else-if="kind === 'pdf' && url" class="doc-viewer-pdf" :src="url" :title="`Aperçu de ${document.fileName}`" />
      <img v-else-if="kind === 'image' && url" class="doc-viewer-img" :src="url" :alt="document.fileName" @error="imageError = true" />
    </div>

    <template #footer>
      <span class="spacer" />
      <button type="button" class="btn btn-ghost" @click="close">Fermer</button>
      <button type="button" class="btn btn-primary" :disabled="missing" @click="emit('download', document)"><Download :size="14" aria-hidden="true" /> Télécharger</button>
    </template>
  </Dialog>
</template>
