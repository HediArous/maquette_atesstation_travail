// Identifiants locaux (en attendant ceux du backend) : préfixe + compteur, conservé avec les données.
let seq = 0;

export const getSeq = () => seq;
export const setSeq = (n) => { seq = Number.isFinite(n) ? n : 0; };
export const newId = (prefix) => `${prefix}${++seq}`;
