/**
 * @packageDocumentation
 *
 * The typefaces and the page frame's own classes: what the root layout puts on
 * `<html>` and `<body>`. Per app, with the same export names in every app, so
 * the layout itself is shared.
 */

import { Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google';

/** The body and heading face. */
const sans = Plus_Jakarta_Sans({
  variable: '--font-sans-face',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

/** The face for numbers, scores and small labels. */
const mono = Geist_Mono({
  variable: '--font-mono-face',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

/** The classes of `<html>`: the font variables, and the base type setting. */
export const HTML_CLASS = `${sans.variable} ${mono.variable} h-full antialiased`;

/** The classes of `<body>`: a column that fills the screen, in the body face. */
export const BODY_CLASS =
  'flex min-h-full flex-col overflow-x-hidden font-sans';

/** Extra attributes for `<html>`, such as the one a theme switcher sets. */
export const HTML_ATTRIBUTES: Readonly<Record<string, string>> = {};
