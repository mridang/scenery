import { languageName } from '@/lib/intl';

/**
 * Human-readable name for a language code. `'all'` is the cross-language
 * sentinel; `'?'` is the unknown language; a code `Intl.DisplayNames` cannot name falls back to its upper-cased form.
 */
export function languageLabel(code: string): string {
  if (code === 'all') {
    return 'All';
  }
  if (code === '?') {
    return 'Unknown';
  }
  const name = languageName(code);
  return name === code ? code.toUpperCase() : name;
}
