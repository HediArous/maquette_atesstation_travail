// Sous-sections des paramètres (affichées dans la sous-navigation du shell) ; `description` = sous-titre de l'en-tête.
import {
  BadgePercent, Briefcase, Building2, CalendarCheck, CalendarOff, Clock, FilePen, FileText, Flag, GitBranch, Globe, IdCard, ListChecks, ShieldCheck,Banknote 
} from '@lucide/vue';

export const SETTINGS_NAV = [
  { id: 'modules-societe', group: 'Administration', label: 'Modules de la société', icon: Building2, description: 'Modules utilisés par la société, indépendamment des rôles et permissions.' },
  { id: 'numerotation', group: 'Numérotation', label: 'Numéro de souche', icon: IdCard, description: 'Format des matricules et des codes attribués automatiquement à la création.' },
  { id: 'devises', group: 'Organisation', label: 'Devises', icon: Banknote, description: 'Gestion des devises et du format d’affichage des montants.' },
  { id: 'pays', group: 'Organisation', label: 'Pays et téléphone', icon: Globe, description: 'Indicatifs et longueur des numéros de téléphone.' },
  { id: 'fonctions', group: 'Organisation', label: 'Fonctions', icon: Briefcase, description: 'Postes occupés dans la société et règles d’intérim.' },
  { id: 'statuts-employe', group: 'Organisation', label: 'Statuts des employés', icon: Flag, description: 'Statuts proposés dans les dossiers des employés.' },
  { id: 'departements', group: 'Organisation', label: 'Départements', icon: Building2, description: 'Arborescence de la société, responsables et horaire organisationnel.' },
  { id: 'horaires', group: 'Temps et congés', label: 'Scénarios d’horaires', icon: Clock, description: 'Scénarios d’horaires affectés aux départements.' },
  { id: 'circuits', group: 'Accès et validation', label: 'Circuits d’approbation', icon: GitBranch, description: 'Étapes de validation des demandes, par département.' },
  { id: 'jours-feries', group: 'Temps et congés', label: 'Jours fériés', icon: CalendarOff, description: 'Calendrier de la société utilisé selon les règles de décompte des politiques.' },
  { id: 'types-contrat', group: 'Organisation', label: 'Types de contrat', icon: FilePen, description: 'Types proposés dans le parcours contractuel des employés.' },
  { id: 'primes', group: 'Organisation', label: 'Catalogue des primes', icon: BadgePercent, description: 'Primes attribuables aux employés autorisés.' },
  { id: 'modeles-documents', group: 'Documents RH', label: 'Modèles de documents', icon: FileText, description: 'Texte des attestations, présentation et signataires propres à la société.' },
  { id: 'types-document', group: 'Organisation', label: 'Types de documents', icon: FileText, description: 'Classement des pièces du dossier employé.' },
  { id: 'types-conge', group: 'Temps et congés', label: 'Types de congés', icon: CalendarCheck, description: 'Définition des absences, unités de demande et politiques associées.' },
  { id: 'politiques-conges', group: 'Temps et congés', label: 'Politiques de congés', icon: ListChecks, description: 'Droits et conditions ; horaires, jours fériés et circuits existants sont réutilisés.' },
  // { id: 'regles', group: 'Temps et congés', label: 'Règles et quotas', icon: ListChecks, description: 'Quotas annuels, reports et règles de présence.' },
  { id: 'roles', group: 'Accès et validation', label: 'Rôles et permissions', icon: ShieldCheck, description: 'Rôles RH et permissions associées.' },

];
