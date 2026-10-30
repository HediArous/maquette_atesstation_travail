<script setup>
import {isCompanyModuleEnabled,numberOptions} from '../../maquette/companyModules';
import { computed } from 'vue';
import { AtSign, Hash, HeartHandshake, MapPin, Phone, UserRound } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import FormCard from '../../components/FormCard.vue';
import InlineField from '../../components/InlineField.vue';
import PhoneField from '../../components/PhoneField.vue';
import { diffDays, formatDate, TODAY } from '../../utils/dates';
import { MARITAL_LABEL } from '../../utils/org';
import { formatPhone, phoneError } from '../../utils/phone';

/**
 * Onglet « Infos générales » (RH-5) : identité, situation familiale et coordonnées, modifiables sur place,
 * champ par champ ; chaque modification est enregistrée aussitôt (saveEmployee) et inscrite dans l'historique.
 */
const props = defineProps({
  employee: { type: Object, required: true },
  profile: { type: Object, required: true },
});

const store = useStore();
const data = useCompanyData();
const e = computed(() => props.employee);
const age = computed(() => (e.value.birthDate ? Math.floor(diffDays(e.value.birthDate, TODAY) / 365.25) : undefined));
const countries = computed(() => data.countries.filter((c) => !c.archived || c.id === e.value.phoneCountryId));
const phone = computed(() => formatPhone(data.country(e.value.phoneCountryId), e.value.phone));

async function update(patch, label) {
  await store.saveEmployee({ ...props.employee, ...patch }, props.profile);
  store.toast(`${label} mis à jour`);
}
const required = (label) => (v) => (String(v ?? '').trim() ? undefined : `${label} requis.`);
// Codes du backend (Gender), comme dans le formulaire de création.
const GENDER_LABEL = { HOMME: 'Homme', FEMME: 'Femme' };
function saveInternalNumber(value){if(numberOptions(store.companyId).required&&!value.trim())return Promise.reject(new Error('Le N° interne est obligatoire.'));return update({internalNumber:value.trim()||undefined},'N° interne');}
</script>

