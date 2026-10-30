<script setup>
import {isLeaveFeatureEnabled} from '../../maquette/companyModules';
import { computed, ref, watch } from 'vue';
import { useStore } from '../../store';
import { useCompanyData } from '../../store/companyData';
import { leaveCatalog } from '../../maquette/leaveCatalog';
import { savePolicy } from '../../maquette/leaveCatalogModel';
import { TODAY } from '../../utils/dates';
import Modal from '../../components/ui/Modal.vue';
import Field from '../../components/ui/Field.vue';
const props = defineProps({ state: { type: Object, default: null } });
const emit = defineEmits(['close', 'saved']);
const store = useStore(), data = useCompanyData();
const f = ref(null), error = ref(''), limited=ref(false), period=ref('year'), previousUnit=ref('jours');
function changeDurationUnit(){const before=previousUnit.value,after=f.value.entitlementUnit;if(['minutes','heures'].includes(before)&&['minutes','heures'].includes(after)){const factor=before==='heures'?60:1/60;if(f.value.quota!==null&&f.value.quota!=='')f.value.quota=Math.round(Number(f.value.quota)*factor*1e8)/1e8;f.value.carry=Math.round(Number(f.value.carry||0)*factor*1e8)/1e8;}else{f.value.quota=null;f.value.carry=0;}previousUnit.value=after;}
function changeType(){ const t=type.value; f.value.quota=null; f.value.carry=0; f.value.entitlementUnit=t?.unit==='minutes'?'minutes':'jours'; previousUnit.value=f.value.entitlementUnit; f.value.name=`${t?.name||''} — Tous les employés`; if(t?.unit==='minutes'){f.value.counting='worked';f.value.excludeHolidays=true;} } 
const type = computed(() => leaveCatalog.types.find(t => t.id === f.value?.typeId));
watch(() => props.state, state => {
  if (!state) { f.value = null; return; }
  const minute = leaveCatalog.types.find(t => t.id === state.typeId)?.unit === 'minutes';
  f.value = JSON.parse(JSON.stringify(state.policy || { name: `${leaveCatalog.types.find(t=>t.id===state.typeId)?.name||''} — Tous les employés`, typeId: state.typeId, scope: 'all', departmentIds: [], employeeIds: [], from: TODAY, to: '', status: 'active', reference: '', counter: 'none', quota: null, entitlementUnit: minute ? 'minutes' : 'jours', accrual: 'Annuelle', counting: 'worked', excludeHolidays: true, carry: 0, notice: 0, proof: 'Facultatif', eligibility: 'Tous les employés concernés', pay: 'À préciser', negative: false }));
  if(f.value.displayUnit==='heures'&&f.value.entitlementUnit==='minutes'){f.value.entitlementUnit='heures';if(f.value.quota!=null)f.value.quota/=60;f.value.carry/=60;}
  previousUnit.value=f.value.entitlementUnit;
  limited.value=f.value.quota!=null; period.value=f.value.limitPeriod||(f.value.accrual==='Par événement'?'event':f.value.accrual==='Mensuelle'?'month':'year'); error.value = ''; 
}, { immediate: true });
const suggestedName = computed(() => {
  if(!f.value) return '';
  const population=f.value.scope==='all'?'Tous les employés':f.value.scope==='departments'?(f.value.departmentIds.map(id=>data.departments.find(d=>d.id===id)?.name||id).join(', ')||'Départements sélectionnés'):'Employés sélectionnés';
  return `${type.value?.name||''} — ${population}`;
});
watch(suggestedName,(name,previous)=>{if(f.value&&(!f.value.name||f.value.name===previous))f.value.name=name;});
function save() {
  f.value.limitPeriod=period.value;
  if(f.value.entitlementUnit==='mois'){f.value.counting='calendar';f.value.excludeHolidays=false;}
  if(!limited.value){f.value.quota=null;f.value.counter='none';f.value.carry=0;}else {f.value.counter=period.value==='event'?'none':period.value==='year'&&type.value?.unit==='jours'?'annual':'own';if(period.value!=='year')f.value.carry=0;}
  f.value.accrual=period.value==='event'?'Par événement':period.value==='month'?'Mensuelle':f.value.accrual==='Mensuelle'?'Mensuelle':'Annuelle';
  const result = savePolicy(leaveCatalog, f.value, data.employees, store.db.departments);
  if (result.error) { error.value = result.error; return; }
  store.toast(`Politique enregistrée · version ${result.item.version}. Les demandes existantes conservent leur version.`);
  emit('saved', result.item); emit('close');
}
</script>
<template>
  <Modal :open="!!state" :title="state?.policy ? 'Modifier la politique' : 'Nouvelle politique de congé'" size="lg" @close="emit('close')">
    <form v-if="f" id="leave-policy-form" @submit.prevent="save">
      <div v-if="state?.policy?.reference" class="policy-example"><strong>{{state.policy.status==='draft'?'Modèle à vérifier avant activation':'Configuration enregistrée'}}</strong><p>{{state.policy.reference}}</p><p v-if="state.policy.eligibility">{{state.policy.eligibility}}</p><a v-if="state.policy.sourceUrl" :href="state.policy.sourceUrl" target="_blank" rel="noopener">Consulter le texte de référence</a></div>
      <p v-if="!isLeaveFeatureEnabled(store.companyId,type)" class="policy-example">Cette fonctionnalité est désactivée pour la société. Le paramétrage est conservé, mais ce type ne sera pas proposé aux nouvelles demandes.</p><p class="small text-muted">Définissez les bénéficiaires et les conditions de l’absence. Les durées d’exemple sont à adapter aux dispositions applicables.</p>
      <div class="form-grid mt-12">
        <Field v-slot="{id}" label="Type de congé"><select :id="id" v-model="f.typeId" :disabled="!!state?.policy" @change="changeType"><option v-for="t in leaveCatalog.types.filter(t=>!t.archived)" :key="t.id" :value="t.id">{{t.name}}</option></select></Field>
        <Field v-slot="{id}" label="Nom de la politique" required hint="Un nom pour reconnaître cette configuration."><input :id="id" v-model="f.name" required /></Field>
        <Field v-slot="{id}" label="Bénéficiaires"><select :id="id" v-model="f.scope"><option value="all">Tous les employés</option><option value="departments">Certains départements</option><option v-if="f.scope==='employees'" value="employees">Employés sélectionnés (configuration existante)</option></select></Field>
        <Field v-slot="{id}" label="Droit limité ?" hint="Sans limite chiffrée : les autres conditions restent applicables."><select :id="id" v-model="limited"><option :value="false">Sans limite chiffrée</option><option :value="true">Oui, définir une limite</option></select></Field>
        <div v-if="f.scope==='departments'" class="span-2 policy-choices"><label v-for="d in data.departments.filter(d=>!d.archived)" :key="d.id" class="check"><input v-model="f.departmentIds" type="checkbox" :value="d.id" />{{d.name}}</label><p class="small text-muted">Choisissez au moins un département.</p></div>
        <div v-if="f.scope==='employees'" class="span-2 policy-choices"><label v-for="e in data.employees" :key="e.id" class="check"><input v-model="f.employeeIds" type="checkbox" :value="e.id" />{{e.firstName}} {{e.lastName}}</label></div>
        <template v-if="limited">
          <Field v-slot="{id}" label="Unité de la durée" :hint="type?.unit==='minutes'?'Choisissez Heures ou Minutes : 2 h = 120 min. La durée est convertie si vous changez d’unité.':'Ce type se demande en jours. Choisissez des mois uniquement pour un droit exprimé en mois, sans conversion en jours.'"><select :id="id" v-model="f.entitlementUnit" @change="changeDurationUnit"><template v-if="type?.unit==='minutes'"><option value="minutes">Minutes</option><option value="heures">Heures</option></template><template v-else><option value="jours">Jours</option><option value="mois">Mois</option></template></select></Field>
          <Field v-slot="{id}" :label="'Durée autorisée'" required><input :id="id" v-model="f.quota" type="number" :min="f.entitlementUnit==='heures'?0.25:type?.unit==='minutes'||f.entitlementUnit==='mois'?1:0.5" :step="f.entitlementUnit==='heures'?0.25:type?.unit==='minutes'||f.entitlementUnit==='mois'?1:0.5" required /></Field>
          <Field v-slot="{id}" label="Limite applicable" :hint="period==='event'?'Plafond par demande, sans cumul annuel ou mensuel.':'Les absences se cumulent sur cette période.'"><select :id="id" v-model="period"><option value="month">Par mois</option><option value="year">Par an</option><option value="event">Par événement</option></select></Field>
        </template>
        <Field v-slot="{id}" label="Justificatif"><select :id="id" v-model="f.proof"><option>Facultatif</option><option>Obligatoire au dépôt</option><option>Régularisation possible</option></select></Field>
        <Field v-slot="{id}" label="Applicable à partir du" required><input :id="id" v-model="f.from" type="date" required /></Field>
      </div>
      <details class="policy-options"><summary>Plus d’options</summary><div class="form-grid mt-12">
        <Field v-if="limited&&period==='year'" v-slot="{id}" label="Acquisition du quota" hint="Le total annuel reste la durée autorisée ci-dessus."><select :id="id" v-model="f.accrual"><option value="Annuelle">En une fois</option><option value="Mensuelle">Progressivement chaque mois</option></select></Field>
        <Field v-if="type?.unit==='jours'&&f.entitlementUnit!=='mois'" v-slot="{id}" label="Décompte"><select :id="id" v-model="f.counting"><option value="worked">Jours travaillés selon l’horaire</option><option value="calendar">Jours calendaires</option></select></Field>
        <label v-if="type?.unit==='jours'&&f.entitlementUnit!=='mois'" class="check span-2"><input v-model="f.excludeHolidays" type="checkbox" />Exclure les jours fériés du décompte</label>
        <Field v-if="limited&&period==='year'" v-slot="{id}" :label="`Report maximum (${f.entitlementUnit})`" hint="0 : aucun report à l’année suivante."><input :id="id" v-model="f.carry" type="number" min="0" :step="f.entitlementUnit==='heures'?0.25:1" /></Field>
        <Field v-slot="{id}" label="Délai de prévenance (jours)" hint="Délai entre le dépôt et le début de l’absence."><input :id="id" v-model="f.notice" type="number" min="0" /></Field>
        <Field v-slot="{id}" label="Date de fin" hint="Vide : sans date de fin."><input :id="id" v-model="f.to" type="date" :min="f.from" /></Field>
        <Field v-slot="{id}" label="État"><select :id="id" v-model="f.status"><option value="active">Active</option><option value="draft">Brouillon</option><option value="closed">Clôturée</option></select></Field>
        <Field v-slot="{id}" label="Référence / note RH" class="span-2" hint="Document ou disposition justifiant ce paramétrage."><input :id="id" v-model="f.reference" /></Field>
        <Field v-slot="{id}" label="Conditions particulières" class="span-2" hint="Note descriptive : ces conditions ne sont pas contrôlées automatiquement dans la maquette."><textarea :id="id" v-model="f.eligibility" rows="2" /></Field>
      </div></details>
      <p class="small text-muted mt-12">Horaires, jours fériés et circuit d’approbation : ceux déjà configurés pour l’employé.</p>
      <p v-if="limited&&f.entitlementUnit==='mois'" class="small text-muted">Droit exprimé en mois calendaires : aucune conversion automatique en jours. Le contrôle des dates de fin reste à intégrer.</p>
      <details v-if="state?.policy" class="policy-options"><summary>Historique des versions</summary><p class="small text-muted">Version actuelle : {{state.policy.version}}. Les demandes enregistrées conservent leur version.</p><p v-for="v in leaveCatalog.policyVersions.filter(v=>v.id===state.policy.id)" :key="v.version" class="small">Version {{v.version}} · effet {{v.from}} · {{v.quota??'Sans limite'}} {{v.quota!=null?v.entitlementUnit:''}}</p></details>
      <p v-if="error" class="field-error" role="alert">{{error}}</p>
    </form>
    <template #footer><button class="btn btn-ghost" @click="emit('close')">Annuler</button><button class="btn btn-primary" type="submit" form="leave-policy-form">Enregistrer la politique</button></template>
  </Modal>
</template>
<style scoped>
.policy-example{background:var(--primary-soft);padding:12px;border-radius:7px;font-size:12px;line-height:1.6;margin-bottom:14px}.policy-example p{margin:6px 0}.policy-choices{display:flex;flex-wrap:wrap;gap:10px 18px;padding:8px 0}.policy-options{border-top:1px solid var(--border);padding:16px 0;margin-top:16px}summary{cursor:pointer;color:var(--primary);font-size:13px;font-weight:600}
</style>
