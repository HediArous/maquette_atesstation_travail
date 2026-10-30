// Numéros de téléphone : indicatif du pays + numéro national dont la longueur est paramétrée par pays
// (Paramètres › Pays et téléphone) : longueur exacte (digits).

export const onlyDigits = (v) => v.replace(/\D/g, '');

/** « +212 6 12 34 56 78 » : le numéro national est groupé par deux chiffres. */
export function formatPhone(country, national) {
  const d = onlyDigits(national);
  if (!d) return '';
  const groups = [];
  let i = d.length % 2;
  if (i) groups.push(d.slice(0, 1));
  for (; i < d.length; i += 2) groups.push(d.slice(i, i + 2));
  return `${country ? `+${country.dialCode} ` : ''}${groups.join(' ')}`;
}

/** Forme internationale normalisée (« +21620123456 ») : sert à comparer les numéros quel que soit leur affichage. */
export const internationalPhone = (country, national) => (country && onlyDigits(national ?? '') ? `+${country.dialCode}${onlyDigits(national)}` : '');

/** Message d'erreur si le numéro ne respecte pas la longueur attendue pour le pays. */
export function phoneError(country, national) {
  const d = onlyDigits(national ?? '');
  if (!d) return undefined;
  if (!country) return 'Choisissez un indicatif.';
  if (d.length !== country.digits) {
    return `${country.digits} chiffres attendus pour ${country.name} (${d.length} saisi${d.length > 1 ? 's' : ''}).`;
  }
  return undefined;
}
