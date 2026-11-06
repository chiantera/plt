import React from 'react';
import { signInLanguages, type SignInLanguage } from '../auth/authCopy';
import { setLanguage, t, useLanguage } from '../locale';

export default function WorkspaceLanguage() {
  const language = useLanguage();
  return (
    <select className="workspace-language" aria-label={t('Lingua')} value={language}
      onChange={event => setLanguage(event.target.value as SignInLanguage)}>
      {Object.entries(signInLanguages).map(([code, label]) => <option key={code} value={code} lang={code}>{label}</option>)}
    </select>
  );
}
