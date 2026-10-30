<script setup>
import { useSettingsRights } from './settingsRights';
import { computed, ref, watch } from 'vue';
import { CheckCircle2, Coins, Plus, RotateCcw, Save, Trash2 } from '@lucide/vue';
import { useStore } from '../../store';
import { DEVISE_FIELDS } from '../../api/devises';
import { formatAmount } from '../../utils/org';
import Alert from '../../components/ui/Alert.vue';
import FormCard from '../../components/FormCard.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import Switch from '../../components/ui/Switch.vue';

/**
 * Devises (backend : /api/devises) : symbole, code ISO 4217, libellé et nombre de décimales des montants.
 * « Pré-remplir » liste les devises de la base : un clic charge la devise dans la carte pour la modifier ;
 * « Ajouter une devise » ouvre une fenêtre de création. Une seule devise active : elle est proposée par défaut
 * pour les salaires ; activer une devise désactive l'ancienne, chaque salaire garde sa devise enregistrée.
 */
const store = useStore();
const { canCreate, canEdit, canArchive } = useSettingsRights();

const devises = computed(() => [...store.devises].sort((a, b) => Number(b.active) - Number(a.active) || a.code.localeCompare(b.code)));

const emptyForm = () => ({ symbol: '', code: '', label: '', decimals: 2, active: !store.devises.length });
const toForm = (d) => ({ symbol: d.symbol, code: d.code, label: d.label, decimals: d.decimals, active: d.active });

/** Erreurs du formulaire ; `id` : devise modifiée (exclue du contrôle de doublon du code ISO). */
function validate(form, id) {
  const e = {};
  const { symbol, code, label, decimals } = form;
  if (!symbol?.trim() || symbol.trim().length > 5) e.symbol = 'De 1 à 5 caractères.';
  if (!/^[A-Z]{3}$/.test(code?.trim() ?? '')) e.code = 'Code ISO de 3 lettres majuscules (ex. TND).';
  else if (store.devises.some((d) => d.id !== id && d.code === code.trim())) e.code = 'Ce code ISO est déjà utilisé.';
  if (!label?.trim()) e.label = 'Libellé requis.';
  else if (label.trim().length > 50) e.label = '50 caractères au plus.';
  if (decimals === '' || decimals == null || !Number.isInteger(Number(decimals)) || Number(decimals) < 0 || Number(decimals) > 4) e.decimals = 'Entier entre 0 et 4.';
  return e;
}
const previewOf = (form) => ({ symbol: form.symbol?.trim() || '—', decimals: Number.isInteger(Number(form.decimals)) ? Number(form.decimals) : 2 });

// ---------- Carte : devise sélectionnée dans « Pré-remplir » ----------
const devise = ref();
const f = ref(emptyForm());
const submitted = ref(false);
const busy = ref(false);
const saveError = ref('');
/** Erreur renvoyée par le backend pour un champ (code ISO déjà utilisé…). */
const serverError = ref({});

function select(d) {
  devise.value = d;
  f.value = d ? toForm(d) : emptyForm();
  submitted.value = false;
  saveError.value = '';
  serverError.value = {};
}
// À l'ouverture (et après un rechargement) : devise affichée relue, sinon la devise active.
watch(() => store.devises, (list) => {
  const current = devise.value && list.find((d) => d.id === devise.value.id);
  if (current) devise.value = current;
  else select(list.find((d) => d.active) ?? list[0]);
}, { immediate: true });
watch(f, () => { serverError.value = {}; }, { deep: true });

const errors = computed(() => ({ ...validate(f.value, devise.value?.id), ...serverError.value }));
const err = (k) => (submitted.value || serverError.value[k] ? errors.value[k] : undefined);
// La devise active ne se désactive pas : on active une autre devise à sa place.
const lockActive = computed(() => !!devise.value?.active);
const preview = computed(() => previewOf(f.value));
const dirty = computed(() => {
  const d = devise.value;
  return !!d && (f.value.symbol !== d.symbol || f.value.code !== d.code || f.value.label !== d.label
    || Number(f.value.decimals) !== d.decimals || f.value.active !== d.active);
});

