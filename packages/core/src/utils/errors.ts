export function notImplemented(feature: string): never {
  throw new Error(`${feature} is not implemented yet. This stub marks planned TS rewrite work.`);
}
