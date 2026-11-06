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

export function getLanguage(): SignInLanguage {
  return language;
}

export function setLanguage(next: SignInLanguage) {
  language = next;
  document.documentElement.lang = next;
  try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* Keep the in-memory selection. */ }
}

export function t(italian: string): string {
  return language === 'it' ? italian : workspaceCopy[italian]?.[language] ?? italian;
}
