<script setup>
import {computed,ref,watch} from 'vue';
import {useStore} from '../../store';
import {useCompanyData} from '../../store/companyData';
import {attestations} from '../../attestations/state';
import {companySettings,saveSettings,templateErrors} from '../../attestations/model';
import Field from '../../components/ui/Field.vue';
import Switch from '../../components/ui/Switch.vue';
import DocumentCanvas from './DocumentCanvas.vue';
import {defaultDocument,documentText} from '../../attestations/layout';
const store=useStore(),data=useCompanyData();
const form=ref(null),error=ref(''),success=ref(''),target=ref('current');
const canEdit=computed(()=>store.can('modeles_documents.modifier'));
const settings=computed(()=>companySettings(attestations,store.companyId));
const signers=computed(()=>form.value.signers.filter(s=>s.active));
const signer=computed(()=>form.value.signers.find(s=>s.id===form.value.signerId));
const missing=computed(()=>templateErrors(form.value).filter(e=>e.startsWith(target.value==='current'?'Contrat en cours':'Contrat terminé')));

function reset(){form.value=JSON.parse(JSON.stringify(settings.value));if(!form.value.legalName)form.value.legalName=data.company.legalName||data.company.name;if(!form.value.documents)form.value.documents={current:defaultDocument(false),ended:defaultDocument(true)};error.value='';success.value='';}
watch(()=>store.companyId,reset,{immediate:true});
function restore(){form.value.documents[target.value]=defaultDocument(target.value==='ended');success.value='Présentation standard rétablie pour ce cas. Enregistrez pour la conserver.';}
function save(){error.value='';form.value.current=documentText(form.value.documents.current);form.value.ended=documentText(form.value.documents.ended);try{saveSettings(attestations,form.value,{companyId:store.companyId,name:`${store.currentUser.firstName} ${store.currentUser.lastName}`,can:p=>store.can(p)});reset();success.value='Modèle enregistré pour les deux situations. Les attestations déjà générées restent inchangées.';store.toast(success.value);}catch(e){error.value=e.message;}}
function addSigner(){const s={id:crypto.randomUUID(),firstName:'',lastName:'',position:'',active:true};form.value.signers.push(s);form.value.signerId=s.id;}
async function logo(event){const file=event.target.files?.[0];if(!file)return;if(!['image/png','image/jpeg'].includes(file.type)||file.size>1024*1024){error.value='Choisissez un logo PNG ou JPEG de 1 Mo maximum.';event.target.value='';return;}form.value.logo=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});}
</script>
<template><section v-if="form" class="att-settings">
  <p class="intro">Adaptez toute la feuille à votre société : coordonnées, bloc salarié, titre, texte et signature. Chaque situation possède son propre document.</p>
  <div class="situations" role="group" aria-label="Situation du contrat">
    <button class="case" :class="{chosen:target==='current'}" :aria-pressed="target==='current'" @click="target='current'"><strong>Contrat en cours</strong><span>« travaille depuis le… » · date de début</span></button>
    <button class="case" :class="{chosen:target==='ended'}" :aria-pressed="target==='ended'" @click="target='ended'"><strong>Contrat terminé</strong><span>« a travaillé du… au… » · début et fin</span></button>
  </div>
  <p class="small text-muted">Les deux textes sont enregistrés ensemble. À la génération, le bon texte est choisi selon le contrat et la date de l’attestation.</p>
  <details class="company-details"><summary>Informations de la société et du signataire</summary><div class="workspace">
    <aside class="simple-settings"><h2>Votre société et le signataire</h2>
      <fieldset :disabled="!canEdit">
        <Field v-slot="{id}" label="Nom de la société" required><input :id="id" v-model="form.legalName" maxlength="150"/></Field>
        <Field v-slot="{id}" label="Adresse de la société"><textarea :id="id" v-model="form.header" rows="3" maxlength="500" placeholder="Rue, immeuble, code postal et ville"/></Field><Field v-slot="{id}" label="Matricule fiscal"><input :id="id" v-model="form.fiscalNumber" maxlength="80"/></Field><Field v-slot="{id}" label="Fait à" required><input :id="id" v-model="form.city" maxlength="100"/></Field>
        <Field v-slot="{id}" label="Qui signe ?"><select :id="id" v-model="form.signerId"><option v-for="s in signers" :key="s.id" :value="s.id">{{s.firstName}} {{s.lastName}} · {{s.position}}</option></select></Field>
        <details class="signer-edit"><summary>Modifier les coordonnées du signataire</summary><div v-if="signer" class="detail-fields">
          <Field v-slot="{id}" label="Prénom"><input :id="id" v-model="signer.firstName" maxlength="80"/></Field>
          <Field v-slot="{id}" label="Nom"><input :id="id" v-model="signer.lastName" maxlength="80"/></Field>
          <Field v-slot="{id}" label="Fonction"><input :id="id" v-model="signer.position" maxlength="120" placeholder="Gérant, Responsable RH…"/></Field>
        </div><button class="btn btn-ghost btn-sm" @click="addSigner">Ajouter un autre signataire</button></details>
        <details><summary>Logo (facultatif)</summary><div class="detail-fields">
          
          <Field v-slot="{id}" label="Logo · PNG ou JPEG, 1 Mo maximum"><input :id="id" type="file" accept="image/png,image/jpeg" @change="logo"/></Field>
          <button v-if="form.logo" class="btn btn-ghost btn-sm" @click="form.logo=''">Retirer le logo</button>
        </div></details>
      </fieldset>
      <p class="automatic-note"><strong>Renseigné automatiquement</strong><br/>Nom et prénom du salarié, CIN et date de délivrance, fonction, dates du contrat et date de l’attestation.</p>
    </aside>
    </div></details>
    <div class="document-area">
      <div class="editor-toolbar"><span>Présentation inspirée du document fourni.</span><button v-if="canEdit" class="btn btn-ghost btn-sm" @click="restore">Rétablir la présentation standard</button></div>
      <DocumentCanvas :key="target" v-model="form.documents[target]" :disabled="!canEdit" :logo="form.logo"/>
      <p class="small text-muted">Le document imprimé reprend ces zones, leur ordre et leur mise en forme. Aucune signature ou mention supplémentaire n’est ajoutée automatiquement.</p>
      <p v-if="missing.length" class="field-error" role="alert">{{missing.join(' ')}} Utilisez « + Information automatique » pour les réinsérer.</p>
    </div>
  <p v-if="error" class="field-error" role="alert">{{error}}</p><p v-if="success" class="att-success" role="status">{{success}}</p>
  <div class="att-footer"><button class="btn btn-ghost" @click="reset">Annuler les modifications</button><button v-if="canEdit" class="btn btn-primary" @click="save">Enregistrer les deux textes</button></div>
  <details class="secondary"><summary>Autres réglages et historique</summary><fieldset :disabled="!canEdit"><Field v-slot="{id}" label="Nom du modèle (interne)"><input :id="id" v-model="form.name" maxlength="120"/></Field><Switch v-model="form.active" label="Autoriser les nouvelles attestations"/></fieldset><p class="small">Version {{settings.version}} · Signature et cachet manuels.</p><p v-for="(h,index) in settings.history" :key="index" class="small">{{new Date(h.at).toLocaleString('fr-FR')}} · {{h.actor}} · {{h.action}}</p></details>
