// Navigation latérale de l'Application RH : rubriques regroupées par domaine ; une rubrique peut s'ouvrir sur ses
// sous-sections (Congés). Les sections des Paramètres restent en onglets en tête de page (SECTION_TABS).
import {
  Banknote, CalendarCheck, CalendarClock, CalendarDays, CalendarRange, ClipboardList, FilePen, LayoutGrid, Scale, Settings, Users,
} from '@lucide/vue';
import { SETTINGS_NAV } from '../pages/settings/nav';

/** Rubriques : `children` = sous-sections, routées en /<rubrique>/<sous-section>. */
export const SIDEBAR = [
  {
    items: [{ id: 'tableau-de-bord', label: 'Tableau de bord', icon: LayoutGrid }],
  },
  {
    title: 'Personnel',
    items: [
      { id: 'employes', label: 'Employés', icon: Users },
      { id: 'contrats', label: 'Contrats', icon: FilePen },
      { id: 'salaires', label: 'Salaires', icon: Banknote },
    ],
  },
  { title: 'Documents RH', items: [
    { id: 'mes-documents', label: 'Mes demandes de documents', icon: ClipboardList },
    { id: 'documents-rh', label: 'Demandes d’attestation', icon: FilePen },
  ] },
  // {
  //   title: 'Temps et absences',
  //   items: [
  //     {
  //       id: 'conges', label: 'Congés', icon: CalendarCheck,
  //       children: [
  //         { id: 'demandes', label: 'Demandes', icon: ClipboardList },
  //         { id: 'soldes', label: 'Soldes', icon: Scale },
  //       ],
  //     },
  //     { id: 'calendrier', label: 'Calendrier', icon: CalendarDays },
  //     { id: 'chargement', label: 'Chargement', title: 'Tableau de chargement', icon: CalendarClock },
  //     { id: 'evenements', label: 'Événements', icon: CalendarRange },
  //   ],
  // },
  {
    title: 'Administration',
    items: [{ id: 'parametres', label: 'Paramètres', icon: Settings }],
  },
];


/** Rubriques dont les sections s'affichent en onglets en tête de page. */
export const SECTION_TABS = {
  parametres: { title: 'Paramètres', items: SETTINGS_NAV.map(({ id, label, icon, group }) => ({ id, label, icon, group })) },
};
