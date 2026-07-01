import { useApiKeyStore } from './keyStore';

const BACKEND_URL = 'http://localhost:3001';

export async function codeToNaturalLanguage(code: string): Promise<string> {
  const { apiKey, setVerified } = useApiKeyStore.getState();

  if (!apiKey) throw new Error('Clé API manquante — veuillez entrer votre clé Anthropic.');

  const response = await fetch(`${BACKEND_URL}/api/to-natural-lang`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, apiKey }),
  });

  if (!response.ok) throw new Error(`Erreur backend : ${response.status}`);

  const data = await response.json();
  setVerified(); // première réponse réussie → clé vérifiée
  return data.result as string;
}

export async function naturalLanguageToCode(description: string): Promise<string> {
  const { apiKey, setVerified } = useApiKeyStore.getState();

  if (!apiKey) throw new Error('Clé API manquante — veuillez entrer votre clé Anthropic.');

  const response = await fetch(`${BACKEND_URL}/api/to-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, apiKey }),
  });

  if (!response.ok) throw new Error(`Erreur backend : ${response.status}`);

  const data = await response.json();
  setVerified();
  return data.result as string;
}

export async function verifyApiKey(): Promise<boolean> {
  const { apiKey, setVerified, clearApiKey } = useApiKeyStore.getState();

  if (!apiKey) return false;

  const response = await fetch(`${BACKEND_URL}/api/verify-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });

  if (!response.ok) return false;

  const data = await response.json();
  if (data.valid) {
    setVerified();
  } else {
    clearApiKey();
  }
  return data.valid;
}