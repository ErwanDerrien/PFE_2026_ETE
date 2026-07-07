/**
 * NaturalLangPanel — Panneau langage naturel.
 *
 * Affiche une description en langage naturel du code courant.
 * - Mode lecture par défaut
 * - Mode édition avec bouton Apply
 * - Se synchronise avec le store via lastOrigin pour éviter les boucles
 * - Ignore les changements "sans impact" (espaces, commentaires) pour
 *   éviter de re-convertir inutilement
 */

import { useEffect, useRef, useState } from 'react';
import { useAstStore } from '../sync';
import { codeToNaturalLanguage, naturalLanguageToCode } from '../api';
import { normalizeForComparison } from './normalize';
import './NaturalLangPanel.css';

export function NaturalLangPanel() {
  // --- lecture du store ---
  const source = useAstStore((s) => s.source);
  const lastOrigin = useAstStore((s) => s.lastOrigin);
  const setSource = useAstStore((s) => s.setSource);
  const error = useAstStore((s) => s.error);

  // --- état local du panneau ---
  const [description, setDescription] = useState('');
  const [editValue, setEditValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Dernière version normalisée du code qu'on a effectivement convertie
  const lastNormalizedRef = useRef<string>('');

  // Si le code est vide, la description est vide — pas besoin d'un effet pour ça
  const displayDescription = source ? description : '';

  // --- quand le code change (et que ce n'est pas nous qui avons écrit) ---
  useEffect(() => {
    // Anti-boucle : si c'est nous qui venons d'écrire, on ne re-convertit pas
    if (lastOrigin === 'natural-lang') return;
    if (!source) return;

    // Impact-less change : si le code n'a pas vraiment changé de sens
    // (juste des espaces ou des commentaires), on ne re-convertit pas
    const normalized = normalizeForComparison(source);
    if (normalized === lastNormalizedRef.current) return;

    let cancelled = false;

    async function convert() {
      setIsLoading(true);
      setApiError(null);
      try {
        const result = await codeToNaturalLanguage(source);
        if (!cancelled) {
          setDescription(result);
          lastNormalizedRef.current = normalized;
        }
      } catch (e) {
        if (!cancelled)
          setApiError(e instanceof Error ? e.message : 'Erreur inconnue');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    convert();

    // Nettoyage : si source change encore pendant la requête, on ignore la réponse
    return () => {
      cancelled = true;
    };
  }, [source, lastOrigin]);

  // --- bouton Edit ---
  function handleEdit() {
    setEditValue(displayDescription);
    setIsEditing(true);
    setApiError(null);
  }

  // --- bouton Cancel ---
  function handleCancel() {
    setIsEditing(false);
    setApiError(null);
  }

  // --- bouton Apply ---
  async function handleApply() {
    setIsLoading(true);
    setApiError(null);
    try {
      const code = await naturalLanguageToCode(editValue);
      setSource(code, 'natural-lang');
      setIsEditing(false);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="nl-panel">
      <div className="nl-panel__header">
        <span className="nl-panel__title">Langage naturel</span>
        {!isEditing && (
          <button
            className="nl-panel__btn nl-panel__btn--ghost"
            onClick={handleEdit}
            disabled={isLoading || !displayDescription}
          >
            Modifier
          </button>
        )}
      </div>

      <div className="nl-panel__body">
        {/* État de chargement */}
        {isLoading && (
          <p className="nl-panel__loading">Conversion en cours…</p>
        )}

        {/* Erreur store (parse, astToGraph…) */}
        {error && !isLoading && (
          <p className="nl-panel__error">
            Erreur ({error.phase}) : {error.message}
          </p>
        )}

        {/* Erreur API Claude */}
        {apiError && !isLoading && (
          <p className="nl-panel__error">{apiError}</p>
        )}

        {/* Mode lecture */}
        {!isEditing && !isLoading && displayDescription && (
          <p className="nl-panel__description">{displayDescription}</p>
        )}

        {/* Placeholder si aucun code */}
        {!isEditing && !isLoading && !displayDescription && !error && (
          <p className="nl-panel__placeholder">
            Écrivez du code pour voir sa description ici.
          </p>
        )}

        {/* Mode édition */}
        {isEditing && (
          <textarea
            className="nl-panel__textarea"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={6}
            placeholder="Décrivez ce que le code doit faire…"
          />
        )}
      </div>

      {/* Actions du mode édition */}
      {isEditing && (
        <div className="nl-panel__footer">
          <button
            className="nl-panel__btn nl-panel__btn--ghost"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Annuler
          </button>
          <button
            className="nl-panel__btn nl-panel__btn--primary"
            onClick={handleApply}
            disabled={isLoading || !editValue.trim()}
          >
            {isLoading ? 'Conversion…' : 'Appliquer'}
          </button>
        </div>
      )}
    </div>
  );
}