<script setup>
import {computed,ref,watch} from 'vue';
import {useStore} from '../../store';
import {useSettingsRights} from './settingsRights';
import {companyModules,companyModuleState,numberOptions} from '../../maquette/companyModules';
import {MODULES,saveModules,moduleEnabled} from '../../maquette/companyModulesModel';
import {leaveCatalog} from '../../maquette/leaveCatalog';
import Switch from '../../components/ui/Switch.vue';
import Badge from '../../components/ui/Badge.vue';
import Modal from '../../components/ui/Modal.vue';
const store=useStore(),{canEdit}=useSettingsRights();
const saved=computed(()=>companyModuleState(store.companyId));
const draft=ref({}),review=ref(false),requiredNumber=ref(false);
const savedNumber=computed(()=>numberOptions(store.companyId));
function reset(){draft.value={...saved.value.values};requiredNumber.value=savedNumber.value.required;review.value=false;}
watch(()=>store.companyId,reset,{immediate:true});
const changes=computed(()=>MODULES.filter(m=>draft.value[m.id]!==saved.value.values[m.id]));
const changedCount=computed(()=>changes.value.length+Number(requiredNumber.value!==savedNumber.value.required));
const disabled=computed(()=>changes.value.filter(m=>!draft.value[m.id]));
const pending=computed(()=>[...store.db.requests.filter(r=>r.companyId===store.companyId&&r.status==='en_attente'),...leaveCatalog.requests.filter(r=>r.status==='À vérifier')].length);
function save(){if(!canEdit.value)return;const actor=`${store.currentUser.firstName||'RH'} ${store.currentUser.lastName||''}`.trim();saveModules(companyModules,store.companyId,draft.value,actor);if(requiredNumber.value!==savedNumber.value.required){savedNumber.value.required=requiredNumber.value;companyModuleState(store.companyId).history.unshift({at:new Date().toISOString(),actor,changes:[{name:'N° interne obligatoire',enabled:requiredNumber.value}]});}reset();store.toast('Modules de la société enregistrés. Les permissions et les données sont conservées.');}
function requestSave(){if(!changedCount.value||!canEdit.value)return;if(disabled.value.length)review.value=true;else save();}
</script>
<template>
  <div class="modules-page">
    <div class="module-intro"><h2>Choisir les modules utilisés par la société</h2><p>Ces réglages concernent toute la société. Les rôles et permissions déterminent ensuite qui peut consulter ou modifier.</p><a href="/parametres/roles">Gérer les rôles et permissions</a></div>
    <div class="module-list">
      <section v-for="m in MODULES" :key="m.id"  :class="['module-row',{'module-child':m.dependsOn}]"><div><h3>{{m.name}} <Badge v-if="m.fixed" tone="neutral">Socle obligatoire</Badge><Badge v-else-if="!m.available" tone="neutral">À venir</Badge></h3><p>{{m.description}}</p><label v-if="m.id==='numero-interne'&&draft[m.id]" class="check internal-number-required"><input v-model="requiredNumber" type="checkbox" :disabled="!canEdit"/>Champ obligatoire dans la fiche employé</label><span v-if="!m.dependsOn" class="module-area">{{m.areas}}</span><p v-if="m.dependsOn&&!draft[m.dependsOn]" class="small text-muted">Indisponible tant que {{MODULES.find(x=>x.id===m.dependsOn)?.name}} est désactivé. Votre choix est conservé.</p><a v-if="m.configure&&moduleEnabled(saved.values,m.id)" :href="m.configure" class="module-configure">Configurer</a></div><div class="module-control"><Switch v-if="m.available" v-model="draft[m.id]" :label="m.dependsOn&&!draft[m.dependsOn]?'Indisponible':draft[m.id]?'Activé':'Désactivé'" :disabled="m.fixed||!canEdit||!!(m.dependsOn&&!draft[m.dependsOn])" /><span v-else class="small text-muted">Indisponible dans cette version</span></div></section>
    </div>
    <p class="module-note">La désactivation masque les accès et conserve les données. Une adresse directe affiche un message d’indisponibilité. Cette maquette réinitialise ses réglages au rechargement.</p>
    <div class="module-footer"><span class="small text-muted">{{changedCount?`${changedCount} modification(s) non enregistrée(s)`:'Aucune modification en attente'}}</span><button class="btn btn-ghost" :disabled="!changedCount" @click="reset">Annuler</button><button v-if="canEdit" class="btn btn-primary" :disabled="!changedCount" @click="requestSave">Enregistrer</button></div>
    <details class="module-history"><summary>Historique des modifications</summary><p v-if="!saved.history.length" class="small text-muted">Aucune modification enregistrée pendant cette session.</p><article v-for="h in saved.history" :key="h.at"><strong>{{h.actor}}</strong><span class="small text-muted"> · {{new Date(h.at).toLocaleString('fr-FR')}}</span><p v-for="c in h.changes" :key="c.name">{{c.name}} : {{c.enabled?'activé':'désactivé'}}</p></article></details>
    <Modal :open="review" title="Confirmer la désactivation des modules" @close="review=false"><p>Les fonctionnalités suivantes seront désactivées pour cette société :</p><ul><li v-for="m in disabled" :key="m.id"><strong>{{m.name}}</strong> : {{m.areas}}</li></ul><p>Les données, les documents, l’historique et les permissions restent conservés. Une réactivation rétablit les accès selon les droits de chaque utilisateur.</p><p v-if="disabled.some(m=>m.id==='conges')" class="module-note">{{pending}} demande(s) fictive(s) en attente ou à vérifier. Leur traitement sera indisponible jusqu’à la réactivation. Le calendrier des absences dépend aussi de ce module.</p><template #footer><button class="btn btn-ghost" @click="review=false">Revenir aux choix</button><button class="btn btn-primary" @click="save">Confirmer et enregistrer</button></template></Modal>
  </div>
</template>
<style scoped>
.internal-number-required{font-size:12px;margin:12px 0 0}.module-intro{margin-bottom:22px;font-size:13px;line-height:1.7}.module-intro h2{font-size:17px;margin:0 0 8px}.module-intro p{color:var(--muted);margin:0 0 8px}.module-list{border:1px solid var(--border);border-radius:9px;overflow:hidden}.module-row{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:20px;border-bottom:1px solid var(--border)}.module-row:last-child{border:0}.module-row h3{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:14px;margin:0 0 8px}.module-row p{font-size:12px;line-height:1.6;margin:0 0 7px;color:var(--muted);max-width:640px}.module-area{font-size:11px;color:var(--muted)}.module-child{padding-left:44px;background:var(--surface-2,#fafcff)}.module-configure{display:block;width:max-content;margin-top:8px;font-size:12px}.module-control{min-width:150px}.module-note{padding:14px;background:var(--primary-soft);border-radius:7px;font-size:12px;line-height:1.7;margin:18px 0}.module-footer{display:flex;justify-content:flex-end;align-items:center;gap:10px}.module-footer>span{margin-right:auto}.module-history{margin-top:26px;font-size:12px}.module-history summary{cursor:pointer;color:var(--primary);font-weight:600}.module-history article{border-bottom:1px solid var(--border);padding:14px 0}.module-history p{margin:6px 0}@media(max-width:650px){.module-row{align-items:flex-start;flex-direction:column}.module-footer{flex-wrap:wrap}}
</style>

