import { useEffect, useRef, useState } from 'react';
import { useAstStore } from '../sync';
import { codeToNaturalLanguage, naturalLanguageToCode } from '../api';
import { useApiKeyStore } from '../api';
import { normalizeForComparison } from './normalize';
import { Button } from '@astryxdesign/core/Button';
import './NaturalLangPanel.css';

export function NaturalLangPanel() {
  const source = useAstStore((s) => s.source);
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

  const dirty = useAstStore((s) => s.dirty);

  const lastOrigin = useAstStore((s) => s.lastOrigin);

  useEffect(() => {
    if (dirty) return;
    if (status !== 'verified') return;
    if (!source) return;
    if (lastOrigin === 'natural-lang') return; // on vient d'écrire nous-mêmes → pas de régénération

    const normalized = normalizeForComparison(source);
    if (normalized === lastNormalizedRef.current) return;

    setIsLoading(true);
    setApiError(null);

    codeToNaturalLanguage(source)
      .then((result) => {
        setDescription(result);
        lastNormalizedRef.current = normalized;
      })
      .catch((e) => {
        setApiError(e instanceof Error ? e.message : 'Erreur inconnue');
      })
      .finally(() => {
        setIsLoading(false);
      });

  }, [dirty, source, status, lastOrigin]);


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
      const code = await naturalLanguageToCode(editValue, source, description);
      setSource(code, 'natural-lang');
      setDescription(editValue); // garder D' comme canonique
      lastNormalizedRef.current = normalizeForComparison(code);
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
          <Button
            label="Modifier"
            variant="secondary"
            size="sm"
            onClick={handleEdit}
            isDisabled={isLoading || !displayDescription}
          />
        ) : (
          <>
            <Button label="Annuler" variant="secondary" size="sm" onClick={handleCancel} isDisabled={isLoading} />
            <Button
              label={isLoading ? 'Conversion…' : 'Appliquer'}
              variant="primary"
              size="sm"
              onClick={handleApply}
              isDisabled={isLoading || !editValue.trim()}
            />
          </>
        )}
      </div>
    </div>
  );
}