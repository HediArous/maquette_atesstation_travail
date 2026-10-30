# Maquette RH — Attestations de travail

Maquette Vue de gestion RH avec des données fictives, comprenant les demandes
d’attestation, les modèles personnalisables par société et la génération PDF.

## Démarrage

Node.js `^22.18.0` ou `>=24.12.0`.

```sh
npm ci
npm run build
npm start
```

Ouvrir `http://127.0.0.1:5181/`.

Pour développer : `npm run dev`.

Sous Windows, `DEMARRER-MAQUETTE.cmd` démarre la version compilée.
Pour le réseau local : `DEMARRER-MAQUETTE-WIFI.cmd`, ou
`node servir-maquette.mjs --wifi`. Le serveur affiche l’adresse de la carte
Wi-Fi au port 5183 ; le pare-feu doit autoriser ce serveur sur le réseau concerné.

## Attestations de travail

- `/mes-documents` : demande et suivi par l’employé.
- `/documents-rh` : préparation, aperçu en direct facultatif, PDF et remise.
- `/parametres/modeles-documents` : documents entièrement personnalisables
  pour contrat en cours ou terminé, informations automatiques et signataires.
- Les anciens salariés sont sélectionnables, même sans contrat en cours.
- Statuts : Demandée → Prête à remettre → Remise ; refus motivé possible.
- Permissions distinctes pour demander, traiter, générer et imprimer.

## Vérification

```sh
node tests/attestations.mjs
node tests/attestation-layout.mjs
npm run build
```

## Limites de la maquette

Aucun backend ni base réelle. Chaque navigateur travaille sur ses propres
données en mémoire : un rechargement les réinitialise. Les identités, CIN,
coordonnées et contrats fournis sont fictifs. Signature et cachet manuels.
Les contrôles de permissions de cette démonstration ne remplacent pas
les contrôles serveur d’une application en production.

Le PDF est généré localement avec pdf-lib ; sa licence est incluse dans
`src/vendor/pdf-lib-LICENSE.md`. Pour les caractères non pris en charge par
les polices du PDF, utiliser l’impression du navigateur.

Les dépendances, compilations, journaux, captures de contrôle et fichiers
temporaires sont exclus du dépôt. Voir aussi `LIRE-MOI.txt`.
