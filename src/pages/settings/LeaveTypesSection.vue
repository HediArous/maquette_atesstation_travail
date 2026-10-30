<script setup>
import { computed, reactive, ref, watch } from 'vue';
import {useRoute} from 'vue-router';
import {isLeaveFeatureEnabled} from '../../maquette/companyModules';
import { Archive, ArchiveRestore, ArrowLeft, Copy, Eye, Pencil, Plus, Search } from '@lucide/vue';
import { useStore } from '../../store';
import { useSettingsRights } from './settingsRights';
import { leaveCatalog as db } from '../../maquette/leaveCatalog';
import { archiveType, EXTRA_FIELDS, FAMILIES, MODES, saveType, usedType } from '../../maquette/leaveCatalogModel';
import { formatDate } from '../../utils/dates';
import Field from '../../components/ui/Field.vue';
import Badge from '../../components/ui/Badge.vue';
import LeavePolicyEditor from './LeavePolicyEditor.vue';

const store = useStore();
const route=useRoute();
const { canCreate, canEdit, canArchive } = useSettingsRights();
const query=ref(''), family=ref(''), showArchived=ref(false), editing=ref(false), originalId=ref(null), readonly=ref(false), tab=ref('general'), errors=ref({}), policyEditor=ref(null);
const f=reactive({});
const tabs=[{id:'general',label:'Général'},{id:'demande',label:'Demande et traitement'},{id:'politiques',label:'Politiques et paramètres hérités'},{id:'historique',label:'Utilisation et historique'}];
const rows=computed(()=>db.types.filter(t=>t.companyId===store.companyId&&(showArchived.value||!t.archived)&&(!family.value||family.value===t.family)&&`${t.name} ${t.code}`.toLocaleLowerCase('fr').includes(query.value.toLocaleLowerCase('fr'))));
const policies=computed(()=>db.policies.filter(p=>p.typeId===originalId.value));
const requests=computed(()=>db.requests.filter(r=>r.typeId===originalId.value));
const history=computed(()=>db.history.filter(h=>h.typeId===originalId.value));
const used=computed(()=>usedType(db,originalId.value));
const actor=()=>`${store.currentUser.firstName||'RH'} ${store.currentUser.lastName||''}`.trim();
function open(type=null,mode='edit'){
  Object.keys(f).forEach(k=>delete f[k]);
  Object.assign(f,JSON.parse(JSON.stringify(type||{code:'',name:'',family:'Repos',color:'#0b62c4',description:'',instruction:'',unit:'jours',halfday:true,shape:'Période continue',mode:MODES[0],extraFields:[],archived:false})));
  originalId.value=mode==='duplicate'?null:type?.id||null;
  if(mode==='duplicate'){f.code='';f.name=`${type.name} — copie`;f.archived=false;delete f.id;}
  readonly.value=mode==='read'||type?.archived===true&&mode!=='duplicate';
  editing.value=true;tab.value='general';errors.value={};
}
function save(){
  if(readonly.value||!(originalId.value?canEdit.value:canCreate.value))return;
  if(!f.code) { let n=1; while(db.types.some(t=>t.code===`CG${n}`))n++; f.code=`CG${n}`; }
  const result=saveType(db,f,originalId.value,actor());
  if(result.errors){errors.value=result.errors;tab.value=result.errors.code||result.errors.name||result.errors.family||result.errors.color?'general':'demande';return;}
  errors.value={};originalId.value=result.item.id;Object.assign(f,JSON.parse(JSON.stringify(result.item)));
  store.toast(`Type « ${result.item.name} » enregistré. Les droits sont définis dans les politiques associées.`);tab.value='politiques';
}
function toggle(type){if(!canArchive.value)return;archiveType(db,type.id,!type.archived,actor());store.toast(type.archived?'Type archivé ; historique conservé.':'Type réactivé ; utilisation soumise à une politique valide.');}
function unitChanged(){if(f.unit==='minutes'){f.halfday=false;f.shape='Créneau horaire';}else f.shape='Période continue';}
watch(()=>route.query.type,id=>{const t=db.types.find(t=>t.id===id);if(t)open(t);},{immediate:true});
const policyStatus=status=>({active:'Active',draft:'Brouillon',closed:'Clôturée'}[status]);
const population=p=>p.scope==='all'?'Tous les employés':p.scope==='departments'?p.departmentIds.map(id=>store.db.departments.find(d=>d.id===id)?.name||id).join(', '):p.employeeIds.length+' employé(s)';
</script>
<template>
  <div class="leave-types">
    <template v-if="!editing">
      <div class="lt-heading"><div><h2>Catalogue des types de congés</h2><p class="small text-muted">Le type décrit l’absence. Les politiques définissent les droits et conditions.</p></div><button v-if="canCreate" class="btn btn-primary" @click="open()"><Plus :size="15" />Ajouter un type</button></div>
      <div class="lt-toolbar"><label class="lt-search"><Search :size="16" /><input v-model="query" placeholder="Code ou libellé…" aria-label="Rechercher un type de congé" /></label><label class="check"><input v-model="showArchived" type="checkbox" />Afficher les archivés</label></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Type de congé</th><th>Unité</th><th>Politiques</th><th>État</th><th>Actions</th></tr></thead><tbody><tr v-for="type in rows" :key="type.id" :class="{'row-archived':type.archived}"><td><div class="type-tag"><span class="type-dot" :style="{background:type.color}" /><strong>{{type.name}}</strong></div><span class="lt-code">{{type.code}}</span></td><td>{{type.unit==='jours'?'Jours':'Heures / minutes'}}</td><td><button class="btn btn-ghost btn-sm" @click="open(type,'read');tab='politiques'">{{db.policies.filter(p=>p.typeId===type.id).length||'À configurer'}}</button></td><td><Badge :tone="type.archived?'neutral':'success'">{{!isLeaveFeatureEnabled(store.companyId,type)?'Désactivé pour la société':type.archived?'Archivé':'Actif'}}</Badge></td><td><div class="lt-actions"><button class="btn btn-ghost btn-sm" :aria-label="`Consulter ${type.name}`" @click="open(type,'read')"><Eye :size="14" /><span>Consulter</span></button><button v-if="canEdit&&!type.archived" class="btn btn-ghost btn-sm" :aria-label="`Modifier ${type.name}`" @click="open(type)"><Pencil :size="13" /><span>Modifier</span></button><button v-if="canCreate" class="btn btn-ghost btn-sm" :aria-label="`Dupliquer ${type.name}`" @click="open(type,'duplicate')"><Copy :size="13" /><span>Dupliquer</span></button><button v-if="canArchive" class="btn btn-ghost btn-sm" :aria-label="`${type.archived?'Réactiver':'Archiver'} ${type.name}`" @click="toggle(type)"><component :is="type.archived?ArchiveRestore:Archive" :size="13" /><span>{{type.archived?'Réactiver':'Archiver'}}</span></button></div></td></tr><tr v-if="!rows.length"><td colspan="5" class="lt-empty">Aucun type ne correspond à vos filtres.</td></tr></tbody></table></div>
      <p class="lt-footer">{{rows.length}} type(s) · Un type actif sans politique applicable n’est pas utilisable pour une nouvelle demande.</p>
      <div class="lt-info">Horaires, jours fériés et circuits sont réutilisés depuis les paramètres existants. Aucun de ces référentiels n’est recopié dans les types.</div>
    </template>
    <template v-else>
      <button class="back-link" @click="editing=false"><ArrowLeft :size="15" />Retour aux types de congés</button>
      <div class="lt-heading mt-16"><div><h2>{{originalId?`${readonly?'Consulter':'Modifier'} « ${f.name} »`:'Nouveau type de congé'}}</h2><p class="small text-muted">{{originalId?f.code:'Définition du type, sans quota ni choix d’approbateur.'}}</p></div><Badge v-if="originalId" :tone="f.archived?'neutral':'success'">{{f.archived?'Archivé':'Actif'}}</Badge></div>
      <p v-if="!isLeaveFeatureEnabled(store.companyId,f)" class="lt-info">Fonctionnalité désactivée pour la société : paramétrage et historique conservés, nouvelles demandes indisponibles.</p><form id="leave-type-form" @submit.prevent="save">
        <p class="small text-muted">Définissez l’absence. Les bénéficiaires et les droits se règlent dans les politiques.</p>
        <div class="form-grid mt-16">
          <Field v-slot="{id}" label="Libellé" required :error="errors.name" class="span-2" hint="Nom affiché aux employés."><input :id="id" v-model="f.name" :disabled="readonly" required /></Field>
          <Field v-slot="{id}" label="Unité" hint="Détermine les champs de la demande."><select :id="id" v-model="f.unit" :disabled="readonly||used||policies.length>0" @change="unitChanged"><option value="jours">Jours</option><option value="minutes">Heures / minutes</option></select></Field>
          <Field v-slot="{id}" label="Couleur du calendrier"><input :id="id" v-model="f.color" type="color" :disabled="readonly" /></Field>
          <label v-if="f.unit==='jours'" class="check span-2"><input v-model="f.halfday" type="checkbox" :disabled="readonly||used" />Autoriser les demi-journées <span class="small text-muted">(matin ou après-midi)</span></label>
          <label class="check span-2"><input v-model="f.archived" type="checkbox" :true-value="false" :false-value="true" :disabled="readonly" />Type actif</label>
        </div>
        <p v-if="used" class="small text-muted mt-12">Type déjà utilisé : l’unité et les demi-journées sont protégées. Dupliquez-le pour changer ce fonctionnement.</p>
        <details class="lt-panel"><summary>Plus d’options</summary><div class="form-grid mt-12">
          <Field v-slot="{id}" label="Code" :error="errors.code" hint="Généré automatiquement si vous laissez ce champ vide."><input :id="id" v-model="f.code" :disabled="readonly||used" /></Field>
          <Field v-slot="{id}" label="Description"><textarea :id="id" v-model="f.description" :disabled="readonly" rows="2" /></Field>
        </div></details>
        <p v-if="Object.keys(errors).length" class="field-error" role="alert">{{Object.values(errors).join(' ')}}</p>
        <div class="lt-form-footer"><button type="button" class="btn btn-ghost" @click="editing=false">{{readonly?'Fermer':'Annuler'}}</button><button v-if="!readonly" class="btn btn-primary" type="submit">Enregistrer le type</button></div>
      </form>
      <section v-if="originalId" class="lt-info"><div class="lt-heading"><div><h3>Politiques associées : {{policies.length}}</h3><p class="small text-muted">Définissez les bénéficiaires et les droits de ce type.</p></div><button v-if="canEdit&&!f.archived" class="btn btn-primary btn-sm" @click="policyEditor={typeId:originalId}">Ajouter une politique</button></div>
        <p v-if="!policies.length">À configurer : aucune politique associée.</p><p v-for="p in policies" :key="p.id"><button class="btn btn-ghost btn-sm" @click="policyEditor={typeId:originalId,policy:p}">{{p.name}}</button> · {{policyStatus(p.status)}}</p>
        <a href="/parametres/politiques-conges">Voir les politiques de congés</a>
      </section>
      <details v-if="originalId" class="lt-panel"><summary>Historique · {{requests.length}} demande(s) d’exemple</summary><ul class="lt-history"><li v-for="h in history" :key="h.id"><strong>{{h.action}}</strong><p>{{h.detail}}</p></li></ul></details>
    </template>
    <LeavePolicyEditor :state="policyEditor" @close="policyEditor=null" />
  </div>
