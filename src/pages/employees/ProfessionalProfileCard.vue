<script setup>
import { computed } from 'vue';
import { Briefcase } from '@lucide/vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import FormCard from '../../components/FormCard.vue';
import InlineField from '../../components/InlineField.vue';
import { formatDate } from '../../utils/dates';
import { defaultProfile } from '../../utils/leave';

/**
 * Profil professionnel de la fiche (onglet Temps de travail) : département, sous-département, fonction, N+1, titre
 * d'emploi et date d'embauche, modifiables sur place champ par champ comme l'onglet « Infos générales » ; chaque
 * modification est enregistrée aussitôt (saveEmployee) et le changement de rattachement est historisé.
 */
const props = defineProps({ employee: { type: Object, required: true } });

const store = useStore();
const data = useCompanyData();
const e = computed(() => props.employee);

async function update(patch, label) {
  await store.saveEmployee({ ...props.employee, ...patch }, data.profile(props.employee.id) ?? defaultProfile(store.db, props.employee));
  store.toast(`${label} mis à jour`);
}
const required = (label) => (v) => (String(v ?? '').trim() ? undefined : `${label} requis.`);

// Mêmes listes et filtres que le formulaire de l'employé : éléments actifs, ou valeur déjà enregistrée.
const deps = computed(() => data.departments.filter((d) => !d.archived || d.id === e.value.departmentId));
const subs = computed(() => data.subDepartments(e.value.departmentId).filter((d) => !d.archived || d.id === e.value.subDepartmentId));
const fns = computed(() => data.functions.filter((x) => (!x.archived || x.id === e.value.functionId)
  && (!e.value.departmentId || !x.departmentId || x.departmentId === e.value.departmentId)));
const managers = computed(() => data.employees.filter((x) => x.id !== e.value.id && (x.status !== 'inactif' || x.id === e.value.managerId)));
const manager = computed(() => data.employee(e.value.managerId));
const subName = computed(() => data.departmentName(e.value.subDepartmentId));

// Nouveau département : le sous-département et une fonction propre à un autre département ne sont pas conservés.
function saveDepartment(id) {
  const fn = data.fn(e.value.functionId);
  const keepFn = !fn?.departmentId || fn.departmentId === id;
  return update({ departmentId: id, subDepartmentId: undefined, functionId: keepFn ? e.value.functionId : '' }, 'Département');
}
// Une fonction solo n'est occupée que par un seul employé actif.
function validateFunction(id) {
  if (!id) return 'Fonction requise.';
  const fn = data.fn(id);
  const taken = fn?.interim && fn.kind === 'solo' ? data.employees.find((x) => x.id !== e.value.id && x.functionId === id && x.status !== 'inactif') : undefined;
  return taken ? `Fonction solo déjà occupée par ${taken.firstName} ${taken.lastName}.` : undefined;
}
</script>

<template>
  <FormCard title="Profil" :subtitle="`${store.can('employes.modifier') ? 'Cliquez sur une valeur pour la modifier. ' : ''}L’horaire du département et le circuit d’approbation découlent du rattachement.`">
    <template #icon><Briefcase :size="16" /></template>
    <div class="if-grid cols-3">
      <InlineField label="Département" required :value="e.departmentId ?? ''" :empty="!e.departmentId" :validate="required('Département')"
        hint="Le sous-département est réinitialisé." :save="saveDepartment">
        {{ data.departmentName(e.departmentId) }}
        <template #editor="{ draft, set, id }">
          <select :id="id" :value="draft" @change="set($event.target.value)">
            <option value="">Sélectionner…</option>
            <option v-for="d in deps" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </template>
      </InlineField>
      <InlineField label="Sous-département" :value="e.subDepartmentId ?? ''" :empty="!subName"
        :hint="e.departmentId && subs.length === 0 ? 'Ce département n’a pas de sous-département.' : ''"
        :save="(v) => update({ subDepartmentId: v || undefined }, 'Sous-département')">
        {{ subName }}
        <template #editor="{ draft, set, id }">
          <select :id="id" :value="draft" :disabled="subs.length === 0" @change="set($event.target.value)">
            <option value="">Aucun</option>
            <option v-for="d in subs" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </template>
      </InlineField>
      <InlineField label="Fonction" required :value="e.functionId ?? ''" :empty="!data.fn(e.functionId)" :validate="validateFunction"
        :save="(v) => update({ functionId: v }, 'Fonction')">
        {{ data.fn(e.functionId)?.name }}
        <template #editor="{ draft, set, id }">
          <select :id="id" :value="draft" @change="set($event.target.value)">
            <option value="">Sélectionner…</option>
            <option v-for="x in fns" :key="x.id" :value="x.id">{{ x.name }}{{ x.interim ? ` (${x.kind === 'solo' ? 'solo' : 'groupe'})` : '' }}</option>
          </select>
        </template>
      </InlineField>
      <InlineField label="Responsable hiérarchique (N+1)" :value="e.managerId ?? ''" :empty="!manager"
        :save="(v) => update({ managerId: v || undefined }, 'Responsable hiérarchique')">
        {{ manager ? `${manager.firstName} ${manager.lastName}` : '' }}
        <template #editor="{ draft, set, id }">
          <select :id="id" :value="draft" @change="set($event.target.value)">
            <option value="">Aucun responsable</option>
            <option v-for="m in managers" :key="m.id" :value="m.id">{{ m.firstName }} {{ m.lastName }}</option>
          </select>
        </template>
      </InlineField>
      <InlineField label="Titre d’emploi" :value="e.jobTitle ?? ''" :empty="!e.jobTitle" hint="Facultatif, distinct de la fonction."
        :validate="(v) => (v.trim().length > 255 ? '255 caractères au plus.' : undefined)"
        :save="(v) => update({ jobTitle: v.trim() }, 'Titre d’emploi')">
        {{ e.jobTitle }}
        <template #editor="{ draft, set, id }"><input :id="id" type="text" maxlength="255" :value="draft" placeholder="Ex. : Comptable senior" @input="set($event.target.value)" /></template>
      </InlineField>
      <InlineField label="Date d’embauche" required :value="e.hireDate ?? ''" :empty="!e.hireDate" :validate="required('Date d’embauche')"
        :save="(v) => update({ hireDate: v }, 'Date d’embauche')">
        {{ e.hireDate ? formatDate(e.hireDate) : '' }}
        <template #editor="{ draft, set, id }"><input :id="id" type="date" :value="draft" @input="set($event.target.value)" /></template>
      </InlineField>
    </div>
  </FormCard>
</template>
