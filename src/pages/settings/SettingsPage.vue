<script setup>
import { computed, provide } from 'vue';
import { Building } from '@lucide/vue';
import { useCompanyData } from '../../store/companyData';
import PageHeader from '../../components/ui/PageHeader.vue';
import DocumentTemplatesSection from './DocumentTemplatesSection.vue';
import CompanyModulesSection from './CompanyModulesSection.vue';
import CircuitsSection from './CircuitsSection.vue';
import ContractTypesSection from './ContractTypesSection.vue';
import CountriesSection from './CountriesSection.vue';
import CurrenciesSection from './CurrenciesSection.vue';
import DepartmentsSection from './DepartmentsSection.vue';
import DocumentTypesSection from './DocumentTypesSection.vue';
import FunctionsSection from './FunctionsSection.vue';
import HolidaysSection from './HolidaysSection.vue';
import LeaveTypesSection from './LeaveTypesSection.vue';
import LeavePoliciesSection from './LeavePoliciesSection.vue';
import NumberingSection from './NumberingSection.vue';
import PrimesSection from './PrimesSection.vue';
import RolesSection from './RolesSection.vue';
import RulesAndPresence from './RulesAndPresence.vue';
import SchedulesSection from './SchedulesSection.vue';
import EmployeeStatusesSection from './EmployeeStatusesSection.vue';
import { SETTINGS_NAV } from './nav';
import { SETTINGS_SECTION } from './settingsRights';

/** Paramètres de la société active : une sous-section par onglet de la sous-navigation. */
const props = defineProps({ param: { type: String, default: undefined } });

const SECTIONS = {
  'modeles-documents': DocumentTemplatesSection,
  'modules-societe': CompanyModulesSection,
  departements: DepartmentsSection,
  fonctions: FunctionsSection,
  numerotation: NumberingSection,
  'statuts-employe': EmployeeStatusesSection,
  pays: CountriesSection,
  devises: CurrenciesSection,
  primes: PrimesSection,
  'types-contrat': ContractTypesSection,
  'types-document': DocumentTypesSection,
  horaires: SchedulesSection,
  'types-conge': LeaveTypesSection,
  'politiques-conges': LeavePoliciesSection,
  regles: RulesAndPresence,
  'jours-feries': HolidaysSection,
  roles: RolesSection,
  circuits: CircuitsSection,
};

const data = useCompanyData();
const current = computed(() => SETTINGS_NAV.find((s) => s.id === props.param) ?? SETTINGS_NAV[0]);
// Les sections lisent leurs droits (ajouter / modifier / archiver) d'après la section affichée.
provide(SETTINGS_SECTION, computed(() => current.value.id));
</script>

<template>
  <PageHeader compact :title="current.label" :subtitle="current.description">
    <template #icon><component :is="current.icon" :size="16" :stroke-width="1.9" /></template>
    <template #actions>
      <span class="ph-scope" :title="`Paramètres propres à ${data.company.name}`"><Building :size="13" aria-hidden="true" /> {{ data.company.name }}</span>
    </template>
  </PageHeader>
  <!-- La clé remonte la section au changement de société ou d'onglet pour réinitialiser ses états. -->
  <div :key="`${data.company.id}-${current.id}`"><component :is="SECTIONS[current.id]" /></div>
</template>
