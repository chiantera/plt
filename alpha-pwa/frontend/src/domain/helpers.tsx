import { ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
import React from 'react';

export function riskColor(level: string | null) {
  return ({ critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' })[level ?? ''] ?? '#94a3b8';
}

export function riskLabel(level: string | null) {
  return ({ critical: 'Critico', high: 'Alto', medium: 'Medio', low: 'Basso' })[level ?? ''] ?? '—';
}

export function riskIcon(level: string | null) {
  if (level === 'critical' || level === 'high') return <ShieldOff size={16} />;
  if (level === 'medium') return <ShieldAlert size={16} />;
  return <ShieldCheck size={16} />;
}
