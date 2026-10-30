// API des documents du dossier employé (/api/employees/{employeeId}/documents, RH-9), et correspondance avec l'EmployeeDocumentDTO.
import { download, request, upload } from './client';
import { DEFAULT_MAX_SIZE_MB } from './documentTypes';

const base = (employeeId) => `/employees/${employeeId}/documents`;

export const employeeDocumentsApi = {
  list: (employeeId) => request('GET', base(employeeId)),
  /** Fichier envoyé tel quel en multipart (stocké en BYTEA), sans Base64. */
  create: (employeeId, { documentTypeId, description, file }) => {
    const form = new FormData();
    form.append('documentTypeId', documentTypeId);
    if (description) form.append('description', description);
    form.append('file', file);
    return upload(base(employeeId), form);
  },
  download: (employeeId, id) => download(`${base(employeeId)}/${id}/download`),
  remove: (employeeId, id) => request('DELETE', `${base(employeeId)}/${id}`),
};

/** Taille maximale d'un fichier pour un type de document, en Mo (Paramètres › Types de documents ; 10 par défaut). */
export const maxSizeMbOf = (type) => type?.maxSizeMb ?? DEFAULT_MAX_SIZE_MB;

/** Message de refus d'un fichier trop volumineux, identique à celui du backend ; '' si le fichier respecte la limite. */
export const sizeError = (file, type) => (file && file.size > maxSizeMbOf(type) * 1024 * 1024
  ? `Le fichier dépasse la taille maximale autorisée de ${maxSizeMbOf(type)} Mo.` : '');

/** EmployeeDocumentDTO → document de la fiche. */
export const fromEmployeeDocumentDto = (dto) => ({
  id: dto.id,
  typeId: dto.documentTypeId,
  typeName: dto.documentTypeName,
  fileName: dto.name,
  description: dto.description ?? '',
  mimeType: dto.mimeType,
  size: dto.size,
  addedAt: dto.createdAt,
});

/** Téléchargement d'un document : contenu binaire lu puis enregistré sous son nom d'origine. */
export async function saveEmployeeDocument(employeeId, doc) {
  const blob = await employeeDocumentsApi.download(employeeId, doc.id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.fileName;
  a.click();
  URL.revokeObjectURL(url);
}
