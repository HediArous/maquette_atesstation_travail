<script setup>
import { computed, ref, watch } from 'vue';
import { Wallet, WalletCards } from '@lucide/vue';
import { useStore } from '../../store';
import { newId } from '../../store/ids';
import Alert from '../../components/ui/Alert.vue';
import ColorField from '../../components/ui/ColorField.vue';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';

/** Création ou modification d'un type de congé. `state` : { type?, deducts } ; fermée tant qu'il est absent. */
const props = defineProps({
  state: { type: Object, default: undefined },
});
const emit = defineEmits(['close']);

const store = useStore();
const f = ref();
const submitted = ref(false);

const type = computed(() => props.state?.type);
const rule = computed(() => (type.value ? store.db.leaveRules.find((r) => r.leaveTypeId === type.value.id && !r.archived) : undefined));
const isRef = computed(() => !!type.value?.annualReference);

watch(() => props.state, (state) => {
  if (!state) return;
  submitted.value = false;
  const t = state.type;
  f.value = {
    name: t?.name ?? '', code: t?.code ?? '', color: t?.color ?? '#b45309',
    deductsFromAnnual: t?.deductsFromAnnual ?? state.deducts,
    paid: t?.paid ?? true, requiresProof: t?.requiresProof ?? false, allowHalfDay: t?.allowHalfDay ?? true, hours: t?.unit === 'heure',
    ownCap: !!t?.tracked, capDays: rule.value?.annualQuota != null ? String(rule.value.annualQuota) : '',
  };
}, { immediate: true });

const errors = computed(() => {
  const e = {};
  if (!f.value) return e;
  if (!f.value.name.trim()) e.name = 'Libellé requis.';
  if (!f.value.code.trim()) e.code = 'Code requis.';
  if (!f.value.deductsFromAnnual && f.value.ownCap && !(Number(f.value.capDays) > 0)) e.cap = 'Indiquez un nombre de jours.';
  return e;
});

function save() {
  submitted.value = true;
  if (Object.keys(errors.value).length) return;
  const v = f.value;
  const ownCap = !v.deductsFromAnnual && v.ownCap;
  const saved = {
    ...(type.value ?? { id: newId('lt'), companyId: store.companyId }),
    name: v.name.trim(), code: v.code.trim().toUpperCase(), color: v.color,
    paid: v.paid, requiresProof: v.requiresProof, allowHalfDay: v.hours ? false : v.allowHalfDay, unit: v.hours ? 'heure' : 'jour',
    deductsFromAnnual: isRef.value ? true : v.deductsFromAnnual, tracked: ownCap,
  };
  if (type.value) store.updateItem('leaveTypes', saved); else store.addItem('leaveTypes', saved);
  // Plafond propre : crée ou met à jour la règle correspondante.
  if (ownCap) {
    if (rule.value) store.updateItem('leaveRules', { ...rule.value, annualQuota: Number(v.capDays) });
    else store.addItem('leaveRules', { id: newId('r'), companyId: store.companyId, leaveTypeId: saved.id, label: `${saved.name} — plafond`, annualQuota: Number(v.capDays), accrual: 'Annuel', maxCarryOver: 0, minNoticeDays: 0, scope: 'Tous les employés' });
  }
  store.toast(`${saved.name} : ${saved.deductsFromAnnual ? 'déduit du solde annuel' : 'hors solde annuel'}`);
  emit('close');
}
</script>

<template>
  <Modal v-if="state && f" open :title="type ? `Modifier « ${type.name} »` : 'Nouveau type de congé'" @close="emit('close')">
    <div class="form-grid">
      <Field v-slot="{ id }" label="Libellé" required class="span-2" :error="submitted ? errors.name : ''"><input :id="id" v-model="f.name" placeholder="Ex. : Congé maladie" /></Field>
      <Field v-slot="{ id }" label="Code" required :error="submitted ? errors.code : ''"><input :id="id" v-model="f.code" placeholder="MAL" /></Field>
      <Field v-slot="{ id }" label="Couleur"><ColorField :id="id" v-model="f.color" /></Field>
    </div>

    <fieldset class="form-section mt-16">
      <legend>Impact sur le solde</legend>
      <div class="deduct-choice" role="radiogroup" aria-label="Impact sur le solde annuel">
        <label :class="['deduct-option', { checked: f.deductsFromAnnual }]">
          <input type="radio" name="deduct" :checked="f.deductsFromAnnual" @change="f.deductsFromAnnual = true" />
          <Wallet :size="18" aria-hidden="true" />
          <span><span class="person-name">Déduit du solde annuel</span><span class="block small text-muted">Ex. : solde de 21 j, congé de 5 j → il reste 16 j.</span></span>
        </label>
        <label :class="['deduct-option', { checked: !f.deductsFromAnnual, disabled: isRef }]">
          <input type="radio" name="deduct" :checked="!f.deductsFromAnnual" :disabled="isRef" @change="f.deductsFromAnnual = false" />
          <WalletCards :size="18" aria-hidden="true" />
          <span><span class="person-name">Hors solde annuel</span><span class="block small text-muted">Ex. : solde de 21 j, congé de 5 j → le solde reste 21 j.</span></span>
        </label>
      </div>
      <p v-if="isRef" class="small text-muted mt-8">Ce type porte le solde annuel : il est forcément imputé.</p>
      <div v-if="!f.deductsFromAnnual" class="cap-row">
        <label class="check"><input v-model="f.ownCap" type="checkbox" /> Limiter avec un plafond propre</label>
        <Field v-if="f.ownCap" v-slot="{ id }" label="Jours par an" :error="submitted ? errors.cap : ''">
          <input :id="id" v-model="f.capDays" type="number" min="0.5" step="0.5" />
        </Field>
      </div>
      <Alert v-if="type && type.deductsFromAnnual !== f.deductsFromAnnual" tone="warning" title="Changement d’imputation">Les soldes seront recalculés, y compris pour les demandes déjà posées avec ce type.</Alert>
    </fieldset>

    <fieldset class="form-section">
      <legend>Options</legend>
      <div class="check-col">
        <label class="check"><input v-model="f.paid" type="checkbox" /> Congé rémunéré</label>
        <label class="check"><input v-model="f.requiresProof" type="checkbox" /> Justificatif conseillé (jamais bloquant)</label>
        <label class="check"><input v-model="f.hours" type="checkbox" /> Autorisation en heures (décomptée selon les créneaux de l’horaire)</label>
        <label v-if="!f.hours" class="check"><input v-model="f.allowHalfDay" type="checkbox" /> Autoriser les demi-journées</label>
      </div>
    </fieldset>

    <template #footer>
      <button type="button" class="btn btn-ghost" @click="emit('close')">Annuler</button>
      <button type="button" class="btn btn-primary" @click="save">{{ type ? 'Enregistrer' : 'Ajouter' }}</button>
    </template>
  </Modal>
</template>
