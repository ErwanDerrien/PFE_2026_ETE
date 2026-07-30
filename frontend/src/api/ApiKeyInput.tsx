import { useState } from 'react';
import { useApiKeyStore } from './keyStore';
import { verifyApiKey } from './client';
import { Button } from '@astryxdesign/core/Button';
import './ApiKeyInput.css';

function validateKey(key: string): string | null {
  if (!key.trim()) return 'La clé ne peut pas être vide.';
  if (!key.startsWith('sk-ant-')) return 'La clé doit commencer par sk-ant-.';
  if (key.length < 100) return 'La clé semble trop courte.';
  return null;
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: up ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s'
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

const STATUS_CONFIG = {
  missing: {
    dot: 'dot--missing',
    label: 'Clé API manquante'
  },
  unverified: {
    dot: 'dot--unverified',
    label: 'Clé API non vérifiée'
  },
  verifying: {
    dot: 'dot--verifying',
    label: 'Vérification en cours...'
  },
  verified: {
    dot: 'dot--verified',
    label: 'Clé API vérifiée'
  },
  invalid: {
    dot: 'dot--invalid',
    label: 'Clé API invalide'
  },
};

export function ApiKeyInput() {
  const apiKey = useApiKeyStore((s) => s.apiKey);
  const status = useApiKeyStore((s) => s.status);
  const setApiKey = useApiKeyStore((s) => s.setApiKey);
  const clearApiKey = useApiKeyStore((s) => s.clearApiKey);

  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationFailed, setVerificationFailed] = useState(false);

  const displayStatus = isVerifying
    ? 'verifying'
    : verificationFailed
      ? 'invalid'
      : status;

  const { dot, label } = STATUS_CONFIG[displayStatus];

  async function handleSave() {
    const error = validateKey(inputValue);

    if (error) {
      setValidationError(error);
      return;
    }

    setApiKey(inputValue.trim());
    setValidationError(null);
    setVerificationFailed(false);
    setIsVerifying(true);

    try {
      const valid = await verifyApiKey();

      if (!valid) {
        setVerificationFailed(true);
        setValidationError('Clé invalide ou refusée par Anthropic.');
        return;
      }

      setInputValue('');
      setIsExpanded(false);

    } catch (e) {
      setVerificationFailed(true);
      setValidationError(
        e instanceof Error
          ? e.message
          : 'Erreur de vérification.'
      );

    } finally {
      setIsVerifying(false);
    }
  }

  function handleClear() {
    clearApiKey();
    setInputValue('');
    setValidationError(null);
    setVerificationFailed(false);
    setIsExpanded(true);
  }

  return (
    <div className="akw">

      <button
        className="akw__pill"
        onClick={() => setIsExpanded(p => !p)}
      >
        <span className={`akw__dot ${dot}`} />
        <span className="akw__label">{label}</span>
        <ChevronIcon up={isExpanded} />
      </button>


      {isExpanded && (
        <div className="akw__panel">

          {apiKey && displayStatus === 'verified' ? (

            <div className="akw__row">
              <span className="akw__masked">
                sk-ant-••••••••••••••••
              </span>

              <Button
                label="Supprimer"
                variant="secondary"
                size="sm"
                onClick={handleClear}
              />
            </div>

          ) : (

            <>
              <p className="akw__hint">
                Entrez votre clé API Anthropic. Elle ne sera jamais stockée sur un serveur.
              </p>


              <div className="akw__row">

                <div className="akw__input-wrap">

                  <input
                    className="akw__input"
                    type={showKey ? 'text' : 'password'}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      setValidationError(null);
                      setVerificationFailed(false);
                    }}
                    placeholder="sk-ant-api03-..."
                    onKeyDown={(e) =>
                      e.key === 'Enter' && handleSave()
                    }
                    autoComplete="off"
                    spellCheck={false}
                    disabled={isVerifying}
                  />


                  <button
                    className="akw__eye"
                    onClick={() => setShowKey(v => !v)}
                    title={showKey ? 'Masquer' : 'Afficher'}
                    tabIndex={-1}
                  >
                    <EyeIcon open={showKey} />
                  </button>

                </div>


                <Button
                  label={isVerifying ? 'Vérification…' : 'Sauvegarder'}
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  isDisabled={!inputValue.trim() || isVerifying}
                />

              </div>


              {validationError && (
                <p className="akw__error">
                  {validationError}
                </p>
              )}

            </>
          )}

        </div>
      )}

    </div>
  );
}