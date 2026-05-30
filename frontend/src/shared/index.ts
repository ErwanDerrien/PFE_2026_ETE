/**
 * /shared — Types, interfaces et constantes partagés par TOUTES les équipes.
 *
 * Point d'entrée unique : importez depuis `../shared` (ex. `import type { GraphModel } from '../shared'`).
 * Ne mettez ici que des contrats (types) et constantes — aucune logique métier.
 */

export * from './graph';
export * from './ast';
export * from './engine';
