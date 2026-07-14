import { useEffect, useRef, useState } from 'react';
import { useAstStore } from '../sync';
import { codeToNaturalLanguage, naturalLanguageToCode } from '../api';
import { useApiKeyStore } from '../api';
import { normalizeForComparison } from './normalize';
import './NaturalLangPanel.css';

export function NaturalLangPanel() {
  const source = useAstStore((s) => s.source);
  const lastOrigin = useAstStore((s) => s.lastOrigin);
  const setSource = useAstStore((s) => s.setSource);
  const error = useAstStore((s) => s.error);
  const status = useApiKeyStore((s) => s.status);

  const [description, setDescription] = useState('');
  const [editValue, setEditValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const lastNormalizedRef = useRef<string>('');

  const displayDescription = source ? description : '';

  useEffect(() => {
  if (lastOrigin === 'natural-lang') return;
  if (!source) return;
  if (status !== 'verified') return;

  const normalized = normalizeForComparison(source);
  if (normalized === lastNormalizedRef.current) return;

  // Debounce : attendre 1.5 secondes après le dernier changement
  const timer = setTimeout(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const result = await codeToNaturalLanguage(source);
      setDescription(result);
      lastNormalizedRef.current = normalized;
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  }, 1500);

  // Cleanup : annule le timer si source change avant les 1.5 secondes
  return () => clearTimeout(timer);
}, [source, lastOrigin, status]);

  function handleEdit() {
    setEditValue(displayDescription);
    setIsEditing(true);
    setApiError(null);
  }

  function handleCancel() {
    setIsEditing(false);
    setApiError(null);
  }

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
    <div className="nl-content">
      <div className="nl-body">
        {isLoading && <p className="nl-loading">Conversion en cours…</p>}

        {error && !isLoading && (
          <p className="nl-error">Erreur ({error.phase}) : {error.message}</p>
        )}

        {apiError && !isLoading && (
          <p className="nl-error">{apiError}</p>
        )}

        {!isEditing && !isLoading && displayDescription && (
          <p className="nl-description">{displayDescription}</p>
        )}

        {!isEditing && !isLoading && !displayDescription && !error && !apiError && (
          <p className="nl-placeholder">
            {status !== 'verified'
              ? 'Entrez votre clé API pour voir la description du code.'
              : 'Écrivez du code pour voir sa description ici.'}
          </p>
        )}

        {isEditing && (
          <textarea
            className="nl-textarea"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={6}
            placeholder="Décrivez ce que le code doit faire…"
          />
        )}
      </div>

      <div className="nl-footer">
        {!isEditing ? (
          <button
            className="nl-btn nl-btn--ghost"
            onClick={handleEdit}
            disabled={isLoading || !displayDescription}
          >
            Modifier
          </button>
        ) : (
          <>
            <button
              className="nl-btn nl-btn--ghost"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Annuler
            </button>
            <button
              className="nl-btn nl-btn--primary"
              onClick={handleApply}
              disabled={isLoading || !editValue.trim()}
            >
              {isLoading ? 'Conversion…' : 'Appliquer'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}