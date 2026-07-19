/**
 * ApiKeyInput — gestion de la clé API Anthropic (vue Langage naturel).
 *
 * UI Astryx : un bouton-pastille (StatusDot + Button ghost) dans l'en-tête du
 * panneau ouvre un Popover contenant le formulaire (TextInput password avec
 * statut de validation intégré, actions Sauvegarder/Supprimer). La logique
 * (validation, vérification via le proxy, stockage local) est inchangée.
 */

import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Popover } from '@astryxdesign/core/Popover';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { HStack, Stack } from '@astryxdesign/core/Stack';
import { useApiKeyStore } from './keyStore';
import { verifyApiKey } from './client';

function validateKey(key: string): string | null {
  if (!key.trim()) return 'La clé ne peut pas être vide.';
  if (!key.startsWith('sk-ant-')) return 'La clé doit commencer par sk-ant-.';
  if (key.length < 100) return 'La clé semble trop courte.';
  return null;
}

const STATUS_CONFIG = {
  missing: { variant: 'error' as const, label: 'Clé API manquante' },
  unverified: { variant: 'warning' as const, label: 'Clé API non vérifiée' },
  verified: { variant: 'success' as const, label: 'Clé API vérifiée' },
};

export function ApiKeyInput() {
  const apiKey = useApiKeyStore((s) => s.apiKey);
  const status = useApiKeyStore((s) => s.status);
  const setApiKey = useApiKeyStore((s) => s.setApiKey);
  const clearApiKey = useApiKeyStore((s) => s.clearApiKey);

  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const { variant, label } = STATUS_CONFIG[status];

  async function handleSave() {
    const error = validateKey(inputValue);
    if (error) { setValidationError(error); return; }

    setApiKey(inputValue.trim());
    setValidationError(null);
    setIsVerifying(true);

    try {
      const valid = await verifyApiKey();
      if (!valid) {
        setValidationError('Clé invalide ou refusée par Anthropic.');
        return; // on reste ouvert pour que l'utilisateur corrige
      }
      setInputValue('');
      setIsOpen(false);
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : 'Erreur de vérification.');
    } finally {
      setIsVerifying(false);
    }
  }

  function handleClear() {
    clearApiKey();
    setInputValue('');
    setValidationError(null);
  }

  const formContent =
    apiKey && status === 'verified' ? (
      <HStack gap={2} vAlign="center">
        <Text type="code" size="sm">sk-ant-••••••••••••••••</Text>
        <Button label="Supprimer" variant="destructive" size="sm" onClick={handleClear} />
      </HStack>
    ) : (
      <Stack gap={2}>
        <Text type="supporting" size="sm" as="p">
          Entrez votre clé API Anthropic. Elle ne sera jamais stockée sur un serveur.
        </Text>
        <TextInput
          label="Clé API Anthropic"
          isLabelHidden
          type={showKey ? 'text' : 'password'}
          value={inputValue}
          onChange={(v: string) => { setInputValue(v); setValidationError(null); }}
          placeholder="sk-ant-api03-..."
          isDisabled={isVerifying}
          status={validationError ? { type: 'error', message: validationError } : undefined}
        />
        <HStack gap={1.5} vAlign="center">
          <Button
            label={showKey ? 'Masquer la clé' : 'Afficher la clé'}
            variant="ghost"
            size="sm"
            onClick={() => setShowKey((v) => !v)}
          />
          <Button
            label={isVerifying ? 'Vérification…' : 'Sauvegarder'}
            variant="primary"
            size="sm"
            isLoading={isVerifying}
            isDisabled={!inputValue.trim() || isVerifying}
            onClick={handleSave}
          />
        </HStack>
      </Stack>
    );

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      label="Clé API Anthropic"
      placement="below"
      content={<Stack gap={2} padding={2}>{formContent}</Stack>}
    >
      <Button
        label={label}
        variant="ghost"
        size="sm"
        icon={<StatusDot variant={variant} label={label} />}
      />
    </Popover>
  );
}
