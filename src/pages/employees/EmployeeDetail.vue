<script setup>
import { computed, provide, ref, watch } from 'vue';
import { ArrowLeft, CalendarCheck, CalendarClock, CloudOff, GitBranch, LoaderCircle, Pencil, Plus, Trash2, Undo2 } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import { navigate } from '../../router/navigate';
import {isCompanyModuleEnabled} from '../../maquette/companyModules';
import { EMPLOYEE_TAB_PERMISSIONS } from '../../config/access';
import EmptyState from '../../components/ui/EmptyState.vue';
import Tabs from '../../components/ui/Tabs.vue';
import FormCard from '../../components/FormCard.vue';
import LeaveDetail from '../leave/LeaveDetail.vue';
import LeaveForm from '../leave/LeaveForm.vue';
import LeaveTable from '../leave/LeaveTable.vue';
import AccessTab from './AccessTab.vue';
import ContractsTab from './ContractsTab.vue';
import CircuitChain from './CircuitChain.vue';
import DeleteEmployeeModal from './DeleteEmployeeModal.vue';
import DocumentsTab from './DocumentsTab.vue';
import EmployeeForm from './EmployeeForm.vue';
import EmployeeHero from './EmployeeHero.vue';
import HistoryTab from './HistoryTab.vue';
import InfosTab from './InfosTab.vue';
import OverviewTab from './OverviewTab.vue';
import ProfileTab from './ProfileTab.vue';
import RemunerationTab from './RemunerationTab.vue';
import ScheduleModeModal from './ScheduleModeModal.vue';
import WorkTimeTab from './WorkTimeTab.vue';

/**
 * Fiche employé. En-tête : identité, statuts, quatre repères et alertes du moment.
 * Onglets par thème : vue d'ensemble, temps de travail, congés (soldes, demandes et circuit d'approbation),
 * rémunération, accès, historique.
 */
const props = defineProps({ employeeId: { type: String, required: true } });

const store = useStore();
// Sans droit de modification des dossiers, les champs modifiables sur place des onglets s'affichent en lecture seule.
const readonly = computed(() => !store.can('employes.modifier'));
provide('inlineReadonly', readonly);
const data = useCompanyData();
const tab = ref('apercu');
const editOpen = ref(false);
const deleting = ref();
const leaveOpen = ref(false);
const openReq = ref();
const modeOpen = ref(false);
// Nombre de contrats connu une fois l'onglet Contrats chargé (lu sur le serveur).
const contractCount = ref();
// Nombre de documents connu une fois l'onglet Documents chargé.
const documentCount = ref();
// Nombre d'événements connu une fois l'onglet Historique chargé (lu sur le serveur).
const historyCount = ref();

watch(() => props.employeeId, () => { tab.value = 'apercu'; contractCount.value = undefined; documentCount.value = undefined; historyCount.value = undefined; });

const employee = computed(() => data.employee(props.employeeId));
const profile = computed(() => data.profile(props.employeeId));
const found = computed(() => !!employee.value && !!profile.value && employee.value.companyId === data.company.id);
const inactive = computed(() => employee.value?.status === 'inactif');
const requests = computed(() => data.requests.filter((r) => r.employeeId === props.employeeId).sort((a, b) => b.start.localeCompare(a.start)));
const pending = computed(() => requests.value.filter((r) => r.status === 'en_attente').length);
// Onglets permis à l'utilisateur connecté (contrats, rémunération, accès et documents sont protégés).
const tabs = computed(() => [
  { id: 'apercu', label: 'Vue d’ensemble' },
  { id: 'infos', label: 'Infos générales' },
  { id: 'temps', label: 'Profil & Horaire' },
  { id: 'contrats', label: 'Contrats', count: contractCount.value || undefined },
  { id: 'conges', label: 'Congés', count: pending.value || undefined },
  { id: 'remuneration', label: 'Rémunération' },
  { id: 'acces', label: 'Accès' },
  { id: 'documents', label: 'Documents', count: documentCount.value || undefined },
  { id: 'historique', label: 'Historique', count: historyCount.value || undefined },
].filter((t) => isCompanyModuleEnabled(store.companyId,({contrats:'contrats',remuneration:'remuneration',conges:'conges'})[t.id])&&store.allows(EMPLOYEE_TAB_PERMISSIONS[t.id])));
watch(tabs, (list) => { if (!list.some((t) => t.id === tab.value)) tab.value = 'apercu'; });

