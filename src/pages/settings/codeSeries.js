// Séries de codes déduits du nom (Paramètres › Numéro de souche) : le backend attribue le code à la création
// (préfixe + premières lettres du nom, suivi de 2, 3… s'il est déjà pris) ; il ne change plus ensuite.
import { BadgePercent, Briefcase, Building2, FileText } from '@lucide/vue';
import { nameCode } from '../../utils/org';

const codesOf = (list) => new Set(list.map((x) => (x.code ?? '').trim().toUpperCase()).filter(Boolean));

/** Série → présentation et codes déjà attribués (l'aperçu ajoute un numéro comme le fera le backend). */
export const CODE_SERIES = {
  departement: {
    label: 'Départements', item: 'code de département', icon: Building2, prefixHint: 'Ex. : DEP.',
    samples: ['Financier', 'Marketing digital', 'Logistique'], taken: (db) => codesOf(db.departments),
  },
  fonction: {
    label: 'Fonctions', item: 'code de fonction', icon: Briefcase, prefixHint: 'Ex. : FCT.',
    samples: ['Financier', 'Comptable', 'Chef de projet'], taken: (db) => codesOf(db.functions),
  },
  prime: {
    label: 'Primes', item: 'code de prime', icon: BadgePercent, prefixHint: 'Ex. : PRI.',
    samples: ['Transport', 'Rendement', 'Panier'], taken: (db) => codesOf(db.primes),
  },
  type_document: {
    label: 'Types de documents', item: 'code de type de document', icon: FileText, prefixHint: 'Ex. : DOC.',
    samples: ['Carte d’identité', 'Diplôme', 'Contrat de travail'], taken: (db) => codesOf(db.documentTypes),
  },
};

/**
 * Types de contrat (sans souche), comme CodeNumberingService.plainCodeForName : un seul mot → ses 3 premières lettres
 * (« Stage » → STA) ; plusieurs mots → l'initiale de chacun (« Contrat à durée déterminée » → CADD). Suivi de 2, 3… si déjà pris.
 */
export function previewContractTypeCode(store, name) {
  const words = (name ?? '').trim().split(/\s+/).map((w) => nameCode({ prefix: '', separator: '', letters: 1 }, w)).filter(Boolean);
  const letters = words.length > 1 ? words.join('') : name?.trim() ?? '';
  return letters ? nameCode({ prefix: '', separator: '', letters: words.length > 1 ? letters.length : 3 }, letters, codesOf(store.db.contractTypes)) : '';
}

/** Aperçu du code qu'attribuera le backend à une nouvelle création ; vide tant que le nom ou la souche manquent. */
export function previewCode(store, entity, name) {
  const numbering = store.codeNumberings?.[entity];
  return numbering && name?.trim() ? nameCode(numbering, name, CODE_SERIES[entity].taken(store.db)) : '';
}
