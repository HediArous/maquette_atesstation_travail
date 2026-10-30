// Libellés et aides partagés par les écrans employés et le catalogue des primes.
import { formatDate, TODAY } from '../../utils/dates';

export const PRIME_TYPE = { fixe: 'Prime ponctuelle', variable: 'Prime variable', exceptionnelle: 'Prime exceptionnelle' };

/** Ancienneté lisible : « 4 ans et 2 mois », « 3 mois », « Moins d’un mois ». */
export function seniority(hireDate, today = TODAY) {
  if (hireDate > today) return `Arrivée le ${formatDate(hireDate)}`;
  const [y1, m1, d1] = hireDate.split('-').map(Number);
  const [y2, m2, d2] = today.split('-').map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  const years = Math.floor(months / 12); months %= 12;
  if (!years && !months) return 'Moins d’un mois';
  return [years && `${years} an${years > 1 ? 's' : ''}`, months && `${months} mois`].filter(Boolean).join(' et ');
}
