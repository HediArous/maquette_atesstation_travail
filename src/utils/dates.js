// Dates ISO « AAAA-MM-JJ » : calculs et formatage (fr-FR). Aucune donnée figée : « aujourd'hui » est la date du jour.

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function toISO(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Date du jour (évaluée au chargement de l'application). */
export const TODAY = toISO(new Date());
/** Année en cours, utilisée pour les soldes annuels. */
export const YEAR = TODAY.slice(0, 4);

export function addDays(s, n) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function addMonths(s, n) {
  const d = parseISO(s);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}

// Ajout de mois en conservant le jour, ramené au dernier jour du mois si besoin (comme LocalDate.plusMonths).
export function plusMonths(s, n) {
  const d = parseISO(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return toISO(d);
}

/** Périodicité maximale d'un contrat ou d'un salaire, en mois. */
export const PERIOD_MAX = 120;

/**
 * Date de fin d'une période de `months` mois commençant le `start` : veille du même jour `months` mois plus tard
 * (01/01 + 12 → 31/12). Si ce jour n'existe pas dans le mois d'arrivée, fin au dernier jour de ce mois
 * (31/01 + 1 → 28 ou 29/02). '' sans début ou sans périodicité.
 */
export function periodEnd(start, months) {
  if (!start || !Number.isInteger(months) || months < 1) return '';
  const target = plusMonths(start, months);
  return target.slice(8) < start.slice(8) ? target : addDays(target, -1);
}

/** Périodicité (mois) qui donne exactement `end` depuis `start`, sinon null (date de fin hors mois entiers). */
export function periodMonths(start, end) {
  if (!start || !end || end < start) return null;
  for (let n = 1; n <= PERIOD_MAX; n++) {
    const e = periodEnd(start, n);
    if (e === end) return n;
    if (e > end) return null;
  }
  return null;
}

export function diffDays(a, b) {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

export function eachDay(start, end) {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 1 = lundi … 7 = dimanche. */
export function isoWeekday(s) {
  const w = parseISO(s).getDay();
  return w === 0 ? 7 : w;
}

export function startOfWeek(s) {
  return addDays(s, 1 - isoWeekday(s));
}

export function startOfMonth(s) {
  return s.slice(0, 8) + '01';
}

export function endOfMonth(s) {
  return addDays(addMonths(s, 1), -1);
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

const fmtShort = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const fmtWeekdayShort = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });

export const formatDate = (s) => fmtShort.format(parseISO(s));
export const formatDayMonth = (s) => fmtDayMonth.format(parseISO(s));
export const formatLong = (s) => fmtLong.format(parseISO(s));
export const formatMonth = (s) => {
  const v = fmtMonth.format(parseISO(s));
  return v.charAt(0).toUpperCase() + v.slice(1);
};
export const formatWeekdayShort = (s) => fmtWeekdayShort.format(parseISO(s)).replace('.', '');

export function formatRange(start, end) {
  if (start === end) return formatDate(start);
  if (start.slice(0, 4) === end.slice(0, 4)) return `${formatDayMonth(start)} → ${formatDate(end)}`;
  return `${formatDate(start)} → ${formatDate(end)}`;
}

/** Horodatage « AAAA-MM-JJTHH:mm » → « 12 oct. 2026 à 09:30 ». */
export function formatDateTime(s) {
  const [date, time] = s.split('T');
  return time ? `${formatDate(date)} à ${time.slice(0, 5)}` : formatDate(date);
}

export function nowStamp() {
  const d = new Date();
  return `${toISO(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDays(n) {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
  return `${v} j`;
}
