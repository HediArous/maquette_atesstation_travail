// Numéro de souche des codes déduits du nom (/api/code-numbering) :
// [{ entity: 'departement' | 'fonction' | 'prime' | 'type_document', prefix, separator, letters }].
// Le code est attribué par le backend à la création.
import { request } from './client';

export const codeNumberingApi = {
  list: () => request('GET', '/code-numbering'),
  update: (entity, numbering) => request('PUT', `/code-numbering/${entity}`, numbering),
};
