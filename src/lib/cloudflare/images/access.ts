/**
 * @packageDocumentation
 *
 * Which pictures anyone may ask the proxy for. The pages show posters of
 * public movies and ask for them by TMDB address, and the proxy only fetches
 * from the hosts in `site.ts`, so it is no relay for the rest of the web and
 * needs no other check.
 */

/** Nobody is turned away before the address is looked at. */
export async function authenticate(): Promise<Response | undefined> {
  return undefined;
}

/** This app does not sign its picture addresses: the host allow-list is the rule. */
export function signatureFor(): string | undefined {
  return undefined;
}

/** This app does not sign its picture addresses, so there is nothing to check. */
export async function signatureValid(): Promise<boolean> {
  return true;
}

/** Any picture on an allowed host may be fetched. */
export async function mayFetch(): Promise<boolean> {
  return true;
}
