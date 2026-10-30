<script setup>
import { computed, ref } from 'vue';
import { Plus } from '@lucide/vue';
import { leaveCatalog as db } from '../../maquette/leaveCatalog';
import { useSettingsRights } from './settingsRights';
import { useStore } from '../../store';
import { formatDate } from '../../utils/dates';
import Field from '../../components/ui/Field.vue';
import Badge from '../../components/ui/Badge.vue';
import Modal from '../../components/ui/Modal.vue';
import LeavePolicyEditor from './LeavePolicyEditor.vue';
const store=useStore(), {canCreate,canEdit}=useSettingsRights();
const typeFilter=ref(''), editor=ref(null), choose=ref(false), chosenType=ref('ca');
const rows=computed(()=>db.policies.filter(p=>!typeFilter.value||p.typeId===typeFilter.value));
const typeName=id=>db.types.find(t=>t.id===id)?.name||id;
</script>
<template>
  <div>
    <div class="pol-heading"><p class="small text-muted">Exemples tunisiens : modèles légaux à vérifier et configurations internes à adapter. Les nouveaux modèles sont en brouillon.</p><button v-if="canCreate" class="btn btn-primary" @click="editor={typeId:db.types.find(t=>!t.archived)?.id}"><Plus :size="15" />Nouvelle politique</button></div>
    <div class="pol-filter"><Field v-slot="{id}" label="Type de congé"><select :id="id" v-model="typeFilter"><option value="">Tous les types</option><option v-for="t in db.types" :key="t.id" :value="t.id">{{t.name}}</option></select></Field></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Politique</th><th>Type</th><th>Population</th><th>Droit</th><th>État</th><th>Action</th></tr></thead><tbody><tr v-for="p in rows" :key="p.id"><td>{{p.name}}<span class="pol-reference">{{p.reference}}</span></td><td>{{typeName(p.typeId)}}</td><td>{{p.scope==='all'?'Tous les employés':p.scope==='employees'?p.employeeIds.length+' employé(s)':p.departmentIds.map(id=>store.db.departments.find(d=>d.id===id)?.name||id).join(', ')}}</td><td>{{p.quota==null?'Sans limite chiffrée':`${p.displayUnit==='heures'?p.quota/60:p.quota} ${p.displayUnit==='heures'?'heures':p.entitlementUnit}`}}<span v-if="p.quota!=null" class="pol-reference">{{p.limitPeriod==='event'||p.accrual==='Par événement'?'Par événement':p.limitPeriod==='month'||!p.limitPeriod&&p.accrual==='Mensuelle'?'Par mois':'Par an'}}</span></td><td><Badge :tone="p.status==='active'?'success':'neutral'">{{ ({active:'Active',draft:'Brouillon',closed:'Clôturée'})[p.status] }}</Badge></td><td><button v-if="canEdit&&!db.types.find(t=>t.id===p.typeId)?.archived" class="btn btn-ghost btn-sm" @click="editor={typeId:p.typeId,policy:p}">Consulter / modifier</button></td></tr><tr v-if="!rows.length"><td colspan="6">Aucune politique pour ce type.</td></tr></tbody></table></div>
    <div class="pol-inherit"><strong>Référentiels existants, sans duplication</strong><p>Horaire : celui applicable à l’employé à chaque date. Jours fériés : calendrier de la société. Circuit : hérité du rattachement, sans sélection indépendante.</p><div><a href="/parametres/horaires">Voir les horaires</a><a href="/parametres/circuits">Voir les circuits</a><a href="/parametres/jours-feries">Voir les jours fériés</a></div></div>
    <Modal :open="choose" title="Choisir le type de congé" @close="choose=false"><Field v-slot="{id}" label="Type actif"><select :id="id" v-model="chosenType"><option v-for="t in db.types.filter(t=>!t.archived)" :key="t.id" :value="t.id">{{t.name}}</option></select></Field><template #footer><button class="btn btn-ghost" @click="choose=false">Annuler</button><button class="btn btn-primary" @click="choose=false;editor={typeId:chosenType}">Continuer</button></template></Modal>
    <LeavePolicyEditor :state="editor" @close="editor=null" />
  </div>
</template>
<style scoped>
.pol-heading{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:18px}.pol-filter{max-width:300px;margin-bottom:18px}.pol-reference{display:block;font-size:11px;color:var(--muted);margin-top:4px;max-width:280px}.pol-inherit{background:var(--primary-soft);border-radius:7px;padding:16px;margin-top:20px;font-size:12px;line-height:1.7}.pol-inherit p{margin:8px 0}.pol-inherit>div{display:flex;gap:18px;flex-wrap:wrap}
</style>