async function save() {
  submitted.value = true;
  if (!devise.value || Object.keys(errors.value).length || busy.value) return;
  busy.value = true;
  saveError.value = '';
  try {
    const saved = await store.saveDevise({ ...devise.value, ...f.value, decimals: Number(f.value.decimals) });
    store.toast(`Devise ${f.value.code} mise à jour`);
    select(store.devises.find((d) => d.id === saved.id) ?? saved);
  } catch (e) {
    const field = DEVISE_FIELDS[e.field];
    if (field) serverError.value = { [field]: e.message };
    else saveError.value = e.message;
  } finally {
    busy.value = false;
  }
}

// ---------- Fenêtre « Ajouter une devise » ----------
const adding = ref(false);
const nf = ref(emptyForm());
const nSubmitted = ref(false);
const nSaveError = ref('');
const nServerError = ref({});

function openAdd() {
  nf.value = emptyForm();
  nSubmitted.value = false;
  nSaveError.value = '';
  nServerError.value = {};
  adding.value = true;
}
watch(nf, () => { nServerError.value = {}; }, { deep: true });
const nErrors = computed(() => ({ ...validate(nf.value), ...nServerError.value }));
const nErr = (k) => (nSubmitted.value || nServerError.value[k] ? nErrors.value[k] : undefined);
const nPreview = computed(() => previewOf(nf.value));

async function create() {
  nSubmitted.value = true;
  if (Object.keys(nErrors.value).length || busy.value) return;
  busy.value = true;
  nSaveError.value = '';
  try {
    const saved = await store.saveDevise({ ...nf.value, decimals: Number(nf.value.decimals) });
    store.toast(`Devise ${saved.code} ajoutée`);
    adding.value = false;
    select(store.devises.find((d) => d.id === saved.id) ?? saved);
  } catch (e) {
    const field = DEVISE_FIELDS[e.field];
    if (field) nServerError.value = { [field]: e.message };
    else nSaveError.value = e.message;
  } finally {
    busy.value = false;
  }
}