<template>
  <div class="fstack">
    <p v-if="store.can('employes.modifier')" class="if-intro">Cliquez sur une valeur pour la modifier : <kbd>Entrée</kbd> enregistre, <kbd>Échap</kbd> annule. Chaque modification est inscrite dans l’historique.</p>

    <div class="if-layout">
      <FormCard title="Identité">
        <template #icon><UserRound :size="16" /></template>
        <div class="if-grid">
          <InlineField label="Prénom" required :value="e.firstName" :empty="!e.firstName" :validate="required('Prénom')" :save="(v) => update({ firstName: v.trim() }, 'Prénom')">
            {{ e.firstName }}
            <template #editor="{ draft, set, id }"><input :id="id" type="text" :value="draft" @input="set($event.target.value)" /></template>
          </InlineField>
          <InlineField label="Nom" required :value="e.lastName" :empty="!e.lastName" :validate="required('Nom')" :save="(v) => update({ lastName: v.trim() }, 'Nom')">
            {{ e.lastName }}
            <template #editor="{ draft, set, id }"><input :id="id" type="text" :value="draft" @input="set($event.target.value)" /></template>
          </InlineField>
          <div class="if">
            <span class="if-label">Matricule</span>
            <span class="if-value" style="cursor: default"><span class="mono"><Hash :size="12" aria-hidden="true" class="inline-icon" />{{ e.matricule }}</span></span>
            <p class="if-hint">Attribué automatiquement, non modifiable.</p>
          </div>
          <InlineField label="Genre" :value="e.gender ?? ''" :empty="!e.gender" :save="(v) => update({ gender: v || undefined }, 'Genre')">
            {{ GENDER_LABEL[e.gender] }}
            <template #editor="{ draft, set }">
              <div class="segmented" role="radiogroup" aria-label="Genre">
                <button v-for="(label, code) in GENDER_LABEL" :key="code" type="button" role="radio" :aria-checked="draft === code"
                  :class="{ active: draft === code }" @click="set(code)">{{ label }}</button>
              </div>
            </template>
          </InlineField>
          <!-- Unicité contrôlée par le serveur : un N° déjà attribué est refusé avec son message sous le champ. -->
          <InlineField label="Date de délivrance de la CIN" :value="e.cinIssueDate||''" :empty="!e.cinIssueDate" :validate="v=>v&&(v>TODAY||e.birthDate&&v<e.birthDate)?'Date de délivrance incohérente.':undefined" :save="v=>update({cinIssueDate:v||''},'Date de délivrance de la CIN')"><span>{{e.cinIssueDate?formatDate(e.cinIssueDate):'Non renseignée'}}</span><template #editor="{id,draft,set}"><input :id="id" type="date" :value="draft" :max="TODAY" :min="e.birthDate||undefined" @input="set($event.target.value)"/></template></InlineField>
          <InlineField v-if="isCompanyModuleEnabled(store.companyId,'numero-interne')" label="N° interne" :value="e.internalNumber ?? ''" :empty="!e.internalNumber" hint="Numéro propre à l’entreprise, unique."
            :save="(v) => saveInternalNumber(v)">
            <span class="mono">{{ e.internalNumber }}</span>
            <template #editor="{ draft, set, id }"><input :id="id" type="text" class="mono" maxlength="50" autocomplete="off" :value="draft" @input="set($event.target.value)" /></template>
          </InlineField>
          <InlineField label="CIN" required :value="e.cin" :empty="!e.cin"
            :validate="(v) => required('CIN')(v) ?? (/^\d{8}$/.test(v.trim()) ? undefined : 'CIN : 8 chiffres.')" :save="(v) => update({ cin: v.trim() }, 'CIN')">
            <span class="mono">{{ e.cin }}</span>
            <!-- Chiffres seulement, 8 au plus, avec compteur (comme le N° CNSS). -->
            <template #editor="{ draft, set, id }">
              <div class="cnss-input">
                <input :id="id" inputmode="numeric" maxlength="8" placeholder="00000000" :value="draft"
                  @input="set(($event.target.value = $event.target.value.replace(/\D/g, '').slice(0, 8)))" />
                <span class="cnss-count" :class="{ done: (draft ?? '').length === 8 }">{{ (draft ?? '').length }}/8</span>
              </div>
            </template>
          </InlineField>
          <InlineField label="CNSS" :value="{ haveCnss: e.haveCnss, cnss: e.cnss }"
            :validate="(v) => (!v.haveCnss ? undefined : /^\d{10}$/.test(v.cnss.replace(/\s/g, '')) ? undefined : 'N° CNSS requis : 10 chiffres.')"
            :save="(v) => update(v.haveCnss ? { haveCnss: true, cnss: v.cnss.trim() } : { haveCnss: false, cnss: '' }, 'CNSS')">
            <span v-if="e.haveCnss" class="mono">{{ e.cnss }}</span>
            <span v-else>Non affilié</span>
            <template #editor="{ draft, set, id }">
              <div class="segmented" role="radiogroup" aria-label="Affiliation CNSS" style="margin-bottom: 6px">
                <button type="button" role="radio" :aria-checked="draft.haveCnss" :class="{ active: draft.haveCnss }" @click="set({ haveCnss: true, cnss: draft.cnss })">Affilié</button>
                <button type="button" role="radio" :aria-checked="!draft.haveCnss" :class="{ active: !draft.haveCnss }" @click="set({ haveCnss: false, cnss: draft.cnss })">Non affilié</button>
              </div>
              <div v-if="draft.haveCnss" class="cnss-input">
                <input :id="id" inputmode="numeric" maxlength="10" placeholder="0000000000" :value="draft.cnss"
                  @input="set({ ...draft, cnss: ($event.target.value = $event.target.value.replace(/\D/g, '').slice(0, 10)) })" />
                <span class="cnss-count" :class="{ done: draft.cnss.length === 10 }">{{ draft.cnss.length }}/10</span>
              </div>
            </template>
          </InlineField>
          <InlineField label="Date de naissance" :value="e.birthDate" :empty="!e.birthDate"
            :validate="(v) => (v && v > TODAY ? 'Date dans le futur.' : undefined)" :save="(v) => update({ birthDate: v }, 'Date de naissance')">
            {{ e.birthDate && formatDate(e.birthDate) }} <span class="text-muted">· {{ age }} ans</span>
            <template #editor="{ draft, set, id }"><input :id="id" type="date" :value="draft" :max="TODAY" @input="set($event.target.value)" /></template>
          </InlineField>
        </div>
      </FormCard>

      <FormCard title="Situation familiale" subtitle="Historisée : utile au calcul des droits et de la paie.">
        <template #icon><HeartHandshake :size="16" /></template>
        <div class="if-grid if-highlight">
          <InlineField label="Situation matrimoniale" required :value="e.maritalStatus" :save="(v) => update(v === 'celibataire' ? { maritalStatus: v, childrenCount: 0 } : { maritalStatus: v }, 'Situation matrimoniale')">
            {{ MARITAL_LABEL[e.maritalStatus] }}
            <template #editor="{ draft, set, id }">
              <select :id="id" :value="draft" @change="set($event.target.value)">
                <option v-for="(l, k) in MARITAL_LABEL" :key="k" :value="k">{{ l }}</option>
              </select>
            </template>
          </InlineField>
          <InlineField v-if="e.maritalStatus !== 'celibataire'" label="Enfants à charge" required :value="e.childrenCount"
            :validate="(v) => (Number.isInteger(v) && v >= 0 ? undefined : 'Nombre entier positif ou nul.')" :save="(v) => update({ childrenCount: v }, 'Enfants à charge')">
            {{ e.childrenCount === 0 ? 'Aucun' : `${e.childrenCount} enfant${e.childrenCount > 1 ? 's' : ''}` }}
            <template #editor="{ draft, set, id }"><input :id="id" type="number" min="0" step="1" :value="draft" @input="set($event.target.value === '' ? 0 : Number($event.target.value))" /></template>
          </InlineField>
        </div>
      </FormCard>
    </div>

    <FormCard title="Coordonnées">
      <template #icon><AtSign :size="16" /></template>
      <div class="if-grid cols-3">
        <InlineField label="E-mail professionnel" :value="e.email" :empty="!e.email"
          :validate="(v) => (!v.trim() || /^\S+@\S+\.\S+$/.test(v.trim()) ? undefined : 'Adresse e-mail invalide.')" :save="(v) => update({ email: v.trim() }, 'E-mail')">
          <AtSign :size="12" aria-hidden="true" class="inline-icon" />{{ e.email }}
          <template #editor="{ draft, set, id }"><input :id="id" type="email" placeholder="prenom.nom@societe.ma" :value="draft" @input="set($event.target.value)" /></template>
        </InlineField>
        <InlineField label="Téléphone" :value="{ countryId: e.phoneCountryId, phone: e.phone }" :empty="!e.phone"
          :validate="(v) => phoneError(data.country(v.countryId), v.phone)" :save="(v) => update({ phoneCountryId: v.countryId, phone: v.phone }, 'Téléphone')">
          <Phone :size="12" aria-hidden="true" class="inline-icon" />{{ phone || e.phone }}
          <template #editor="{ draft, set, id }">
            <PhoneField :id="id" :value="draft.phone" :country-id="draft.countryId" :countries="countries" @change="(countryId, p) => set({ countryId, phone: p })" />
          </template>
        </InlineField>
        <InlineField label="Adresse postale" :value="e.address" :empty="!e.address" :save="(v) => update({ address: v.trim() }, 'Adresse')">
          <MapPin :size="12" aria-hidden="true" class="inline-icon" />{{ e.address }}
          <template #editor="{ draft, set, id }"><input :id="id" type="text" placeholder="Rue, ville, code postal" :value="draft" @input="set($event.target.value)" /></template>
        </InlineField>
      </div>
    </FormCard>
  </div>
</template>
