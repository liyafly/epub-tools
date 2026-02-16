import { notImplemented } from "../utils/errors";

export async function reformatEpub(epubPath: string, outDir?: string): Promise<void> {
  notImplemented(`reformatEpub(${epubPath}${outDir ? ` -> ${outDir}` : ""})`);
}
