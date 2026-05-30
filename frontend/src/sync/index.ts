/**
 * /sync — Moteur de synchronisation (source unique de vérité).
 *
 * Propriétaire : équipe A (Adel, Junior). Lu par toutes les équipes.
 *
 * Surface publique :
 *  - `useAstStore`  : le store partagé (lecture pour tous, écriture via actions).
 *  - transforms     : parse / generate / astToGraph / graphToAst (encore en stub).
 */

export { useAstStore } from './store';
export { parse, generate, astToGraph, graphToAst } from './transforms';
