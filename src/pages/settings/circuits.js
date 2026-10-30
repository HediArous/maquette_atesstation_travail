// Présentation des circuits d'approbation (RH-22) : un circuit par département, actif dès sa création (pas de date d'effet).
import { formatDate } from '../../utils/dates';

/** « Créé le 01/01/2026 ». */
export const circuitPeriod = (c) => `Créé le ${formatDate(c.effectiveFrom)}`;

/** État d'un circuit : actif (s'applique à son département) ou archivé (département libéré). */
export const circuitState = (c) => (c.archived
  ? { key: 'archived', tone: 'neutral', label: 'Archivé' }
  : { key: 'current', tone: 'success', label: 'Actif' });
