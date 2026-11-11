type Falsy = false | null | undefined;

/** Join class names, skipping anything falsy: `cn('a', cond && 'b')`. */
export function cn(...parts: readonly (string | Falsy)[]): string {
  return parts.filter(Boolean).join(' ');
}
