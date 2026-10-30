// Session fictive propre à la maquette ; aucun jeton, aucun Core Tenant réel.
import { reactive } from 'vue';
import { context } from '../maquette/fixtures.js';
export const CORE_URL = window.location.origin;
export const REOPEN_MESSAGE = 'Maquette locale de l’application RH';
export const CORE_ROLE_LABEL = { COMPANY_ADMIN: 'Administrateur RH · démo', USER: 'Employé · démo' };
export const coreSession = reactive({ context, error: '', redirecting: false });
export const initCoreSession = async () => coreSession.context;
export const coreRoleIn = companyId => coreSession.context.companies.find(c => c.id === companyId)?.role;
export const setCoreCompany = async companyId => { coreSession.context.companyId = companyId; };
export const redirectToCore = () => { window.location.href = '/'; };
