// Client exclusivement local pour cette copie de maquette : aucun transport HTTP.
import { mockRequest, mockUpload, mockDownload } from '../maquette/service.js';
export class ApiError extends Error {
  constructor(message, status = 0, field) { super(message); this.status = status; this.field = field; }
}
export const setAuthToken = () => {};
export const setUnauthorizedHandler = () => {};
export const request = mockRequest;
export const upload = mockUpload;
export const download = mockDownload;
export const streamEvents = () => () => {};
