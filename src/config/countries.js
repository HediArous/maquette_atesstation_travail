// Pays proposés pour une société (référentiel de l'application, pas une donnée métier). Les montants s'affichent dans la
// devise active de Paramètres › Devises, jamais dans la devise du pays.
export const COUNTRIES = [
  { name: 'Maroc', currency: 'MAD' },
  { name: 'France', currency: 'EUR' },
  { name: 'Belgique', currency: 'EUR' },
  { name: 'Tunisie', currency: 'TND' },
  { name: 'Sénégal', currency: 'XOF' },
  { name: 'Côte d’Ivoire', currency: 'XOF' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0].name;
