// Un document est une suite de blocs éditables ; aucun HTML utilisateur n'est stocké.
export function defaultDocument(ended=false){return [
 {text:'{{lieu}}, le {{date_attestation}}',size:10,align:'left',gap:12},
 {text:'{{societe}}\n{{adresse_societe}}',size:11,bold:true,align:'left',gap:0},
 {text:'{{employe_prenom}} {{employe_nom}}\nCIN : {{cin}}\nDélivrée le : {{cin_delivree_le}}',size:11,bold:true,align:'right',gap:24},
 {text:'ATTESTATION DE TRAVAIL',size:18,bold:true,align:'center',shade:true,gap:42},
 {text:'Je soussigné(e) {{signataire_prenom}} {{signataire_nom}}, {{signataire_fonction}} de la société {{societe}} (matricule fiscal : {{matricule_fiscal}}), dont le siège social se situe à {{adresse_societe}}.\n\nCertifie que {{civilite}} {{employe_prenom}} {{employe_nom}}, titulaire de la carte d’identité nationale numéro {{cin}}, délivrée le {{cin_delivree_le}}, '+(ended?'a travaillé au sein de notre société en qualité de {{employe_fonction}} du {{contrat_debut}} au {{contrat_fin}}.':'travaille au sein de notre société en qualité de {{employe_fonction}} depuis le {{contrat_debut}}.')+'\n\nFait pour servir et valoir ce que de droit.',size:11,align:'left',gap:56},
 {text:'{{signataire_prenom}} {{signataire_nom}}\n{{signataire_fonction}}\nSignature et cachet',size:11,align:'left',gap:0},
 {text:'{{lieu}}, le {{date_attestation}}',size:10,align:'right',gap:0},
];}
export const documentText=blocks=>blocks.map(b=>b.text).join('\n\n');
export function validBlocks(blocks){return Array.isArray(blocks)&&blocks.length>0&&blocks.length<=40&&blocks.every(b=>typeof b.text==='string'&&['left','center','right','justify'].includes(b.align)&&[10,11,12,14,16,18,20,24].includes(Number(b.size))&&Number(b.gap)>=0&&Number(b.gap)<=100);}
