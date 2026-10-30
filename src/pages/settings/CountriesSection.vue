<script setup>
import { computed, ref, watch } from 'vue';
import { Globe, Pencil } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import { PHONE_COUNTRY_FIELDS } from '../../api/phoneCountries';
import Field from '../../components/ui/Field.vue';
import Modal from '../../components/ui/Modal.vue';
import ArchivableTable from '../../components/ArchivableTable.vue';
import { formatPhone, onlyDigits } from '../../utils/phone';

/**
 * Pays : indicatif téléphonique et nombre de chiffres du numéro national (utilisés par le champ Téléphone).
 * Paramétrage enregistré dans le backend (/api/phone-country-settings) ; « Archiver » désactive le pays.
 */
const store = useStore();
const data = useCompanyData();
const editing = ref();

const columns = [
  { key: 'name', header: 'Pays' },
  { key: 'dial', header: 'Indicatif' },
  { key: 'digits', header: 'Chiffres du numéro national', className: 'num' },
  { key: 'example', header: 'Exemple' },
  { key: 'employees', header: 'Employés', className: 'num' },
];

// ---------- Formulaire ----------
const country = computed(() => editing.value?.country);
const name = ref('');
const dial = ref('');
const digits = ref('');
const submitted = ref(false);
const saving = ref(false);
/** Erreur renvoyée par le backend pour un champ (doublon…). */
const serverError = ref({});

watch(editing, (state) => {
  if (!state) return;
  name.value = state.country?.name ?? '';
  dial.value = state.country?.dialCode ?? '';
  digits.value = state.country ? String(state.country.digits) : '';
  submitted.value = false;
  serverError.value = {};
});
watch([name, dial, digits], () => { serverError.value = {}; });

const n = computed(() => Number(digits.value));
// Un numéro international compte au plus 15 chiffres, indicatif compris.
const limit = computed(() => 15 - (dial.value.length || 1));
const errors = computed(() => {
  const e = {};
  if (!name.value.trim()) e.name = 'Nom requis.';
  else if (data.countries.some((c) => c.id !== country.value?.id && c.name.toLowerCase() === name.value.trim().toLowerCase())) e.name = 'Ce pays existe déjà.';
  if (!/^[1-9]\d{0,3}$/.test(dial.value)) e.dial = 'De 1 à 4 chiffres, sans zéro initial.';
  else if (data.countries.some((c) => c.id !== country.value?.id && c.dialCode === dial.value)) e.dial = 'Indicatif déjà utilisé par un autre pays.';
  if (!Number.isInteger(n.value) || n.value < 4 || n.value > limit.value) e.digits = `Entre 4 et ${limit.value} chiffres.`;
  return { ...e, ...serverError.value };
});
const err = (k) => (submitted.value ? errors.value[k] : undefined);

async function save() {
  submitted.value = true;
  if (Object.keys(errors.value).length || saving.value) return;
  saving.value = true;
  try {
    await store.savePhoneCountry({ ...(country.value ?? {}), name: name.value.trim(), dialCode: dial.value, digits: n.value });
    store.toast(country.value ? 'Pays mis à jour' : 'Pays ajouté');
    editing.value = undefined;
  } catch (e) {
    const field = PHONE_COUNTRY_FIELDS[e.field];
    if (field) serverError.value = { [field]: e.message };
    else store.toast(`Enregistrement impossible : ${e.message}`, 'danger');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <p v-if="store.countriesError" class="small text-danger">
    Pays indisponibles : {{ store.countriesError }} <button type="button" class="link-btn" @click="store.loadPhoneCountries()">Réessayer</button>
  </p>
  <ArchivableTable title="Pays" add-label="Ajouter un pays" collection="countries" :rows="data.countries" :columns="columns" :name-of="(c) => c.name"
    description="Détermine, pour le téléphone d’un employé, l’indicatif proposé et le nombre exact de chiffres attendu pour le numéro national. Un pays archivé est désactivé : il n’est plus proposé."
    @add="editing = {}">
    <template #cell-name="{ row: c }"><span class="country-cell"><span class="country-icon" aria-hidden="true"><Globe :size="14" /></span><span class="person-name">{{ c.name }}</span></span></template>
    <template #cell-dial="{ row: c }"><span class="dial-chip">+{{ c.dialCode }}</span></template>
    <template #cell-digits="{ row: c }">{{ c.digits }}</template>
    <template #cell-example="{ row: c }"><span class="mono small text-muted">{{ formatPhone(c, '6'.padEnd(c.digits, '0')) }}</span></template>
    <template #cell-employees="{ row: c }">{{ data.employees.filter((e) => e.phoneCountryId === c.id).length }}</template>
    <template #row-actions="{ row: c }">
      <button type="button" class="btn btn-sm btn-ghost" :aria-label="`Modifier ${c.name}`" @click="editing = { country: c }"><Pencil :size="13" aria-hidden="true" /> Modifier</button>
    </template>
  </ArchivableTable>

  <Modal :open="!!editing" :title="country ? `Modifier ${country.name}` : 'Nouveau pays'" @close="editing = undefined">
    <div class="form-grid">
      <Field v-slot="{ id }" label="Nom" required :error="err('name')" class="span-2"><input :id="id" v-model="name" placeholder="Ex. : Tunisie" autofocus /></Field>
      <Field v-slot="{ id }" label="Indicatif" required :error="err('dial')" hint="Le « + » est ajouté automatiquement.">
        <div class="input-prefix"><span aria-hidden="true">+</span>
          <input :id="id" inputmode="numeric" :value="dial" maxlength="4" placeholder="216" @input="dial = onlyDigits($event.target.value)" />
        </div>
      </Field>
      <Field v-slot="{ id }" label="Chiffres du numéro national" required :error="err('digits')">
        <input :id="id" v-model="digits" type="number" min="4" :max="limit" placeholder="8" />
      </Field>
    </div>
    <p v-if="!errors.dial && !errors.digits" class="phone-preview">Aperçu : <span class="mono">{{ formatPhone({ dialCode: dial }, '6'.padEnd(n, '0')) }}</span></p>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="editing = undefined">Annuler</button>
      <button type="button" class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Enregistrement…' : 'Enregistrer' }}</button>
    </template>
  </Modal>
</template>
