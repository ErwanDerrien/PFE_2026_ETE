# /api — Couche API Claude

**Propriétaire : Rôle transversal (Émie).**

> 📘 Nouveau sur le projet ou sur React ? Lisez d'abord [`docs/README.md`](../../../docs/README.md).

Couche d'accès à l'API Claude (Anthropic) : conversions code ↔ langage naturel,
saisie et stockage de la clé API fournie par l'utilisateur.

## À faire
- Interface de saisie de la clé API Anthropic (stockée côté client).
- Fonctions de conversion `code -> NL` et `NL -> code`.
- Gestion des erreurs réseau / quota.

> Les appels Claude passent par le backend node.js (`/backend`) qui sert de proxy
> pour ne pas exposer la clé API. Cette couche appelle donc le backend.
