// Base fictive en mémoire. Les stockages de l’application réelle ne sont jamais lus.
import { emptyDatabase } from './emptyDatabase';
import { localEmployeeParts } from '../maquette/service.js';
export function loadDatabase() { return { db: { ...emptyDatabase(), employees: localEmployeeParts() }, seq: 1000 }; }
export function saveDatabase() { /* Rechargement = remise à zéro de la maquette. */ }
