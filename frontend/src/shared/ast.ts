/**
 * Couche AST — l'AST Babel est la *source de vérité* de toute l'application.
 * Toutes les vues (éditeur, blocs, langage naturel) sont des projections de cet AST.
 *
 * On centralise ici :
 *  - la ré-exportation des types Babel utiles (`File`, `Node`) pour que les autres
 *    modules n'importent pas `@babel/types` directement ;
 *  - la configuration du langage (TypeScript d'abord, conçu pour être interchangeable).
 *
 * Propriétaire : équipe A (/sync). Lu par tous.
 */

import type { ParserOptions } from '@babel/parser';

// Ré-export des types de nœuds AST — la racine de l'arbre Babel est `File`.
export type { File, Node, SourceLocation } from '@babel/types';

/**
 * Langages supportés. TypeScript est le premier (Babel le gère nativement).
 * Le multi-langage viendra plus tard : ajouter une entrée ici + son parseur
 * dans `LANGUAGE_CONFIG` (pour Java il faudra un parseur dédié, p. ex. `java-parser`,
 * et un générateur autre que `@babel/generator`).
 */
export type SupportedLanguage = 'typescript' | 'javascript';

export const DEFAULT_LANGUAGE: SupportedLanguage = 'typescript';

/** Configuration de parsing par langage (passée à `@babel/parser`). */
export interface LanguageConfig {
  readonly label: string;
  readonly parserOptions: ParserOptions;
}

/**
 * Options Babel par langage. `sourceType: 'module'` + plugins, comme recommandé :
 * `parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] })`.
 */
export const LANGUAGE_CONFIG: Record<SupportedLanguage, LanguageConfig> = {
  typescript: {
    label: 'TypeScript',
    parserOptions: {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      // Conserve les emplacements (loc.start.line) — requis pour le regroupement
      // par lignes vides et le round-trip code <-> blocs.
      ranges: true,
      tokens: false,
    },
  },
  javascript: {
    label: 'JavaScript',
    parserOptions: {
      sourceType: 'module',
      plugins: ['jsx'],
      ranges: true,
      tokens: false,
    },
  },
};
