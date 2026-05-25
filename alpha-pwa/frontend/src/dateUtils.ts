function parseIsoDateAtNoon(value: string | null): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | null): string {
  if (!value) return 'da definire';
  const date = parseIsoDateAtNoon(value);
  if (!date) return 'data non valida';
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function formatShortDate(value: string | null): string {
  if (!value) return '—';
  const date = parseIsoDateAtNoon(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(date);
}

export function formatDateFull(value: string | null): string {
  if (!value) return 'da definire';
  const date = parseIsoDateAtNoon(value);
  if (!date) return 'data non valida';
  const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  return `${days[date.getDay()]} ${new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)}`;
}
