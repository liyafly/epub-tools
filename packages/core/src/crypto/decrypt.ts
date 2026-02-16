import { notImplemented } from "../utils/errors";

export async function decryptFilenames(epubPath: string, outDir?: string): Promise<void> {
  notImplemented(`decryptFilenames(${epubPath}${outDir ? ` -> ${outDir}` : ""})`);
}
