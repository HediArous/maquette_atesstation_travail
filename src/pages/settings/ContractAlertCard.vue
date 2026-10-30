<script setup>
import { useSettingsRights } from './settingsRights';
import { computed, onMounted, ref } from 'vue';
import { BellRing, Minus, Plus, Save } from '@lucide/vue';
import { useStore } from '../../store';
import { contractAlertApi } from '../../api/notifications';
import Switch from '../../components/ui/Switch.vue';

/**
 * Alerte d'expiration des contrats (backend /api/contract-alert-settings) : une notification est envoyée, en temps réel, quand
 * le contrat en cours d'un employé arrive à échéance dans le délai choisi. Un ancien contrat, ou un contrat déjà suivi d'un
 * renouvellement, ne déclenche rien.
 */
const store = useStore();
const { canEdit } = useSettingsRights();
const MAX_DAYS = 365;
const saved = ref({ enabled: true, daysBefore: 30 });
const f = ref({ enabled: true, daysBefore: '30' });
const status = ref('loading');
const loadError = ref('');
const saving = ref(false);

const days = computed(() => Number(f.value.daysBefore));
const error = computed(() => (Number.isInteger(days.value) && days.value >= 1 && days.value <= MAX_DAYS ? '' : `Entre 1 et ${MAX_DAYS} jours.`));
const dirty = computed(() => f.value.enabled !== saved.value.enabled || days.value !== saved.value.daysBefore);
const summary = computed(() => (f.value.enabled
  ? `Notification ${days.value > 1 ? `${days.value} jours` : 'la veille'} avant la fin du contrat en cours de chaque employé.`
  : 'Aucune notification d’échéance de contrat.'));

/** Boutons − / + (et flèches du clavier) : pas d'un jour, bornés à 1–365. */
function step(delta) {
  const current = Number.isInteger(days.value) ? days.value : saved.value.daysBefore;
  f.value.daysBefore = String(Math.min(MAX_DAYS, Math.max(1, current + delta)));
}

function apply(setting) {
  saved.value = { enabled: setting.enabled !== false, daysBefore: setting.daysBefore ?? 30 };
  f.value = { enabled: saved.value.enabled, daysBefore: String(saved.value.daysBefore) };
}

async function load() {
  status.value = 'loading';
  try {
    apply(await contractAlertApi.get());
    status.value = 'ready';
  } catch (e) {
    loadError.value = e.message;
    status.value = 'error';
  }
}

async function save() {
  if (error.value || saving.value || !dirty.value) return;
  saving.value = true;
  try {
    apply(await contractAlertApi.update({ enabled: f.value.enabled, daysBefore: days.value }));
    store.toast('Alerte d’expiration des contrats enregistrée');
  } catch (e) {
    store.toast(`Enregistrement impossible : ${e.message}`, 'danger');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="card ca-card" aria-labelledby="ca-title">
    <span class="ca-icon" aria-hidden="true"><BellRing :size="17" :stroke-width="1.8" /></span>
    <div class="ca-text">
      <h2 id="ca-title" class="ca-title">Alerte d’expiration des contrats</h2>
      <p v-if="status === 'error'" class="ca-sub text-danger">
        {{ loadError }} <button type="button" class="link-btn" @click="load">Réessayer</button>
      </p>
      <p v-else class="ca-sub">{{ status === 'loading' ? 'Chargement…' : summary }}</p>
    </div>
    <form class="ca-form" @submit.prevent="save">
      <Switch v-model="f.enabled" label="Activée" :disabled="status !== 'ready'" />
      <div :class="['ca-stepper', { invalid: f.enabled && error, disabled: status !== 'ready' || !f.enabled }]" :title="f.enabled && error ? error : ''">
        <button type="button" class="ca-step" aria-label="Un jour de moins" tabindex="-1"
          :disabled="status !== 'ready' || !f.enabled || days <= 1" @click="step(-1)"><Minus :size="13" :stroke-width="2.2" /></button>
        <input id="ca-days" v-model="f.daysBefore" type="text" inputmode="numeric" maxlength="3" aria-label="Délai de notification avant l’échéance, en jours"
          :disabled="status !== 'ready' || !f.enabled" :aria-invalid="!!(f.enabled && error)"
          @keydown.up.prevent="step(1)" @keydown.down.prevent="step(-1)" @input="f.daysBefore = f.daysBefore.replace(/\D/g, '')" />
        <span class="ca-unit">{{ days > 1 ? 'jours' : 'jour' }}</span>
        <button type="button" class="ca-step" aria-label="Un jour de plus" tabindex="-1"
          :disabled="status !== 'ready' || !f.enabled || days >= MAX_DAYS" @click="step(1)"><Plus :size="13" :stroke-width="2.2" /></button>
      </div>
      <button v-if="canEdit" type="submit" class="btn btn-sm btn-primary" :disabled="status !== 'ready' || !dirty || !!error || saving">
        <Save :size="13" aria-hidden="true" /> {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
/* Bandeau de paramétrage compact au-dessus du tableau des types de contrat. */
.ca-card { display: flex; align-items: center; gap: 14px; padding: 14px 16px; margin-bottom: 16px; }
.ca-icon { display: grid; place-items: center; flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px; background: var(--primary-soft, #eaf1fd); color: var(--primary, #1d4ed8); }
.ca-text { flex: 1; min-width: 0; }
.ca-title { margin: 0; font-size: 13.5px; font-weight: 650; color: var(--text, #0f172a); }
.ca-sub { margin: 2px 0 0; font-size: 12px; color: var(--muted, #64748b); }
.ca-form { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
/* Sélecteur de délai : − valeur jours +, une seule bordure, mêmes hauteurs et focus que les champs de l'application. */
.ca-stepper { display: inline-flex; align-items: center; height: 30px; border: 1px solid #dde3ea; border-radius: 8px; background: #fff; transition: border-color .15s, box-shadow .15s; }
.ca-stepper:hover:not(.disabled) { border-color: #cbd4df; }
.ca-stepper:focus-within { border-color: #7aa7e3; box-shadow: 0 0 0 3px rgba(11, 92, 192, .12); }
.ca-stepper.invalid { border-color: var(--danger, #dc2626); box-shadow: 0 0 0 3px rgba(220, 38, 38, .1); }
.ca-stepper.disabled { background: #f8fafc; }
.ca-step { display: grid; place-items: center; width: 28px; height: 100%; padding: 0; border: 0; background: transparent; color: #64748b; cursor: pointer; transition: color .12s, background .12s; }
.ca-step:first-child { border-radius: 7px 0 0 7px; border-right: 1px solid #eef1f5; }
.ca-step:last-child { border-radius: 0 7px 7px 0; border-left: 1px solid #eef1f5; }
.ca-step:hover:not(:disabled) { background: var(--primary-soft, #e8f1fc); color: var(--primary, #0b5cc0); }
.ca-step:disabled { color: #cbd4df; cursor: default; }
.ca-stepper input { width: 34px; height: 100%; padding: 0; border: 0; background: transparent; text-align: right; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; color: #1e293b; outline: none; box-shadow: none; }
.ca-stepper input:disabled { color: #a3adbb; }
.ca-unit { padding: 0 9px 0 5px; font-size: 12px; color: #64748b; user-select: none; }
.ca-stepper.disabled .ca-unit { color: #a3adbb; }
@media (max-width: 720px) {
  .ca-card { flex-wrap: wrap; }
  .ca-form { width: 100%; flex-wrap: wrap; }
}
</style>
