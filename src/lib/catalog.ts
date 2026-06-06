// Back-compat shim. The real implementation lives under `lib/catalog/`
// (CatalogRepository, ScoringEngine, ViewBuilder). New code should
// import from there directly.
export * from "./catalog/index";
