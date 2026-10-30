// API du paramétrage des pays et numéros de téléphone (/api/phone-country-settings)
// et correspondance avec le pays du frontend : { id, name, dialCode (sans « + »), digits, archived }.
import { request } from './client';

export const phoneCountriesApi = {
  list: (activeOnly = false) => request('GET', `/phone-country-settings${activeOnly ? '?activeOnly=true' : ''}`),
  create: (dto) => request('POST', '/phone-country-settings', dto),
  update: (id, dto) => request('PUT', `/phone-country-settings/${id}`, dto),
  remove: (id) => request('DELETE', `/phone-country-settings/${id}`),
};

/** Les identifiants du backend sont numériques ; le frontend les manipule en chaînes (valeurs des <select>). */
export const fromPhoneCountryDto = (dto) => ({
  id: String(dto.id),
  name: dto.pays,
  dialCode: String(dto.indicatif ?? '').replace(/^\+/, ''),
  digits: dto.chiffresNumeroNational,
  archived: dto.etat === false,
});

export const toPhoneCountryDto = (c) => ({
  pays: c.name.trim(),
  indicatif: `+${c.dialCode}`,
  chiffresNumeroNational: c.digits,
  etat: !c.archived,
});

/** Correspondance des champs du backend (propriété « field » des erreurs) avec ceux du formulaire pays. */
export const PHONE_COUNTRY_FIELDS = { pays: 'name', indicatif: 'dial', chiffresNumeroNational: 'digits' };
