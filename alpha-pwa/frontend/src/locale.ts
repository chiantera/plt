import { useSyncExternalStore } from 'react';
import type { SignInLanguage } from './auth/authCopy';
import { workspaceCopy } from './workspaceCopy';

const LANGUAGE_KEY = 'plt:sign-in-language';

function initialLanguage(): SignInLanguage {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === 'en' || saved === 'de') return saved;
  } catch { /* Storage is optional. */ }
  return 'it';
}

let language = initialLanguage();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useLanguage() {
  return useSyncExternalStore(subscribe, getLanguage);
}

export function apiFetch(url: string, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  headers.set('Accept-Language', getLanguage());
  return fetch(url, { ...options, headers });
}

export function getLanguage(): SignInLanguage {
  return language;
}

export function setLanguage(next: SignInLanguage) {
  if (next === language) return;
  language = next;
  document.documentElement.lang = next;
  try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* Keep the in-memory selection. */ }
  listeners.forEach(listener => listener());
}

export function t(italian: string): string {
  return language === 'it' ? italian : workspaceCopy[italian]?.[language] ?? italian;
}

export async function apiError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(typeof body?.detail === 'string' ? body.detail : `${t('Errore')} ${response.status}`);
}
