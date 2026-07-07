/**
 * /api/keyStore.ts — Store pour la clé API Anthropic.
 *
 * La clé est fournie par l'utilisateur et gardée en mémoire côté client.
 * Statuts : 'missing' | 'unverified' | 'verified'
 */

import { create } from 'zustand';

export type ApiKeyStatus = 'missing' | 'unverified' | 'verified';

interface ApiKeyState {
  apiKey: string;
  status: ApiKeyStatus;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  setVerified: () => void;
}

export const useApiKeyStore = create<ApiKeyState>()((set) => ({
  apiKey: '',
  status: 'missing',
  setApiKey: (key) => set({ apiKey: key, status: 'unverified' }),
  clearApiKey: () => set({ apiKey: '', status: 'missing' }),
  setVerified: () => set({ status: 'verified' }),
}));