// Libellés, tons et options partagés par les composants d'interface.
import { AlertTriangle, Ban, Info } from '@lucide/vue';

export const LEAVE_STATUS = {
  en_attente: ['En attente', 'warning'],
  approuve: ['Approuvée', 'success'],
  refuse: ['Refusée', 'danger'],
  annule: ['Annulée', 'muted'],
};
export const leaveStatusLabel = (s) => LEAVE_STATUS[s][0];

export const STEP_STATUS = {
  en_attente: ['En attente de décision', 'warning'],
  approuve: ['Approuvé', 'success'],
  refuse: ['Refusé', 'danger'],
  a_venir: ['À venir', 'neutral'],
  ignore: ['Sans objet', 'muted'],
  info: ['Pour information', 'info'],
};

export const EMP_STATUS = {
  actif: ['Actif', 'success'],
  essai: ["Période d'essai", 'info'],
  inactif: ['Inactif', 'muted'],
};
export const employeeStatusOptions = Object.entries(EMP_STATUS).map(([value, [label]]) => ({ value, label }));

export const EFFECTS = {
  info: { label: 'Informatif', tone: 'info', icon: Info, help: 'Affiché dans le calendrier, sans impact sur les demandes.' },
  warning: { label: 'Avertissement', tone: 'warning', icon: AlertTriangle, help: 'La demande reste possible mais un avertissement est affiché.' },
  block: { label: 'Bloquant', tone: 'danger', icon: Ban, help: 'Les demandes de congé chevauchant ces dates sont bloquées.' },
};

export const AVATAR_COLORS = ['#2f5bd3', '#0f8a7a', '#8a4fd1', '#c2410c', '#0e7490', '#b45309', '#be185d', '#4d7c0f'];

export const COLOR_PRESETS = ['#2f5bd3', '#0b5cc0', '#0f8a7a', '#1e7d45', '#b45309', '#c2410c', '#c4362f', '#be185d', '#8a4fd1', '#6b7280'];