// ---------- Suppression ----------
const deleting = ref();
const deleteError = ref('');
function askDelete(d) {
  deleting.value = d;
  deleteError.value = '';
}
async function confirmDelete() {
  const d = deleting.value;
  if (!d || busy.value) return;
  busy.value = true;
  try {
    await store.deleteDevise(d.id);
    store.toast(`Devise ${d.code} supprimée`, 'info');
    deleting.value = undefined;
  } catch (e) {
    deleteError.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Alert v-if="store.devisesStatus === 'error'" tone="danger" title="Devises non chargées">
    {{ store.devisesError }} <button type="button" class="link-btn" @click="store.loadDevises()">Réessayer</button>
  </Alert>
  <div class="fstack">
    <FormCard title="Devise de la société"
      subtitle="Utilisée pour l’affichage et la saisie des salaires de tous les employés de la société.">
      <template #icon><Coins :size="16" /></template>
      <Alert v-if="saveError" tone="danger" title="Enregistrement impossible" class="mb-12">{{ saveError }}</Alert>
      <div class="cur-presets">
        <span class="small text-muted">Pré-remplir :</span>
        <button v-for="d in devises" :key="d.id" type="button" :class="['cur-preset', { on: devise?.id === d.id }]"
          :title="`${d.label}${d.active ? ' — devise active' : ''}`" @click="select(d)">
          <strong>{{ d.symbol }}</strong> {{ d.code }}<CheckCircle2 v-if="d.active" :size="11" class="cur-preset-active" aria-label="active" />
        </button>
        <button v-if="canCreate" type="button" class="cur-preset cur-preset-add" @click="openAdd">
          <Plus :size="12" aria-hidden="true" /> Ajouter une devise
        </button>
      </div>

      <EmptyState v-if="!devise" title="Aucune devise" text="Ajoutez une première devise : elle deviendra la devise active." />
      <template v-else>
        <div class="cur-grid">
          <Field v-slot="{ id }" label="Symbole" required :error="err('symbol')" hint="Affiché après les montants.">
            <input :id="id" v-model="f.symbol" maxlength="5" placeholder="DT" />
          </Field>
          <Field v-slot="{ id }" label="Code ISO" required :error="err('code')" hint="Norme ISO 4217.">
            <input :id="id" class="mono" :value="f.code" maxlength="3" placeholder="TND" @input="f.code = $event.target.value.toUpperCase()" />
          </Field>
          <Field v-slot="{ id }" label="Libellé" required :error="err('label')" hint="En toutes lettres.">
            <input :id="id" v-model="f.label" maxlength="50" placeholder="Dinars" />
          </Field>
          <Field v-slot="{ id }" label="Chiffres après la virgule" required :error="err('decimals')" hint="TND : 3, EUR : 2.">
            <input :id="id" v-model.number="f.decimals" type="number" min="0" max="4" step="1" />
          </Field>
          <div class="cur-state">
            <Switch v-model="f.active" :disabled="lockActive" label="Devise active" />
            <span class="small text-muted">
              {{ lockActive ? 'Pour en changer, activez une autre devise.' : f.active ? 'L’ancienne devise active sera désactivée.' : 'Une seule devise active à la fois.' }}
            </span>
            <span v-if="err('active')" class="field-error">{{ err('active') }}</span>
          </div>
        </div>

        <div class="cur-preview" aria-live="polite">
          <span class="numbering-label">Aperçu</span>
          <div class="cur-preview-items">
            <span><small>Salaire de base</small><strong>{{ formatAmount(10740, preview) }}</strong><em>/ mois</em></span>
            <span><small>Prime</small><strong class="pos">+{{ formatAmount(250, preview) }}</strong></span>
            <span class="cur-preview-input"><small>Saisie</small><span class="input-suffix"><input readonly value="3 800" aria-label="Exemple de saisie" /><span aria-hidden="true">{{ preview.symbol }}</span></span></span>
          </div>
          <span class="small text-muted">Montants exprimés en <strong>{{ f.label?.trim() || '—' }}</strong> ({{ f.code?.trim() || '—' }}).</span>
        </div>

        <div class="save-bar">
          <button v-if="canArchive" type="button" class="btn btn-ghost cur-delete" :disabled="busy || devise.active" :title="devise.active ? 'Activez d’abord une autre devise' : undefined"
            @click="askDelete(devise)"><Trash2 :size="14" aria-hidden="true" /> Supprimer</button>
          <button v-if="canEdit" type="button" class="btn btn-ghost" :disabled="!dirty" @click="select(devise)"><RotateCcw :size="14" aria-hidden="true" /> Annuler</button>
          <button v-if="canEdit" type="button" class="btn btn-primary" :disabled="!dirty || busy" @click="save"><Save :size="14" aria-hidden="true" /> {{ busy ? 'Enregistrement…' : 'Enregistrer' }}</button>
        </div>
      </template>
    </FormCard>
  </div>

  <Modal :open="adding" title="Nouvelle devise" @close="adding = false">
    <Alert v-if="nSaveError" tone="danger" title="Enregistrement impossible" class="mb-12">{{ nSaveError }}</Alert>
    <div class="form-grid">
      <Field v-slot="{ id }" label="Symbole" required :error="nErr('symbol')" hint="Affiché après les montants.">
        <input :id="id" v-model="nf.symbol" maxlength="5" placeholder="DT" autofocus />
      </Field>
      <Field v-slot="{ id }" label="Code ISO" required :error="nErr('code')" hint="Norme ISO 4217.">
        <input :id="id" class="mono" :value="nf.code" maxlength="3" placeholder="TND" @input="nf.code = $event.target.value.toUpperCase()" />
      </Field>
      <Field v-slot="{ id }" label="Libellé" required :error="nErr('label')" hint="En toutes lettres.">
        <input :id="id" v-model="nf.label" maxlength="50" placeholder="Dinars" />
      </Field>
      <Field v-slot="{ id }" label="Chiffres après la virgule" required :error="nErr('decimals')" hint="TND : 3, EUR : 2.">
        <input :id="id" v-model.number="nf.decimals" type="number" min="0" max="4" step="1" />
      </Field>
    </div>
    <div class="mt-12">
      <Switch v-model="nf.active" :disabled="!store.devises.length" label="Devise active" />
      <p class="small text-muted mt-8">
        {{ !store.devises.length ? 'Première devise : elle sera active.' : nf.active ? 'L’ancienne devise active sera désactivée.' : 'Une seule devise active à la fois.' }}
      </p>
    </div>
    <div class="cur-preview">
      <span class="numbering-label">Aperçu</span>
      <div class="cur-preview-items">
        <span><small>Salaire de base</small><strong>{{ formatAmount(10740, nPreview) }}</strong><em>/ mois</em></span>
      </div>
    </div>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="adding = false">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="busy" @click="create"><Plus :size="14" aria-hidden="true" /> {{ busy ? 'Enregistrement…' : 'Ajouter' }}</button>
    </template>
  </Modal>

  <Modal :open="!!deleting" size="sm" title="Supprimer cette devise ?" @close="deleting = undefined">
    <template v-if="deleting">
      <p>La devise « <strong>{{ deleting.label }} ({{ deleting.code }})</strong> » sera supprimée définitivement.</p>
      <p class="small text-muted mt-8">Une devise utilisée par des salaires ne peut pas être supprimée.</p>
      <Alert v-if="deleteError" tone="danger" title="Suppression impossible" class="mt-12">{{ deleteError }}</Alert>
    </template>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="deleting = undefined">{{ deleteError ? 'Fermer' : 'Annuler' }}</button>
      <button v-if="!deleteError" type="button" class="btn btn-danger" :disabled="busy" @click="confirmDelete"><Trash2 :size="14" aria-hidden="true" /> Supprimer</button>
    </template>
  </Modal>
</template>

<style scoped>
/* Repris de la maquette (refine.css, .cur-*). */
.cur-presets { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.cur-preset { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border: 1px solid #dde3ea; border-radius: 999px; background: #fff; font: inherit; font-size: 12px; color: #475569; cursor: pointer; }
.cur-preset strong { color: #0f172a; }
.cur-preset:hover { border-color: #b8cbe6; }
.cur-preset.on { border-color: #0b5cc0; background: #f3f8ff; color: #0b4fa6; }
.cur-preset-active { color: #1f7a45; }
.cur-preset-add { border-style: dashed; color: #0b5cc0; font-weight: 600; }
.cur-grid { display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 12px 14px; }
.cur-state { grid-column: span 2; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
.cur-preview { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; padding: 12px 14px; border-radius: 10px; background: #f6f8fb; border: 1px solid #e8ecf2; }
.cur-preview-items { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 28px; }
.cur-preview-items > span { display: flex; flex-direction: column; gap: 2px; }
.cur-preview-items small { font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #8a96a8; }
.cur-preview-items strong { font-size: 17px; color: #0b4fa6; font-variant-numeric: tabular-nums; }
.cur-preview-items strong.pos { color: #1f7a45; }
.cur-preview-items em { font-style: normal; font-size: 11.5px; color: #64748b; }
.cur-preview-input .input-suffix { width: 150px; }
.cur-preview-input .input-suffix input { padding-right: 52px; }
.cur-delete { margin-right: auto; color: #b42318; }
@media (max-width: 720px) { .cur-grid { grid-template-columns: 1fr; } .cur-state { grid-column: auto; } }
</style>