</section></template>
<style scoped>
.att-settings{font-size:13px;line-height:1.7}.intro{max-width:850px}.situations{display:flex;gap:12px;margin:20px 0 8px}.case{flex:1;text-align:left;background:white;border:1px solid var(--border,#d8e1ec);border-radius:10px;padding:14px 18px;cursor:pointer;color:inherit}.case strong,.case span{display:block}.case span{font-size:12px;color:#64748b}.case.chosen{border:2px solid #2264bb;background:#eef5ff;padding:13px 17px}.workspace{margin-top:15px}.company-details{margin:20px 0;padding:15px;background:#f5f8fc;border:1px solid #d8e1eb;border-radius:8px}.simple-settings fieldset{grid-template-columns:repeat(3,minmax(0,1fr))}.document-area{max-width:900px;margin:auto}.simple-settings{border:1px solid var(--border,#d8e1ec);border-radius:10px;padding:18px;background:white}.simple-settings h2{font-size:15px;margin:0 0 16px}fieldset{border:0;padding:0;min-width:0}.simple-settings fieldset{display:grid;gap:16px}.detail-fields{display:grid;gap:12px;padding:12px 0}.automatic-note{background:#f1f6fc;padding:12px;border-radius:8px;margin-top:22px;color:#50627a;font-size:12px}.editor-toolbar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;color:#64748b;font-size:12px;margin-bottom:10px}.editor-toolbar>div{display:flex;gap:5px}.insert-options{display:flex;flex-wrap:wrap;gap:5px;padding:12px;background:#edf5ff;border-radius:8px;margin-bottom:12px}.document-sheet{background:white;border:1px solid #d8e1eb;box-shadow:0 3px 14px #17375d0d;padding:40px;min-height:750px;color:#203147;font:14px/2 Arial,sans-serif}.document-sheet header{white-space:pre-wrap;min-height:75px;overflow-wrap:anywhere}.document-sheet header strong{font-size:18px}.document-sheet header img{float:right;max-height:65px;max-width:110px}.document-title{width:100%;text-align:center;font-size:20px!important;font-weight:700;border:1px dashed transparent!important;background:transparent!important;box-shadow:none!important;margin:24px 0 30px;padding:8px!important;color:inherit}.document-title:hover,.document-title:focus{border-color:#86a8d3!important}.document-text{white-space:pre-wrap;overflow-wrap:anywhere;outline:0;min-height:200px;border:1px dashed #b7c9dd;padding:12px;border-radius:5px}.document-text:focus{border-color:#2264bb;box-shadow:0 0 0 2px #2264bb15}.document-text :deep(.auto-value){display:inline;background:#edf5ff;color:#1e5da8;border:1px solid #cbdff5;border-radius:4px;padding:2px 4px;font-size:12px;white-space:normal;box-decoration-break:clone}.signature{margin-top:45px}.signature p{color:#64748b}.att-footer{display:flex;justify-content:flex-end;gap:10px;margin:24px 0}.att-success{color:#137a70}summary{cursor:pointer;color:var(--primary,#2264bb)}.secondary{border-top:1px solid #d8e1eb;padding-top:15px}.secondary fieldset{display:grid;gap:12px;max-width:400px;margin-top:15px}@media(max-width:1050px){.workspace{grid-template-columns:1fr}.simple-settings fieldset{grid-template-columns:repeat(2,minmax(0,1fr))}.document-sheet{max-width:794px;margin:auto}}@media(max-width:600px){.situations{flex-direction:column}.simple-settings fieldset{grid-template-columns:1fr}.document-sheet{padding:24px 18px}.att-footer{flex-wrap:wrap}}
</style>
