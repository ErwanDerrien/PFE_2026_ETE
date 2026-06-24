/**
 * node-size — source UNIQUE de vérité des dimensions d'un bloc.
 * Utilisée à la fois par dagre (graph-to-flow) et par le rendu (les nœuds),
 * pour que « taille déclarée au layout == taille rendue » → aucun chevauchement.
 *
 * Le RENDU dimensionne la carte exactement au contenu (CSS `width: max-content`,
 * cf. blocks.css) → padding symétrique, jamais de coupure. Ici on fournit à dagre
 * une estimation **généreuse** (largeur de caractère sur-estimée) qui est toujours
 * ≥ la largeur réellement rendue : l'auto-layout réserve un peu plus d'espace, donc
 * aucun chevauchement (sur-réservation = côté sûr).
 */

import type { GraphNode } from "../shared";
import { isBranching, isLooping } from "./block-meta";

export interface NodeSize {
  width: number;
  height: number;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

// Largeur de caractère NETTEMENT sur-estimée (mono 13px réel ≈ 8px) → l'estimation
// dagre est toujours ≥ la largeur rendue (max-content), même avec le letter-spacing.
const CHAR_W = 9;
const CARD_PAD_X = 32;
const CARD_MIN_W = 180;
const CARD_MAX_W = 760; // ≈ 80 caractères : couvre une ligne tronquée complète

export function nodeSize(node: GraphNode): NodeSize {
  if (node.track === "expression") {
    return { width: clamp(node.label.length * CHAR_W + 24, 60, CARD_MAX_W), height: 34 };
  }
  const text = node.source ?? node.label;
  const width = clamp(text.length * CHAR_W + CARD_PAD_X, CARD_MIN_W, CARD_MAX_W);
  // Header(32) + Body(44) = 76 base.
  // Function declarations (collapsed or expanded): +1 footer row (26) → 106. Loops: same. Conditions: 2 rows → 132. Plain: 80.
  const isFuncDeclNode = node.astType === "FunctionDeclaration" && node.collapsed !== undefined;
  const height = (isFuncDeclNode || isLooping(node.astType)) ? 106
               : isBranching(node.astType) ? 132
               : 80;
  return { width, height };
}
