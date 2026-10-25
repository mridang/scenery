/**
 * @packageDocumentation
 *
 * The HTTP framework seam: `serve` wraps the app with the security headers,
 * CSP, edge cache/limits and reporting, and `summariseReports` reads the CSP
 * report-to payloads. The rest of the modules here are its internals.
 */

export { serve } from './serve';
export type { ServeApp, ServeDeps, ServeEnv } from './serve';
export { summariseReports } from './csp-reports';
export type { ReportSummary } from './csp-reports';
