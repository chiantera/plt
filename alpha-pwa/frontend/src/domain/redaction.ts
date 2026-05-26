import type { CaseAnalysis, RedactionRule } from './types';

// ── Redaction helpers ─────────────────────────────────────────────────────────

export function redactString(text: string, rules: RedactionRule[]): string {
  return rules.reduce((t, r) => {
    if (!r.enabled || !r.original.trim()) return t;
    const escaped = r.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return t.replace(new RegExp(escaped, 'gi'), r.replacement);
  }, text);
}

export function redactObj<T>(obj: T, rules: RedactionRule[]): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return redactString(obj, rules) as unknown as T;
  if (Array.isArray(obj)) return (obj as unknown[]).map(item => redactObj(item, rules)) as unknown as T;
  if (typeof obj === 'object') {
    const result = {} as T;
    for (const key of Object.keys(obj as object) as (keyof T)[]) {
      (result as Record<string, unknown>)[key as string] = redactObj((obj as Record<string, unknown>)[key as string], rules);
    }
    return result;
  }
  return obj;
}

export function applyRedactionToCase(c: CaseAnalysis, rules: RedactionRule[]): CaseAnalysis {
  const active = rules.filter(r => r.enabled && r.original.trim());
  if (!active.length) return c;
  return redactObj(c, active);
}

export function mergeRedactionRules(global: RedactionRule[], perCase: RedactionRule[]): RedactionRule[] {
  const seen = new Set(global.map(r => r.id));
  return [...global, ...perCase.filter(r => !seen.has(r.id))];
}
