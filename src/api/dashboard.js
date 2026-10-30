// Tableau de bord (/api/dashboard) : indicateurs calculés par le backend sur les données enregistrées de la société de la
// session. Une section vaut null quand l'utilisateur n'a pas la permission de la consulter.
import { request } from './client';

export const dashboardApi = {
  get: () => request('GET', '/dashboard'),
};
