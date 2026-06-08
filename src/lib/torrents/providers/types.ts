/**
 * Construction options for the concrete torrent providers. The shared
 * fields live on {@link ProviderOptions}; apibay adds a category.
 */

/** Options common to every HTTP-backed provider. @public */
export interface ProviderOptions {
  /** Override the upstream base URL (tests / self-hosting). */
  readonly baseUrl?: string;
}

/** Options for {@link ApibayProvider}. @public */
export interface ApibayOptions extends ProviderOptions {
  /** apibay category id; `200` is video/movies. */
  readonly category?: string;
}
