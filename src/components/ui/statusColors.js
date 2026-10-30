// Couleurs indicatives des statuts d'employé, par cycle de vie :
// arrivée (bleu) → en poste (vert) → alerte (ambre / orange) → sortie (rouge, gris) → fin (ardoise).
const tone = (fg, bg, border) => ({ fg, bg, border });

const KNOWN = [
  [/essai/, tone('#1d4ed8', '#eff6ff', '#bfdbfe')], // En période d'essai : bleu
  [/^actif$/, tone('#15803d', '#f0fdf4', '#bbf7d0')], // Actif : vert
  [/suspendu/, tone('#b45309', '#fffbeb', '#fde68a')], // Suspendu : ambre
  [/preavis/, tone('#c2410c', '#fff7ed', '#fed7aa')], // En préavis de départ : orange
  [/demission/, tone('#7e22ce', '#faf5ff', '#e9d5ff')], // Démissionnaire : violet
  [/licenci/, tone('#b91c1c', '#fef2f2', '#fecaca')], // Licencié : rouge
  [/fin de contrat/, tone('#0f766e', '#f0fdfa', '#99f6e4')], // Fin de contrat : sarcelle
  [/retrait/, tone('#4b5563', '#f9fafb', '#e5e7eb')], // Retraité : gris
  [/deced/, tone('#1e293b', '#f1f5f9', '#cbd5e1')], // Décédé : ardoise sombre
];

// Statuts ajoutés dans les Paramètres : couleur stable déduite du libellé.
const EXTRA = [
  tone('#be185d', '#fdf2f8', '#fbcfe8'),
  tone('#0369a1', '#f0f9ff', '#bae6fd'),
  tone('#4d7c0f', '#f7fee7', '#d9f99d'),
  tone('#6d28d9', '#f5f3ff', '#ddd6fe'),
  tone('#a16207', '#fefce8', '#fef08a'),
];

const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function statusColor(value) {
  const v = normalize(value ?? '');
  const known = KNOWN.find(([re]) => re.test(v));
  if (known) return known[1];
  return EXTRA[[...v].reduce((s, c) => s + c.charCodeAt(0), 0) % EXTRA.length];
}