</template>
<style scoped>
.lt-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;margin:0 0 18px;flex-wrap:wrap}.lt-heading h2{font-size:17px;margin:0 0 6px}.lt-heading h3,.lt-panel h3{font-size:14px;margin:0 0 6px}.lt-toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:16px}.lt-search{display:flex;gap:8px;align-items:center;flex:1;min-width:180px}.lt-search input{width:100%;max-width:330px;padding:8px 10px;border:1px solid var(--border);border-radius:6px}.lt-toolbar select{padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)}.lt-actions{display:grid;grid-template-columns:repeat(2,max-content);gap:4px}.lt-code{display:block;font-size:11px;color:var(--muted);margin-top:5px;max-width:280px}.lt-footer{font-size:12px;color:var(--muted);margin:15px 0}.lt-info{background:var(--primary-soft);padding:13px 15px;border-radius:7px;font-size:12px;line-height:1.7;margin:16px 0}.lt-empty{text-align:center;padding:35px}.lt-panel{padding:20px 0}.lt-checks{display:flex;gap:12px 20px;flex-wrap:wrap;padding:10px 0}.lt-label{font-size:12px;font-weight:600}.lt-reference-links{display:flex;flex-wrap:wrap;gap:18px;margin-top:20px;font-size:12px}.lt-form-footer{display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--border);padding-top:18px}.lt-history{margin:14px 0;padding:0;list-style:none}.lt-history li{padding:12px 0;border-bottom:1px solid var(--border);font-size:12px}.lt-history li>div{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}.lt-history p{margin:6px 0 0;color:var(--text-2)}
@media(max-width:1100px){.lt-actions span{display:none}.lt-actions .btn{padding:6px}.lt-actions{grid-template-columns:repeat(2,28px)}}
summary{cursor:pointer;color:var(--primary);font-size:13px;font-weight:600}
</style>

