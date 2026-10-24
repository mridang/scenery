/**
 * ISO 639-1 language-code vocabulary. The catalog stores TMDB's
 * `original_language` codes; the UI shows human names. This is the
 * single place that mapping lives.
 *
 * @public
 */
const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  en: 'English',
  hi: 'Hindi',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ta: 'Tamil',
  te: 'Telugu',
  ml: 'Malayalam',
  th: 'Thai',
  tr: 'Turkish',
  pl: 'Polish',
  sv: 'Swedish',
  da: 'Danish',
  nl: 'Dutch',
  no: 'Norwegian',
  fi: 'Finnish',
  ar: 'Arabic',
  '?': 'Unknown',
};

/**
 * Human-readable name for a language code. `'all'` is the cross-language
 * sentinel; unknown codes fall back to their upper-cased form.
 */
export function languageLabel(code: string): string {
  if (code === 'all') {
    return 'All';
  }
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}