function goTo(t) {
  tab.value = t;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
</script>

<template>
  <EmptyState v-if="!found && store.employeesStatus === 'loading'" title="Chargement de la fiche…" text="Lecture du dossier sur le serveur.">
    <template #icon><LoaderCircle :size="28" aria-hidden="true" /></template>
  </EmptyState>
  <EmptyState v-else-if="!found && store.employeesStatus === 'error'" title="Fiche indisponible" :text="store.employeesError">
    <template #icon><CloudOff :size="28" aria-hidden="true" /></template>
    <template #action><button type="button" class="btn btn-primary" @click="store.loadEmployees()">Réessayer</button></template>
  </EmptyState>
  <EmptyState v-else-if="!found" title="Employé introuvable" text="Cette fiche n’appartient pas à la société active.">
    <template #action><button type="button" class="btn btn-primary" @click="navigate('employes')">Retour à la liste</button></template>
  </EmptyState>
  <template v-else>
    <div class="breadcrumb">
      <button type="button" class="back-link" @click="navigate('employes')"><ArrowLeft :size="14" aria-hidden="true" /> Employés</button>
      <span aria-hidden="true">/</span>
      <span>{{ employee.firstName }} {{ employee.lastName }}</span>
    </div>

    <EmployeeHero :employee="employee" :profile="profile" @tab="goTo">
      <template #actions>
        <!-- <button type="button" class="btn btn-ghost" :disabled="inactive" :title="employee.scheduleMode === 'organisation' ? 'Passer au tableau de chargement' : 'Revenir à l’horaire du département'" @click="modeOpen = true">
          <template v-if="employee.scheduleMode === 'organisation'"><CalendarClock :size="14" aria-hidden="true" /> Tableau de chargement</template>
          <template v-else><Undo2 :size="14" aria-hidden="true" /> Horaire du département</template>
        </button> -->
        <!-- <button type="button" class="btn btn-ghost" :disabled="inactive" @click="leaveOpen = true"><CalendarCheck :size="14" aria-hidden="true" /> Saisir un congé</button> -->
        <!-- <button v-if="store.can('employes.modifier')" type="button" class="btn btn-primary" @click="editOpen = true"><Pencil :size="14" aria-hidden="true" /> Modifier</button>
        <button v-if="store.can('employes.supprimer')" type="button" class="icon-btn icon-btn-danger" aria-label="Supprimer le dossier" title="Supprimer le dossier" @click="deleting = employee"><Trash2 :size="16" /></button> -->
      </template>
    </EmployeeHero>


    <Tabs v-model="tab" label="Sections de la fiche" :tabs="tabs" />

    <div class="emp-tab">
      <OverviewTab v-if="tab === 'apercu'" :employee="employee" :profile="profile" @tab="goTo" />
      <InfosTab v-if="tab === 'infos'" :employee="employee" :profile="profile" />
      <WorkTimeTab v-if="tab === 'temps'" :employee="employee" @switch="modeOpen = true" />
      <ContractsTab v-if="tab === 'contrats'" :employee="employee" @count="(n) => (contractCount = n)" />
      <DocumentsTab v-if="tab === 'documents'" :employee="employee" @count="(n) => (documentCount = n)" />
      <div v-if="tab === 'conges'" class="fstack">
        <ProfileTab :key="`p-${employee.id}`" :profile="profile" />
        <!-- <FormCard title="Demandes de congé" :subtitle="`${requests.length} demande${requests.length > 1 ? 's' : ''}${pending ? ` · ${pending} en attente` : ''}`">
          <template #icon><CalendarCheck :size="16" /></template>
          <template #actions>
            <button type="button" class="btn btn-sm btn-primary" :disabled="inactive" @click="leaveOpen = true"><Plus :size="14" aria-hidden="true" /> Nouvelle demande</button>
          </template>
          <LeaveTable :requests="requests" hide-employee empty-text="Aucune demande pour cet employé." @open="(id) => (openReq = id)" />
        </FormCard> -->
        <FormCard title="Circuit d’approbation" subtitle="Hérité du département, appliqué automatiquement à chaque demande.">
          <template #icon><GitBranch :size="16" /></template>
          <CircuitChain :employee="employee" :profile="profile" />
        </FormCard>
      </div>
      <RemunerationTab v-if="tab === 'remuneration'" :employee="employee" />
      <AccessTab v-if="tab === 'acces'" :key="`a-${employee.id}`" :profile="profile" />
      <HistoryTab v-if="tab === 'historique'" :employee="employee" @count="(n) => (historyCount = n)" />
    </div>

    <EmployeeForm :open="editOpen" :employee="employee" @close="editOpen = false" />
    <ScheduleModeModal :employee="employee" :open="modeOpen" @close="modeOpen = false" />
    <LeaveForm :open="leaveOpen" :default-employee-id="employee.id" @close="leaveOpen = false" @created="(id) => (openReq = id)" />
    <LeaveDetail v-if="openReq" :request-id="openReq" @close="openReq = undefined" />
  </template>
  <!-- Hors de la fiche : reste monté quand l'employé supprimé disparaît, pour revenir à la liste. -->
  <DeleteEmployeeModal :employee="deleting" @close="deleting = undefined" @deleted="navigate('employes')" />
</template>
