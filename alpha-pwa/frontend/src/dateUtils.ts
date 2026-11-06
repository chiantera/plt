function parseIsoDateAtNoon(value: string | null): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | null, language: 'it' | 'en' | 'de' = 'it'): string {
  if (!value) return { it: 'da definire', en: 'to be determined', de: 'noch festzulegen' }[language];
  const date = parseIsoDateAtNoon(value);
  if (!date) return { it: 'data non valida', en: 'invalid date', de: 'ungültiges Datum' }[language];
  return new Intl.DateTimeFormat(language, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function formatShortDate(value: string | null, language: 'it' | 'en' | 'de' = 'it'): string {
  if (!value) return '—';
  const date = parseIsoDateAtNoon(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(language, { day: '2-digit', month: 'short' }).format(date);
}

export function formatDateFull(value: string | null, language: 'it' | 'en' | 'de' = 'it'): string {
  if (!value) return { it: 'da definire', en: 'to be determined', de: 'noch festzulegen' }[language];
  const date = parseIsoDateAtNoon(value);
  if (!date) return { it: 'data non valida', en: 'invalid date', de: 'ungültiges Datum' }[language];
  if (language !== 'it') return new Intl.DateTimeFormat(language, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  return `${days[date.getDay()]} ${new Intl.DateTimeFormat(language, { day: '2-digit', month: 'short', year: 'numeric' }).format(date)}`;
}
