/**
 * InsertionContext — canal léger entre les éléments « + » rendus DANS l'arbre
 * React Flow (arête custom, plus tard boutons de port) et `BlocksCanvas` qui
 * détient l'état du popup. Évite de threader des callbacks via `edge.data`
 * (la projection `graphToFlow` reste une transformation pure).
 */

import { createContext, useContext } from "react";
import type { InsertTarget } from "../../shared";

/** Position écran (clientX/clientY) pour ancrer le popup de palette. */
export interface ScreenPoint {
  x: number;
  y: number;
}

export type RequestInsert = (target: InsertTarget, at: ScreenPoint) => void;

const InsertionContext = createContext<RequestInsert>(() => {});

export const InsertionProvider = InsertionContext.Provider;

export function useRequestInsert(): RequestInsert {
  return useContext(InsertionContext);
}

/**
 * Id de l'arête actuellement survolée (détecté par React Flow via
 * `onEdgeMouseEnter/Leave`), partagé pour que `InsertableEdge` affiche son « + ».
 * Plus fiable que de capter le survol sur un tracé SVG fin.
 */
const HoveredEdgeContext = createContext<string | null>(null);

export const HoveredEdgeProvider = HoveredEdgeContext.Provider;

export function useHoveredEdge(): string | null {
  return useContext(HoveredEdgeContext);
}
