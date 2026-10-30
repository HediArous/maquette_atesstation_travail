// API des devises (/api/devises) et correspondance avec la devise du frontend :
// { id, symbol, code, label, decimals, active }. Une seule devise active à la fois.
import { request } from './client';

export const devisesApi = {
  list: () => request('GET', '/devises'),
  active: () => request('GET', '/devises/active'),
  get: (id) => request('GET', `/devises/${id}`),
  create: (dto) => request('POST', '/devises', dto),
  update: (id, dto) => request('PUT', `/devises/${id}`, dto),
  /** Active la devise ; l'ancienne devise active est désactivée par le backend. */
  activate: (id) => request('PATCH', `/devises/${id}/activate`),
  remove: (id) => request('DELETE', `/devises/${id}`),
};

/** Les identifiants du backend sont numériques ; le frontend les manipule en chaînes. */
export const fromDeviseDto = (dto) => ({
  id: String(dto.id),
  symbol: dto.symbole,
  code: dto.codeISO,
  label: dto.libelle,
  decimals: dto.chiffreApresVirgule,
  active: dto.etat === true,
});

export const toDeviseDto = (d) => ({
  symbole: d.symbol.trim(),
  codeISO: d.code.trim().toUpperCase(),
  libelle: d.label.trim(),
  chiffreApresVirgule: d.decimals,
  etat: d.active,
});

/** Correspondance des champs du backend (propriété « field » des erreurs) avec ceux du formulaire. */
export const DEVISE_FIELDS = { symbole: 'symbol', codeISO: 'code', libelle: 'label', chiffreApresVirgule: 'decimals', etat: 'active' };
