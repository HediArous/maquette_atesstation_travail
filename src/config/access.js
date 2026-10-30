// Permissions requises par rubrique, section des paramètres et onglet de la fiche employé : l'interface masque ce que
// l'utilisateur connecté ne peut pas faire (le backend refuse de toute façon avec 403). Une entrée absente est ouverte à
// tous ; un tableau signifie « l'une de ces permissions suffit ».
// Clés : catalogue du backend (Permissions.java).

/** Rubriques de la navigation latérale (id de SIDEBAR, puis `rubrique/sous-section` pour les sous-sections). */
export const NAV_PERMISSIONS = {
  'documents-rh': 'attestations.traiter',
  'mes-documents': ['attestations.demander', 'attestations.voir_soi'],
  employes: 'employes.consulter',
  contrats: 'contrats.consulter',
  salaires: 'salaires.consulter',
  conges: ['conges.demander', 'conges.voir_equipe', 'conges.voir_tous', 'conges.approuver'],
  'conges/demandes': ['conges.demander', 'conges.voir_equipe', 'conges.voir_tous', 'conges.approuver'],
  'conges/soldes': ['conges.voir_tous', 'soldes.ajuster'],
  calendrier: ['calendrier.equipe', 'calendrier.societe'],
  chargement: ['chargement.consulter', 'chargement.affecter'],
};

/**
 * Ressource du catalogue de chaque section des paramètres (id de SETTINGS_NAV) : la section s'affiche avec
 * « ressource.consulter » ; ajouter, modifier et archiver demandent « .creer », « .modifier » et « .archiver ».
 */
export const SETTINGS_RESOURCES = {
  'modeles-documents': 'modeles_documents',
  'modules-societe': 'modules_societe',
  numerotation: 'numerotation',
  devises: 'devises',
  pays: 'pays',
  fonctions: 'fonctions',
  'statuts-employe': 'statuts_employe',
  departements: 'departements',
  horaires: 'horaires',
  circuits: 'circuits',
  'jours-feries': 'jours_feries',
  'types-contrat': 'types_contrat',
  primes: 'primes_catalogue',
  'types-document': 'types_document',
  roles: 'roles',
  // Module congés pas encore développé : sections masquées, aucune permission au catalogue.
  'types-conge': 'types_conge',
  'politiques-conges': 'politiques_conges',
  regles: 'regles',
};

/** Sections des paramètres : visibles avec la permission de consultation de leur ressource. */
export const SETTINGS_PERMISSIONS = Object.fromEntries(Object.entries(SETTINGS_RESOURCES).map(([id, res]) => [id, `${res}.consulter`]));

/** Onglets de la fiche employé. */
export const EMPLOYEE_TAB_PERMISSIONS = {
  contrats: 'contrats.consulter',
  remuneration: ['salaires.consulter', 'primes.consulter'],
  acces: 'acces.consulter',
  documents: 'documents.consulter',
};

/** Permission(s) requise(s) pour une route `/<rubrique>/<sous-section>` (une fiche, `employes/<id>`, suit sa rubrique). */
export function requiredForRoute(section, sub) {
  if (section === 'parametres') return SETTINGS_PERMISSIONS[sub];
  return NAV_PERMISSIONS[`${section}/${sub}`] ?? NAV_PERMISSIONS[section];
}

/** `required` satisfaite par `can` (clé, tableau « l'une de », ou rien = ouvert). */
export const allows = (can, required) => !required || (Array.isArray(required) ? required.some(can) : can(required));

