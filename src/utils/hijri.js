// Calendrier hégirien (Umm al-Qura, fourni par le navigateur) : estimation des fêtes religieuses d'une année sur l'autre.
// Les dates officielles dépendent de l'observation du croissant lunaire : elles restent à confirmer (± 1 jour).
import { addDays } from './dates';

const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Date grégorienne « AAAA-MM-JJ » → { year, month, day } hégiriens. */
export function toHijri(iso) {
  const parts = fmt.formatToParts(new Date(`${iso}T12:00:00Z`));
  const n = (type) => Number(parts.find((p) => p.type === type)?.value);
  return { year: n('year'), month: n('month'), day: n('day') };
}

/**
 * Même jour hégirien, l'année hégirienne suivante (environ 354 jours plus tard) : estimation d'une fête religieuse
 * (Aïd al-Fitr, Aïd al-Adha…) pour l'année suivante. Un 30 absent du mois visé devient le 29.
 */
export function nextHijriYear(iso) {
  const h = toHijri(iso);
  const target = { year: h.year + 1, month: h.month };
  const approx = addDays(iso, 354);
  for (const day of [h.day, h.day - 1]) {
    for (let delta = 0; delta <= 4; delta++) {
      for (const d of delta ? [addDays(approx, -delta), addDays(approx, delta)] : [approx]) {
        const x = toHijri(d);
        if (x.year === target.year && x.month === target.month && x.day === day) return d;
      }
    }
  }
  return approx;
}
