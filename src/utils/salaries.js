// Contrôles des périodes de salaire saisies avec un contrat (mêmes règles que SalaryService, qui reste la référence).
import { formatDate } from './dates';

const OPEN_END = '9999-12-31';
const period = (s) => `du ${formatDate(s.start)}${s.end ? ` au ${formatDate(s.end)}` : ', sans date de fin'}`;

/**
 * Erreurs d'une liste de salaires par rapport au contrat { start, end, fixedTerm } :
 * { rows: { [key]: message }, general: message | undefined }.
 * - début >= début du contrat ; fin >= début ; montant > 0 ;
 * - contrat à durée déterminée : fin obligatoire et <= fin du contrat ;
 * - aucun chevauchement entre lignes (actives ou désactivées), une fin vide étant une période ouverte ;
 * - contrat déjà commencé à `today` : au moins un salaire actif commençant exactement à la date de début du contrat.
 */
export function salaryLinesErrors(lines, contract, today) {
  const rows = {};
  const add = (key, msg) => { if (!rows[key]) rows[key] = msg; };
  lines.forEach((s, i) => {
    const n = `Salaire n°${i + 1} : `;
    if (!s.start) add(s.key, `${n}date de début requise.`);
    else if (contract.start && s.start < contract.start) add(s.key, `${n}il commence avant le contrat (${formatDate(contract.start)}).`);
    if (!(Number(s.amount) > 0)) add(s.key, `${n}montant supérieur à 0 requis.`);
    if (s.end && s.start && s.end < s.start) add(s.key, `${n}la date de fin précède la date de début.`);
    else if (contract.fixedTerm && !s.end) add(s.key, `${n}date de fin requise (contrat à durée déterminée).`);
    else if (contract.fixedTerm && contract.end && s.end > contract.end) add(s.key, `${n}il se termine après la fin du contrat (${formatDate(contract.end)}).`);
  });
  lines.forEach((a, i) => {
    if (!a.start) return;
    const other = lines.find((b, j) => j !== i && b.start && a.start <= (b.end || OPEN_END) && b.start <= (a.end || OPEN_END));
    if (other) add(a.key, `Salaire n°${i + 1} : chevauche le salaire n°${lines.indexOf(other) + 1} (${period(other)}).`);
  });
  let general;
  if (contract.start && contract.start <= today && !lines.some((s) => s.active && s.start === contract.start)) {
    general = `Le contrat a déjà commencé : ajoutez au moins un salaire actif commençant le ${formatDate(contract.start)}.`;
  }
  return { rows, general };
}
