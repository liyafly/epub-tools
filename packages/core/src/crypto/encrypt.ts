import { notImplemented } from "../utils/errors";

export async function encryptFilenames(epubPath: string, outDir?: string): Promise<void> {
  notImplemented(`encryptFilenames(${epubPath}${outDir ? ` -> ${outDir}` : ""})`);
}
